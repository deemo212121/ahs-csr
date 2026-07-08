import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getFirebaseAdminAuth } from '@/lib/firebase/admin';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { getErSupabaseAdmin, isErSupabaseConfigured } from '@/lib/supabase/er-admin';
import { resolveDefaultCompanyId } from '@/lib/er-ticket-database';
import { normalizePhone } from '@/lib/er-customer-links';
import { getCompanyBySlug } from '@/lib/firebase/firestore-admin';

const registerSchema = z.object({
  first_name: z.string().min(1),
  last_name: z.string().min(1),
  phone_number: z.string().optional(),
  address: z.string().optional(),
  region: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  zip_code: z.string().optional(),
  company_id: z.string().uuid().optional(),
  company_slug: z.string().optional(),
});

const profileSelect = 'id, firebase_uid, supabase_user_id, company_id, role, first_name, last_name, email, phone_number, address, region, city, state, zip_code, is_active, created_at';

// A company_slug (from /login/[companyId] -> /customer/register/[companyId])
// always wins over a client-supplied company_id — the slug gets re-resolved
// against Firestore here rather than trusting whatever UUID the browser sent,
// since that resolution is what actually assigns tenancy.
async function resolveRegistrationCompanyId(chosen: string | undefined, slug: string | undefined): Promise<string> {
  if (slug) {
    const company = await getCompanyBySlug(slug);
    if (company && company.isActive) return company.erCompanyId;
  }
  if (chosen) return chosen;
  if (!isErSupabaseConfigured()) {
    throw new Error('No company was selected and none could be resolved automatically.');
  }
  const erSupabase = getErSupabaseAdmin();
  if (!erSupabase) throw new Error('No company was selected and none could be resolved automatically.');
  return resolveDefaultCompanyId(erSupabase);
}

// Called right after createUserWithEmailAndPassword() on the client, while
// the customer only has a fresh Firebase ID token — there's no profile row
// yet, so this can't go through the normal getAuthContext() flow. Verifies
// the token directly instead and creates the row itself.
export async function POST(request: NextRequest) {
  try {
    const header = request.headers.get('authorization') ?? '';
    const token = header.match(/^Bearer\s+(.+)$/i)?.[1];
    if (!token) throw new Error('Missing bearer token.');

    const decoded = await getFirebaseAdminAuth().verifyIdToken(token);
    const email = decoded.email ?? '';
    if (!email) throw new Error('This Firebase account has no email on file.');

    const body = registerSchema.parse(await request.json());
    const supabaseAdmin = getSupabaseAdmin();

    const { data: existing, error: existingError } = await supabaseAdmin
      .from('profiles')
      .select(profileSelect)
      .eq('firebase_uid', decoded.uid)
      .maybeSingle();
    if (existingError) throw new Error(existingError.message);
    if (existing) {
      return NextResponse.json({ profile: existing });
    }

    // profiles.email is unique. If this email already has a row (a customer
    // who registered back when auth was Supabase-only, or a retried
    // registration), link this Firebase uid to it instead of inserting a
    // second row and hitting profiles_email_key.
    const { data: byEmail, error: byEmailError } = await supabaseAdmin
      .from('profiles')
      .select(profileSelect)
      .eq('email', email)
      .maybeSingle();
    if (byEmailError) throw new Error(byEmailError.message);

    if (byEmail) {
      if (byEmail.firebase_uid && byEmail.firebase_uid !== decoded.uid) {
        throw new Error('This email is already linked to a different account.');
      }
      const { data: linked, error: linkError } = await supabaseAdmin
        .from('profiles')
        .update({
          firebase_uid: decoded.uid,
          first_name: byEmail.first_name || body.first_name,
          last_name: byEmail.last_name || body.last_name,
          phone_number: byEmail.phone_number || body.phone_number || null,
          address: byEmail.address || body.address || null,
          region: byEmail.region || body.region || null,
          city: byEmail.city || body.city || null,
          state: byEmail.state || body.state || null,
          zip_code: byEmail.zip_code || body.zip_code || null,
        })
        .eq('id', byEmail.id)
        .select(profileSelect)
        .single();

      if (linkError || !linked) {
        throw new Error(linkError?.message ?? 'Unable to link this account.');
      }

      return NextResponse.json({ profile: linked });
    }

    // A shared phone number auto-links two different customer accounts to
    // the same ER customer record (see src/lib/er-customer-links.ts), which
    // then merges their ticket history together — surfacing one account's
    // tickets on the other's dashboard. Block it at registration instead of
    // letting that happen silently.
    const normalizedPhone = normalizePhone(body.phone_number);
    if (normalizedPhone) {
      const { data: phoneMatches, error: phoneError } = await supabaseAdmin
        .from('profiles')
        .select('id')
        .eq('role', 'customer')
        .eq('phone_number', normalizedPhone)
        .limit(1);
      if (phoneError) throw new Error(phoneError.message);
      if (phoneMatches?.length) {
        throw new Error('This phone number is already registered to another account. Please use a different phone number.');
      }
    }

    const companyId = await resolveRegistrationCompanyId(body.company_id, body.company_slug);
    const { data: created, error: createError } = await supabaseAdmin
      .from('profiles')
      .insert({
        firebase_uid: decoded.uid,
        supabase_user_id: null,
        company_id: companyId,
        role: 'customer',
        email,
        first_name: body.first_name,
        last_name: body.last_name,
        phone_number: normalizedPhone || body.phone_number || null,
        address: body.address || null,
        region: body.region || null,
        city: body.city || null,
        state: body.state || null,
        zip_code: body.zip_code || null,
        is_active: true,
      })
      .select(profileSelect)
      .single();

    if (createError || !created) {
      throw new Error(createError?.message ?? 'Unable to create customer profile.');
    }

    return NextResponse.json({ profile: created }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : 'Unable to register customer account.' },
      { status: 400 },
    );
  }
}

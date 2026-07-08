import { NextResponse } from 'next/server';
import { getErSupabaseAdmin, isErSupabaseConfigured } from '@/lib/supabase/er-admin';
import { listErCompanies } from '@/lib/er-ticket-database';

// Public, unauthenticated: the registration page needs this list before the
// customer has any account. Only ever returns id + display name.
export async function GET() {
  try {
    if (!isErSupabaseConfigured()) {
      return NextResponse.json({ companies: [] });
    }
    const erSupabase = getErSupabaseAdmin();
    if (!erSupabase) {
      return NextResponse.json({ companies: [] });
    }

    const companies = await listErCompanies(erSupabase);
    return NextResponse.json({ companies });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : 'Unable to load companies.' },
      { status: 400 },
    );
  }
}

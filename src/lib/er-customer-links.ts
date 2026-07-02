import type { SupabaseClient } from '@supabase/supabase-js';
import type { AppProfile } from '@/lib/types';
import { getErSupabaseAdmin, isErSupabaseConfigured } from '@/lib/supabase/er-admin';

export type ErCustomerLink = {
  id: string;
  local_customer_id: string;
  er_customer_id: string;
  er_customer_name: string | null;
  er_customer_phone: string | null;
  er_customer_second_phone: string | null;
  er_customer_email: string | null;
  er_customer_city: string | null;
  er_customer_state: string | null;
  er_customer_zip: string | null;
  match_method: string;
  match_confidence: string;
  match_score: number;
  matched_at: string;
  updated_at: string;
};

type ErCustomerRow = Record<string, unknown>;

const erCustomerColumns = [
  'id',
  'full_name',
  'first_name',
  'last_name',
  'phone',
  'second_phone',
  'email',
  'address',
  'address2',
  'city',
  'state',
  'zip',
  'address_note',
  'created_at',
].join(', ');

function cleanString(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function normalizeEmail(value?: string | null) {
  return value?.trim().toLowerCase() || null;
}

export function normalizePhone(value?: string | null) {
  const digits = value?.replace(/\D/g, '') || '';
  if (!digits) return null;
  return digits.length > 10 ? digits.slice(-10) : digits;
}

function normalizeName(value?: string | null) {
  return value
    ?.toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim() || null;
}

function profileFullName(profile: Pick<AppProfile, 'first_name' | 'last_name' | 'email'>) {
  return [profile.first_name, profile.last_name].filter(Boolean).join(' ').trim() || profile.email || '';
}

function erCustomerName(customer: ErCustomerRow) {
  const fullName = cleanString(customer.full_name);
  if (fullName) return fullName;
  return [cleanString(customer.first_name), cleanString(customer.last_name)].filter(Boolean).join(' ').trim() || null;
}

function getErCustomersTable() {
  return process.env.ER_SUPABASE_CUSTOMERS_TABLE?.trim() || 'customers';
}

function matchCustomer(profile: AppProfile, customer: ErCustomerRow) {
  const profileEmail = normalizeEmail(profile.email);
  const profilePhone = normalizePhone(profile.phone_number);
  const profileName = normalizeName(profileFullName(profile));
  const profileFirst = normalizeName(profile.first_name);
  const profileLast = normalizeName(profile.last_name);

  const erEmail = normalizeEmail(cleanString(customer.email));
  const erPhone = normalizePhone(cleanString(customer.phone));
  const erSecondPhone = normalizePhone(cleanString(customer.second_phone));
  const erName = normalizeName(erCustomerName(customer));
  const erFirst = normalizeName(cleanString(customer.first_name));
  const erLast = normalizeName(cleanString(customer.last_name));

  const phoneMatched = Boolean(profilePhone && (profilePhone === erPhone || profilePhone === erSecondPhone));
  const emailMatched = Boolean(profileEmail && erEmail && profileEmail === erEmail);
  const fullNameMatched = Boolean(profileName && erName && profileName === erName);
  const splitNameMatched = Boolean(profileFirst && profileLast && erFirst && erLast && profileFirst === erFirst && profileLast === erLast);

  // Do not auto-link by name only. Phone is the main proof, email is secondary proof.
  if (!phoneMatched && !emailMatched) return null;

  let score = 0;
  if (phoneMatched) score += 80;
  if (emailMatched) score += 90;
  if (fullNameMatched) score += 15;
  if (splitNameMatched) score += 10;

  const method = phoneMatched && emailMatched ? 'phone_email' : phoneMatched ? 'phone' : 'email';
  const confidence = phoneMatched && emailMatched ? 'high' : fullNameMatched || splitNameMatched ? 'good' : 'medium';

  return {
    match_method: method,
    match_confidence: confidence,
    match_score: score,
  };
}

// Looser than matchCustomer: allows a name-only match. Used only for the
// staff-side ticket board matcher below (a human reviews the conversation),
// never for the customer-authenticated auto-link flow above, where linking
// a stranger's ticket by name alone would be a privacy risk.
function matchCustomerByName(profile: AppProfile, customer: ErCustomerRow) {
  const profileName = normalizeName(profileFullName(profile));
  const profileFirst = normalizeName(profile.first_name);
  const profileLast = normalizeName(profile.last_name);

  const erName = normalizeName(erCustomerName(customer));
  const erFirst = normalizeName(cleanString(customer.first_name));
  const erLast = normalizeName(cleanString(customer.last_name));

  const fullNameMatched = Boolean(profileName && erName && profileName === erName);
  const splitNameMatched = Boolean(profileFirst && profileLast && erFirst && erLast && profileFirst === erFirst && profileLast === erLast);

  if (!fullNameMatched && !splitNameMatched) return null;

  return {
    match_method: 'name',
    match_confidence: 'low',
    match_score: fullNameMatched && splitNameMatched ? 30 : 20,
  };
}

async function readAllErCustomers() {
  if (!isErSupabaseConfigured()) return [] as ErCustomerRow[];
  const erSupabase = getErSupabaseAdmin();
  if (!erSupabase) return [] as ErCustomerRow[];

  const limit = Math.min(Math.max(Number(process.env.ER_CUSTOMER_MATCH_SCAN_LIMIT ?? 10000), 100), 50000);
  const { data, error } = await erSupabase
    .from(getErCustomersTable())
    .select(erCustomerColumns)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) return [] as ErCustomerRow[];
  return (data ?? []) as unknown as ErCustomerRow[];
}

export async function ensureErCustomerLinksForProfile(
  supabaseAdmin: SupabaseClient,
  profile: AppProfile,
) {
  if (profile.role !== 'customer') return [] as ErCustomerLink[];

  const erCustomers = await readAllErCustomers();
  if (!erCustomers.length) return [] as ErCustomerLink[];

  const matches = erCustomers
    .map((customer) => {
      const erCustomerId = cleanString(customer.id);
      if (!erCustomerId) return null;
      const match = matchCustomer(profile, customer);
      if (!match) return null;
      return {
        local_customer_id: profile.id,
        er_customer_id: erCustomerId,
        er_customer_name: erCustomerName(customer),
        er_customer_phone: cleanString(customer.phone),
        er_customer_second_phone: cleanString(customer.second_phone),
        er_customer_email: cleanString(customer.email),
        er_customer_city: cleanString(customer.city),
        er_customer_state: cleanString(customer.state),
        er_customer_zip: cleanString(customer.zip),
        match_method: match.match_method,
        match_confidence: match.match_confidence,
        match_score: match.match_score,
        matched_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
    })
    .filter((row): row is Omit<ErCustomerLink, 'id'> => Boolean(row));

  if (!matches.length) return [] as ErCustomerLink[];

  // This is local DB only. If the setup SQL has not been run yet, do not break the UI.
  const { error } = await supabaseAdmin
    .from('customer_er_links')
    .upsert(matches, { onConflict: 'local_customer_id,er_customer_id' });

  if (error) {
    return matches.map((row) => ({
      id: `${row.local_customer_id}:${row.er_customer_id}`,
      ...row,
    })) as ErCustomerLink[];
  }

  const { data } = await supabaseAdmin
    .from('customer_er_links')
    .select('*')
    .eq('local_customer_id', profile.id);

  return (data ?? []) as ErCustomerLink[];
}

// Bulk version of ensureErCustomerLinksForProfile, for staff-side flows (e.g.
// building ER ticket board conversations) that need to match many ER
// customers against the local customer directory at once. Persists matches
// into customer_er_links (same table the customer-portal linking uses) so
// they're inspectable directly in Supabase and reused on the next run.
export async function matchErCustomersToLocalProfiles(
  supabaseAdmin: SupabaseClient,
  erCustomers: ErCustomerRow[],
): Promise<Map<string, string>> {
  const result = new Map<string, string>();
  const candidateIds = erCustomers
    .map((customer) => cleanString(customer.id))
    .filter((id): id is string => Boolean(id));
  if (!candidateIds.length) return result;

  const { data: existingLinks } = await supabaseAdmin
    .from('customer_er_links')
    .select('local_customer_id, er_customer_id')
    .in('er_customer_id', candidateIds);

  const linkedErIds = new Set<string>();
  for (const row of (existingLinks ?? []) as Array<{ local_customer_id: string; er_customer_id: string }>) {
    result.set(row.er_customer_id, row.local_customer_id);
    linkedErIds.add(row.er_customer_id);
  }

  const unlinkedCustomers = erCustomers.filter((customer) => {
    const id = cleanString(customer.id);
    return id && !linkedErIds.has(id);
  });
  if (!unlinkedCustomers.length) return result;

  const { data: profiles, error: profilesError } = await supabaseAdmin
    .from('profiles')
    .select('id, email, phone_number, first_name, last_name')
    .eq('role', 'customer')
    .limit(10000);
  if (profilesError || !profiles?.length) return result;

  const localProfiles = profiles as AppProfile[];
  const newLinks: Omit<ErCustomerLink, 'id'>[] = [];

  for (const customer of unlinkedCustomers) {
    const erCustomerId = cleanString(customer.id);
    if (!erCustomerId) continue;

    let best: { profile: AppProfile; score: number; method: string; confidence: string } | null = null;
    for (const profile of localProfiles) {
      const match = matchCustomer(profile, customer) ?? matchCustomerByName(profile, customer);
      if (!match) continue;
      if (!best || match.match_score > best.score) {
        best = { profile, score: match.match_score, method: match.match_method, confidence: match.match_confidence };
      }
    }
    if (!best) continue;

    result.set(erCustomerId, best.profile.id);
    newLinks.push({
      local_customer_id: best.profile.id,
      er_customer_id: erCustomerId,
      er_customer_name: erCustomerName(customer),
      er_customer_phone: cleanString(customer.phone),
      er_customer_second_phone: cleanString(customer.second_phone),
      er_customer_email: cleanString(customer.email),
      er_customer_city: cleanString(customer.city),
      er_customer_state: cleanString(customer.state),
      er_customer_zip: cleanString(customer.zip),
      match_method: best.method,
      match_confidence: best.confidence,
      match_score: best.score,
      matched_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
  }

  if (newLinks.length) {
    await supabaseAdmin
      .from('customer_er_links')
      .upsert(newLinks, { onConflict: 'local_customer_id,er_customer_id' });
  }

  return result;
}

export async function getLinkedErCustomerIds(
  supabaseAdmin: SupabaseClient,
  profile: AppProfile,
) {
  if (profile.role !== 'customer') return [] as string[];

  await ensureErCustomerLinksForProfile(supabaseAdmin, profile);

  const { data, error } = await supabaseAdmin
    .from('customer_er_links')
    .select('er_customer_id')
    .eq('local_customer_id', profile.id);

  if (error) {
    const fallbackLinks = await ensureErCustomerLinksForProfile(supabaseAdmin, profile);
    return Array.from(new Set(fallbackLinks.map((link) => link.er_customer_id).filter(Boolean)));
  }

  return Array.from(new Set(((data ?? []) as Array<Record<string, unknown>>)
    .map((row: Record<string, unknown>) => cleanString(row.er_customer_id))
    .filter((id): id is string => Boolean(id))));
}

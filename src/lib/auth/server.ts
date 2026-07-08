import type { NextRequest } from 'next/server';
import { getFirebaseAdminAuth } from '@/lib/firebase/admin';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { getErSupabaseAdmin, isErSupabaseConfigured } from '@/lib/supabase/er-admin';
import { resolveDefaultCompanyId } from '@/lib/er-ticket-database';
import type { AppProfile, AppRole } from '@/lib/types';

// Safety net only — normal registration always saves a real company_id
// chosen at signup. This only fires for accounts auto-provisioned outside
// that flow (e.g. a first Supabase-session login for a pre-migration
// customer with no row yet).
async function resolveFallbackCompanyId(): Promise<string> {
  if (!isErSupabaseConfigured()) {
    throw new Error('Unable to resolve a default company for this account — ER Supabase is not configured.');
  }
  const erSupabase = getErSupabaseAdmin();
  if (!erSupabase) throw new Error('Unable to resolve a default company for this account.');
  return resolveDefaultCompanyId(erSupabase);
}

export type ProfileSource = 'local' | 'er' | 'test';

export type AuthContext = {
  firebaseUid: string | null;
  firebaseIdToken: string | null;
  supabaseUserId: string | null;
  email: string;
  role: AppRole;
  profile: AppProfile;
  profileSource: ProfileSource;
};

const validRoles = new Set<AppRole>(['customer', 'csr', 'team_leader', 'csr_manager', 'admin']);

const testProfiles: Record<AppRole, AppProfile> = {
  customer: {
    id: '10000000-0000-4000-8000-000000000001',
    firebase_uid: null,
    supabase_user_id: '20000000-0000-4000-8000-000000000001',
    role: 'customer',
    first_name: 'Bubble',
    last_name: 'Max',
    email: 'bubblemax@gmail.com',
    phone_number: '9248375123',
    is_active: true,
  },
  csr: {
    id: '10000000-0000-4000-8000-000000000002',
    firebase_uid: 'test-csr',
    supabase_user_id: null,
    role: 'csr',
    first_name: 'Anne',
    last_name: 'Murray Lorico',
    email: 'murray.lorico10@gmail.com',
    phone_number: null,
    is_active: true,
  },
  team_leader: {
    id: '10000000-0000-4000-8000-000000000003',
    firebase_uid: 'test-team_leader',
    supabase_user_id: null,
    role: 'team_leader',
    first_name: 'Rochelle',
    last_name: 'Ortiz',
    email: 'team.leader@ushs.local',
    phone_number: null,
    is_active: true,
  },
  csr_manager: {
    id: '10000000-0000-4000-8000-000000000004',
    firebase_uid: 'test-csr_manager',
    supabase_user_id: null,
    role: 'csr_manager',
    first_name: 'CSR',
    last_name: 'Manager',
    email: 'manager@ushs.local',
    phone_number: null,
    is_active: true,
  },
  admin: {
    id: '10000000-0000-4000-8000-000000000005',
    firebase_uid: 'test-admin',
    supabase_user_id: null,
    role: 'admin',
    first_name: 'Admin',
    last_name: 'Hub',
    email: 'admin@ushs.local',
    phone_number: null,
    is_active: true,
  },
};

function normalizeRole(value: unknown): AppRole | null {
  if (typeof value !== 'string') return null;
  return validRoles.has(value as AppRole) ? (value as AppRole) : null;
}

function normalizeErStaffRole(value: unknown): Exclude<AppRole, 'customer'> | null {
  if (typeof value !== 'string') return null;

  const raw = value.trim();
  const upper = raw.toUpperCase();
  const spaced = raw.toLowerCase().replace(/\s+/g, ' ').trim();

  if (upper === 'ADMIN' || upper === 'SUPERADMIN' || spaced === 'admin') {
    return 'admin';
  }

  // The ER database uses the display role "CSR Manager".
  // Keep this strict so CSR_MANAGER / MANAGER / Parts Manager are not accepted as CSR Manager accounts.
  if (spaced === 'csr manager' && !raw.includes('_')) {
    return 'csr_manager';
  }

  if (upper === 'CSR_TEAM_LEADER') {
    return 'team_leader';
  }

  if (upper === 'CSR_AGENT') {
    return 'csr';
  }

  return null;
}

type ErStaffProfileRow = {
  id: string;
  firebase_uid: string | null;
  company_id: string | null;
  email: string | null;
  username: string | null;
  display_name: string | null;
  role: string | null;
  phone_number: string | null;
  is_active: boolean | null;
  assigned_branch: string | null;
  branch_access: string | null;
  created_at: string | null;
};

function splitDisplayName(value: string) {
  const parts = value.trim().split(/\s+/).filter(Boolean);
  return {
    firstName: parts[0] ?? '',
    lastName: parts.slice(1).join(' '),
  };
}

function mapErStaffProfile(row: ErStaffProfileRow, role: Exclude<AppRole, 'customer'>): AppProfile {
  const displayName = row.display_name?.trim() || row.username?.trim() || row.email?.split('@')[0] || 'ER Staff';
  const { firstName, lastName } = splitDisplayName(displayName);

  return {
    id: row.id,
    firebase_uid: row.firebase_uid,
    supabase_user_id: null,
    company_id: row.company_id,
    role,
    first_name: firstName,
    last_name: lastName,
    email: row.email ?? '',
    phone_number: row.phone_number,
    region: row.assigned_branch,
    branch_access: row.branch_access,
    is_active: row.is_active === true,
    created_at: row.created_at,
  };
}

const erStaffContextCache = new Map<string, { context: AuthContext; expiresAt: number }>();
const ER_STAFF_CONTEXT_CACHE_TTL_MS = 30_000;

async function getErStaffContext(firebaseUid: string, tokenEmail: string): Promise<AuthContext> {
  const cached = erStaffContextCache.get(firebaseUid);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.context;
  }

  if (!isErSupabaseConfigured()) {
    throw new Error('ER Supabase is not configured for staff profile lookup.');
  }

  const erSupabase = getErSupabaseAdmin();
  if (!erSupabase) throw new Error('Unable to create the ER Supabase staff profile client.');

  const table = process.env.ER_PROFILES_TABLE?.trim() || 'profiles';
  const { data, error } = await erSupabase
    .from(table)
    .select('id, firebase_uid, company_id, email, username, display_name, role, phone_number, is_active, assigned_branch, branch_access, created_at')
    .eq('firebase_uid', firebaseUid)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) {
    throw new Error('This Firebase account is not linked to an ER staff profile. Ask the ER administrator to verify its firebase_uid.');
  }

  const erProfile = data as ErStaffProfileRow;
  if (erProfile.is_active !== true) throw new Error('This ER staff account is inactive.');

  const role = normalizeErStaffRole(erProfile.role);
  if (!role) {
    throw new Error(`ER role "${erProfile.role || 'blank'}" is not allowed to use this portal.`);
  }

  const profile = mapErStaffProfile(erProfile, role);
  const context: AuthContext = {
    firebaseUid,
    firebaseIdToken: null,
    supabaseUserId: null,
    email: profile.email || tokenEmail,
    role,
    profile,
    profileSource: 'er',
  };

  erStaffContextCache.set(firebaseUid, { context, expiresAt: Date.now() + ER_STAFF_CONTEXT_CACHE_TTL_MS });
  return context;
}

function isTestLoginAllowed() {
  return (
    process.env.NODE_ENV !== 'production' &&
    process.env.NEXT_PUBLIC_ENABLE_TEST_LOGIN !== 'false' &&
    (process.env.ENABLE_TEST_LOGIN === 'true' || !process.env.NEXT_PUBLIC_FIREBASE_API_KEY)
  );
}

const profileSelect = 'id, firebase_uid, supabase_user_id, company_id, role, first_name, last_name, email, phone_number, address, region, city, state, zip_code, is_active, created_at';

async function getTestAuthContext(role: AppRole): Promise<AuthContext> {
  const fallbackProfile = testProfiles[role];

  try {
    const supabaseAdmin = getSupabaseAdmin();
    const { data, error } = await supabaseAdmin
      .from('profiles')
      .upsert(
        {
          id: fallbackProfile.id,
          firebase_uid: fallbackProfile.firebase_uid,
          supabase_user_id: fallbackProfile.supabase_user_id,
          role,
          first_name: fallbackProfile.first_name,
          last_name: fallbackProfile.last_name,
          email: fallbackProfile.email,
          phone_number: fallbackProfile.phone_number,
          is_active: true,
        },
        { onConflict: 'email' },
      )
      .select(profileSelect)
      .single();

    if (!error && data) {
      return {
        firebaseUid: fallbackProfile.firebase_uid,
        firebaseIdToken: null,
        supabaseUserId: fallbackProfile.supabase_user_id,
        email: fallbackProfile.email,
        role,
        profile: data as AppProfile,
        profileSource: 'local',
      };
    }
  } catch {
    // Database setup is optional for opening the UI in local test mode.
  }

  return {
    firebaseUid: fallbackProfile.firebase_uid,
    firebaseIdToken: null,
    supabaseUserId: fallbackProfile.supabase_user_id,
    email: fallbackProfile.email,
    role,
    profile: fallbackProfile,
    profileSource: 'test',
  };
}

async function getSupabaseCustomerContext(accessToken: string): Promise<AuthContext> {
  const supabaseAdmin = getSupabaseAdmin();
  const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(accessToken);

  if (userError || !userData.user) {
    throw new Error(userError?.message ?? 'Invalid Supabase customer token.');
  }

  const supabaseUser = userData.user;
  const email = supabaseUser.email ?? '';
  let { data: profile, error } = await supabaseAdmin
    .from('profiles')
    .select(profileSelect)
    .eq('supabase_user_id', supabaseUser.id)
    .maybeSingle();

  if (error) throw new Error(error.message);

  if (!profile) {
    const fullName = typeof supabaseUser.user_metadata?.full_name === 'string' ? supabaseUser.user_metadata.full_name : '';
    const parts = fullName.trim().split(/\s+/).filter(Boolean);
    const companyId = await resolveFallbackCompanyId();
    const { data: created, error: createError } = await supabaseAdmin
      .from('profiles')
      .insert({
        supabase_user_id: supabaseUser.id,
        firebase_uid: null,
        company_id: companyId,
        role: 'customer',
        email,
        first_name: typeof supabaseUser.user_metadata?.first_name === 'string' ? supabaseUser.user_metadata.first_name : (parts[0] ?? ''),
        last_name: typeof supabaseUser.user_metadata?.last_name === 'string' ? supabaseUser.user_metadata.last_name : parts.slice(1).join(' '),
        phone_number: typeof supabaseUser.user_metadata?.phone_number === 'string' ? supabaseUser.user_metadata.phone_number : null,
        address: typeof supabaseUser.user_metadata?.address === 'string' ? supabaseUser.user_metadata.address : null,
        region: typeof supabaseUser.user_metadata?.region === 'string' ? supabaseUser.user_metadata.region : null,
        city: typeof supabaseUser.user_metadata?.city === 'string' ? supabaseUser.user_metadata.city : null,
        state: typeof supabaseUser.user_metadata?.state === 'string' ? supabaseUser.user_metadata.state : null,
        zip_code: typeof supabaseUser.user_metadata?.zip_code === 'string' ? supabaseUser.user_metadata.zip_code : null,
      })
      .select(profileSelect)
      .single();

    if (createError || !created) {
      throw new Error(createError?.message ?? 'Unable to create customer profile.');
    }

    return {
      firebaseUid: null,
      firebaseIdToken: null,
      supabaseUserId: supabaseUser.id,
      email,
      role: 'customer',
      profile: created as AppProfile,
      profileSource: 'local',
    };
  }

  if (!profile.is_active) throw new Error('This account is inactive.');
  if (profile.role !== 'customer') throw new Error('Supabase login is only for customer accounts. Staff must use Firebase login.');

  const metadataRepair: Record<string, string> = {};
  const metadataMap = {
    phone_number: supabaseUser.user_metadata?.phone_number,
    address: supabaseUser.user_metadata?.address,
    region: supabaseUser.user_metadata?.region,
    city: supabaseUser.user_metadata?.city,
    state: supabaseUser.user_metadata?.state,
    zip_code: supabaseUser.user_metadata?.zip_code,
  };

  Object.entries(metadataMap).forEach(([key, value]) => {
    if (
      typeof value === 'string' &&
      value.trim() &&
      !profile?.[key as keyof typeof metadataMap]
    ) {
      metadataRepair[key] = value.trim();
    }
  });

  if (Object.keys(metadataRepair).length) {
    const { data: repairedProfile } = await supabaseAdmin
      .from('profiles')
      .update(metadataRepair)
      .eq('id', profile.id)
      .select(profileSelect)
      .single();

    if (repairedProfile) {
      profile = repairedProfile;
    }
  }

  return {
    firebaseUid: null,
    firebaseIdToken: null,
    supabaseUserId: supabaseUser.id,
    email,
    role: 'customer',
    profile: profile as AppProfile,
    profileSource: 'local',
  };
}

// Customers now authenticate through Firebase exactly like staff do — same
// verifyIdToken() call, same "look up a profile row by firebase_uid" shape
// as getErStaffContext above. The one structural difference: staff rows are
// provisioned ahead of time by an ER administrator in a different database,
// so a missing row is an error. Customers self-register through this app,
// so /api/customer/register creates the row right after sign-up — but this
// still auto-creates a bare-bones one as a safety net if that step ever
// failed to run, rather than locking the customer out entirely.
async function getCustomerFirebaseContext(firebaseUid: string, tokenEmail: string): Promise<AuthContext> {
  const supabaseAdmin = getSupabaseAdmin();
  const { data: profile, error } = await supabaseAdmin
    .from('profiles')
    .select(profileSelect)
    .eq('firebase_uid', firebaseUid)
    .maybeSingle();

  if (error) throw new Error(error.message);

  if (!profile) {
    // No row for this uid yet. Before inserting, check whether this email
    // already has a row — e.g. a customer who registered back when auth was
    // Supabase-only. profiles.email is unique, so a blind insert here would
    // collide with that pre-existing row instead of adopting it. If we find
    // one and it's still unlinked, this is that legacy account signing in
    // through Firebase for the first time: attach this uid to it (lazy
    // migration) rather than creating a duplicate.
    const { data: byEmail, error: byEmailError } = await supabaseAdmin
      .from('profiles')
      .select(profileSelect)
      .eq('email', tokenEmail)
      .maybeSingle();

    if (byEmailError) throw new Error(byEmailError.message);

    if (byEmail) {
      if (byEmail.firebase_uid && byEmail.firebase_uid !== firebaseUid) {
        throw new Error('This email is already linked to a different account.');
      }
      if (byEmail.role !== 'customer') {
        throw new Error('This Firebase account is not registered as a customer.');
      }
      if (!byEmail.is_active) {
        throw new Error('This account is inactive.');
      }

      const { data: linked, error: linkError } = await supabaseAdmin
        .from('profiles')
        .update({ firebase_uid: firebaseUid })
        .eq('id', byEmail.id)
        .select(profileSelect)
        .single();

      if (linkError || !linked) {
        throw new Error(linkError?.message ?? 'Unable to link this account.');
      }

      return {
        firebaseUid,
        firebaseIdToken: null,
        supabaseUserId: linked.supabase_user_id,
        email: linked.email || tokenEmail,
        role: 'customer',
        profile: linked as AppProfile,
        profileSource: 'local',
      };
    }

    const companyId = await resolveFallbackCompanyId();
    const { data: created, error: createError } = await supabaseAdmin
      .from('profiles')
      .insert({
        firebase_uid: firebaseUid,
        supabase_user_id: null,
        company_id: companyId,
        role: 'customer',
        email: tokenEmail,
        first_name: '',
        last_name: '',
        is_active: true,
      })
      .select(profileSelect)
      .single();

    if (createError || !created) {
      throw new Error(createError?.message ?? 'Unable to create customer profile.');
    }

    return {
      firebaseUid,
      firebaseIdToken: null,
      supabaseUserId: null,
      email: tokenEmail,
      role: 'customer',
      profile: created as AppProfile,
      profileSource: 'local',
    };
  }

  if (profile.role !== 'customer') {
    throw new Error('This Firebase account is not registered as a customer.');
  }
  if (!profile.is_active) {
    throw new Error('This account is inactive.');
  }

  return {
    firebaseUid,
    firebaseIdToken: null,
    supabaseUserId: null,
    email: profile.email || tokenEmail,
    role: 'customer',
    profile: profile as AppProfile,
    profileSource: 'local',
  };
}

async function attachPreferences(context: AuthContext): Promise<AuthContext> {
  if (!context.firebaseUid) return context;
  try {
    const supabaseAdmin = getSupabaseAdmin();
    const { data } = await supabaseAdmin
      .from('user_preferences')
      .select('preferences')
      .eq('firebase_uid', context.firebaseUid)
      .maybeSingle();
    if (data?.preferences) {
      return { ...context, profile: { ...context.profile, preferences: data.preferences } };
    }
  } catch {
    // Preferences are optional; ignore lookup failures (e.g. table not migrated yet).
  }
  return context;
}

export async function getAuthContext(request: NextRequest): Promise<AuthContext> {
  const header = request.headers.get('authorization') ?? '';
  const token = header.match(/^Bearer\s+(.+)$/i)?.[1];

  if (!token) {
    throw new Error('Missing bearer token.');
  }

  const testRole = token.startsWith('test:') ? normalizeRole(token.slice(5)) : null;
  if (testRole) {
    if (!isTestLoginAllowed()) {
      throw new Error('Test login is disabled.');
    }
    return attachPreferences(await getTestAuthContext(testRole));
  }

  if (token.startsWith('supabase:')) {
    return attachPreferences(await getSupabaseCustomerContext(token.slice('supabase:'.length)));
  }

  const decoded = await getFirebaseAdminAuth().verifyIdToken(token);
  const firebaseUid = decoded.uid;
  const email = decoded.email ?? '';

  // Staff and customers now share one Firebase project, disambiguated by
  // lookup rather than anything in the token itself. Staff is tried first
  // so their behavior/latency is completely unchanged from before this
  // customer path existed — it only ever falls through to the customer
  // lookup for a uid that isn't a staff profile.
  try {
    const staffContext = await getErStaffContext(firebaseUid, email);
    return attachPreferences({ ...staffContext, firebaseIdToken: token });
  } catch (staffError) {
    try {
      const customerContext = await getCustomerFirebaseContext(firebaseUid, email);
      return attachPreferences({ ...customerContext, firebaseIdToken: token });
    } catch (customerError) {
      // Real staff accounts always resolve on the first try above, so by the
      // time both have failed the caller is almost certainly a customer with
      // a genuine problem (not registered, inactive) — surface that error,
      // not the staff/ER one, since it's the more actionable message for them.
      throw customerError instanceof Error ? customerError : staffError instanceof Error ? staffError : new Error('Unable to resolve this account.');
    }
  }
}

export function localProfileId(context: AuthContext) {
  return context.profileSource === 'local' ? context.profile.id : null;
}

export function requireRole(context: AuthContext, allowed: AppRole[]) {
  if (!allowed.includes(context.role)) {
    throw new Error('You do not have access to this action.');
  }
}

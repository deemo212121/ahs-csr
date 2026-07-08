import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { getErSupabaseAdmin, isErSupabaseConfigured } from '@/lib/supabase/er-admin';

const serviceAreaSelect = 'id, legacy_id, zip_code, city, state, region, is_active, created_at, updated_at';
const erLocationCoverageSelect = 'id, company_id, legacy_id, location, zip_code, city, self_schedule, days_later, tier_code, created_at, updated_at';
const erLocationsSelect = 'id, company_id, legacy_id, location, address1, address2, city, state, zip_code, office, office_location, coordinates, phone_no, email, available_days, available_time_slot, created_at, updated_at';

type ErLocationCoverageRow = Record<string, unknown>;
type ErLocationRow = Record<string, unknown>;

function sanitizeSearch(value: string | null) {
  return (value ?? '').trim().replaceAll('%', '').replaceAll(',', ' ');
}

function cleanText(value: unknown, fallback = '') {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback;
}

function useErLocationCoverage() {
  return isErSupabaseConfigured() && process.env.ER_LOCATION_COVERAGE_DISABLED !== 'true';
}

function getErLocationCoverageTable() {
  return process.env.ER_LOCATION_COVERAGE_TABLE?.trim() || 'location_mgmt_coverage';
}

function getErLocationsTable() {
  return process.env.ER_LOCATIONS_TABLE?.trim() || 'location_mgmt_locations';
}

function getErCoverageCompanyId() {
  return (
    process.env.ER_LOCATION_VIEW_COMPANY_ID?.trim() ||
    process.env.ER_TICKET_VIEW_COMPANY_ID?.trim() ||
    process.env.ER_DEFAULT_COMPANY_ID?.trim() ||
    ''
  );
}

// Optional fast path: a read-only Postgres function in the ER database
// (distinct_location_coverage — see supabase/er_distinct_location_coverage_setup.sql)
// that returns one pre-deduplicated row per zip in a single round-trip,
// instead of paging through the full ~127k-row table. Only used for the
// "list every zip" case (no zip/search filter) — that's the one that needs
// the whole table; a single-zip lookup is already cheap as-is. Falls back
// silently to the existing capped pagination if the function hasn't been
// created yet, so nothing breaks for anyone who hasn't run that SQL.
async function tryDistinctCoverageRpc(companyId: string): Promise<ErLocationCoverageRow[] | null> {
  const erSupabase = getErSupabaseAdmin();
  if (!erSupabase) return null;
  try {
    const { data, error } = await erSupabase.rpc('distinct_location_coverage', { p_company_id: companyId });
    if (error || !Array.isArray(data)) return null;
    return data as ErLocationCoverageRow[];
  } catch {
    return null;
  }
}

function normalizeKey(value: unknown) {
  return cleanText(value).toLowerCase().replace(/[^a-z0-9]/g, '');
}

function mapErLocationCoverage(row: ErLocationCoverageRow, canonicalLocation?: string) {
  const selfSchedule = cleanText(row.self_schedule);
  const location = canonicalLocation || cleanText(row.location, 'Unassigned Location');
  return {
    id: cleanText(row.id),
    legacy_id: cleanText(row.legacy_id) || null,
    company_id: cleanText(row.company_id) || null,
    zip_code: cleanText(row.zip_code),
    city: cleanText(row.city),
    // ER location_mgmt_coverage does not include a state column in the export provided.
    state: '',
    // Use ER location as the portal Region/Branch value.
    region: location,
    location,
    self_schedule: selfSchedule || null,
    days_later: cleanText(row.days_later) || null,
    tier_code: cleanText(row.tier_code) || null,
    is_active: selfSchedule !== '0',
    source_kind: 'coverage' as const,
    created_at: cleanText(row.created_at),
    updated_at: cleanText(row.updated_at),
  };
}

function mapErLocation(row: ErLocationRow) {
  const location = cleanText(row.location) || cleanText(row.office_location) || cleanText(row.office) || 'Unassigned Location';
  return {
    id: cleanText(row.id),
    legacy_id: cleanText(row.legacy_id) || null,
    company_id: cleanText(row.company_id) || null,
    location,
    address1: cleanText(row.address1) || null,
    address2: cleanText(row.address2) || null,
    city: cleanText(row.city) || null,
    state: cleanText(row.state) || null,
    zip_code: cleanText(row.zip_code) || null,
    office: cleanText(row.office) || null,
    office_location: cleanText(row.office_location) || null,
    coordinates: cleanText(row.coordinates) || null,
    phone_no: cleanText(row.phone_no) || null,
    email: cleanText(row.email) || null,
    available_days: Array.isArray(row.available_days) ? row.available_days : [],
    available_time_slot: cleanText(row.available_time_slot) || null,
    created_at: cleanText(row.created_at),
    updated_at: cleanText(row.updated_at),
  };
}

function buildLocalServiceAreaQuery(options: { zip: string; q: string; activeOnly: boolean }) {
  const supabaseAdmin = getSupabaseAdmin();
  let query = supabaseAdmin
    .from('service_areas')
    .select(serviceAreaSelect)
    .order('region', { ascending: true })
    .order('state', { ascending: true })
    .order('city', { ascending: true })
    .order('zip_code', { ascending: true });

  if (options.activeOnly) query = query.eq('is_active', true);
  if (options.zip.length === 5) query = query.eq('zip_code', options.zip);
  if (options.q) {
    const like = `%${options.q}%`;
    query = query.or(`zip_code.ilike.${like},city.ilike.${like},state.ilike.${like},region.ilike.${like}`);
  }

  return query;
}

function buildErCoverageQuery(options: { zip: string; q: string; activeOnly: boolean }) {
  const erSupabase = getErSupabaseAdmin();
  if (!erSupabase) throw new Error('ER Supabase client is not configured.');

  let query = erSupabase
    .from(getErLocationCoverageTable())
    .select(erLocationCoverageSelect)
    .order('location', { ascending: true })
    .order('city', { ascending: true })
    .order('zip_code', { ascending: true });

  const companyId = getErCoverageCompanyId();
  if (companyId) query = query.eq('company_id', companyId);
  if (options.activeOnly) query = query.neq('self_schedule', '0');
  if (options.zip.length === 5) query = query.eq('zip_code', options.zip);
  if (options.q) {
    const like = `%${options.q}%`;
    query = query.or(`zip_code.ilike.${like},city.ilike.${like},location.ilike.${like},tier_code.ilike.${like},legacy_id.ilike.${like}`);
  }

  return query;
}

function buildErLocationsQuery(options: { zip: string; q: string }) {
  const erSupabase = getErSupabaseAdmin();
  if (!erSupabase) throw new Error('ER Supabase client is not configured.');

  let query = erSupabase
    .from(getErLocationsTable())
    .select(erLocationsSelect)
    .order('location', { ascending: true });

  const companyId = getErCoverageCompanyId();
  if (companyId) query = query.eq('company_id', companyId);
  if (options.zip.length === 5) query = query.eq('zip_code', options.zip);
  if (options.q) {
    const like = `%${options.q}%`;
    query = query.or(`zip_code.ilike.${like},city.ilike.${like},state.ilike.${like},location.ilike.${like},office.ilike.${like},office_location.ilike.${like},legacy_id.ilike.${like}`);
  }

  return query;
}

// ER's location_mgmt_coverage table runs well into six figures of rows (one
// row per zip per schedule slot/tier, not one row per zip) — fetching that
// serially, one 1000-row page at a time, would mean 100+ sequential
// round-trips and take tens of seconds. Pages within a batch are independent
// range queries, so fire a bounded batch of them concurrently and only stop
// issuing further batches once a page in the batch comes back short (the
// real end of the data), instead of paging one request at a time.
async function getPagedRows<T>(buildQuery: () => any, limit: number) {
  const pageSize = 1000;
  const batchConcurrency = 25;
  const rows: T[] = [];
  let offset = 0;
  let reachedEnd = false;

  while (offset < limit && !reachedEnd) {
    const batchStarts: number[] = [];
    for (let i = 0; i < batchConcurrency && offset + i * pageSize < limit; i++) {
      batchStarts.push(offset + i * pageSize);
    }

    const pages = await Promise.all(
      batchStarts.map(async (from) => {
        const to = Math.min(from + pageSize - 1, limit - 1);
        const { data, error } = await buildQuery().range(from, to);
        if (error) throw new Error(error.message);
        return (data ?? []) as T[];
      }),
    );

    for (const page of pages) {
      rows.push(...page);
      if (page.length < pageSize) reachedEnd = true;
    }

    offset += batchStarts.length * pageSize;
  }

  return rows;
}

function deduplicateLocations(rows: ErLocationRow[]) {
  const byLocation = new Map<string, ReturnType<typeof mapErLocation>>();

  rows.forEach((row) => {
    const location = mapErLocation(row);
    const key = normalizeKey(location.location) || location.id;
    const current = byLocation.get(key);
    if (!current || location.updated_at > current.updated_at) byLocation.set(key, location);
  });

  return Array.from(byLocation.values()).sort((a, b) => a.location.localeCompare(b.location));
}

async function getMergedErServiceAreas(options: { zip: string; q: string; activeOnly: boolean; limit: number }) {
  // The "list every zip" case (no zip/search filter) is the one that needs
  // the whole ~127k-row table — try the single-round-trip RPC first (see
  // supabase/er_distinct_location_coverage_setup.sql) and only fall back to
  // paging through the capped, possibly-incomplete slice if that function
  // hasn't been created in ER yet.
  const companyId = getErCoverageCompanyId();
  const wantsFullList = !options.zip && !options.q;
  const rpcRows = wantsFullList && companyId ? await tryDistinctCoverageRpc(companyId) : null;
  const coverageRowsSource = rpcRows
    ? (options.activeOnly ? rpcRows.filter((row) => cleanText(row.self_schedule) !== '0') : rpcRows)
    : null;

  const [coverageRows, rawLocationRows] = await Promise.all([
    coverageRowsSource ?? getPagedRows<ErLocationCoverageRow>(() => buildErCoverageQuery(options), options.limit),
    getPagedRows<ErLocationRow>(() => buildErLocationsQuery(options), 1000),
  ]);
  const locations = deduplicateLocations(rawLocationRows);
  const locationsByName = new Map(locations.map((location) => [normalizeKey(location.location), location] as const));
  type MergedServiceArea = Omit<ReturnType<typeof mapErLocationCoverage>, 'source_kind'> & {
    source_kind: 'coverage' | 'location';
  };
  const uniqueZips = new Map<string, MergedServiceArea>();

  coverageRows.forEach((row) => {
    const coverageLocation = cleanText(row.location, 'Unassigned Location');
    const canonical = locationsByName.get(normalizeKey(coverageLocation))?.location || coverageLocation;
    const mapped = mapErLocationCoverage(row, canonical);
    const zipKey = normalizeKey(mapped.zip_code);
    const fallbackKey = `${normalizeKey(mapped.location)}|${normalizeKey(mapped.city)}|${mapped.id}`;
    const key = zipKey || fallbackKey;
    const current = uniqueZips.get(key);

    if (!current || (!current.is_active && mapped.is_active)) uniqueZips.set(key, mapped);
  });

  const coverageDuplicatesRemoved = Math.max(0, coverageRows.length - uniqueZips.size);
  let addedLocationZipRows = 0;
  let locationZipDuplicatesSkipped = 0;
  locations.forEach((location) => {
    const zipKey = normalizeKey(location.zip_code);
    if (!zipKey) return;
    if (uniqueZips.has(zipKey)) {
      locationZipDuplicatesSkipped += 1;
      return;
    }
    uniqueZips.set(zipKey, {
      id: `location:${location.id}`,
      legacy_id: location.legacy_id,
      company_id: location.company_id,
      zip_code: location.zip_code || '',
      city: location.city || '',
      state: location.state || '',
      region: location.location,
      location: location.location,
      self_schedule: null,
      days_later: null,
      tier_code: null,
      is_active: true,
      source_kind: 'location' as const,
      created_at: location.created_at,
      updated_at: location.updated_at,
    });
    addedLocationZipRows += 1;
  });

  const serviceAreas = Array.from(uniqueZips.values()).sort((a, b) =>
    a.location.localeCompare(b.location) || a.city.localeCompare(b.city) || a.zip_code.localeCompare(b.zip_code),
  );

  return {
    service_areas: serviceAreas,
    locations,
    source: coverageRowsSource
      ? 'er_location_mgmt_coverage_rpc_and_locations'
      : 'er_location_mgmt_coverage_and_locations',
    dedupe: {
      coverage_rows_loaded: coverageRows.length,
      location_rows_loaded: rawLocationRows.length,
      unique_zip_rows: serviceAreas.length,
      zip_duplicates_removed: coverageDuplicatesRemoved + locationZipDuplicatesSkipped,
      location_zip_duplicates_skipped: locationZipDuplicatesSkipped,
      unique_locations: locations.length,
      location_duplicates_removed: Math.max(0, rawLocationRows.length - locations.length),
      added_location_zip_rows: addedLocationZipRows,
      used_rpc_fast_path: Boolean(coverageRowsSource),
    },
  };
}

async function getServiceAreas(options: { zip: string; q: string; activeOnly: boolean; limit: number }) {
  if (useErLocationCoverage()) {
    return getMergedErServiceAreas(options);
  }

  const serviceAreas = await getPagedRows<unknown>(() => buildLocalServiceAreaQuery(options), options.limit);
  return { service_areas: serviceAreas, locations: [], source: 'local_service_areas', dedupe: null };
}

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const zip = sanitizeSearch(url.searchParams.get('zip')).replace(/\D/g, '').slice(0, 5);
    const q = sanitizeSearch(url.searchParams.get('q'));
    const activeOnly = url.searchParams.get('active') !== 'false';
    // ER's location_mgmt_coverage table can run into six figures of rows for
    // a single company (many rows per zip — one per schedule slot/tier, not
    // one per zip). PostgREST hard-caps each request at 1000 rows and
    // Cloudflare caps how many outbound requests a single Worker invocation
    // can make, so fetching the *entire* table this way isn't possible no
    // matter how it's batched. This cap only matters as a fallback now — see
    // getMergedErServiceAreas's RPC fast path (distinct_location_coverage),
    // which fetches the full deduplicated set in one round-trip instead.
    const limit = Math.min(Math.max(Number(url.searchParams.get('limit') ?? (zip ? 25 : 6000)), 1), 40000);

    const result = await getServiceAreas({ zip, q, activeOnly, limit });

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : 'Unable to load service areas.' },
      { status: 400 },
    );
  }
}

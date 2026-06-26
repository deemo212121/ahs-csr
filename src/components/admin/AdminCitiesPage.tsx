'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Building2,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Database,
  Filter,
  MapPin,
  RefreshCw,
  Search,
  ShieldCheck,
} from 'lucide-react';
import { AdminEmptyState, AdminPageHeader, AdminPanel, AdminStatGrid } from '@/components/admin/AdminUi';

type ServiceArea = {
  id: string;
  legacy_id: string | number | null;
  company_id?: string | null;
  zip_code: string;
  city: string;
  state: string;
  region: string;
  location?: string | null;
  self_schedule?: string | null;
  days_later?: string | null;
  tier_code?: string | null;
  is_active: boolean;
  source_kind?: 'coverage' | 'location';
  created_at: string;
  updated_at: string;
};

type ErLocation = {
  id: string;
  legacy_id: string | number | null;
  company_id?: string | null;
  location: string;
  address1: string | null;
  address2: string | null;
  city: string | null;
  state: string | null;
  zip_code: string | null;
  office: string | null;
  office_location: string | null;
  coordinates: string | null;
  phone_no: string | null;
  email: string | null;
  available_days: string[];
  available_time_slot: string | null;
  created_at: string;
  updated_at: string;
};

type DedupeSummary = {
  coverage_rows_loaded: number;
  location_rows_loaded: number;
  unique_zip_rows: number;
  zip_duplicates_removed: number;
  location_zip_duplicates_skipped: number;
  unique_locations: number;
  location_duplicates_removed: number;
  added_location_zip_rows: number;
};

type ServiceAreasResponse = {
  service_areas?: ServiceArea[];
  locations?: ErLocation[];
  source?: string;
  dedupe?: DedupeSummary | null;
  message?: string;
};

type StatusFilter = 'all' | 'active' | 'inactive';

type CitySummary = {
  city: string;
  zips: string[];
  active: number;
};

type LocationGroup = {
  key: string;
  location: string;
  metadata: ErLocation | null;
  areas: ServiceArea[];
  cities: CitySummary[];
  activeZips: number;
};

const SOURCE_LABELS: Record<string, string> = {
  er_location_mgmt_coverage_and_locations: 'ER coverage + locations',
  er_location_mgmt_coverage: 'ER coverage',
  local_service_areas: 'Local service areas',
};

const PAGE_SIZE = 50;

function normalize(value: string | null | undefined) {
  return (value ?? '').trim().toLowerCase().replace(/[^a-z0-9]/g, '');
}

function text(value: string | null | undefined) {
  return (value ?? '').trim();
}

function deduplicateAreas(rows: ServiceArea[]) {
  const map = new Map<string, ServiceArea>();
  rows.forEach((row) => {
    const zipKey = normalize(row.zip_code);
    const key = zipKey || `${normalize(row.location || row.region)}|${normalize(row.city)}|${row.id}`;
    const current = map.get(key);
    if (!current || (current.source_kind === 'location' && row.source_kind === 'coverage') || (!current.is_active && row.is_active)) {
      map.set(key, row);
    }
  });
  return Array.from(map.values());
}

function deduplicateLocations(rows: ErLocation[]) {
  const map = new Map<string, ErLocation>();
  rows.forEach((row) => {
    const key = normalize(row.location) || row.id;
    const current = map.get(key);
    if (!current || row.updated_at > current.updated_at) map.set(key, row);
  });
  return Array.from(map.values());
}

function buildLocationGroups(areas: ServiceArea[], locations: ErLocation[]): LocationGroup[] {
  const groups = new Map<string, { location: string; metadata: ErLocation | null; areas: ServiceArea[] }>();

  locations.forEach((location) => {
    const key = normalize(location.location) || location.id;
    groups.set(key, { location: location.location, metadata: location, areas: [] });
  });

  areas.forEach((area) => {
    const displayName = text(area.location || area.region) || 'Unassigned Location';
    const key = normalize(displayName) || area.id;
    const current = groups.get(key) ?? { location: displayName, metadata: null, areas: [] };
    current.areas.push(area);
    groups.set(key, current);
  });

  return Array.from(groups.entries())
    .map(([key, group]) => {
      const cityMap = new Map<string, { city: string; zips: Set<string>; active: number }>();
      group.areas.forEach((area) => {
        const city = text(area.city) || 'No city listed';
        const cityKey = normalize(city) || city;
        const current = cityMap.get(cityKey) ?? { city, zips: new Set<string>(), active: 0 };
        if (text(area.zip_code)) current.zips.add(text(area.zip_code));
        if (area.is_active) current.active += 1;
        cityMap.set(cityKey, current);
      });

      const cities = Array.from(cityMap.values())
        .map((city) => ({ city: city.city, zips: Array.from(city.zips).sort(), active: city.active }))
        .sort((a, b) => b.zips.length - a.zips.length || a.city.localeCompare(b.city));

      return {
        key,
        location: group.location,
        metadata: group.metadata,
        areas: group.areas.sort((a, b) => a.city.localeCompare(b.city) || a.zip_code.localeCompare(b.zip_code)),
        cities,
        activeZips: group.areas.filter((area) => area.is_active).length,
      };
    })
    .sort((a, b) => a.location.localeCompare(b.location));
}

function rowMatches(area: ServiceArea, query: string, status: StatusFilter) {
  if (status === 'active' && !area.is_active) return false;
  if (status === 'inactive' && area.is_active) return false;
  if (!query) return true;
  return [area.zip_code, area.city, area.state, area.location, area.region, String(area.legacy_id ?? '')]
    .some((value) => normalize(value).includes(query));
}

function CitiesBadge({ children, tone = 'neutral' }: { children: React.ReactNode; tone?: string }) {
  return <span className={`admin-cities-badge ${tone}`}>{children}</span>;
}

export function AdminCitiesPage() {
  const [areas, setAreas] = useState<ServiceArea[]>([]);
  const [locations, setLocations] = useState<ErLocation[]>([]);
  const [source, setSource] = useState('');
  const [dedupe, setDedupe] = useState<DedupeSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastLoaded, setLastLoaded] = useState<Date | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [selectedLocation, setSelectedLocation] = useState('');
  const [page, setPage] = useState(0);

  const loadAreas = useCallback(async (silent = false) => {
    if (silent) setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/service-areas?limit=15000', { cache: 'no-store' });
      const data = (await response.json()) as ServiceAreasResponse;
      if (!response.ok) throw new Error(data.message || 'Unable to load ER location coverage.');
      setAreas(deduplicateAreas(data.service_areas ?? []));
      setLocations(deduplicateLocations(data.locations ?? []));
      setSource(data.source ?? '');
      setDedupe(data.dedupe ?? null);
      setLastLoaded(new Date());
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Unable to load ER location coverage.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void loadAreas();
    const interval = window.setInterval(() => void loadAreas(true), 120_000);
    return () => window.clearInterval(interval);
  }, [loadAreas]);

  const groups = useMemo(() => buildLocationGroups(areas, locations), [areas, locations]);

  const filteredGroups = useMemo(() => {
    const query = normalize(search);
    return groups
      .map((group) => {
        const groupMatch = Boolean(query && [group.location, group.metadata?.city, group.metadata?.state, group.metadata?.zip_code, group.metadata?.office]
          .some((value) => normalize(value).includes(query)));
        const filteredAreas = group.areas.filter((area) => rowMatches(area, groupMatch ? '' : query, statusFilter));
        const matchesNoCoverageLocation = !group.areas.length && (!query || groupMatch) && statusFilter !== 'inactive';
        return { group, filteredAreas, visible: filteredAreas.length > 0 || matchesNoCoverageLocation };
      })
      .filter((entry) => entry.visible);
  }, [groups, search, statusFilter]);

  useEffect(() => {
    if (!filteredGroups.length) {
      setSelectedLocation('');
      return;
    }
    if (!filteredGroups.some((entry) => entry.group.key === selectedLocation)) setSelectedLocation(filteredGroups[0].group.key);
  }, [filteredGroups, selectedLocation]);

  useEffect(() => {
    setPage(0);
  }, [search, selectedLocation, statusFilter]);

  const selectedEntry = filteredGroups.find((entry) => entry.group.key === selectedLocation) ?? null;
  const selectedGroup = selectedEntry?.group ?? null;
  const selectedRows = selectedEntry?.filteredAreas ?? [];
  const pageCount = Math.max(1, Math.ceil(selectedRows.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount - 1);
  const visibleRows = selectedRows.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE);

  const stats = useMemo(() => {
    const active = areas.filter((area) => area.is_active);
    const cities = new Set(areas.map((area) => normalize(area.city)).filter(Boolean));
    return { zips: areas.length, active: active.length, cities: cities.size, locations: groups.length };
  }, [areas, groups.length]);

  const selectedCitySummaries = useMemo(() => {
    const map = new Map<string, CitySummary>();
    selectedRows.forEach((area) => {
      const city = text(area.city) || 'No city listed';
      const key = normalize(city) || city;
      const current = map.get(key) ?? { city, zips: [], active: 0 };
      if (text(area.zip_code)) current.zips.push(text(area.zip_code));
      if (area.is_active) current.active += 1;
      map.set(key, current);
    });
    return Array.from(map.values())
      .map((city) => ({ ...city, zips: Array.from(new Set(city.zips)) }))
      .sort((a, b) => b.zips.length - a.zips.length || a.city.localeCompare(b.city));
  }, [selectedRows]);

  const sourceLabel = SOURCE_LABELS[source] || source || 'ER location data';
  const metadata = selectedGroup?.metadata;

  return (
    <div className="admin-dashboard admin-cities-page">
      <AdminPageHeader
        actions={(
          <div className="admin-cities-header-actions">
            <CitiesBadge tone="cyan"><Database size={13} /> {sourceLabel}</CitiesBadge>
            <CitiesBadge tone="green"><ShieldCheck size={13} /> Deduplicated live view</CitiesBadge>
          </div>
        )}
        description="Live branch, city, and ZIP coverage merged from ER location_mgmt_coverage and location_mgmt_locations."
        eyebrow="Service network"
        title="Cities & ZIP Coverage"
      />

      <AdminStatGrid
        stats={[
          { label: 'Unique ZIP Records', value: stats.zips.toLocaleString(), tone: 'cyan', helper: 'Duplicates removed' },
          { label: 'Active ZIPs', value: stats.active.toLocaleString(), tone: 'green', helper: 'Self-scheduling enabled' },
          { label: 'Covered Cities', value: stats.cities.toLocaleString(), tone: 'blue', helper: 'Unique ER city names' },
          { label: 'Live Locations', value: stats.locations.toLocaleString(), tone: 'yellow', helper: `${locations.length} location records` },
        ]}
      />

      {error ? <div className="customer-alert">{error}</div> : null}

      <AdminPanel
        action={(
          <button className="admin-cities-refresh" disabled={refreshing} onClick={() => void loadAreas(true)} type="button">
            <RefreshCw className={refreshing ? 'spin' : ''} size={15} />
            {refreshing ? 'Refreshing...' : 'Refresh ER data'}
          </button>
        )}
        subtitle="Search the complete network, then choose a branch to inspect its cities and ZIP records. Data refreshes automatically every two minutes."
        title="Coverage Explorer"
      >
        <div className="admin-cities-filterbar">
          <label className="admin-cities-search">
            <Search size={16} />
            <input aria-label="Search location coverage" onChange={(event) => setSearch(event.target.value)} placeholder="Search ZIP, city, branch, or legacy ID..." value={search} />
          </label>
          <label className="admin-cities-select">
            <Filter size={15} />
            <select aria-label="Filter by status" onChange={(event) => setStatusFilter(event.target.value as StatusFilter)} value={statusFilter}>
              <option value="all">All statuses</option>
              <option value="active">Active only</option>
              <option value="inactive">Inactive only</option>
            </select>
          </label>
          {(search || statusFilter !== 'all') ? (
            <button className="admin-cities-clear" onClick={() => { setSearch(''); setStatusFilter('all'); }} type="button">Clear filters</button>
          ) : null}
        </div>

        {loading ? (
          <AdminEmptyState label="Merging and deduplicating ER location coverage..." />
        ) : filteredGroups.length ? (
          <div className="admin-cities-workspace">
            <aside className="admin-cities-location-rail">
              <div className="admin-cities-rail-head">
                <div><span>Location directory</span><strong>{filteredGroups.length} shown</strong></div>
                <MapPin size={18} />
              </div>
              <div className="admin-cities-location-list">
                {filteredGroups.map(({ group, filteredAreas }) => (
                  <button className={group.key === selectedLocation ? 'active' : ''} key={group.key} onClick={() => setSelectedLocation(group.key)} type="button">
                    <span className="admin-cities-location-icon"><Building2 size={15} /></span>
                    <span>
                      <strong>{group.location}</strong>
                      <small>{filteredAreas.length.toLocaleString()} ZIPs · {group.cities.length.toLocaleString()} cities</small>
                    </span>
                    <ChevronRight size={15} />
                  </button>
                ))}
              </div>
              <div className="admin-cities-sync-note">
                <CheckCircle2 size={14} />
                <span>{lastLoaded ? `Updated ${lastLoaded.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}` : 'Waiting for ER data'}</span>
              </div>
            </aside>

            <section className="admin-cities-location-detail">
              {selectedGroup ? (
                <>
                  <div className="admin-cities-location-hero">
                    <span className="admin-cities-hero-icon"><MapPin size={23} /></span>
                    <div>
                      <span>Selected ER location</span>
                      <h2>{selectedGroup.location}</h2>
                      <p>{[metadata?.office, metadata?.city, metadata?.state, metadata?.zip_code].filter(Boolean).join(' · ') || 'Coverage-only branch record'}</p>
                    </div>
                    <CitiesBadge tone={selectedRows.length ? 'green' : 'yellow'}>{selectedRows.length.toLocaleString()} matching ZIPs</CitiesBadge>
                  </div>

                  <div className="admin-cities-location-metrics">
                    <div><strong>{selectedRows.length.toLocaleString()}</strong><span>Unique ZIPs</span></div>
                    <div><strong>{selectedCitySummaries.length.toLocaleString()}</strong><span>Cities</span></div>
                    <div><strong>{selectedRows.filter((area) => area.is_active).length.toLocaleString()}</strong><span>Active</span></div>
                    <div><strong>{selectedRows.filter((area) => !area.is_active).length.toLocaleString()}</strong><span>Inactive</span></div>
                  </div>

                  {selectedCitySummaries.length ? (
                    <div className="admin-cities-top-cities">
                      <div className="admin-cities-section-head"><div><h3>Largest covered cities</h3><p>Top cities by unique ZIP count in this location</p></div></div>
                      <div className="admin-cities-city-grid">
                        {selectedCitySummaries.slice(0, 6).map((city) => (
                          <article key={city.city}>
                            <span>{city.city}</span>
                            <strong>{city.zips.length}</strong>
                            <small>{city.zips.length === 1 ? 'ZIP code' : 'ZIP codes'} · {city.active} active</small>
                          </article>
                        ))}
                      </div>
                    </div>
                  ) : null}

                  <div className="admin-cities-table-section">
                    <div className="admin-cities-section-head">
                      <div><h3>ZIP coverage records</h3><p>Showing unique ZIPs only; coverage rows take priority over matching location rows.</p></div>
                      <CitiesBadge>{selectedRows.length.toLocaleString()} records</CitiesBadge>
                    </div>
                    <div className="admin-php-table-wrap admin-cities-table-wrap">
                      <table className="admin-php-table admin-cities-table">
                        <thead><tr><th>ZIP</th><th>City</th><th>Source</th><th>Status</th></tr></thead>
                        <tbody>
                          {visibleRows.map((area) => (
                            <tr key={`${area.source_kind || 'row'}:${area.id}`}>
                              <td><strong>{area.zip_code || '—'}</strong></td>
                              <td>{area.city || '—'}</td>
                              <td><CitiesBadge tone={area.source_kind === 'location' ? 'yellow' : 'blue'}>{area.source_kind === 'location' ? 'Location' : 'Coverage'}</CitiesBadge></td>
                              <td><span className={area.is_active ? 'admin-status-pill active' : 'admin-status-pill inactive'}>{area.is_active ? 'Active' : 'Inactive'}</span></td>
                            </tr>
                          ))}
                          {!visibleRows.length ? <tr><td colSpan={4}>This location has no ZIP coverage matching the current filters.</td></tr> : null}
                        </tbody>
                      </table>
                    </div>
                    {selectedRows.length > PAGE_SIZE ? (
                      <div className="admin-cities-pagination">
                        <span>Page {safePage + 1} of {pageCount}</span>
                        <div>
                          <button disabled={safePage === 0} onClick={() => setPage((current) => Math.max(0, current - 1))} type="button"><ChevronLeft size={15} /> Previous</button>
                          <button disabled={safePage >= pageCount - 1} onClick={() => setPage((current) => Math.min(pageCount - 1, current + 1))} type="button">Next <ChevronRight size={15} /></button>
                        </div>
                      </div>
                    ) : null}
                  </div>
                </>
              ) : <AdminEmptyState label="Choose a location to inspect its coverage." />}
            </section>
          </div>
        ) : <AdminEmptyState label="No ER locations match the current filters." />}

        {dedupe ? (
          <div className="admin-cities-dedupe-note">
            <ShieldCheck size={15} />
            <span><strong>Duplicate protection active.</strong> {dedupe.coverage_rows_loaded.toLocaleString()} coverage rows and {dedupe.location_rows_loaded.toLocaleString()} location rows were merged into {dedupe.unique_zip_rows.toLocaleString()} unique ZIP records across {dedupe.unique_locations.toLocaleString()} locations. {dedupe.location_zip_duplicates_skipped.toLocaleString()} location ZIP duplicates were safely skipped.</span>
          </div>
        ) : null}
      </AdminPanel>
    </div>
  );
}

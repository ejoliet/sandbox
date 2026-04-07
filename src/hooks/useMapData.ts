import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import type { SeedRecord, MarkerData, FilterState } from '@/types';

// ── Convert flat seed records → unique map markers ────────────────────────────
function seedToMarkers(records: SeedRecord[]): MarkerData[] {
  const seen    = new Set<string>();
  const markers: MarkerData[] = [];

  for (const r of records) {
    const key = `${r.wikidataId}_${r.lat.toFixed(5)}_${r.lng.toFixed(5)}`;
    if (!seen.has(key)) {
      seen.add(key);
      markers.push({
        id:            r.wikidataId,
        title:         r.title,
        year:          r.year,
        lat:           r.lat,
        lng:           r.lng,
        locationLabel: r.locationLabel,
      });
    }
  }

  return markers;
}

// ── Load seed JSON ────────────────────────────────────────────────────────────
export function useMapData() {
  const { data: seedRecords, isLoading, error } = useQuery<SeedRecord[]>({
    queryKey:  ['seed-data'],
    queryFn:   async () => {
      const res = await fetch('/data/movie-locations.json');
      if (!res.ok) throw new Error('Seed data not found — run: npm run seed');
      return res.json() as Promise<SeedRecord[]>;
    },
    staleTime: Infinity,
    gcTime:    Infinity,
    retry:     false,
  });

  const markers = useMemo(
    () => (seedRecords ? seedToMarkers(seedRecords) : []),
    [seedRecords],
  );

  return { markers, isLoading, error, totalRecords: seedRecords?.length ?? 0 };
}

// ── Apply filters to markers ──────────────────────────────────────────────────
export function useFilteredMarkers(markers: MarkerData[], filters: FilterState): MarkerData[] {
  return useMemo(() => {
    if (!filters.decade) return markers;
    const start = parseInt(filters.decade);
    const end   = start + 9;
    return markers.filter((m) => m.year !== null && m.year >= start && m.year <= end);
  }, [markers, filters.decade]);
}

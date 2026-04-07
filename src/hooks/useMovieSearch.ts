import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { searchMoviesByTitle } from '@/services/wikidata';
import { enrichMovieWithTMDb } from '@/services/tmdb';
import { useMapStore } from '@/store/mapStore';
import type { MovieLocation } from '@/types';

// ── Debounce hook ─────────────────────────────────────────────────────────────
export function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState<T>(value);
  const timer = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    timer.current = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer.current);
  }, [value, delay]);

  return debounced;
}

// ── Movie title search ────────────────────────────────────────────────────────
export function useMovieSearch() {
  const { searchQuery, searchMode, setSearchResults, setIsSearching } = useMapStore();
  const debouncedQuery = useDebounce(searchQuery, 500);

  const { data, isFetching } = useQuery<MovieLocation[]>({
    queryKey: ['movie-search', debouncedQuery],
    queryFn:  () => searchMoviesByTitle(debouncedQuery),
    enabled:  searchMode === 'movie' && debouncedQuery.trim().length >= 2,
    staleTime: 5 * 60 * 1000,
  });

  useEffect(() => { setSearchResults(data ?? []); }, [data, setSearchResults]);
  useEffect(() => { setIsSearching(isFetching);   }, [isFetching, setIsSearching]);

  return { results: data ?? [], isSearching: isFetching };
}

// ── TMDb enrichment (lazy, per selected movie) ────────────────────────────────
export function useMovieEnrichment(movie: MovieLocation | null): MovieLocation | null {
  const { data: enriched } = useQuery<MovieLocation>({
    queryKey:  ['tmdb-enrich', movie?.wikidataId],
    queryFn:   () => enrichMovieWithTMDb(movie!),
    enabled:   !!movie,
    staleTime: 24 * 60 * 60 * 1000,
  });

  return enriched ?? movie;
}

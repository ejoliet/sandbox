import type { MovieLocation } from '@/types';

const TMDB_KEY  = import.meta.env.VITE_TMDB_API_KEY as string | undefined;
const TMDB_BASE = 'https://api.themoviedb.org/3';
const IMG_BASE  = 'https://image.tmdb.org/t/p';
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours

export type PosterSize = 'w92' | 'w185' | 'w342' | 'w500' | 'original';

export function getTMDbImageUrl(path: string, size: PosterSize = 'w342'): string {
  return `${IMG_BASE}/${size}${path}`;
}

// ── Cache helpers ─────────────────────────────────────────────────────────────
function lsGet<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const { data, ts } = JSON.parse(raw) as { data: T; ts: number };
    if (Date.now() - ts > CACHE_TTL) { localStorage.removeItem(key); return null; }
    return data;
  } catch { return null; }
}

function lsSet<T>(key: string, data: T): void {
  try { localStorage.setItem(key, JSON.stringify({ data, ts: Date.now() })); } catch { /* quota */ }
}

// ── Internal types ────────────────────────────────────────────────────────────
interface TMDbMovie {
  id:                   number;
  title:                string;
  overview:             string;
  poster_path:          string | null;
  vote_average:         number;
  runtime:              number | null;
  genres:               Array<{ id: number; name: string }>;
  production_countries: Array<{ iso_3166_1: string; name: string }>;
  credits?: {
    crew: Array<{ job: string; name: string }>;
  };
}

interface TMDbFindResult {
  movie_results: Array<{ id: number }>;
}

interface TMDbSearchResult {
  results: Array<{ id: number; title: string }>;
}

async function tmdbFetch<T>(path: string): Promise<T> {
  const sep = path.includes('?') ? '&' : '?';
  const url = `${TMDB_BASE}${path}${sep}api_key=${TMDB_KEY}&language=en-US`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`TMDb ${res.status}`);
  return res.json() as Promise<T>;
}

async function resolveTMDbId(movie: MovieLocation): Promise<number | null> {
  // 1. Try IMDb ID look-up
  if (movie.imdbId) {
    try {
      const r = await tmdbFetch<TMDbFindResult>(`/find/${movie.imdbId}?external_source=imdb_id`);
      if (r.movie_results[0]) return r.movie_results[0].id;
    } catch { /* fall through */ }
  }

  // 2. Title + year search with fuzzy match
  try {
    const yearPart = movie.year ? `&year=${movie.year}` : '';
    const r = await tmdbFetch<TMDbSearchResult>(
      `/search/movie?query=${encodeURIComponent(movie.title)}${yearPart}`,
    );
    if (!r.results.length) return null;

    const queryLc = movie.title.toLowerCase();
    const best = r.results.find((res) => {
      const resLc = res.title.toLowerCase();
      const longer  = Math.max(queryLc.length, resLc.length);
      const shorter = Math.min(queryLc.length, resLc.length);
      return shorter / longer > 0.7;
    });

    return (best ?? r.results[0]).id;
  } catch { return null; }
}

// ── Public API ────────────────────────────────────────────────────────────────
export async function enrichMovieWithTMDb(movie: MovieLocation): Promise<MovieLocation> {
  if (!TMDB_KEY) return movie;

  const cacheKey = `tmdb_${movie.wikidataId}`;
  const cached = lsGet<MovieLocation>(cacheKey);
  if (cached) return { ...movie, ...cached };

  try {
    const tmdbId = await resolveTMDbId(movie);
    if (!tmdbId) return movie;

    const detail = await tmdbFetch<TMDbMovie>(`/movie/${tmdbId}?append_to_response=credits`);

    const enriched: MovieLocation = {
      ...movie,
      tmdbId,
      posterPath: detail.poster_path ?? undefined,
      overview:   detail.overview   || undefined,
      genres:     detail.genres.map((g) => g.name),
      director:   detail.credits?.crew.find((c) => c.job === 'Director')?.name,
      rating:     detail.vote_average > 0 ? Math.round(detail.vote_average * 10) / 10 : undefined,
      runtime:    detail.runtime ?? undefined,
      countries:  detail.production_countries.map((c) => c.name),
    };

    // Cache only the enriched fields
    lsSet(cacheKey, {
      tmdbId:     enriched.tmdbId,
      posterPath: enriched.posterPath,
      overview:   enriched.overview,
      genres:     enriched.genres,
      director:   enriched.director,
      rating:     enriched.rating,
      runtime:    enriched.runtime,
      countries:  enriched.countries,
    });

    return enriched;
  } catch {
    return movie;
  }
}

export const tmdbEnabled = !!TMDB_KEY;

import type { MovieLocation, FilmingLocation, WikidataBinding, SeedRecord } from '@/types';

const SPARQL_ENDPOINT = 'https://query.wikidata.org/sparql';
const CACHE_TTL_MS    = 5 * 60 * 1000; // 5 minutes

// ── Coordinate parsing ────────────────────────────────────────────────────────
// Wikidata uses WKT "Point(lng lat)" — longitude comes first!
export function parseCoordinate(wkt: string): [number, number] | null {
  const m = wkt.match(/Point\((-?\d+\.?\d*)\s+(-?\d+\.?\d*)\)/);
  if (!m) return null;
  const lng = parseFloat(m[1]);
  const lat = parseFloat(m[2]);
  if (isNaN(lat) || isNaN(lng)) return null;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
  return [lat, lng];
}

// ── LocalStorage cache helpers ────────────────────────────────────────────────
function lsGet<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const { data, ts } = JSON.parse(raw) as { data: T; ts: number };
    if (Date.now() - ts > CACHE_TTL_MS) { localStorage.removeItem(key); return null; }
    return data;
  } catch { return null; }
}

function lsSet<T>(key: string, data: T): void {
  try { localStorage.setItem(key, JSON.stringify({ data, ts: Date.now() })); } catch { /* quota */ }
}

// ── SPARQL execution ──────────────────────────────────────────────────────────
async function runSparql(sparql: string): Promise<WikidataBinding[]> {
  const cacheKey = `wd_${btoa(encodeURIComponent(sparql.slice(0, 200))).slice(0, 60)}`;
  const cached = lsGet<WikidataBinding[]>(cacheKey);
  if (cached) return cached;

  const url = `${SPARQL_ENDPOINT}?query=${encodeURIComponent(sparql)}&format=json`;
  const res = await fetch(url, {
    headers: {
      Accept:       'application/sparql-results+json',
      'User-Agent': 'CineLocations/1.0 (https://github.com/ejoliet/sandbox)',
    },
  });

  if (!res.ok) throw new Error(`Wikidata error ${res.status}: ${res.statusText}`);

  const json = await res.json() as { results: { bindings: WikidataBinding[] } };
  const bindings = json.results.bindings;
  lsSet(cacheKey, bindings);
  return bindings;
}

// ── Result normalisation ──────────────────────────────────────────────────────
function groupByMovie(bindings: WikidataBinding[]): MovieLocation[] {
  const map = new Map<string, MovieLocation>();

  for (const b of bindings) {
    const wikidataId = b.movie.value.replace('http://www.wikidata.org/entity/', '');
    const title      = b.movieLabel?.value ?? 'Unknown';
    const year       = b.year   ? parseInt(b.year.value)   : null;
    const imdbId     = b.imdbId ? b.imdbId.value           : null;
    const coords     = parseCoordinate(b.coord?.value ?? '');
    if (!coords) continue;

    const [lat, lng] = coords;
    const loc: FilmingLocation = { label: b.locationLabel?.value ?? 'Unknown location', lat, lng };

    const existing = map.get(wikidataId);
    if (existing) {
      const dup = existing.locations.some((l) => l.lat === lat && l.lng === lng);
      if (!dup) existing.locations.push(loc);
    } else {
      map.set(wikidataId, { wikidataId, title, year, imdbId, locations: [loc] });
    }
  }

  return Array.from(map.values());
}

// ── Public API ────────────────────────────────────────────────────────────────

export async function searchMoviesByTitle(query: string): Promise<MovieLocation[]> {
  if (!query || query.trim().length < 2) return [];

  const escaped = query.trim().replace(/"/g, '\\"');
  const sparql = `
SELECT DISTINCT ?movie ?movieLabel ?locationLabel ?coord ?year ?imdbId WHERE {
  ?movie wdt:P31 wd:Q11424 ;
         wdt:P915 ?location .
  ?location wdt:P625 ?coord .
  ?movie rdfs:label ?movieLabel .
  FILTER(CONTAINS(LCASE(?movieLabel), LCASE("${escaped}")))
  FILTER(LANG(?movieLabel) = "en")
  OPTIONAL { ?movie wdt:P577 ?date . BIND(YEAR(?date) AS ?year) }
  OPTIONAL { ?movie wdt:P345 ?imdbId }
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en" . }
}
LIMIT 100`;

  const bindings = await runSparql(sparql);
  return groupByMovie(bindings);
}

export async function getMoviesByLocation(
  lat: number,
  lng: number,
  radiusKm = 30,
): Promise<MovieLocation[]> {
  const sparql = `
SELECT DISTINCT ?movie ?movieLabel ?locationLabel ?coord ?year ?imdbId WHERE {
  ?movie wdt:P31 wd:Q11424 ;
         wdt:P915 ?location .
  SERVICE wikibase:around {
    ?location wdt:P625 ?coord .
    bd:serviceParam wikibase:center "Point(${lng} ${lat})"^^geo:wktLiteral .
    bd:serviceParam wikibase:radius "${radiusKm}" .
  }
  OPTIONAL { ?movie wdt:P577 ?date . BIND(YEAR(?date) AS ?year) }
  OPTIONAL { ?movie wdt:P345 ?imdbId }
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en" . }
}
LIMIT 50`;

  const bindings = await runSparql(sparql);
  return groupByMovie(bindings);
}

// ── Seed data conversion ──────────────────────────────────────────────────────
export function seedRecordsToMovies(records: SeedRecord[]): MovieLocation[] {
  const map = new Map<string, MovieLocation>();

  for (const r of records) {
    const existing = map.get(r.wikidataId);
    if (existing) {
      const dup = existing.locations.some((l) => l.lat === r.lat && l.lng === r.lng);
      if (!dup) existing.locations.push({ label: r.locationLabel, lat: r.lat, lng: r.lng });
    } else {
      map.set(r.wikidataId, {
        wikidataId: r.wikidataId,
        title:      r.title,
        year:       r.year,
        imdbId:     r.imdbId,
        locations:  [{ label: r.locationLabel, lat: r.lat, lng: r.lng }],
      });
    }
  }

  return Array.from(map.values());
}

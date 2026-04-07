// ── Raw Wikidata SPARQL binding ───────────────────────────────────────────────
export interface WikidataBinding {
  movie:         { value: string };
  movieLabel:    { value: string };
  locationLabel: { value: string };
  coord:         { value: string }; // "Point(lng lat)" WKT format
  year?:         { value: string };
  imdbId?:       { value: string };
}

// ── Seed JSON record (one per location) ──────────────────────────────────────
export interface SeedRecord {
  wikidataId:    string;
  title:         string;
  year:          number | null;
  imdbId:        string | null;
  locationLabel: string;
  lat:           number;
  lng:           number;
}

// ── Filming location ──────────────────────────────────────────────────────────
export interface FilmingLocation {
  label:        string;
  lat:          number;
  lng:          number;
  wikidataId?:  string;
}

// ── Full movie record (with optional TMDb enrichment) ────────────────────────
export interface MovieLocation {
  wikidataId:  string;
  title:       string;
  year:        number | null;
  imdbId:      string | null;
  locations:   FilmingLocation[];
  // TMDb-enriched (optional — absent until a movie is selected)
  tmdbId?:     number;
  posterPath?: string;
  overview?:   string;
  genres?:     string[];
  director?:   string;
  rating?:     number;
  runtime?:    number;
  countries?:  string[];
}

// ── Lightweight marker record (for map layer — one per lat/lng) ───────────────
export interface MarkerData {
  id:            string; // wikidataId
  title:         string;
  year:          number | null;
  lat:           number;
  lng:           number;
  locationLabel: string;
}

// ── Filter state ──────────────────────────────────────────────────────────────
export interface FilterState {
  decade:  string | null; // e.g. "1990" → covers 1990–1999
  genre:   string | null;
  country: string | null;
}

// ── Nominatim geocode result ──────────────────────────────────────────────────
export interface GeocodeSuggestion {
  displayName: string;
  lat:         number;
  lng:         number;
}

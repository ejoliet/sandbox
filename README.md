# CineLocations

An interactive world map that lets you explore where movies in history were filmed. Search by movie title to see its filming locations on the map, or click anywhere on the map to discover movies shot in that area.

## Features

- **Dark cinema-themed map** — CartoDB Dark Matter tiles with gold marker clusters
- **Movie search** — type a title, pick from results, map flies to the filming locations
- **Location search** — type a city or region, see movies filmed nearby
- **Map click** — in location mode, click any point on the globe to query for movies shot within 30 km
- **Movie detail panel** — year, genres, director, rating, overview, and a clickable list of filming locations with fly-to buttons
- **TMDb enrichment** — if you provide a free TMDb API key, posters and ratings are loaded automatically; the app works fully without one
- **Decade filter** — narrow the visible markers by decade
- **Responsive** — sidebar on desktop, slide-up bottom sheet on mobile

## Quick Start

### Prerequisites

- Node.js 18+
- npm 9+

### Install

```bash
git clone https://github.com/ejoliet/sandbox.git
cd sandbox
npm install
```

### (Optional) Add a TMDb API key

Posters, ratings, genres, and director info come from [The Movie Database](https://www.themoviedb.org/settings/api). The app works without a key, but movie detail panels will show placeholders instead of posters.

```bash
cp .env.local.example .env.local
# Edit .env.local and set VITE_TMDB_API_KEY=your_key_here
```

### Fetch full location data (optional but recommended)

The repo ships with a curated seed file of ~50 iconic films. To fetch up to 10 000 movies with filming locations from Wikidata, run:

```bash
npm run seed
```

This writes `public/data/movie-locations.json` and takes 1–2 minutes. Requires internet access to `query.wikidata.org`.

### Run the dev server

```bash
npm run dev
```

Open [http://localhost:5173](http://localhost:5173).

## Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start the Vite dev server with hot reload |
| `npm run build` | Type-check and build for production (`dist/`) |
| `npm run preview` | Serve the production build locally |
| `npm run seed` | Fetch movie filming locations from Wikidata and write `public/data/movie-locations.json` |
| `npm run typecheck` | Run TypeScript type checking without emitting files |

## Tech Stack

| Layer | Library |
|---|---|
| Framework | React 18 + TypeScript + Vite |
| Map | [Leaflet](https://leafletjs.com/) + [react-leaflet](https://react-leaflet.js.org/) |
| Clustering | [leaflet.markercluster](https://github.com/Leaflet/Leaflet.markercluster) |
| Map tiles | [CartoDB Dark Matter](https://carto.com/basemaps/) (free, no key needed) |
| UI state | [Zustand](https://github.com/pmndrs/zustand) |
| Server state / caching | [TanStack Query](https://tanstack.com/query/latest) |
| Styling | [Tailwind CSS](https://tailwindcss.com/) |
| Icons | [Lucide React](https://lucide.dev/) |

## Data Sources

| Source | Used for |
|---|---|
| [Wikidata SPARQL](https://query.wikidata.org/) | Filming locations (property P915), coordinates (P625) — free, no key |
| [TMDb API](https://developer.themoviedb.org/) | Posters, ratings, genres, director — free key required |
| [Nominatim / OSM](https://nominatim.openstreetmap.org/) | Place name → coordinates geocoding — free, rate-limited to 1 req/s |

## Project Structure

```
src/
├── components/
│   ├── Layout/       # Header, Sidebar
│   ├── Map/          # MapContainer, MarkerCluster, MovieMarker
│   ├── MoviePanel/   # MovieDetail, LocationList
│   └── Search/       # SearchBar, FilterPanel, SearchResultsList
├── hooks/            # useMapData, useMovieSearch
├── services/         # wikidata.ts, tmdb.ts, geocoding.ts
├── store/            # Zustand store (mapStore.ts)
└── types/            # Shared TypeScript types
public/data/
└── movie-locations.json   # Seed data (committed) — replace with npm run seed
scripts/
└── fetch-seed-data.js     # Wikidata bulk fetch script
```

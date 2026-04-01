/**
 * fetch-seed-data.js
 * Run with: node scripts/fetch-seed-data.js
 *
 * Fetches ~5000 movies with filming locations from Wikidata SPARQL and writes
 * them to public/data/movie-locations.json as a flat array of SeedRecords.
 */

import { writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR   = join(__dirname, '..', 'public', 'data');
const OUT_FILE  = join(OUT_DIR, 'movie-locations.json');

const ENDPOINT = 'https://query.wikidata.org/sparql';
const UA       = 'CineLocations/1.0 (https://github.com/ejoliet/sandbox)';

function parseCoord(wkt) {
  const m = wkt.match(/Point\((-?\d+\.?\d*)\s+(-?\d+\.?\d*)\)/);
  if (!m) return null;
  const lng = parseFloat(m[1]);
  const lat  = parseFloat(m[2]);
  if (isNaN(lat) || isNaN(lng)) return null;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
  return { lat, lng };
}

async function fetchPage(offset, limit = 5000) {
  const sparql = `
SELECT DISTINCT ?movie ?movieLabel ?locationLabel ?coord ?year ?imdbId WHERE {
  ?movie wdt:P31 wd:Q11424 ;
         wdt:P915 ?location .
  ?location wdt:P625 ?coord .
  OPTIONAL { ?movie wdt:P577 ?date . BIND(YEAR(?date) AS ?year) }
  OPTIONAL { ?movie wdt:P345 ?imdbId }
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en" . }
}
ORDER BY DESC(?year)
LIMIT ${limit}
OFFSET ${offset}`;

  const url = `${ENDPOINT}?query=${encodeURIComponent(sparql)}&format=json`;

  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      const res = await fetch(url, {
        headers: { Accept: 'application/sparql-results+json', 'User-Agent': UA },
      });
      if (res.status === 429 || res.status === 503) {
        const wait = Math.pow(2, attempt + 2) * 1000;
        console.warn(`  Rate limited (${res.status}) — retrying in ${wait / 1000}s…`);
        await new Promise((r) => setTimeout(r, wait));
        continue;
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      return json.results.bindings;
    } catch (err) {
      if (attempt === 3) throw err;
      const wait = Math.pow(2, attempt + 1) * 1000;
      console.warn(`  Error: ${err.message} — retrying in ${wait / 1000}s…`);
      await new Promise((r) => setTimeout(r, wait));
    }
  }
  return [];
}

async function main() {
  console.log('🎬  CineLocations seed data fetcher');
  console.log('────────────────────────────────────');

  mkdirSync(OUT_DIR, { recursive: true });

  const records = [];
  const seen    = new Set();
  let   offset  = 0;
  const limit   = 5000;
  let   page    = 1;

  while (true) {
    console.log(`\n📡  Page ${page} (offset ${offset})…`);
    const bindings = await fetchPage(offset, limit);
    console.log(`    Received ${bindings.length} bindings`);

    if (bindings.length === 0) break;

    let added = 0;
    for (const b of bindings) {
      const wikidataId    = b.movie.value.replace('http://www.wikidata.org/entity/', '');
      const title         = b.movieLabel?.value ?? '';
      const locationLabel = b.locationLabel?.value ?? '';
      const coordStr      = b.coord?.value ?? '';
      const year          = b.year   ? parseInt(b.year.value)   : null;
      const imdbId        = b.imdbId ? b.imdbId.value           : null;

      if (!title || !coordStr) continue;
      const coord = parseCoord(coordStr);
      if (!coord) continue;

      const key = `${wikidataId}_${coord.lat.toFixed(5)}_${coord.lng.toFixed(5)}`;
      if (seen.has(key)) continue;
      seen.add(key);

      records.push({
        wikidataId,
        title,
        year,
        imdbId,
        locationLabel,
        lat: coord.lat,
        lng: coord.lng,
      });
      added++;
    }

    console.log(`    Added ${added} new records (total: ${records.length})`);

    // Stop if fewer results than limit (last page) or we have enough
    if (bindings.length < limit || records.length >= 10000) break;

    offset += limit;
    page++;

    // Be polite to Wikidata — wait 3 seconds between pages
    await new Promise((r) => setTimeout(r, 3000));
  }

  writeFileSync(OUT_FILE, JSON.stringify(records, null, 2), 'utf8');
  console.log(`\n✅  Written ${records.length} records → ${OUT_FILE}`);
}

main().catch((err) => {
  console.error('\n❌  Seed fetch failed:', err.message);
  process.exit(1);
});

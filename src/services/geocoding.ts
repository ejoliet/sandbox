import type { GeocodeSuggestion } from '@/types';

const NOMINATIM = 'https://nominatim.openstreetmap.org';
const MIN_INTERVAL_MS = 1100; // Nominatim policy: max 1 req/sec
const UA = 'CineLocations/1.0 (https://github.com/ejoliet/sandbox)';

let lastRequest = 0;

async function rateLimited(url: string): Promise<Response> {
  const wait = MIN_INTERVAL_MS - (Date.now() - lastRequest);
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  lastRequest = Date.now();
  return fetch(url, { headers: { 'User-Agent': UA, 'Accept-Language': 'en' } });
}

interface NominatimResult {
  lat:          string;
  lon:          string;
  display_name: string;
}

interface NominatimReverseResult {
  display_name: string;
  address: {
    city?:    string;
    town?:    string;
    village?: string;
    county?:  string;
    country?: string;
  };
}

export async function geocodeLocation(query: string): Promise<GeocodeSuggestion[]> {
  if (!query.trim()) return [];
  try {
    const url = `${NOMINATIM}/search?q=${encodeURIComponent(query)}&format=json&limit=5&addressdetails=0`;
    const res = await rateLimited(url);
    if (!res.ok) return [];
    const results: NominatimResult[] = await res.json();
    return results.map((r) => ({
      displayName: r.display_name,
      lat:         parseFloat(r.lat),
      lng:         parseFloat(r.lon),
    }));
  } catch { return []; }
}

export async function reverseGeocode(lat: number, lng: number): Promise<string> {
  try {
    const url = `${NOMINATIM}/reverse?lat=${lat}&lon=${lng}&format=json`;
    const res = await rateLimited(url);
    if (!res.ok) return `${lat.toFixed(2)}°, ${lng.toFixed(2)}°`;
    const data: NominatimReverseResult = await res.json();
    const addr  = data.address ?? {};
    const parts = [addr.city ?? addr.town ?? addr.village ?? addr.county, addr.country].filter(Boolean);
    return parts.length ? parts.join(', ') : data.display_name;
  } catch {
    return `${lat.toFixed(2)}°, ${lng.toFixed(2)}°`;
  }
}

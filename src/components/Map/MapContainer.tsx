import { useEffect } from 'react';
import { MapContainer as LeafletMapContainer, TileLayer, useMap, useMapEvents } from 'react-leaflet';
import { Loader2 } from 'lucide-react';
import MarkerCluster from './MarkerCluster';
import { useMapStore } from '@/store/mapStore';
import { useMapData, useFilteredMarkers } from '@/hooks/useMapData';
import { getMoviesByLocation } from '@/services/wikidata';
import { reverseGeocode } from '@/services/geocoding';

// ── Map event handler (click → location search) ───────────────────────────────
function MapEvents() {
  const { setSearchResults, setSidebarOpen, setIsSearching, searchMode } = useMapStore();

  useMapEvents({
    click: async (e) => {
      if (searchMode !== 'location') return; // only in location mode
      const { lat, lng } = e.latlng;
      setIsSearching(true);
      setSidebarOpen(true);
      try {
        const [movies] = await Promise.all([
          getMoviesByLocation(lat, lng, 30),
          reverseGeocode(lat, lng),
        ]);
        setSearchResults(movies);
      } catch (err) {
        console.error('Location search failed:', err);
      } finally {
        setIsSearching(false);
      }
    },
  });

  return null;
}

// ── Fly to selected movie + register flyTo in store ──────────────────────────
function FlyToSelected() {
  const map           = useMap();
  const selectedMovie = useMapStore((s) => s.selectedMovie);
  const registerFlyTo = useMapStore((s) => s.registerFlyTo);

  // Register imperative flyTo so sidebar components can trigger it
  useEffect(() => {
    registerFlyTo((lat, lng, zoom = 12) => {
      map.flyTo([lat, lng], zoom, { duration: 1.2, easeLinearity: 0.3 });
    });
  }, [map, registerFlyTo]);

  // Auto-fly when movie is selected
  useEffect(() => {
    if (!selectedMovie?.locations[0]) return;
    const { lat, lng } = selectedMovie.locations[0];
    map.flyTo([lat, lng], Math.max(map.getZoom(), 8), { duration: 1.5, easeLinearity: 0.3 });
  }, [selectedMovie, map]);

  return null;
}

// ── Map zoom label ────────────────────────────────────────────────────────────
function ModeLabel() {
  const { searchMode } = useMapStore();

  if (searchMode !== 'location') return null;

  return (
    <div
      className="absolute bottom-6 left-1/2 -translate-x-1/2 pointer-events-none"
      style={{ zIndex: 999 }}
    >
      <div className="bg-cinema-gold/90 text-cinema-bg text-xs font-semibold px-3 py-1 rounded-full shadow-lg">
        Click the map to find movies filmed here
      </div>
    </div>
  );
}

// ── Main map component ────────────────────────────────────────────────────────
export default function MapContainer() {
  const { markers, isLoading, error, totalRecords } = useMapData();
  const filters   = useMapStore((s) => s.filters);
  const filtered  = useFilteredMarkers(markers, filters);

  return (
    <div className="absolute inset-0">
      <LeafletMapContainer
        center={[20, 0]}
        zoom={2}
        minZoom={2}
        maxZoom={18}
        zoomControl={false}
        attributionControl={true}
        className="w-full h-full"
        style={{ background: '#0a0a0f' }}
      >
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
          maxZoom={19}
          subdomains="abcd"
        />

        <MapEvents />
        <FlyToSelected />

        {markers.length > 0 && (
          <MarkerCluster markers={filtered} />
        )}
      </LeafletMapContainer>

      {/* Loading overlay */}
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-cinema-bg/80" style={{ zIndex: 998 }}>
          <div className="flex flex-col items-center gap-3">
            <Loader2 size={32} className="text-cinema-gold animate-spin" />
            <p className="text-cinema-muted text-sm">Loading movie locations…</p>
          </div>
        </div>
      )}

      {/* Seed data error */}
      {error && (
        <div className="absolute top-4 right-4 bg-cinema-card border border-red-800 rounded-lg px-4 py-3 text-sm max-w-xs" style={{ zIndex: 998 }}>
          <p className="text-red-400 font-medium mb-1">Seed data not found</p>
          <p className="text-cinema-muted">Run <code className="text-cinema-gold bg-black/30 px-1 rounded">npm run seed</code> then refresh.</p>
        </div>
      )}

      {/* Record count badge */}
      {!isLoading && totalRecords > 0 && (
        <div className="absolute bottom-6 right-4 bg-cinema-bg/80 border border-cinema-border text-cinema-muted text-xs px-2 py-1 rounded" style={{ zIndex: 998 }}>
          {totalRecords.toLocaleString()} filming locations loaded
        </div>
      )}

      <ModeLabel />
    </div>
  );
}

import { MapPin, Navigation } from 'lucide-react';
import { useMapStore } from '@/store/mapStore';
import type { FilmingLocation } from '@/types';

interface LocationListProps {
  locations: FilmingLocation[];
}

export default function LocationList({ locations }: LocationListProps) {
  const { flyTo, setHoveredMarkerId } = useMapStore();

  return (
    <div>
      <h3 className="text-xs font-semibold uppercase tracking-wider text-cinema-muted mb-2 flex items-center gap-1.5">
        <MapPin size={12} /> Filming Locations
      </h3>
      <ul className="space-y-0.5">
        {locations.map((loc, i) => (
          <li
            key={i}
            className="flex items-center justify-between gap-2 px-2 py-1.5 rounded hover:bg-cinema-card group transition-colors"
            onMouseEnter={() => setHoveredMarkerId(loc.wikidataId ?? null)}
            onMouseLeave={() => setHoveredMarkerId(null)}
          >
            <div className="flex items-center gap-1.5 min-w-0">
              <div className="w-1.5 h-1.5 rounded-full bg-cinema-gold shrink-0" />
              <span className="text-cinema-text text-xs truncate">{loc.label}</span>
            </div>
            {flyTo && (
              <button
                onClick={() => flyTo(loc.lat, loc.lng, 12)}
                title="Fly to this location on the map"
                className="opacity-0 group-hover:opacity-100 text-cinema-gold hover:text-white transition-opacity shrink-0"
              >
                <Navigation size={12} />
              </button>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

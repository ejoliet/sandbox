import { Film, MapPin } from 'lucide-react';
import { useMapStore } from '@/store/mapStore';
import type { MovieLocation } from '@/types';

interface SearchResultsListProps {
  results: MovieLocation[];
}

export default function SearchResultsList({ results }: SearchResultsListProps) {
  const { setSelectedMovie, isSearching } = useMapStore();

  if (isSearching) {
    return (
      <div className="p-4 space-y-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="skeleton h-14 rounded-lg" />
        ))}
      </div>
    );
  }

  if (!results.length) {
    return (
      <div className="p-6 text-center text-cinema-muted text-sm">
        No movies found in this area.
      </div>
    );
  }

  return (
    <div>
      <div className="px-3 py-2 text-[11px] text-cinema-muted uppercase tracking-wider border-b border-cinema-border">
        {results.length} movie{results.length !== 1 ? 's' : ''} found
      </div>
      <ul>
        {results.map((movie) => (
          <li key={movie.wikidataId} className="border-b border-cinema-border last:border-0">
            <button
              className="w-full text-left px-3 py-3 hover:bg-cinema-card transition-colors"
              onClick={() => setSelectedMovie(movie)}
            >
              <div className="flex items-start gap-2">
                <Film size={14} className="text-cinema-gold mt-0.5 shrink-0" />
                <div className="min-w-0">
                  <div className="text-cinema-text text-sm font-medium">{movie.title}</div>
                  <div className="text-cinema-muted text-xs mt-0.5 flex items-center gap-1">
                    {movie.year && <span>{movie.year}</span>}
                    {movie.year && <span>·</span>}
                    <MapPin size={10} />
                    <span>{movie.locations.length} location{movie.locations.length !== 1 ? 's' : ''}</span>
                  </div>
                </div>
              </div>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

import { useRef, useState, useEffect } from 'react';
import { Search, MapPin, Loader2, X, Film, Map } from 'lucide-react';
import { useMapStore } from '@/store/mapStore';
import { useMovieSearch, useDebounce } from '@/hooks/useMovieSearch';
import { geocodeLocation } from '@/services/geocoding';
import { getMoviesByLocation } from '@/services/wikidata';
import type { MovieLocation, GeocodeSuggestion } from '@/types';

export default function SearchBar() {
  const {
    searchQuery, searchMode, isSearching,
    setSearchQuery, setSearchMode,
    setSelectedMovie, setSearchResults, setSidebarOpen, setIsSearching,
  } = useMapStore();

  const [showDropdown, setShowDropdown] = useState(false);
  const [locationSuggestions, setLocationSuggestions] = useState<GeocodeSuggestion[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  // Movie search (via hook)
  const { results: movieResults } = useMovieSearch();

  // Location autocomplete
  const debouncedQuery = useDebounce(searchQuery, 600);

  useEffect(() => {
    if (searchMode !== 'location' || debouncedQuery.trim().length < 2) {
      setLocationSuggestions([]);
      return;
    }
    let cancelled = false;
    geocodeLocation(debouncedQuery).then((s) => {
      if (!cancelled) setLocationSuggestions(s);
    });
    return () => { cancelled = true; };
  }, [debouncedQuery, searchMode]);

  const handleClear = () => {
    setSearchQuery('');
    setSearchResults([]);
    setLocationSuggestions([]);
    setShowDropdown(false);
    inputRef.current?.focus();
  };

  const handleMovieSelect = (movie: MovieLocation) => {
    setSelectedMovie(movie);
    setShowDropdown(false);
    setSearchQuery(movie.title);
  };

  const handleLocationSelect = async (suggestion: GeocodeSuggestion) => {
    setShowDropdown(false);
    setSearchQuery(suggestion.displayName.split(',')[0]);
    setIsSearching(true);
    setSidebarOpen(true);
    try {
      const movies = await getMoviesByLocation(suggestion.lat, suggestion.lng, 30);
      setSearchResults(movies);
    } catch (err) {
      console.error(err);
    } finally {
      setIsSearching(false);
    }
  };

  const hasResults = searchMode === 'movie'
    ? movieResults.length > 0
    : locationSuggestions.length > 0;

  return (
    <div className="relative">
      {/* Mode toggle */}
      <div className="flex rounded-md overflow-hidden border border-cinema-border mb-2 text-xs">
        <button
          onClick={() => setSearchMode('movie')}
          className={[
            'flex-1 flex items-center justify-center gap-1.5 py-1.5 transition-colors',
            searchMode === 'movie'
              ? 'bg-cinema-gold text-cinema-bg font-semibold'
              : 'bg-cinema-card text-cinema-muted hover:text-cinema-text',
          ].join(' ')}
        >
          <Film size={12} /> Movie title
        </button>
        <button
          onClick={() => setSearchMode('location')}
          className={[
            'flex-1 flex items-center justify-center gap-1.5 py-1.5 transition-colors',
            searchMode === 'location'
              ? 'bg-cinema-gold text-cinema-bg font-semibold'
              : 'bg-cinema-card text-cinema-muted hover:text-cinema-text',
          ].join(' ')}
        >
          <Map size={12} /> Location
        </button>
      </div>

      {/* Input */}
      <div className="relative">
        <div className="absolute left-3 top-1/2 -translate-y-1/2 text-cinema-muted pointer-events-none">
          {isSearching
            ? <Loader2 size={15} className="animate-spin" />
            : searchMode === 'movie' ? <Search size={15} /> : <MapPin size={15} />
          }
        </div>

        <input
          ref={inputRef}
          value={searchQuery}
          onChange={(e) => { setSearchQuery(e.target.value); setShowDropdown(true); }}
          onFocus={() => setShowDropdown(true)}
          onBlur={() => setTimeout(() => setShowDropdown(false), 150)}
          onKeyDown={(e) => { if (e.key === 'Escape') { setShowDropdown(false); handleClear(); } }}
          placeholder={searchMode === 'movie' ? 'Search movie title…' : 'Search a place or city…'}
          className="w-full bg-cinema-card border border-cinema-border text-cinema-text placeholder-cinema-muted rounded-lg pl-9 pr-9 py-2.5 text-sm focus:outline-none focus:border-cinema-gold transition-colors"
        />

        {searchQuery && (
          <button
            onMouseDown={(e) => e.preventDefault()}
            onClick={handleClear}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-cinema-muted hover:text-cinema-text"
          >
            <X size={14} />
          </button>
        )}
      </div>

      {/* Dropdown */}
      {showDropdown && hasResults && (
        <div className="absolute left-0 right-0 top-full mt-1 bg-cinema-card border border-cinema-border rounded-lg shadow-xl overflow-hidden animate-fade-in" style={{ zIndex: 1100 }}>
          {searchMode === 'movie' ? (
            <MovieDropdown results={movieResults} onSelect={handleMovieSelect} />
          ) : (
            <LocationDropdown suggestions={locationSuggestions} onSelect={handleLocationSelect} />
          )}
        </div>
      )}
    </div>
  );
}

function MovieDropdown({ results, onSelect }: { results: MovieLocation[]; onSelect: (m: MovieLocation) => void }) {
  return (
    <ul>
      {results.slice(0, 8).map((movie) => (
        <li key={movie.wikidataId}>
          <button
            className="w-full text-left px-3 py-2.5 hover:bg-cinema-surface flex items-start gap-2 transition-colors"
            onMouseDown={(e) => { e.preventDefault(); onSelect(movie); }}
          >
            <Film size={13} className="text-cinema-gold mt-0.5 shrink-0" />
            <div className="min-w-0">
              <div className="text-cinema-text text-sm font-medium truncate">{movie.title}</div>
              <div className="text-cinema-muted text-xs">
                {movie.year && <span>{movie.year} · </span>}
                {movie.locations.length} location{movie.locations.length !== 1 ? 's' : ''}
              </div>
            </div>
          </button>
        </li>
      ))}
      {results.length > 8 && (
        <li className="px-3 py-2 text-xs text-cinema-muted border-t border-cinema-border text-center">
          +{results.length - 8} more results — refine your search
        </li>
      )}
    </ul>
  );
}

function LocationDropdown({ suggestions, onSelect }: { suggestions: GeocodeSuggestion[]; onSelect: (s: GeocodeSuggestion) => void }) {
  return (
    <ul>
      {suggestions.map((s, i) => (
        <li key={i}>
          <button
            className="w-full text-left px-3 py-2.5 hover:bg-cinema-surface flex items-start gap-2 transition-colors"
            onMouseDown={(e) => { e.preventDefault(); onSelect(s); }}
          >
            <MapPin size={13} className="text-cinema-gold mt-0.5 shrink-0" />
            <div className="text-cinema-text text-sm truncate">{s.displayName}</div>
          </button>
        </li>
      ))}
    </ul>
  );
}

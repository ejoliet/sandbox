import { create } from 'zustand';
import type { MovieLocation, FilterState } from '@/types';

interface MapStore {
  // Selection
  selectedMovie:    MovieLocation | null;
  hoveredMarkerId:  string | null;
  // Filters
  filters:          FilterState;
  // Search
  searchQuery:      string;
  searchMode:       'movie' | 'location';
  searchResults:    MovieLocation[];
  isSearching:      boolean;
  // Layout
  sidebarOpen:      boolean;
  // Map view
  mapCenter:        [number, number];
  mapZoom:          number;
  // Highlighted marker set (wikidataIds)
  highlightedIds:   Set<string>;
  // Imperative map actions (registered by MapContainer child)
  flyTo:            ((lat: number, lng: number, zoom?: number) => void) | null;

  // Actions
  setSelectedMovie:   (movie: MovieLocation | null) => void;
  setHoveredMarkerId: (id: string | null) => void;
  setFilters:         (filters: Partial<FilterState>) => void;
  clearFilters:       () => void;
  setSearchQuery:     (query: string) => void;
  setSearchMode:      (mode: 'movie' | 'location') => void;
  setSearchResults:   (results: MovieLocation[]) => void;
  setIsSearching:     (value: boolean) => void;
  setSidebarOpen:     (open: boolean) => void;
  setMapView:         (center: [number, number], zoom: number) => void;
  setHighlightedIds:  (ids: Set<string>) => void;
  registerFlyTo:      (fn: (lat: number, lng: number, zoom?: number) => void) => void;
}

// Zustand v4 curried create for correct TypeScript inference
export const useMapStore = create<MapStore>()((set) => ({
  selectedMovie:   null,
  hoveredMarkerId: null,
  filters:         { decade: null, genre: null, country: null },
  searchQuery:     '',
  searchMode:      'movie',
  searchResults:   [],
  isSearching:     false,
  sidebarOpen:     false,
  mapCenter:       [20, 0],
  mapZoom:         2,
  highlightedIds:  new Set(),
  flyTo:           null,

  setSelectedMovie: (movie) =>
    set({
      selectedMovie:  movie,
      sidebarOpen:    true,
      highlightedIds: movie ? new Set([movie.wikidataId]) : new Set(),
    }),

  setHoveredMarkerId: (id) => set({ hoveredMarkerId: id }),

  setFilters: (filters) =>
    set((s) => ({ filters: { ...s.filters, ...filters } })),

  clearFilters: () =>
    set({ filters: { decade: null, genre: null, country: null } }),

  setSearchQuery:    (searchQuery)    => set({ searchQuery }),
  setSearchMode:     (searchMode)     => set({ searchMode, searchResults: [] }),
  setSearchResults:  (searchResults)  => set({ searchResults }),
  setIsSearching:    (isSearching)    => set({ isSearching }),
  setSidebarOpen:    (sidebarOpen)    => set({ sidebarOpen }),
  setMapView:        (mapCenter, mapZoom) => set({ mapCenter, mapZoom }),
  setHighlightedIds: (highlightedIds) => set({ highlightedIds }),
  registerFlyTo:     (fn)             => set({ flyTo: fn }),
}));

import { X, ChevronUp } from 'lucide-react';
import { useMapStore } from '@/store/mapStore';
import SearchBar from '@/components/Search/SearchBar';
import FilterPanel from '@/components/Search/FilterPanel';
import MovieDetail from '@/components/MoviePanel/MovieDetail';
import SearchResultsList from '@/components/Search/SearchResultsList';

export default function Sidebar() {
  const { sidebarOpen, selectedMovie, searchResults, setSidebarOpen, setSelectedMovie } = useMapStore();

  return (
    <>
      {/* Desktop sidebar */}
      <aside
        className={[
          'hidden lg:flex flex-col',
          'w-96 shrink-0 h-full',
          'bg-cinema-surface border-r border-cinema-border',
          'overflow-hidden',
        ].join(' ')}
        style={{ zIndex: 999 }}
      >
        <SidebarContent />
      </aside>

      {/* Mobile bottom sheet */}
      <div
        className={[
          'lg:hidden fixed bottom-0 left-0 right-0',
          'bg-cinema-surface border-t border-cinema-border',
          'transition-transform duration-300 ease-in-out',
          sidebarOpen ? 'translate-y-0' : 'translate-y-full',
        ].join(' ')}
        style={{ zIndex: 999, maxHeight: '80vh' }}
      >
        {/* Drag handle */}
        <div className="flex items-center justify-between px-4 py-2 border-b border-cinema-border">
          <div className="w-10 h-1 rounded-full bg-cinema-border mx-auto" />
          <button
            onClick={() => setSidebarOpen(false)}
            className="absolute right-4 top-2 text-cinema-muted hover:text-cinema-text"
          >
            <X size={18} />
          </button>
        </div>
        <div className="overflow-y-auto custom-scrollbar" style={{ maxHeight: 'calc(80vh - 40px)' }}>
          <SidebarContent />
        </div>
      </div>

      {/* Mobile open button (when sidebar is closed) */}
      {!sidebarOpen && (
        <button
          className="lg:hidden fixed bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-2 px-4 py-2 rounded-full bg-cinema-gold text-cinema-bg font-medium text-sm shadow-lg"
          style={{ zIndex: 998 }}
          onClick={() => setSidebarOpen(true)}
        >
          <ChevronUp size={16} />
          Search &amp; Results
        </button>
      )}
    </>
  );
}

function SidebarContent() {
  const { selectedMovie, searchResults, setSelectedMovie } = useMapStore();

  return (
    <div className="flex flex-col h-full">
      {/* Search is always visible */}
      <div className="p-3 border-b border-cinema-border shrink-0">
        <SearchBar />
        <FilterPanel />
      </div>

      {/* Dynamic body */}
      <div className="flex-1 overflow-y-auto custom-scrollbar">
        {selectedMovie ? (
          <MovieDetail />
        ) : searchResults.length > 0 ? (
          <SearchResultsList results={searchResults} />
        ) : (
          <EmptyState />
        )}
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center h-full px-6 text-center gap-4 opacity-60">
      <div className="text-5xl">🎬</div>
      <p className="text-cinema-muted text-sm leading-relaxed">
        Search for a movie title to see where it was filmed, or click anywhere on the map to discover movies shot in that area.
      </p>
    </div>
  );
}

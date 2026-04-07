import { useState } from 'react';
import { ChevronDown, SlidersHorizontal, X } from 'lucide-react';
import { useMapStore } from '@/store/mapStore';

const DECADES = ['1920','1930','1940','1950','1960','1970','1980','1990','2000','2010','2020'];

export default function FilterPanel() {
  const { filters, setFilters, clearFilters } = useMapStore();
  const [open, setOpen] = useState(false);

  const activeCount = [filters.decade, filters.genre, filters.country].filter(Boolean).length;

  return (
    <div className="mt-2">
      {/* Toggle */}
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 text-xs text-cinema-muted hover:text-cinema-text transition-colors w-full"
      >
        <SlidersHorizontal size={12} />
        <span>Filters</span>
        {activeCount > 0 && (
          <span className="ml-auto bg-cinema-gold text-cinema-bg text-[10px] font-bold px-1.5 rounded-full">{activeCount}</span>
        )}
        <ChevronDown size={12} className={`ml-auto transition-transform ${open ? 'rotate-180' : ''} ${activeCount > 0 ? '' : ''}`} />
      </button>

      {open && (
        <div className="mt-2 animate-fade-in">
          {/* Decade filter */}
          <div className="mb-3">
            <div className="text-[11px] text-cinema-muted font-medium uppercase tracking-wider mb-1.5">Decade</div>
            <div className="flex flex-wrap gap-1">
              {DECADES.map((d) => (
                <button
                  key={d}
                  onClick={() => setFilters({ decade: filters.decade === d ? null : d })}
                  className={[
                    'px-2 py-0.5 rounded text-[11px] font-medium border transition-colors',
                    filters.decade === d
                      ? 'bg-cinema-gold border-cinema-gold text-cinema-bg'
                      : 'border-cinema-border text-cinema-muted hover:border-cinema-gold hover:text-cinema-gold',
                  ].join(' ')}
                >
                  {d}s
                </button>
              ))}
            </div>
          </div>

          {/* Clear */}
          {activeCount > 0 && (
            <button
              onClick={clearFilters}
              className="flex items-center gap-1 text-[11px] text-red-400 hover:text-red-300 transition-colors"
            >
              <X size={11} /> Clear all filters
            </button>
          )}
        </div>
      )}
    </div>
  );
}

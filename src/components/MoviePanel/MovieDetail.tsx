import { ArrowLeft, Star, Clock, Globe, User, ChevronDown, ChevronUp } from 'lucide-react';
import { useState } from 'react';
import { useMapStore } from '@/store/mapStore';
import { useMovieEnrichment } from '@/hooks/useMovieSearch';
import { getTMDbImageUrl } from '@/services/tmdb';
import { tmdbEnabled } from '@/services/tmdb';
import LocationList from './LocationList';

export default function MovieDetail() {
  const { selectedMovie, setSelectedMovie } = useMapStore();
  const enriched = useMovieEnrichment(selectedMovie);
  const movie    = enriched ?? selectedMovie;

  const [overviewExpanded, setOverviewExpanded] = useState(false);

  if (!movie) return null;

  const isLoading = tmdbEnabled && !enriched?.posterPath && !!movie.imdbId;

  return (
    <div className="animate-fade-in">
      {/* Back button */}
      <button
        onClick={() => setSelectedMovie(null)}
        className="flex items-center gap-1.5 text-cinema-muted hover:text-cinema-gold text-xs px-3 py-2 border-b border-cinema-border w-full transition-colors"
      >
        <ArrowLeft size={13} /> Back to results
      </button>

      {/* Poster */}
      <div className="relative aspect-[2/3] w-full max-h-72 overflow-hidden bg-cinema-card">
        {isLoading ? (
          <div className="skeleton w-full h-full" />
        ) : movie.posterPath ? (
          <img
            src={getTMDbImageUrl(movie.posterPath, 'w342')}
            alt={`${movie.title} poster`}
            className="w-full h-full object-cover"
            loading="lazy"
          />
        ) : (
          <PosterPlaceholder title={movie.title} />
        )}
        {/* Gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-cinema-surface via-transparent to-transparent" />
      </div>

      {/* Movie info */}
      <div className="p-4 space-y-4">

        {/* Title + meta */}
        <div>
          <h2 className="font-cinzel font-semibold text-xl text-cinema-text leading-tight">{movie.title}</h2>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1.5 text-xs text-cinema-muted">
            {movie.year && <span>{movie.year}</span>}
            {movie.rating && (
              <span className="flex items-center gap-0.5 text-cinema-gold">
                <Star size={11} fill="currentColor" /> {movie.rating.toFixed(1)}
              </span>
            )}
            {movie.runtime && (
              <span className="flex items-center gap-0.5">
                <Clock size={11} /> {Math.floor(movie.runtime / 60)}h {movie.runtime % 60}m
              </span>
            )}
          </div>
        </div>

        {/* Genres */}
        {movie.genres && movie.genres.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {movie.genres.map((g: string) => (
              <span key={g} className="text-[10px] px-2 py-0.5 rounded-full border border-cinema-border text-cinema-muted">
                {g}
              </span>
            ))}
          </div>
        )}

        {/* Director */}
        {movie.director && (
          <div className="flex items-center gap-1.5 text-xs text-cinema-muted">
            <User size={12} /> <span className="text-cinema-text font-medium">{movie.director}</span>
          </div>
        )}

        {/* Countries */}
        {movie.countries && movie.countries.length > 0 && (
          <div className="flex items-center gap-1.5 text-xs text-cinema-muted">
            <Globe size={12} /> <span>{movie.countries.join(', ')}</span>
          </div>
        )}

        {/* Overview */}
        {isLoading ? (
          <div className="space-y-1.5">
            <div className="skeleton h-3 rounded w-full" />
            <div className="skeleton h-3 rounded w-5/6" />
            <div className="skeleton h-3 rounded w-4/6" />
          </div>
        ) : movie.overview ? (
          <div>
            <p className={`text-cinema-muted text-xs leading-relaxed ${!overviewExpanded ? 'line-clamp-4' : ''}`}>
              {movie.overview}
            </p>
            {movie.overview.length > 200 && (
              <button
                onClick={() => setOverviewExpanded((e) => !e)}
                className="flex items-center gap-0.5 text-cinema-gold text-[11px] mt-1 hover:underline"
              >
                {overviewExpanded ? <><ChevronUp size={11} /> Show less</> : <><ChevronDown size={11} /> Show more</>}
              </button>
            )}
          </div>
        ) : null}

        {/* Divider */}
        <div className="border-t border-cinema-border" />

        {/* Filming locations */}
        <LocationList locations={movie.locations} />

        {/* IMDb link */}
        {movie.imdbId && (
          <a
            href={`https://www.imdb.com/title/${movie.imdbId}/`}
            target="_blank"
            rel="noopener noreferrer"
            className="block text-center text-[11px] text-cinema-muted hover:text-cinema-gold transition-colors border border-cinema-border rounded py-1.5 hover:border-cinema-gold"
          >
            View on IMDb ↗
          </a>
        )}
      </div>
    </div>
  );
}

function PosterPlaceholder({ title }: { title: string }) {
  return (
    <div className="w-full h-full flex flex-col items-center justify-center bg-cinema-card gap-3 p-4">
      <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#D4AF37" strokeWidth="1">
        <rect x="2" y="2" width="20" height="20" rx="2" />
        <circle cx="8.5" cy="8.5" r="1.5" />
        <polyline points="21 15 16 10 5 21" />
      </svg>
      <span className="text-cinema-muted text-xs text-center leading-snug">{title}</span>
    </div>
  );
}

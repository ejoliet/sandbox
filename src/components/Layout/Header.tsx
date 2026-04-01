import { Film } from 'lucide-react';

export default function Header() {
  return (
    <header
      className="relative flex items-center h-12 px-4 bg-cinema-surface border-b border-cinema-border shrink-0"
      style={{ zIndex: 1000 }}
    >
      {/* Film strip left */}
      <div className="film-strip absolute left-0 top-0 h-full w-8 opacity-30" />

      {/* Logo + title */}
      <div className="flex items-center gap-2 ml-8">
        <Film size={20} className="text-cinema-gold" />
        <span className="font-cinzel font-semibold text-lg tracking-wider"
              style={{ background: 'linear-gradient(90deg, #D4AF37, #f5e090, #D4AF37)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
          CineLocations
        </span>
      </div>

      {/* Tagline */}
      <span className="ml-3 text-xs text-cinema-muted hidden sm:block font-light tracking-widest uppercase">
        Explore the world through film
      </span>

      {/* Film strip right */}
      <div className="film-strip absolute right-0 top-0 h-full w-8 opacity-30" />
    </header>
  );
}

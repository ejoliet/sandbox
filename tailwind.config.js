/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        cinema: {
          bg:       '#0a0a0f',
          surface:  '#111119',
          card:     '#1a1a28',
          border:   '#2a2a3a',
          gold:     '#D4AF37',
          'gold-dim': '#B8860B',
          text:     '#e8e8f0',
          muted:    '#8888aa',
        },
      },
      fontFamily: {
        cinzel: ['Cinzel', 'serif'],
      },
      animation: {
        'pulse-gold': 'pulseGold 1.5s ease-in-out infinite',
        'slide-in':   'slideIn 0.3s ease-out',
        'fade-in':    'fadeIn 0.2s ease-out',
      },
      keyframes: {
        pulseGold: {
          '0%, 100%': { boxShadow: '0 0 6px 2px rgba(212,175,55,0.4)' },
          '50%':      { boxShadow: '0 0 16px 6px rgba(212,175,55,0.8)' },
        },
        slideIn: {
          from: { transform: 'translateX(-100%)' },
          to:   { transform: 'translateX(0)' },
        },
        fadeIn: {
          from: { opacity: '0' },
          to:   { opacity: '1' },
        },
      },
    },
  },
  plugins: [],
};

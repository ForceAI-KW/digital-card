import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        // Nardo Lux
        ink: '#0A0A0B',
        nardo: '#686A6C',
        // Force Brand
        wine: '#2D1418',
        'wine-elev': '#3D2128',
        orange: '#FF7700',
        'orange-hover': '#FF8A1A',
        cream: '#ECECEC',
      },
      borderRadius: {
        pill: '9999px',
      },
      letterSpacing: {
        'wider-12': '0.12em',
        'wider-15': '0.15em',
      },
      fontFamily: {
        sans:  ['var(--font-sans)',  'system-ui', 'sans-serif'],
        serif: ['var(--font-serif)', 'serif'],
      },
    },
  },
  plugins: [],
};
export default config;

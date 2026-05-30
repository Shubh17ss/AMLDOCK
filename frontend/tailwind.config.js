/** @type {import('tailwindcss').Config} */
export default {
  // MUI ships its own baseline reset (CssBaseline) — disabling Tailwind's preflight
  // keeps Tailwind a pure utility layer so it doesn't fight MUI.
  corePlugins: { preflight: false },
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        // Deep, trust-building blues. Used in the landing page palette.
        trust: {
          50: '#f3f7fb',
          100: '#e1ecf6',
          200: '#bfd6ea',
          300: '#94b8d8',
          400: '#5e8fbe',
          500: '#1f4b7a',
          600: '#173a61',
          700: '#102d4c',
          800: '#0a1f37',
          900: '#06152a',
        },
      },
      fontFamily: {
        // Libre Baskerville is the closest free clone of Baskerville and ships via Google Fonts.
        baskerville: ['"Libre Baskerville"', 'Baskerville', 'Georgia', 'serif'],
      },
      backgroundImage: {
        'hero-cityscape':
          "url('https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&w=2400&q=80')",
      },
    },
  },
  plugins: [],
};

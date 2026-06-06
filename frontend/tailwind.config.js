/** @type {import('tailwindcss').Config} */
export default {
  // MUI ships its own baseline reset (CssBaseline) — disabling Tailwind's preflight
  // keeps Tailwind a pure utility layer so it doesn't fight MUI.
  corePlugins: { preflight: false },
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        // Legacy app palette (MUI pages + old mockup components)
        trust: {
          50: '#f3f7fb', 100: '#e1ecf6', 200: '#bfd6ea', 300: '#94b8d8',
          400: '#5e8fbe', 500: '#1f4b7a', 600: '#173a61', 700: '#102d4c',
          800: '#0a1f37', 900: '#06152a',
        },
        warm: { 50: '#fff7ed', 100: '#ffedd5', 200: '#fed7aa' },
        // Neumorphism design system
        neu: {
          base: '#E0E5EC',
          fg: '#3D4852',
          muted: '#6B7280',
          accent: '#6C63FF',
          'accent-light': '#8B84FF',
          teal: '#38B2AC',
        },
      },
      fontFamily: {
        display:      ['"Plus Jakarta Sans"', 'system-ui', 'sans-serif'],
        baskerville:  ['"Plus Jakarta Sans"', 'system-ui', 'sans-serif'],
        body:         ['"DM Sans"', 'system-ui', 'sans-serif'],
        grotesk:      ['"FK Grotesk Trial"', 'system-ui', 'sans-serif'],
        'grotesk-mono': ['"FK Grotesk Mono Trial"', 'monospace'],
      },
      boxShadow: {
        'neu-extruded':       '9px 9px 16px rgb(163,177,198,0.6), -9px -9px 16px rgba(255,255,255,0.5)',
        'neu-extruded-hover': '12px 12px 20px rgb(163,177,198,0.7), -12px -12px 20px rgba(255,255,255,0.6)',
        'neu-extruded-sm':    '5px 5px 10px rgb(163,177,198,0.6), -5px -5px 10px rgba(255,255,255,0.5)',
        'neu-inset':          'inset 6px 6px 10px rgb(163,177,198,0.6), inset -6px -6px 10px rgba(255,255,255,0.5)',
        'neu-inset-deep':     'inset 10px 10px 20px rgb(163,177,198,0.7), inset -10px -10px 20px rgba(255,255,255,0.6)',
        'neu-inset-sm':       'inset 3px 3px 6px rgb(163,177,198,0.6), inset -3px -3px 6px rgba(255,255,255,0.5)',
        'neu-nav':            '0 6px 16px rgb(163,177,198,0.45), 0 -1px 0 rgba(255,255,255,0.9)',
      },
      animation: {
        float: 'neuFloat 4s ease-in-out infinite',
      },
      keyframes: {
        neuFloat: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%':      { transform: 'translateY(-14px)' },
        },
      },
      backgroundImage: {
        'hero-cityscape': "url('https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&w=2400&q=80')",
      },
    },
  },
  plugins: [],
};

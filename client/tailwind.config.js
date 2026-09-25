/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        obsidian: '#08080B',
        surface: '#0E1015',
        surface2: '#141721',
        gold: '#D4AF37',
        goldSoft: '#EED9A2',
        cyanBlue: {
          start: '#4facfe',
          end: '#00f2fe',
        },
        apple: {
          bg: '#f8fafc',
          card: '#ffffff',
          darkBg: '#08080B',
          darkCard: '#0E1015',
          darkSubtle: '#141721',
          accent: '#00f2fe',
          accentHover: '#4facfe',
        },
      },
      fontFamily: {
        sans: [
          '-apple-system',
          'BlinkMacSystemFont',
          '"SF Pro Display"',
          '"SF Pro Text"',
          '"Segoe UI"',
          'Roboto',
          'Helvetica',
          'Arial',
          'sans-serif'
        ],
      },
      backgroundImage: {
        'akash-gradient': 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
        'akash-hover': 'linear-gradient(135deg, #3b9bee 0%, #00d5e2 100%)',
      },
      animation: {
        'pulse-subtle': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'wave': 'wave 1.5s ease-in-out infinite',
      },
      keyframes: {
        wave: {
          '0%, 100%': { transform: 'scaleY(0.4)' },
          '50%': { transform: 'scaleY(1)' },
        }
      }
    },
  },
  plugins: [],
}

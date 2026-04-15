/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', 'system-ui', '-apple-system', 'sans-serif'],
      },
      colors: {
        dash: {
          bg: '#07111d',
          bg2: '#0c1728',
          bg3: '#10223d',
          card: '#0d182b',
          fg: '#edf3ff',
          muted: '#8ea4c5',
          line: 'rgba(255,255,255,0.07)',
          accent: '#FFD200',
          'accent-dark': '#c49d00',
          blue: '#173968',
          'blue-2': '#244f8f',
          ink: '#08101c',
        },
        status: {
          good: '#34d399',
          warn: '#fbbf24',
          bad: '#f87171',
        },
      },
      boxShadow: {
        dash: '0 16px 40px rgba(0,0,0,0.18), 0 4px 12px rgba(0,0,0,0.16)',
        nav: '0 1px 0 rgba(255,255,255,0.04), 0 18px 48px rgba(0,0,0,0.26)',
        primary: '0 10px 24px rgba(255,210,0,0.16), 0 2px 8px rgba(0,0,0,0.18)',
      },
      borderRadius: {
        dash: '16px',
      },
      keyframes: {
        'fade-up': {
          from: { opacity: '0', transform: 'translateY(8px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
      },
      animation: {
        'fade-up': 'fade-up 0.25s ease-out both',
      },
    },
  },
  plugins: [],
}

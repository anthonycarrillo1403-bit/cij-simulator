/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: { lcd: ['"Courier New"', 'ui-monospace', 'monospace'] },
      colors: {
        lcd: { bg: '#0d1b14', ink: '#9cf7c4', dim: '#4c8a68', hi: '#e8fff2' },
      },
    },
  },
  plugins: [],
}

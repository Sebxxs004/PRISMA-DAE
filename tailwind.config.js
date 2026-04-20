/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        'investigation-bg': '#0A0F16',
        'neon-cyan': '#00F0FF',
        'neon-orange': '#FF6B00',
        'panel-dark': 'rgba(15, 23, 42, 0.8)',
      },
    },
  },
  plugins: [],
};

/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: [
    './app/**/*.{js,jsx,ts,tsx}',
    './components/**/*.{js,jsx,ts,tsx}',
  ],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        primary: '#6366F1',
        background: '#121212',
        surface: '#1E1E1E',
        'surface-border': '#2A2A2A',
        'text-secondary': '#A1A1AA',
        macro: {
          carbs: '#3b82f6',
          protein: '#ef4444',
          fat: '#f59e0b',
        },
      },
    },
  },
  plugins: [],
};

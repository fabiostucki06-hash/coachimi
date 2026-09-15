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
        // rgb-triplet + CSS var so the active Coin Shop theme (utils/themePalettes.ts)
        // can override these at runtime via NativeWind's vars() while keeping every
        // existing `/NN` alpha modifier (bg-primary/15 etc.) working correctly.
        primary: 'rgb(var(--color-primary, 99 102 241) / <alpha-value>)',
        background: 'rgb(var(--color-background, 18 18 18) / <alpha-value>)',
        surface: 'rgb(var(--color-surface, 30 30 30) / <alpha-value>)',
        'surface-border': 'rgb(var(--color-surface-border, 42 42 42) / <alpha-value>)',
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

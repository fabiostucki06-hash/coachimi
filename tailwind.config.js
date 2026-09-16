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
        background: 'rgb(var(--color-background, 15 23 42) / <alpha-value>)',
        surface: 'rgb(var(--color-surface, 30 41 59) / <alpha-value>)',
        'surface-border': 'rgb(var(--color-surface-border, 51 65 85) / <alpha-value>)',
        // Main body text (replaces the old hardcoded `text-white`) and the subtle
        // `bg-white/NN` / `border-white/NN` overlay tint used for hairlines and hover
        // states - both flip with the CSS vars utils/themePalettes.ts sets so every
        // screen using them stays legible in both Light and Dark mode.
        foreground: 'rgb(var(--color-foreground, 248 250 252) / <alpha-value>)',
        'text-secondary': 'rgb(var(--color-foreground-secondary, 161 161 170) / <alpha-value>)',
        overlay: 'rgb(var(--color-overlay, 255 255 255) / <alpha-value>)',
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

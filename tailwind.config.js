/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: ['class', '[data-theme="dark"]'],
  theme: {
    extend: {
      colors: {
        bg: 'rgb(var(--bg) / <alpha-value>)',
        surface: 'rgb(var(--surface) / <alpha-value>)',
        sunk: 'rgb(var(--sunk) / <alpha-value>)',
        ink: 'rgb(var(--ink) / <alpha-value>)',
        muted: 'rgb(var(--muted) / <alpha-value>)',
        line: 'rgb(var(--line) / <alpha-value>)',
        teal: 'rgb(var(--teal) / <alpha-value>)',
        tealsoft: 'rgb(var(--teal-soft) / <alpha-value>)',
        leaf: 'rgb(var(--leaf) / <alpha-value>)',
        leafsoft: 'rgb(var(--leaf-soft) / <alpha-value>)',
        warn: 'rgb(var(--warn) / <alpha-value>)',
        danger: 'rgb(var(--danger) / <alpha-value>)',
        pro: 'rgb(var(--pro) / <alpha-value>)',
        carb: 'rgb(var(--carb) / <alpha-value>)',
        fat: 'rgb(var(--fat) / <alpha-value>)',
        water: 'rgb(var(--water) / <alpha-value>)',
        coffee: 'rgb(var(--coffee) / <alpha-value>)',
        tea: 'rgb(var(--tea) / <alpha-value>)',
      },
      fontFamily: {
        display: ['"Plus Jakarta Sans"', 'system-ui', 'sans-serif'],
        sans: ['"Figtree"', 'system-ui', 'sans-serif'],
      },
      borderRadius: { card: '20px' },
      boxShadow: {
        card: '0 1px 2px rgb(var(--shadow) / 0.06), 0 6px 20px -8px rgb(var(--shadow) / 0.14)',
        lift: '0 10px 30px -10px rgb(var(--shadow) / 0.35)',
      },
    },
  },
  plugins: [],
};

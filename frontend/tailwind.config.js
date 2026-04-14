/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Paleta CemLicença - verde/terra para temática cemitério + ambiental
        primary: {
          50: '#f0fdf4',
          100: '#dcfce7',
          200: '#bbf7d0',
          300: '#86efac',
          400: '#4ade80',
          500: '#22c55e',
          600: '#16a34a',
          700: '#15803d',
          800: '#166534',
          900: '#14532d',
        },
        terra: {
          50: '#fdf8f0',
          100: '#f5e6d3',
          200: '#e8cba5',
          300: '#d4a574',
          400: '#c4884f',
          500: '#a86d3a',
          600: '#8b5630',
          700: '#6e4327',
          800: '#553420',
          900: '#3d251a',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};

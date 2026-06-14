/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        dotmatrix: ['"DotGothic16"', 'monospace'],
        minimal: ['"IBM Plex Mono"', 'monospace'],
      },
      colors: {
        antsn: {
          black: '#0a0a0a',
          grey: '#888888',
          white: '#f5f5f5',
          line: '#333333',
        },
      },
      animation: {
        blink: 'blink 1.2s step-end infinite',
      },
      keyframes: {
        blink: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0' },
        },
      },
    },
  },
  plugins: [],
}

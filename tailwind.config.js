module.exports = {
  content: [
    "./pages/**/*.{js,jsx,ts,tsx}",
    "./components/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: "#830032",
      },
      fontFamily: {
        sans: ['"Heebo"', 'sans-serif'],
        mplus: ['"M PLUS 1p"', 'sans-serif'],
      },
      keyframes: {
        'cta-dark-cover': {
          '0%': { opacity: '0' },
          '25%': { opacity: '0' },
          '25.01%': { opacity: '1' },
          '100%': { opacity: '1' },
        },
      },
      animation: {
        'cta-dark-cover': 'cta-dark-cover 4s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};
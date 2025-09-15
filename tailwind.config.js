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
    },
  },
  plugins: [],
};
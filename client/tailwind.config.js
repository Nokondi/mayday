/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        mayday: {
          50: "#eef7fc",
          100: "#cbe7f6",
          200: "#a8d7f0",
          300: "#85c7ea",
          400: "#62b7e4",
          500: "#3fa7de",
          600: "#2394d1",
          700: "#1e7cae",
          800: "#176087",
          900: "#124A69",
        },
      },
    },
  },
  plugins: [],
};

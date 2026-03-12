/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: "#4F46E5",
        navy: "#1a2332",
        "light-bg": "#f0f2f5",
      }
    },
  },
  plugins: [],
}

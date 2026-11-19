/** RESTORA design tokens. @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    container: { center: true, padding: "1.25rem", screens: { "2xl": "72rem" } },
    extend: {
      colors: {
        brand: {
          deep: "#54266F",
          royal: "#75439A",
          lavender: "#B89AD6",
          soft: "#EDE3F5",
          lilac: "#F8F4FB",
          ivory: "#FAF8F6",
        },
        ink: { DEFAULT: "#33313A", muted: "#5F5A6B" },
        line: "#E6DCEF",
        caution: { bg: "#FDF6E7", ink: "#6B4A06" },
        stop: { bg: "#FBECEE", ink: "#7D1F2C" },
        go: { bg: "#EAF6EF", ink: "#1E5B3A" },
      },
      fontFamily: {
        display: ['"Cormorant Garamond"', '"Iowan Old Style"', "Georgia", "serif"],
        sans: ["Inter", '"Segoe UI"', "system-ui", "sans-serif"],
      },
      borderRadius: { card: "1.25rem" },
      boxShadow: {
        soft: "0 1px 2px rgb(84 38 111 / 0.04), 0 8px 24px -8px rgb(84 38 111 / 0.12)",
        lift: "0 2px 4px rgb(84 38 111 / 0.05), 0 16px 40px -12px rgb(84 38 111 / 0.2)",
      },
    },
  },
  plugins: [],
};

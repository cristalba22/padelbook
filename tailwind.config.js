/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./index.html",
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          bg: "#050814",        // fondo general azul noche
          bgSoft: "#070C1D",    // bloques
          surface: "#0B1326",   // tarjetas
          border: "#1E293B",
          accent: "#3DF7A8",    // mint principal
          accentSoft: "#A6FFE0",
          text: "#F9FAFB",
          muted: "#9CA3AF",
        },
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
        display: ["Poppins", "system-ui", "sans-serif"],
      },
      boxShadow: {
        "brand-glow": "0 0 28px rgba(61,247,168,0.45)",
      },
      borderRadius: {
        "2xl": "1.25rem",
        "3xl": "2rem",
      },
    },
  },
  plugins: [],
};

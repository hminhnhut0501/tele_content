module.exports = {
  content: [
    "./templates/**/*.html",
    "./static/js/**/*.js",
  ],
  darkMode: "class",
  theme: {
    extend: {
      fontFamily: {
        sans: ["Inter", "sans-serif"],
        display: ["Space Grotesk", "sans-serif"],
        mono: ["JetBrains Mono", "monospace"],
      },
      colors: {
        accent: {
          300: "#6ee7f9",
          400: "#22d3ee",
          500: "#06b6d4",
        },
        ink: {
          950: "#050816",
          925: "#0b1022",
          900: "#10182d",
          850: "#17203b",
        },
      },
      boxShadow: {
        shell: "0 28px 80px rgba(2, 8, 23, 0.42)",
        glow: "0 0 0 1px rgba(34, 211, 238, 0.08), 0 18px 60px rgba(8, 145, 178, 0.14)",
      },
    },
  },
  plugins: [],
};

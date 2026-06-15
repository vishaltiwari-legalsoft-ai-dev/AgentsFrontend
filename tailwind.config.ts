import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./ui_kits/**/*.{jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-sans)", "Manrope", "sans-serif"],
        display: ["var(--font-display)", "Manrope", "sans-serif"],
        mono: ["var(--font-mono)", "JetBrains Mono", "monospace"],
      },
      colors: {
        brand: "var(--brand)",
        accent: "var(--accent)",
        ink: "var(--text-primary)",
      },
    },
  },
  plugins: [],
};

export default config;

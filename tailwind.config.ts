import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        background: "#080c14",
        surface: {
          DEFAULT: "#0f172a",
          secondary: "#131d35",
          border: "#1e293b",
          hover: "#1e2c4f",
        },
        brand: {
          DEFAULT: "#00e5ff",
          hover: "#33ebff",
          dark: "#0099ab",
          glow: "rgba(0, 229, 255, 0.15)",
        },
        emerald: {
          glow: "rgba(16, 185, 129, 0.15)",
        },
      },
      fontFamily: {
        sans: [
          "-apple-system",
          "BlinkMacSystemFont",
          "Segoe UI",
          "Roboto",
          "Helvetica Neue",
          "sans-serif",
        ],
        mono: [
          "ui-monospace",
          "SFMono-Regular",
          "Menlo",
          "Monaco",
          "Consolas",
          "monospace",
        ],
      },
      boxShadow: {
        glow: "0 0 24px -4px rgba(0, 229, 255, 0.25)",
        "glow-emerald": "0 0 24px -4px rgba(16, 185, 129, 0.3)",
        card: "0 4px 20px -2px rgba(0, 0, 0, 0.5)",
      },
    },
  },
  plugins: [],
};

export default config;

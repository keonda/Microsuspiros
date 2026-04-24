import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}", "./actions/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#241f25",
        parchment: "#f6f0e7",
        paper: "#fffaf2",
        cedar: "#9c7b72",
        moss: "#75886f",
        slate: "#57636a",
        gold: "#c5a65a",
        clay: "#b46d57"
      },
      boxShadow: {
        soft: "0 18px 60px rgba(0,0,0,0.24)"
      }
    }
  },
  plugins: []
};

export default config;

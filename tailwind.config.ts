import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#17201b",
        mist: "#f4f7f2",
        leaf: "#2f6f4f",
        lime: "#d9f99d",
        skycap: "#d8ecff",
        tomato: "#f9735b",
        honey: "#f5c451"
      },
      boxShadow: {
        soft: "0 12px 32px rgba(23, 32, 27, 0.08)"
      }
    },
  },
  plugins: [],
};

export default config;

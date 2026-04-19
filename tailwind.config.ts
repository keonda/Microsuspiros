import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}", "./actions/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#121014",
        night: "#1b1720",
        plum: "#342536",
        rose: "#d9a7b4",
        mist: "#d9d1dc",
        moss: "#88a584",
        gold: "#d7bd77"
      },
      boxShadow: {
        soft: "0 18px 60px rgba(0,0,0,0.24)"
      }
    }
  },
  plugins: []
};

export default config;

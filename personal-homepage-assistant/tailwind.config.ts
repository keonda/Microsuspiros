import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: ["./app/**/*.{js,ts,jsx,tsx}", "./components/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#1e2330",
        mist: "#eef3f1",
        moss: "#7a9b76",
        coral: "#e8856b",
        honey: "#e9bd5c",
        plum: "#7e6a9e"
      },
      boxShadow: {
        soft: "0 18px 50px rgba(24, 31, 42, 0.12)"
      }
    }
  },
  plugins: []
};

export default config;

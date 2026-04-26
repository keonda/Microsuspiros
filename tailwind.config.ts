import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}"
  ],
  theme: {
    extend: {
      colors: {
        ink: "#202020",
        paper: "#f7f4ef",
        moss: "#5f6f52",
        clay: "#a95e43",
        mist: "#d8ddd2"
      },
      boxShadow: {
        quiet: "0 14px 50px rgba(32, 32, 32, 0.08)"
      }
    }
  },
  plugins: []
};

export default config;

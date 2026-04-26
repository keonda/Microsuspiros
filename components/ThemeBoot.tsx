"use client";

import { useEffect } from "react";

export function ThemeBoot({ theme }: { theme: string }) {
  useEffect(() => {
    const dark = theme === "dark" || (theme === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
    document.documentElement.classList.toggle("dark", dark);
  }, [theme]);
  return null;
}

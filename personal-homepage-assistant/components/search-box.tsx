"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type Result = { type: string; id: string; title: string; subtitle?: string; href: string };

export function SearchBox() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Result[]>([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        document.getElementById("global-search")?.focus();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    if (query.trim().length < 2) {
      setResults([]);
      return;
    }
    fetch(`/api/search?q=${encodeURIComponent(query)}`, { signal: controller.signal })
      .then((r) => r.json())
      .then((data) => setResults(data.results ?? []))
      .catch(() => undefined);
    return () => controller.abort();
  }, [query]);

  return (
    <div className="relative w-full md:w-96">
      <input
        id="global-search"
        className="field h-11"
        placeholder="Search or Ctrl+K"
        value={query}
        onFocus={() => setOpen(true)}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
      />
      {open && query && (
        <div className="absolute right-0 top-12 z-30 max-h-96 w-full overflow-auto rounded-2xl border border-ink/10 bg-white p-2 shadow-soft dark:border-white/10 dark:bg-[#18212c]">
          {results.length === 0 ? (
            <p className="px-3 py-4 text-sm text-ink/55 dark:text-white/55">No matches yet.</p>
          ) : (
            results.map((result) => (
              <Link key={`${result.type}-${result.id}`} href={result.href} onClick={() => setOpen(false)} className="block rounded-xl px-3 py-2 hover:bg-ink/5 dark:hover:bg-white/10">
                <div className="flex items-center justify-between gap-3">
                  <span className="font-semibold">{result.title}</span>
                  <span className="badge">{result.type}</span>
                </div>
                {result.subtitle && <p className="line-clamp-1 text-xs text-ink/55 dark:text-white/55">{result.subtitle}</p>}
              </Link>
            ))
          )}
        </div>
      )}
    </div>
  );
}

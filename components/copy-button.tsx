"use client";

import { useState } from "react";

export function CopyButton({ value, label = "Copy" }: { value: string; label?: string }) {
  const [copied, setCopied] = useState(false);

  return (
    <button
      type="button"
      onClick={async () => {
        await navigator.clipboard.writeText(value);
        setCopied(true);
        window.setTimeout(() => setCopied(false), 1400);
      }}
      className="rounded-lg bg-white/8 px-3 py-1.5 text-xs font-semibold text-mist ring-1 ring-white/10 hover:bg-white/12"
    >
      {copied ? "Copied" : label}
    </button>
  );
}

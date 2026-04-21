export function DownloadLink({ label, filename, content, mimeType = "application/json" }: { label: string; filename: string; content: string; mimeType?: string }) {
  const href = `data:${mimeType};charset=utf-8,${encodeURIComponent(content)}`;
  return (
    <a
      href={href}
      download={filename}
      className="rounded-lg bg-white/8 px-3 py-1.5 text-xs font-semibold text-mist ring-1 ring-white/10 hover:bg-white/12"
    >
      {label}
    </a>
  );
}

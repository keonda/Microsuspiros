import type { Document } from "@prisma/client";

export function slugify(input: string) {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "");
}

export function wordCount(text: string) {
  return text.trim() ? text.trim().split(/\s+/).length : 0;
}

export function readingMinutes(words: number) {
  return Math.max(1, Math.ceil(words / 225));
}

export function bytesLabel(bytes: number) {
  const units = ["B", "KB", "MB", "GB"];
  let size = bytes;
  let unit = 0;
  while (size >= 1024 && unit < units.length - 1) {
    size /= 1024;
    unit += 1;
  }
  return `${size.toFixed(unit === 0 ? 0 : 1)} ${units[unit]}`;
}

export function documentToHtml(document: Pick<Document, "title" | "contentHtml">) {
  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(document.title)}</title>
  <style>
    body { max-width: 760px; margin: 48px auto; font-family: Georgia, serif; line-height: 1.75; color: #241f25; }
    h1, h2, h3 { line-height: 1.2; }
    blockquote { border-left: 3px solid #9c7b72; margin-left: 0; padding-left: 1rem; color: #5d5359; }
  </style>
</head>
<body>
  <h1>${escapeHtml(document.title)}</h1>
  ${document.contentHtml}
</body>
</html>`;
}

export function escapeHtml(input: string) {
  return input
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

// TODO: Add DOCX/PDF export adapters behind the same document/project export interface.

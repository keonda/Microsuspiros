export function extractWikiTitles(content: string) {
  const matches = content.matchAll(/\[\[([^\]\n]+)\]\]/g);
  return Array.from(new Set(Array.from(matches).map((match) => match[1].trim()).filter(Boolean)));
}

export function excerpt(content: string, length = 150) {
  const compact = content.replace(/[#*_>`\-[\]()]/g, " ").replace(/\s+/g, " ").trim();
  return compact.length > length ? `${compact.slice(0, length)}...` : compact;
}

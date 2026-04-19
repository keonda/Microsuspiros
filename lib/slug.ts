export function slugify(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export async function uniqueSlug(base: string, exists: (slug: string) => Promise<boolean>) {
  const root = slugify(base) || "untitled";
  let slug = root;
  let counter = 2;

  while (await exists(slug)) {
    slug = `${root}-${counter}`;
    counter += 1;
  }

  return slug;
}

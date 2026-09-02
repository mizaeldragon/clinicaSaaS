export function slugify(value: string): string {
  return value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

/** Gera um slug único usando um verificador assíncrono de existência. */
export async function uniqueSlug(
  base: string,
  exists: (slug: string) => Promise<boolean>,
): Promise<string> {
  const root = slugify(base) || 'empresa';
  let candidate = root;
  let counter = 1;
  // Limite defensivo para não entrar em laço infinito.
  while (await exists(candidate)) {
    counter += 1;
    candidate = `${root}-${counter}`;
    if (counter > 500) {
      candidate = `${root}-${Date.now().toString(36)}`;
      break;
    }
  }
  return candidate;
}

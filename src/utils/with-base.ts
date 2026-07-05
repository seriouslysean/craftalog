/**
 * Joins a root-absolute path (e.g. a generated texture URL or an internal
 * link) with the site's base path, so links and asset URLs keep working when
 * the site is deployed under a non-root base (BASE_PATH env var, see
 * astro.config.mjs).
 *
 * `base` defaults to `import.meta.env.BASE_URL` in real usage; tests pass it
 * explicitly to keep this pure and Vite-free.
 */
export function withBase(path: string, base: string = import.meta.env.BASE_URL): string {
  const normalizedBase = base.endsWith("/") ? base.slice(0, -1) : base;
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${normalizedBase}${normalizedPath}` || "/";
}

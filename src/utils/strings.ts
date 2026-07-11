/**
 * Title-cases an underscore_separated id, e.g. "oak_log" -> "Oak Log".
 * Shared by the data pipeline (scripts/lib/lang.ts fallback display names,
 * scripts/lib/patterned-banner.ts) and the site (tag labels) -- scripts
 * import from src/utils, never the reverse (same direction as slugify.ts).
 */
export function titleCaseFromId(id: string): string {
  return id
    .split("_")
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

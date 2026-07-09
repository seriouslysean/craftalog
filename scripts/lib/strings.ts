const MC_PREFIX = "minecraft:";

/** Strips a leading "minecraft:" namespace prefix, if present. */
export function stripMcPrefix(value: string): string {
  return value.startsWith(MC_PREFIX) ? value.slice(MC_PREFIX.length) : value;
}

/** Title-cases an underscore_separated id, e.g. "oak_log" -> "Oak Log". */
export function titleCaseFromId(id: string): string {
  return id
    .split("_")
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

/**
 * Converts a display label into a stable underscore_separated id, e.g.
 * "Copper Goods" -> "copper_goods", "Rails & Minecarts" -> "rails_minecarts".
 * Used to derive family/category ids from their curated display names (see
 * scripts/lib/family.ts, scripts/lib/category.ts) -- underscore style to
 * match vanilla item id conventions, distinct from src/utils/slugify.ts's
 * hyphenated URL-slug style.
 */
export function toSnakeId(label: string): string {
  return label
    .toLowerCase()
    .replace(/&/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

/**
 * Recursively sorts object keys alphabetically for deterministic JSON output.
 * Arrays are preserved in order (element order is semantically meaningful),
 * but any objects nested inside arrays still get their keys sorted.
 */
export function sortKeysDeep<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((item) => sortKeysDeep(item)) as unknown as T;
  }

  if (value !== null && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>).toSorted(([a], [b]) =>
      a.localeCompare(b),
    );
    const sorted: Record<string, unknown> = {};
    for (const [key, val] of entries) {
      sorted[key] = sortKeysDeep(val);
    }
    return sorted as T;
  }

  return value;
}

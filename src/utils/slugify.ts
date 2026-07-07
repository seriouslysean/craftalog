/**
 * Converts a string into a lowercase, hyphen-separated URL slug (e.g.
 * "Bone Meal" -> "bone-meal", "dye_black_wool" -> "dye-black-wool").
 * Shared by the data pipeline (scripts/lib/generate.ts, computing persisted
 * `slug` fields) and runtime page code (a same-effect fallback for the one
 * recipe with no result item, see src/utils/recipe-groups.ts).
 */
export function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

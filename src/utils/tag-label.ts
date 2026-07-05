import type { Ingredient } from "../content.config";

/**
 * Humanizes a resolved tag name into a recipe-book-style label, e.g.
 * `oak_logs` -> "Any Oak Logs", `planks` -> "Any Planks".
 */
export function humanizeTagLabel(tag: string): string {
  const words = tag
    .split("_")
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1));
  return `Any ${words.join(" ")}`;
}

/**
 * Builds the label shown under the grid for a multi-option ingredient.
 * Returns `null` for single-item ingredients (nothing to label).
 *
 * - Tag-based (e.g. "planks"): humanized tag, "Any Planks".
 * - Non-tag multi-option: first item's name + "or N more".
 */
export function ingredientLabel(
  ingredient: Ingredient,
  getItemName: (id: string) => string,
): string | null {
  if (ingredient.items.length <= 1) {
    return null;
  }

  if (ingredient.tag) {
    return humanizeTagLabel(ingredient.tag);
  }

  const first = getItemName(ingredient.items[0]);
  const more = ingredient.items.length - 1;
  return `${first} or ${more} more`;
}

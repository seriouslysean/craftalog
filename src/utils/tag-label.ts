import type { Ingredient } from "../content.config";

/**
 * Title-cases a snake_case tag name, e.g. `oak_logs` -> "Oak Logs".
 */
function tagWords(tag: string): string {
  return tag
    .split("_")
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

/**
 * Humanizes a resolved tag name into a recipe-book-style label, e.g.
 * `oak_logs` -> "Any Oak Logs", `planks` -> "Any Planks".
 */
export function humanizeTagLabel(tag: string): string {
  return `Any ${tagWords(tag)}`;
}

export interface IngredientOption {
  label: string;
  /** Every item id this ingredient accepts, for a cycling icon display. */
  items: string[];
}

/**
 * Builds the label + variant items shown for a multi-option ingredient.
 * Returns `null` for single-item ingredients (nothing to show).
 *
 * - Tag-based (e.g. "planks"): title-cased tag, "Planks" -- no "Any" prefix
 *   here, since this label is always shown nested under an "Accepts any of
 *   these" heading and repeating "any" reads as if the ingredient can go
 *   anywhere in the grid rather than accept any of these item variants.
 * - Non-tag multi-option: first item's name (the cycling icon + option
 *   count carry the "or others" information, so the label doesn't need to).
 */
export function ingredientOption(
  ingredient: Ingredient,
  getItemName: (id: string) => string,
): IngredientOption | null {
  if (ingredient.items.length <= 1) {
    return null;
  }

  const label = ingredient.tag ? tagWords(ingredient.tag) : getItemName(ingredient.items[0]);

  return { label, items: ingredient.items };
}

import type { Ingredient } from "../content.config";
import { titleCaseFromId } from "./strings";

/**
 * Humanizes a resolved tag name into a recipe-book-style label, e.g.
 * `oak_logs` -> "Any Oak Logs", `planks` -> "Any Planks".
 */
export function humanizeTagLabel(tag: string): string {
  return `Any ${titleCaseFromId(tag)}`;
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
 * - Tag-based (e.g. "planks"): `humanizeTagLabel`, "Any Planks". Each
 *   ingredient slot gets its own heading in `IngredientOptions.astro`, so
 *   the label must stand on its own -- there's no shared "accepts any of
 *   these" heading supplying that meaning for every row anymore.
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

  const label = ingredient.tag
    ? humanizeTagLabel(ingredient.tag)
    : getItemName(ingredient.items[0]);

  return { label, items: ingredient.items };
}

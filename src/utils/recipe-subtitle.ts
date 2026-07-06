import type { Ingredient, RecipeData } from "../content.config";
import { humanizeTagLabel } from "./tag-label";

const NOTE_MAX_LENGTH = 40;

function primaryIngredientLabel(
  ingredient: Ingredient,
  getItemName: (id: string) => string,
): string {
  if (ingredient.tag) {
    return humanizeTagLabel(ingredient.tag);
  }
  return getItemName(ingredient.items[0]);
}

function truncateNote(note: string): string {
  return note.length > NOTE_MAX_LENGTH ? `${note.slice(0, NOTE_MAX_LENGTH - 1)}…` : note;
}

/**
 * Short "from X" label distinguishing one of several recipes that produce
 * the same result item (e.g. "Black Dye" from an ink sac vs. a wither rose).
 * Derived from the recipe's first ingredient — the vanilla data consistently
 * lists the distinguishing material first for these recipe families.
 * Returns null when there's nothing to derive a label from.
 */
export function recipeSubtitle(
  recipe: RecipeData,
  getItemName: (id: string) => string,
): string | null {
  if (recipe.type === "shaped" && recipe.key) {
    const first = Object.values(recipe.key)[0];
    return first ? `from ${primaryIngredientLabel(first, getItemName)}` : null;
  }

  if ((recipe.type === "shapeless" || recipe.type === "transmute") && recipe.ingredients?.length) {
    return `from ${primaryIngredientLabel(recipe.ingredients[0], getItemName)}`;
  }

  if (recipe.type === "special" && recipe.note) {
    return truncateNote(recipe.note);
  }

  return null;
}

/**
 * Derives the recipe-distinguishing part of a recipe's id relative to its
 * result item's id, for the /recipe/{item}/{slug}/ URL scheme.
 *
 * Recipe ids aren't reliably prefixed with their result item's id -- e.g.
 * "dye_black_wool" produces "black_wool", and "book_cloning" produces
 * "written_book" with zero string relation. A plain prefix-strip only
 * handles ~15% of recipes; this instead removes the item id's tokens
 * wherever they appear as a contiguous run (prefix, suffix, or embedded),
 * which additionally recovers a clean "dye" from "dye_black_wool" for free.
 * Falls back to "default" when nothing is left (the canonical recipe, whose
 * id is usually the item id verbatim), and to the full recipe id when the
 * item id doesn't appear in it at all (book_cloning, map_cloning, ...) --
 * still a valid, unique-by-construction slug on its own.
 */
export function deriveRecipeSlugSource(recipeId: string, itemId: string): string {
  const recipeTokens = recipeId.split("_");
  const itemTokens = itemId.split("_");

  for (let i = 0; i <= recipeTokens.length - itemTokens.length; i++) {
    const isMatch = itemTokens.every((token, j) => recipeTokens[i + j] === token);
    if (!isMatch) continue;

    const remaining = [...recipeTokens.slice(0, i), ...recipeTokens.slice(i + itemTokens.length)];
    return remaining.join("_") || "default";
  }

  return recipeId;
}

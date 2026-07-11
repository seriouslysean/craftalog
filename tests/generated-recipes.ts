import type { RecipeData } from "../src/content.config";
import recipesData from "../src/data/generated/recipes.json";

/**
 * The real generated recipes.json in content-collection shape. On disk,
 * `family` is a plain family id string; the `recipes` collection (see
 * src/content.config.ts) models it as a `families` reference, and consumers
 * like recipe-groups.ts read `family.id` -- so tests exercising the real
 * data must hand them the reference shape Astro would.
 */
export function loadGeneratedRecipes(): RecipeData[] {
  return Object.values(recipesData).map((recipe) => ({
    ...recipe,
    family: { collection: "families", id: recipe.family },
  })) as RecipeData[];
}

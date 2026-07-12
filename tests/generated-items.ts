import type { ItemData } from "../src/content.config";
import itemsData from "../src/data/generated/items.json";

/**
 * The real generated items.json as the id-keyed Map the recipe-groups
 * helpers take (`itemsMap`) -- mirrors tests/generated-recipes.ts, so tests
 * exercising name derivation run against the exact item names the site
 * renders.
 */
export function loadGeneratedItems(): Map<string, ItemData> {
  return new Map(Object.entries(itemsData).map(([id, item]) => [id, item as ItemData]));
}

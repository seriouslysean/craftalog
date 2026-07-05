import type { Ingredient, RawIngredient, RawTagsData } from "./types.ts";
import { resolveTag } from "./tags.ts";
import { stripMcPrefix } from "./strings.ts";

/**
 * Normalizes a raw recipe ingredient/key value into the generated data
 * contract's `Ingredient` shape. Raw values come in three flavors: a single
 * item id, an array of interchangeable item ids, or a tag reference
 * (starting with "#").
 */
export function normalizeIngredient(raw: RawIngredient, tags: RawTagsData): Ingredient {
  if (Array.isArray(raw)) {
    return { items: Array.from(new Set(raw.map(stripMcPrefix))) };
  }

  if (raw.startsWith("#")) {
    const tagName = stripMcPrefix(raw.slice(1));
    return { items: resolveTag(tagName, tags), tag: tagName };
  }

  return { items: [stripMcPrefix(raw)] };
}

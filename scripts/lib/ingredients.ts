import type { Ingredient, RawIngredient, RawTagsData } from "./types.ts";
import { resolveTag } from "./tags.ts";
import { stripMcPrefix } from "./strings.ts";

/**
 * Normalizes a raw recipe ingredient/key value into the generated data
 * contract's `Ingredient` shape. Raw values come in three flavors: a single
 * item id, an array of interchangeable item ids, or a tag reference
 * (starting with "#").
 *
 * Throws when a tag reference resolves to zero items (unknown/renamed tag,
 * or a tag that genuinely contains nothing) -- an ingredient with no
 * candidate items would render as an empty slot and can only mean the
 * vendored data moved out from under this pipeline, so fail generation
 * instead of shipping `{ items: [] }`.
 */
export function normalizeIngredient(raw: RawIngredient, tags: RawTagsData): Ingredient {
  if (Array.isArray(raw)) {
    return { items: Array.from(new Set(raw.map(stripMcPrefix))) };
  }

  if (raw.startsWith("#")) {
    const tagName = stripMcPrefix(raw.slice(1));
    const items = resolveTag(tagName, tags);
    if (items.length === 0) {
      throw new Error(
        `Ingredient tag "#${tagName}" resolved to zero items -- unknown or renamed tag in the vendored data?`,
      );
    }
    return { items, tag: tagName };
  }

  return { items: [stripMcPrefix(raw)] };
}

import type { ItemTagIndex } from "./family.ts";

/**
 * Vanilla item tags that unify every material Mojang ships for one
 * interchangeable shape -- e.g. `#minecraft:slabs` holds oak_slab,
 * stone_slab, AND cut_copper_slab (plus all 8 of its oxidation/waxing
 * tiers), all as siblings of the same "slab" shape. Used by
 * src/utils/recipe-groups.ts to collapse a shape's material variants into
 * one tabbed catalog card, e.g. one "Slabs" card instead of 49 (see that
 * file's groupRecipes).
 *
 * Deliberately its own curated list, NOT a reuse of
 * scripts/lib/family.ts's TAG_FAMILY_PRIORITY: that list serves the
 * coarser top-level browse taxonomy and deliberately includes tags like
 * "logs"/"copper"/"pickaxes" that group related but visually/functionally
 * DIFFERENT items -- collapsing those into one tabbed card the way this
 * list does would be wrong (e.g. the "copper" tag spans cut copper,
 * copper bulbs, the golem statue, lightning rods, ... -- very much not
 * "one shape, several materials").
 *
 * Every tag here was confirmed against the vendored tag data
 * (vendor/mcmeta-summary/data/tag/item/data.json) to follow the same
 * shape: a `#wooden_X` sub-tag (or, for walls, a flat list -- vanilla has
 * no wooden wall) plus additional non-wood material ids for the identical
 * shape. Order doesn't currently matter (no item belongs to more than one
 * of these in the current data) but is kept as an explicit priority list
 * (first match wins) in case a future item ever legitimately belongs to
 * two.
 *
 * `doors`/`trapdoors`/`fences` are included even though they weren't
 * called out by name in the original bug report -- each has the exact
 * same wood-plus-more tag shape as slabs/stairs/walls/buttons (doors:
 * 12 wood + 8 copper oxidation tiers + iron_door; trapdoors: same shape
 * as doors; fences: 12 wood + nether_brick_fence), so leaving them out
 * would be an arbitrary inconsistency in an otherwise general,
 * data-driven rule. Confirmed against the real data with a systematic
 * sweep of every `wooden_X` tag, comparing its member count to its bare
 * `X` counterpart's (see the sweep in this file's PR/commit description) --
 * this list is exactly the set where that comparison finds extra,
 * non-wood members.
 *
 * Deliberately NOT included: fence_gates/signs/hanging_signs/
 * wooden_shelves (real vendored tags/groups exist for all four, but every
 * member is wood-only in the current data -- no non-wood sibling exists to
 * collapse in, so routing them through this mechanism wouldn't change a
 * single card's membership today, only its internal key name for no
 * benefit. Add the relevant tag here the day vanilla ships a non-wood
 * member of any of those shapes -- e.g. a stone sign). Also NOT included:
 * pressure plates -- no vendored tag unifies them across materials (only
 * "wooden_pressure_plates" exists; stone/weighted plates share no tag or
 * `group` with each other or with wood), so there is no real data signal
 * to key a "Pressure Plates" collapse off yet.
 */
const SHAPE_TAG_IDS = [
  "slabs",
  "stairs",
  "walls",
  "buttons",
  "doors",
  "trapdoors",
  "fences",
] as const;

/**
 * Derives a recipe result's shape-based collapse key from vanilla item
 * tags (see SHAPE_TAG_IDS), e.g. "cut_copper_slab" -> "slabs". Returns
 * undefined when the item isn't in any allow-listed shape tag, so callers
 * fall back to their existing derivation (see
 * src/utils/recipe-groups.ts's groupRecipes, which prefers this over its
 * oxidation-prefix and vanilla-`group` derivations -- the most complete
 * signal, since it's the only one that unifies every material of a shape,
 * copper included, in one pass).
 */
export function deriveShapeTag(itemId: string, itemTagIndex: ItemTagIndex): string | undefined {
  const tags = itemTagIndex.get(itemId);
  if (!tags) return undefined;
  return SHAPE_TAG_IDS.find((tag) => tags.has(tag));
}

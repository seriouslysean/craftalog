import type { ItemTagIndex } from "./family.ts";
import { resolveTag } from "./tags.ts";
import type { RawTagsData } from "./types.ts";

/**
 * Vanilla item tags that unify every material Mojang ships for one
 * interchangeable shape -- e.g. `#minecraft:slabs` holds oak_slab,
 * stone_slab, AND cut_copper_slab (plus all 8 of its oxidation/waxing
 * tiers), all as siblings of the same "slab" shape. Used by
 * src/utils/recipe-groups.ts to collapse a shape's material variants into
 * one tabbed catalog card, e.g. one "Slabs" card instead of 49 (see that
 * file's groupRecipes).
 *
 * The set is DERIVED from the vendored tag data by deriveShapeTagIds below
 * (not hand-listed): a tag `X` is a cross-material shape tag exactly when
 * vanilla also ships a `wooden_X` counterpart AND `X` resolves to more
 * members than `wooden_X` does -- i.e. non-wood materials of the identical
 * shape exist to collapse in. That mechanical rule is why
 * fence_gates/signs/hanging_signs/shelves are excluded (every member is
 * wood-only today -- `|X| == |wooden_X|` -- so there's nothing to collapse;
 * they auto-admit the day vanilla ships a non-wood member) and why pressure
 * plates are excluded (no bare cross-material `pressure_plates` tag exists
 * at all -- only `wooden_pressure_plates`).
 *
 * Deliberately NOT a reuse of scripts/lib/family.ts's TAG_FAMILY_PRIORITY:
 * that list serves the coarser top-level browse taxonomy and deliberately
 * includes tags like "logs"/"copper"/"pickaxes" that group related but
 * visually/functionally DIFFERENT items -- collapsing those into one tabbed
 * card would be wrong (e.g. the "copper" tag spans cut copper, copper
 * bulbs, the golem statue, lightning rods, ... -- very much not "one
 * shape, several materials").
 */

/**
 * The one curated exception to the `wooden_X` sweep: vanilla has no wooden
 * wall, so `walls` has no `wooden_X` counterpart to compare against -- it's
 * a flat cross-material list (32 stone/blackstone/copper/... members of one
 * identical shape). Kept as a curated single-entry supplement rather than
 * loosening the sweep rule, which would over-admit same-suffix but
 * NOT-shape-family tags (banners, beds, candles -- one shape but one
 * material each, nothing to collapse).
 */
const FLAT_SHAPE_TAG_IDS = ["walls"] as const;

/**
 * Derives the cross-material shape-tag set from the vendored tag data --
 * see this file's docstring for the rule. Produces exactly
 * ["buttons", "doors", "fences", "slabs", "stairs", "trapdoors", "walls"]
 * for mcmeta pin 26.2 (asserted in tests/shape-tag.test.ts). Sorted for
 * deterministic output; order carries no meaning (no item belongs to more
 * than one of these in the current data).
 */
export function deriveShapeTagIds(tagsRaw: RawTagsData): string[] {
  const ids = new Set<string>();

  for (const tagName of Object.keys(tagsRaw)) {
    if (!tagName.startsWith("wooden_")) continue;
    const bareName = tagName.slice("wooden_".length);
    if (!(bareName in tagsRaw)) continue;
    if (resolveTag(bareName, tagsRaw).length > resolveTag(tagName, tagsRaw).length) {
      ids.add(bareName);
    }
  }

  for (const tagName of FLAT_SHAPE_TAG_IDS) {
    if (resolveTag(tagName, tagsRaw).length > 0) ids.add(tagName);
  }

  return Array.from(ids).toSorted();
}

/**
 * Derives a recipe result's shape-based collapse key from vanilla item
 * tags (see deriveShapeTagIds), e.g. "cut_copper_slab" -> "slabs". Returns
 * undefined when the item isn't in any derived shape tag, so callers fall
 * back to their existing derivation (see src/utils/recipe-groups.ts's
 * groupRecipes, which prefers this over its oxidation-prefix and
 * vanilla-`group` derivations -- the most complete signal, since it's the
 * only one that unifies every material of a shape, copper included, in one
 * pass).
 */
export function deriveShapeTag(
  itemId: string,
  itemTagIndex: ItemTagIndex,
  shapeTagIds: readonly string[],
): string | undefined {
  const tags = itemTagIndex.get(itemId);
  if (!tags) return undefined;
  return shapeTagIds.find((tag) => tags.has(tag));
}

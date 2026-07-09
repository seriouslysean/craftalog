import type { Ingredient, ItemData, RecipeData } from "../content.config";
import familiesData from "../data/generated/families.json";
import { slugify } from "./slugify";
import { humanizeTagLabel } from "./tag-label";

const NOTE_MAX_LENGTH = 40;

// Family id -> display name, read directly from the generated data (not via
// the `families` content collection) so this stays synchronous. `family` on
// a recipe is now a `families` collection reference (see
// src/content.config.ts) rather than a plain display-name string -- this is
// a minimal shim so every existing call site that read `recipe.family` as
// text (this file, RecipePage.astro) keeps working unchanged. Real UI
// consumption of the `families`/`categories` collections (category nav,
// grouped homepage sections, etc.) is tracked as follow-up work.
const FAMILY_NAME_BY_ID: Record<string, string> = Object.fromEntries(
  Object.values(familiesData).map((family) => [family.id, family.name]),
);

/** Resolves a recipe's `family` reference back to its display name, e.g. "Copper Goods" -- see FAMILY_NAME_BY_ID above. */
export function familyDisplayName(family: RecipeData["family"]): string {
  return FAMILY_NAME_BY_ID[family.id] ?? family.id;
}

/** Base path segment for every recipe page -- single source of truth for src/pages/recipe/, so a route restructure only touches one string. */
export const RECIPE_BASE_PATH = "/recipe";

function truncateNote(note: string): string {
  return note.length > NOTE_MAX_LENGTH ? `${note.slice(0, NOTE_MAX_LENGTH - 1)}…` : note;
}

function ingredientList(recipe: RecipeData): Ingredient[] {
  if (recipe.type === "shaped" && recipe.key) {
    return Object.values(recipe.key);
  }
  if ((recipe.type === "shapeless" || recipe.type === "transmute") && recipe.ingredients) {
    return recipe.ingredients;
  }
  return [];
}

function ingredientLabel(ingredient: Ingredient, getItemName: (id: string) => string): string {
  return ingredient.tag ? humanizeTagLabel(ingredient.tag) : getItemName(ingredient.items[0]);
}

/**
 * Vanilla groups that are a "re-dye an existing item" variant of a base
 * craft group targeting the exact same set of result items (confirmed
 * against the real generated data: harness/harness_dye both produce all 16
 * harness colors, bed/bed_dye all 16 bed colors, carpet/carpet_dye all 18
 * carpet variants) -- normalized to the base group name so both sides of
 * the pair collapse into one VariantGroup instead of two. Every other
 * dye-only group (bundle_dye, dyed_candle, shulker_box_dye, ...) has no
 * separate base craft group to alias to -- colors are its only recipes for
 * that shape, so it's already a complete collapse key on its own.
 */
const REDYE_GROUP_ALIASES: Record<string, string> = {
  harness_dye: "harness",
  bed_dye: "bed",
  carpet_dye: "carpet",
};

function normalizeVariantGroupKey(group: string | undefined): string | undefined {
  if (!group) return undefined;
  return REDYE_GROUP_ALIASES[group] ?? group;
}

export interface SiblingRecipe {
  recipeId: string;
  type: RecipeData["type"];
  /** e.g. "from Bone", or a truncated note for special recipes. Null for singletons. */
  label: string | null;
  /** The distinguishing ingredient's item id. Null for singletons and special recipes. */
  iconItemId: string | null;
  /** Every ingredient item id this recipe accepts, for the catalog search index. */
  ingredientItemIds: string[];
  /** URL-safe /recipe/{item}/{slug}/ segment for this recipe, precomputed by the data pipeline (see scripts/lib/recipe-slug.ts) -- unique within the group. */
  slug: string;
}

export interface RecipeGroup {
  resultId: string;
  family: string;
  familyId: string;
  /** Normalized vanilla `group` field shared by this result's recipes (see normalizeVariantGroupKey), or undefined if none carry one. Used to fold same-shape/different-material result items into one tabbed VariantGroup -- see collapseVariantGroups. */
  variantKey: string | undefined;
  /** Alphabetically-first recipe id — the group's default/linked-to recipe. */
  canonicalId: string;
  count: number;
  /** Sorted by recipeId; siblings[0].recipeId === canonicalId. */
  siblings: SiblingRecipe[];
}

/**
 * Recomputes labels within a colliding cluster (siblings that landed on the
 * same primary label) from an ingredient unique to each one *within that
 * cluster* -- e.g. magenta_dye's "blue + red + pink" vs "blue + red + white"
 * recipes both lead with blue dye once the group-wide common set is empty,
 * but differ from each other in their last ingredient.
 */
function resolveLabelCollisions(
  siblings: SiblingRecipe[],
  lists: Ingredient[][],
  getItemName: (id: string) => string,
): void {
  const byLabel = new Map<string, number[]>();
  siblings.forEach((sibling, index) => {
    if (sibling.label === null) return;
    const indices = byLabel.get(sibling.label);
    if (indices) {
      indices.push(index);
    } else {
      byLabel.set(sibling.label, [index]);
    }
  });

  for (const indices of byLabel.values()) {
    if (indices.length <= 1) continue;

    for (const index of indices) {
      const otherItemIds = new Set(
        indices
          .filter((other) => other !== index)
          .flatMap((other) => lists[other].map((ingredient) => ingredient.items[0])),
      );
      const distinguishing = lists[index].find(
        (ingredient) => !otherItemIds.has(ingredient.items[0]),
      );
      if (distinguishing) {
        siblings[index].label = `from ${ingredientLabel(distinguishing, getItemName)}`;
        siblings[index].iconItemId = distinguishing.items[0];
      }
    }
  }
}

/**
 * Groups recipes by result item (a recipe with no result becomes its own
 * singleton group keyed by its own id -- every emitted recipe has a result
 * today, see generate.ts's resultless-recipe exclusion, but `result` stays
 * optional on the schema so this stays defensive). For groups with more than
 * one recipe, derives a short "from X" label per sibling from whatever
 * ingredient actually differs between them -- not just the first ingredient,
 * which breaks when siblings share their first ingredient (all 17
 * Suspicious Stew recipes lead with a bowl).
 */
export function groupRecipes(
  recipes: RecipeData[],
  getItemName: (id: string) => string,
): RecipeGroup[] {
  const byResult = new Map<string, RecipeData[]>();
  for (const recipe of recipes) {
    const resultId = recipe.result?.id ?? recipe.id;
    const bucket = byResult.get(resultId);
    if (bucket) {
      bucket.push(recipe);
    } else {
      byResult.set(resultId, [recipe]);
    }
  }

  const groups: RecipeGroup[] = [];

  for (const [resultId, members] of byResult) {
    members.sort((a, b) => a.id.localeCompare(b.id));
    const count = members.length;
    const lists = members.map(ingredientList);

    let commonItemIds: Set<string> | null = null;
    if (count > 1) {
      commonItemIds = new Set(lists[0].map((ingredient) => ingredient.items[0]));
      for (const list of lists.slice(1)) {
        const itemIds = new Set(list.map((ingredient) => ingredient.items[0]));
        commonItemIds = new Set([...commonItemIds].filter((id) => itemIds.has(id)));
      }
    }

    const siblings: SiblingRecipe[] = members.map((recipe, index) => {
      const list = lists[index];
      const ingredientItemIds = [...new Set(list.flatMap((ingredient) => ingredient.items))];

      if (count === 1) {
        return {
          recipeId: recipe.id,
          type: recipe.type,
          label: null,
          iconItemId: null,
          ingredientItemIds,
          slug: recipe.slug,
        };
      }

      if (list.length === 0) {
        return {
          recipeId: recipe.id,
          type: recipe.type,
          label: recipe.note ? truncateNote(recipe.note) : null,
          iconItemId: null,
          ingredientItemIds,
          slug: recipe.slug,
        };
      }

      const distinguishing =
        list.find((ingredient) => !commonItemIds!.has(ingredient.items[0])) ?? list[0];

      return {
        recipeId: recipe.id,
        type: recipe.type,
        label: `from ${ingredientLabel(distinguishing, getItemName)}`,
        iconItemId: distinguishing.items[0],
        ingredientItemIds,
        slug: recipe.slug,
      };
    });

    if (count > 1) {
      resolveLabelCollisions(siblings, lists, getItemName);
    }

    groups.push({
      resultId,
      family: familyDisplayName(members[0].family),
      familyId: members[0].family.id,
      variantKey: normalizeVariantGroupKey(members[0].group),
      canonicalId: members[0].id,
      count,
      siblings,
    });
  }

  return groups;
}

export interface VariantGroup {
  /** The shared, normalized vanilla `group` field every member's canonical recipe carries (see normalizeVariantGroupKey). */
  groupKey: string;
  /** Every member RecipeGroup (one per distinct result item), sorted by resultId. variants[0] is this card's default/linked-to variant, matching RecipeGroup.canonicalId's own "alphabetically first" convention. */
  variants: RecipeGroup[];
}

/**
 * Folds RecipeGroups that share a normalized vanilla `group` field (see
 * RecipeGroup.variantKey) into one tabbed VariantGroup -- e.g. all 16
 * harness colors collapse into one "Harnesses" card instead of 16 separate
 * catalog entries. A groupKey with only one member (most copper
 * oxidation-tier groups, since vanilla doesn't tag every tier under one
 * shared group the way it does for wood/color families) isn't worth a tab
 * UI, so it's returned as a plain singleton alongside every RecipeGroup
 * with no variantKey at all.
 */
export function collapseVariantGroups(groups: RecipeGroup[]): {
  variantGroups: VariantGroup[];
  singletons: RecipeGroup[];
} {
  const byKey = new Map<string, RecipeGroup[]>();
  const singletons: RecipeGroup[] = [];

  for (const group of groups) {
    if (!group.variantKey) {
      singletons.push(group);
      continue;
    }
    const bucket = byKey.get(group.variantKey);
    if (bucket) {
      bucket.push(group);
    } else {
      byKey.set(group.variantKey, [group]);
    }
  }

  const variantGroups: VariantGroup[] = [];
  for (const [groupKey, members] of byKey) {
    if (members.length === 1) {
      singletons.push(members[0]);
      continue;
    }
    variantGroups.push({
      groupKey,
      variants: members.toSorted((a, b) => a.resultId.localeCompare(b.resultId)),
    });
  }

  return { variantGroups, singletons };
}

/** Looks up a recipe's group by its own recipe id (not just the canonical id). */
export function indexByRecipeId(groups: RecipeGroup[]): Map<string, RecipeGroup> {
  const map = new Map<string, RecipeGroup>();
  for (const group of groups) {
    for (const sibling of group.siblings) {
      map.set(sibling.recipeId, group);
    }
  }
  return map;
}

/**
 * Maps every craftable item's id to its group's canonical /recipe/{item}/
 * path -- only items that are some group's result are craftable, so an item
 * absent from this map has no recipe page. Bare, base-agnostic paths like
 * canonicalRecipePath/recipePath above; callers still apply withBase().
 * Powers the "link to its recipe" behavior on item-icon hover tooltips.
 */
export function buildRecipeHrefMap(
  groups: RecipeGroup[],
  itemsMap: Map<string, ItemData>,
): Map<string, string> {
  const map = new Map<string, string>();
  for (const group of groups) {
    map.set(group.resultId, canonicalRecipePath(groupItemSlug(group, itemsMap)));
  }
  return map;
}

/**
 * The /recipe/{item}/... URL segment for a group's result item. Reads the
 * item's precomputed slug (see scripts/lib/generate.ts); only falls back to
 * slugifying the group's own canonical recipe id for a resultless recipe
 * (so there's no item entry to read a slug from) -- see groupRecipes' doc
 * comment for why that stays a defensive case rather than a real one today.
 */
export function groupItemSlug(group: RecipeGroup, itemsMap: Map<string, ItemData>): string {
  return itemsMap.get(group.resultId)?.slug ?? slugify(group.canonicalId);
}

/**
 * The human-readable display name for a recipe group's result. Reads the
 * result item's name where one exists; otherwise falls back to a raw,
 * lowercase de-slugified canonicalId. Single source of truth for every
 * <title>, meta description, card label, and pager name derived from a
 * group, so this raw lowercase fallback never leaks into production HTML on
 * its own.
 */
export function groupDisplayName(group: RecipeGroup, itemsMap: Map<string, ItemData>): string {
  const resultItem = itemsMap.get(group.resultId);
  return resultItem?.name ?? group.canonicalId.replace(/_/g, " ");
}

/** The bare canonical URL path for an item's recipe group -- no slug segment. Callers still apply withBase(). */
export function canonicalRecipePath(itemSlug: string): string {
  return `${RECIPE_BASE_PATH}/${itemSlug}/`;
}

/**
 * The base-relative URL path for a specific recipe within a group. The
 * canonical recipe (whatever its own `slug` happens to be -- usually
 * "default", but not always, see recipeId === canonicalId below) is
 * reachable at the bare /recipe/{item}/ path with no slug segment; every
 * other sibling keeps /recipe/{item}/{slug}/. Callers still apply withBase().
 */
export function recipePath(
  itemSlug: string,
  canonicalId: string,
  recipeId: string,
  recipeSlug: string,
): string {
  return recipeId === canonicalId
    ? canonicalRecipePath(itemSlug)
    : `${RECIPE_BASE_PATH}/${itemSlug}/${recipeSlug}/`;
}

import type { Ingredient, ItemData, RecipeData } from "../content.config";
import { slugify } from "./slugify";
import { humanizeTagLabel } from "./tag-label";

const NOTE_MAX_LENGTH = 40;

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
 * Groups recipes by result item (recipes with no result, e.g. repair_item,
 * become their own singleton group keyed by their own id). For groups with
 * more than one recipe, derives a short "from X" label per sibling from
 * whatever ingredient actually differs between them -- not just the first
 * ingredient, which breaks when siblings share their first ingredient (all
 * 17 Suspicious Stew recipes lead with a bowl).
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
      family: members[0].family,
      canonicalId: members[0].id,
      count,
      siblings,
    });
  }

  return groups;
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
 * slugifying the group's own canonical recipe id for repair_item, the one
 * recipe with no result (so there's no item entry to read a slug from).
 */
export function groupItemSlug(group: RecipeGroup, itemsMap: Map<string, ItemData>): string {
  return itemsMap.get(group.resultId)?.slug ?? slugify(group.canonicalId);
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

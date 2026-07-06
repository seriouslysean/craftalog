import type {
  Ingredient,
  RawRecipeEntry,
  RawResult,
  RawTagsData,
  Recipe,
  RecipeResult,
} from "./types.ts";
import { normalizeIngredient } from "./ingredients.ts";
import { stripMcPrefix } from "./strings.ts";

const DEFAULT_CATEGORY = "misc";

/**
 * Curated human explanations for hardcoded ("special") crafting recipes —
 * these aren't data-driven in vanilla, so there's no ingredient list to
 * render, just a note. Keyed by the raw (prefixed) recipe type.
 */
const SPECIAL_NOTES: Record<string, string> = {
  "minecraft:crafting_special_bannerduplicate":
    "Combine a banner with a matching blank banner to duplicate its pattern.",
  "minecraft:crafting_special_bookcloning":
    "Combine a written book with a book and quill to copy its contents.",
  "minecraft:crafting_special_firework_rocket":
    "Combine paper, gunpowder, and up to 8 firework stars to craft a firework rocket.",
  "minecraft:crafting_special_firework_star":
    "Combine gunpowder with dyes and optional shape/effect ingredients to craft a firework star.",
  "minecraft:crafting_special_firework_star_fade":
    "Add extra dyes to an existing firework star to give it a fade-to-color effect.",
  "minecraft:crafting_special_mapextending":
    "Combine a filled map with paper to extend it to the next zoom level.",
  "minecraft:crafting_special_repairitem":
    "Combine two damaged items of the same type to repair them, combining their remaining durability.",
  "minecraft:crafting_special_shielddecoration":
    "Combine a shield with a banner to apply the banner's pattern.",
  "minecraft:crafting_decorated_pot":
    "Arrange four pottery sherds (or bricks) around the edges of the crafting grid to craft a decorated pot.",
  "minecraft:crafting_imbue":
    "Dip an item into a lingering potion to imbue it with the potion's effect, e.g. crafting tipped arrows.",
  "minecraft:crafting_dye":
    "Dye an item, such as leather armor or a wolf collar, using any color of dye.",
};

export function isIncludedSpecialType(type: string): boolean {
  return type in SPECIAL_NOTES;
}

function toResult(raw: RawResult | undefined): RecipeResult | undefined {
  if (!raw) return undefined;
  return { id: stripMcPrefix(raw.id), count: raw.count ?? 1 };
}

/**
 * Transforms a single raw recipe entry into the generated data contract's
 * `Recipe` shape. Returns undefined for out-of-scope recipe types (smelting,
 * stonecutting, smithing, uncurated specials, etc.) — the caller should skip
 * the id entirely.
 */
export function transformRecipe(
  id: string,
  raw: RawRecipeEntry,
  tags: RawTagsData,
): Omit<Recipe, "family"> | undefined {
  const category = raw.category ?? DEFAULT_CATEGORY;
  const group = raw.group;

  if (raw.type === "minecraft:crafting_shaped") {
    if (!raw.key || !raw.pattern) {
      throw new Error(`Recipe "${id}" is missing key/pattern for crafting_shaped`);
    }
    const key: Record<string, Ingredient> = {};
    for (const [char, value] of Object.entries(raw.key)) {
      key[char] = normalizeIngredient(value, tags);
    }
    return {
      id,
      type: "shaped",
      category,
      ...(group ? { group } : {}),
      result: toResult(raw.result),
      pattern: raw.pattern,
      key,
    };
  }

  if (raw.type === "minecraft:crafting_shapeless") {
    if (!raw.ingredients) {
      throw new Error(`Recipe "${id}" is missing ingredients for crafting_shapeless`);
    }
    return {
      id,
      type: "shapeless",
      category,
      ...(group ? { group } : {}),
      result: toResult(raw.result),
      ingredients: raw.ingredients.map((ingredient) => normalizeIngredient(ingredient, tags)),
    };
  }

  if (raw.type === "minecraft:crafting_transmute") {
    if (!raw.input || !raw.material) {
      throw new Error(`Recipe "${id}" is missing input/material for crafting_transmute`);
    }
    return {
      id,
      type: "transmute",
      category,
      ...(group ? { group } : {}),
      result: toResult(raw.result),
      ingredients: [normalizeIngredient(raw.input, tags), normalizeIngredient(raw.material, tags)],
    };
  }

  if (isIncludedSpecialType(raw.type)) {
    return {
      id,
      type: "special",
      category,
      ...(group ? { group } : {}),
      // Optional: crafting_special_repairitem carries no result in the
      // vendored data (it acts on two arbitrary matching-type items).
      ...(raw.result ? { result: toResult(raw.result) } : {}),
      note: SPECIAL_NOTES[raw.type],
    };
  }

  return undefined;
}

/** Collects every item id referenced by a recipe (result + all resolved ingredients). */
export function collectRecipeItemIds(recipe: Recipe): string[] {
  const ids = new Set<string>();

  if (recipe.result) ids.add(recipe.result.id);

  if (recipe.key) {
    for (const ingredient of Object.values(recipe.key)) {
      for (const item of ingredient.items) ids.add(item);
    }
  }

  if (recipe.ingredients) {
    for (const ingredient of recipe.ingredients) {
      for (const item of ingredient.items) ids.add(item);
    }
  }

  return Array.from(ids);
}

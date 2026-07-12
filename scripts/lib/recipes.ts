import type {
  GeneratedRecipe,
  Ingredient,
  RawRecipeEntry,
  RawResult,
  RawTagsData,
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

/**
 * The additive note used for a `minecraft:crafting_*` type this repo hasn't
 * curated a SPECIAL_NOTES entry for yet -- a future vanilla crafting type
 * is INCLUDED with this note (and surfaced in meta.audit.pendingSpecialTypes
 * as a curation queue) rather than failing the parse: the curated note is an
 * enhancement, never a blocking dependency (see docs/PLAN.md).
 */
const GENERIC_SPECIAL_NOTE = "Special crafting recipe — see the in-game recipe book.";

/**
 * Recipe types present in the vendored data that are deliberately out of
 * scope for this catalog (non-crafting-grid stations: furnaces, stonecutter,
 * smithing table). Derived from the full type inventory of
 * vendor/mcmeta-summary/data/recipe/data.json. Documentation of the KNOWN
 * out-of-scope set: an unknown NON-crafting type is still excluded, but gets
 * recorded in meta.audit.excludedUnknownTypes so a vendored data bump can
 * never silently drop a genuinely novel type (see transformRecipe).
 */
const KNOWN_EXCLUDED_TYPES = new Set([
  "minecraft:blasting",
  "minecraft:campfire_cooking",
  "minecraft:smelting",
  "minecraft:smithing_transform",
  "minecraft:smithing_trim",
  "minecraft:smoking",
  "minecraft:stonecutting",
]);

/** Crafting-grid shapeless recipes hold 1-9 ingredients (a 3x3 grid) -- anything else is malformed vendored data. */
const MAX_SHAPELESS_INGREDIENTS = 9;

/**
 * transformRecipe's output: the generated contract's recipe shape minus the
 * fields generate.ts derives afterwards (`family` from the result item,
 * `slug` from deriveRecipeSlugSource).
 */
export type TransformedRecipe = Omit<GeneratedRecipe, "family" | "slug">;

/**
 * Sink for the recipe-type degradations transformRecipe records instead of
 * throwing (see docs/PLAN.md's core-vs-presentation contract): unknown
 * crafting types that were included with the generic note, and unknown
 * non-crafting types that were excluded. Surfaced via meta.audit.
 */
export interface RecipeTypeAudit {
  pendingSpecialTypes: Set<string>;
  excludedUnknownTypes: Set<string>;
}

function toResult(raw: RawResult | undefined): RecipeResult | undefined {
  if (!raw) return undefined;
  return { id: stripMcPrefix(raw.id), count: raw.count ?? 1 };
}

/**
 * Whether a raw special recipe modifies an EXISTING item of the same kind
 * rather than crafting a genuinely new one -- the deterministic signal is a
 * raw ingredient field (`banner`, `target`, `map`, `source`, ...) whose
 * value is the same item id as the recipe's own `result.id`. Verified
 * against every special type in the vendored data: exactly bannerduplicate,
 * bookcloning, firework_star_fade, mapextending, shielddecoration, and
 * crafting_dye match; firework_rocket/firework_star/decorated_pot/imbue all
 * produce a different item than any of their own ingredient fields. Tag
 * refs ("#minecraft:banners") never match an item id (the "#" survives
 * stripMcPrefix), so they can't false-positive.
 */
function isSelfReferentialRaw(raw: RawRecipeEntry): boolean {
  const resultId = raw.result?.id;
  if (typeof resultId !== "string") return false;
  const bareResultId = stripMcPrefix(resultId);
  return Object.entries(raw).some(
    ([field, value]) =>
      field !== "type" &&
      field !== "category" &&
      field !== "group" &&
      typeof value === "string" &&
      stripMcPrefix(value) === bareResultId,
  );
}

/**
 * Transforms a single raw recipe entry into the generated data contract's
 * `Recipe` shape. Returns undefined for excluded types (KNOWN_EXCLUDED_TYPES
 * -- smelting, stonecutting, smithing, ... -- plus unknown non-crafting
 * types, which are additionally recorded in `audit.excludedUnknownTypes`) —
 * the caller should skip the id entirely. An unknown `minecraft:crafting_*`
 * type is INCLUDED as a "special" recipe with a generic note and recorded in
 * `audit.pendingSpecialTypes` -- a vendored data bump introducing a new
 * crafting type degrades to that additive default instead of failing the
 * automated weekly update (see docs/PLAN.md). Malformed data for a KNOWN
 * type (missing key/pattern/ingredients/input) still throws: that's core
 * recipe content, never shipped broken.
 */
export function transformRecipe(
  id: string,
  raw: RawRecipeEntry,
  tags: RawTagsData,
  audit?: RecipeTypeAudit,
): TransformedRecipe | undefined {
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
    if (raw.ingredients.length < 1 || raw.ingredients.length > MAX_SHAPELESS_INGREDIENTS) {
      throw new Error(
        `Recipe "${id}" has ${raw.ingredients.length} ingredients -- a crafting-grid shapeless recipe must have 1-${MAX_SHAPELESS_INGREDIENTS}`,
      );
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

  if (isIncludedSpecialType(raw.type) || raw.type.startsWith("minecraft:crafting_")) {
    const isCurated = isIncludedSpecialType(raw.type);
    if (!isCurated) audit?.pendingSpecialTypes.add(raw.type);
    return {
      id,
      type: "special",
      category,
      ...(group ? { group } : {}),
      // Optional: crafting_special_repairitem carries no result in the
      // vendored data (it acts on two arbitrary matching-type items).
      ...(raw.result ? { result: toResult(raw.result) } : {}),
      note: isCurated ? SPECIAL_NOTES[raw.type] : GENERIC_SPECIAL_NOTE,
      // Raw vanilla type id, kept alongside the coarse "special" bucket above
      // -- see generated-schema.ts's recipeSchema for why.
      vanillaType: raw.type,
      // Deterministic "modifies an existing item" signal -- see
      // isSelfReferentialRaw and src/utils/self-referential-specials.ts.
      ...(isSelfReferentialRaw(raw) ? { selfReferential: true } : {}),
    };
  }

  if (!KNOWN_EXCLUDED_TYPES.has(raw.type)) audit?.excludedUnknownTypes.add(raw.type);
  return undefined;
}

/** Collects every item id referenced by a recipe (result + all resolved ingredients). Accepts a pre-`family`/`slug` transform output or a full GeneratedRecipe. */
export function collectRecipeItemIds(recipe: TransformedRecipe): string[] {
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

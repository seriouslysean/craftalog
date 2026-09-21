import type {
  GeneratedRecipe,
  Ingredient,
  RawRecipeEntry,
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
 * smithing table, brewing stand). Derived from the full type inventory of
 * vendor/mcmeta-summary/data/recipe/data.json. Documentation of the KNOWN
 * out-of-scope set: an unknown NON-crafting type is still excluded, but gets
 * recorded in meta.audit.excludedUnknownTypes so a vendored data bump can
 * never silently drop a genuinely novel type (see transformRecipe).
 */
const KNOWN_EXCLUDED_TYPES = new Set([
  "minecraft:blasting",
  "minecraft:brewing",
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

/**
 * Recipes whose vendored `result` is an empty object because the crafted item
 * is copied from the recipe's own input rather than being a fixed item. 26.3
 * generalized both map recipes over item tags -- `map_cloning`'s `input`
 * became `#minecraft:clonable_maps` and `map_extending`'s `map` became
 * `#minecraft:extendable_maps` -- so the data no longer names a result item
 * at all. The generated result carries that whole input as `copiedFrom` (the
 * site shows the result mirroring whichever item went in); `canonical` is the
 * single member the recipe is filed under -- family, slug, and grouping all
 * key off one result id -- and `filled_map` is what both recipes produced
 * before 26.3.
 *
 * `canonical` is asserted to be a member of the resolved input in
 * toCopiedResult. Tag order is datapack JSON order and Mojang may reorder it
 * freely, so this must never degrade into "whichever item happens to be first".
 */
const COPIED_RESULT_RECIPES: Record<string, { inputField: string; canonical: string }> = {
  map_cloning: { inputField: "input", canonical: "filled_map" },
  map_extending: { inputField: "map", canonical: "filled_map" },
};

/**
 * Resolves the result of a recipe whose vendored `result` object carries no
 * `id` (see COPIED_RESULT_RECIPES). Throws when the recipe isn't a known
 * copied-result recipe, or when its canonical item is no longer part of the
 * input it copies -- both mean the vendored data changed shape again, and a
 * recipe's result is core content that never ships silently degraded.
 */
function toCopiedResult(id: string, raw: RawRecipeEntry, tags: RawTagsData): RecipeResult {
  const copied = COPIED_RESULT_RECIPES[id];
  if (!copied) {
    throw new Error(
      `Recipe "${id}" (${raw.type}) has an empty result object -- only ` +
        `${Object.keys(COPIED_RESULT_RECIPES).join(", ")} are known to copy their result from ` +
        `their own input; a vendored data bump may have changed shape ` +
        `(see scripts/lib/recipes.ts).`,
    );
  }

  const rawInput = raw[copied.inputField];
  if (typeof rawInput !== "string" && !Array.isArray(rawInput)) {
    throw new Error(
      `Recipe "${id}" is missing the "${copied.inputField}" input its result is copied from`,
    );
  }

  const copiedFrom = normalizeIngredient(rawInput, tags);
  if (!copiedFrom.items.includes(copied.canonical)) {
    throw new Error(
      `Recipe "${id}" copies its result from "${copied.inputField}", but its canonical result ` +
        `item "${copied.canonical}" is no longer one of that input's items ` +
        `(${copiedFrom.items.join(", ")}) -- pick a new canonical item in COPIED_RESULT_RECIPES.`,
    );
  }

  return { id: copied.canonical, count: raw.result?.count ?? 1, copiedFrom };
}

/**
 * Normalizes a recipe's raw result into the generated contract's shape.
 * Returns undefined only when the recipe carries no `result` field at all
 * (crafting_special_repairitem); an empty result object routes to
 * toCopiedResult.
 */
function toResult(id: string, raw: RawRecipeEntry, tags: RawTagsData): RecipeResult | undefined {
  const result = raw.result;
  if (!result) return undefined;
  if (typeof result.id !== "string") return toCopiedResult(id, raw, tags);
  return { id: stripMcPrefix(result.id), count: result.count ?? 1 };
}

/**
 * Whether a raw special recipe modifies an EXISTING item of the same kind
 * rather than crafting a genuinely new one -- the deterministic signal is a
 * raw ingredient field (`banner`, `target`, `map`, `source`, ...) whose
 * value is the same item id as the recipe's own `result.id`. Verified
 * against every special type in the vendored data: exactly bannerduplicate,
 * bookcloning, firework_star_fade, shielddecoration, and crafting_dye match
 * that way; firework_rocket/firework_star/decorated_pot/imbue all produce a
 * different item than any of their own ingredient fields. Tag refs
 * ("#minecraft:banners") never match an item id (the "#" survives
 * stripMcPrefix), so they can't false-positive.
 *
 * An empty `result` object is the second, stronger signal: the recipe hands
 * back the very item that went in (see COPIED_RESULT_RECIPES). mapextending
 * matched by id equality until 26.3 moved it onto a tag-valued input, which
 * the equality check below could never satisfy.
 */
function isSelfReferentialRaw(raw: RawRecipeEntry): boolean {
  if (raw.result && typeof raw.result.id !== "string") return true;

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
      result: toResult(id, raw, tags),
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
      result: toResult(id, raw, tags),
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
      result: toResult(id, raw, tags),
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
      ...(raw.result ? { result: toResult(id, raw, tags) } : {}),
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

  if (recipe.result) {
    ids.add(recipe.result.id);
    // A special recipe has no ingredient list, so a copied result's candidate
    // items reach items.json only through here.
    for (const item of recipe.result.copiedFrom?.items ?? []) ids.add(item);
  }

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

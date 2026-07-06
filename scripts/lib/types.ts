/**
 * Shared types for the recipe parser + validator pipeline.
 *
 * "Raw*" types describe the shape of the vendored mcmeta-summary JSON
 * (loosely typed, since the upstream data isn't ours to guarantee). The
 * remaining types mirror the generated data contract in docs/PLAN.md.
 */

// ---------------------------------------------------------------------------
// Raw mcmeta input types
// ---------------------------------------------------------------------------

export type RawIngredient = string | string[];

export interface RawResult {
  id: string;
  count?: number;
  [key: string]: unknown;
}

/**
 * A single recipe entry from data/recipe/data.json. Loosely typed on purpose:
 * the fields present depend on `type`, and we only care about a subset of
 * types (shaped/shapeless/transmute + a curated set of "special" types).
 */
export interface RawRecipeEntry {
  type: string;
  category?: string;
  group?: string;
  result?: RawResult;
  // crafting_shaped
  key?: Record<string, RawIngredient>;
  pattern?: string[];
  // crafting_shapeless
  ingredients?: RawIngredient[];
  // crafting_transmute
  input?: RawIngredient;
  material?: RawIngredient;
  [key: string]: unknown;
}

export type RawRecipesData = Record<string, RawRecipeEntry>;

export type RawTagValue = string | { id: string; required?: boolean };

export interface RawTag {
  values: RawTagValue[];
}

export type RawTagsData = Record<string, RawTag>;

/**
 * Texture map entries are usually a plain ref/indirection string, but some
 * (e.g. stained glass) use an extended `{ sprite, force_translucent }` form.
 */
export type RawModelTextureValue = string | { sprite: string; [key: string]: unknown };

export interface RawModel {
  parent?: string;
  textures?: Record<string, RawModelTextureValue>;
  [key: string]: unknown;
}

export type RawModelsData = Record<string, RawModel>;

export interface RawItemDefinition {
  model: unknown;
}

export type RawItemDefinitionsData = Record<string, RawItemDefinition>;

/** Locale -> translation key -> translated string. */
export type RawLangFile = Record<string, Record<string, string>>;

/**
 * Per-item data-driven components (vendor/mcmeta-summary/item_components).
 * Loosely typed on purpose — we only read a handful of well-known component
 * keys (see scripts/lib/item-stats.ts) out of the ~40 that exist upstream.
 */
export type RawItemComponents = Record<string, unknown>;
export type RawItemComponentsData = Record<string, RawItemComponents>;

// ---------------------------------------------------------------------------
// Generated data contract (see docs/PLAN.md "Generated data contract")
// ---------------------------------------------------------------------------

export interface Ingredient {
  items: string[];
  tag?: string;
}

export interface RecipeResult {
  id: string;
  count: number;
}

export type RecipeType = "shaped" | "shapeless" | "transmute" | "special";

export interface Recipe {
  id: string;
  type: RecipeType;
  category: string;
  group?: string;
  // Optional in practice only for crafting_special_repairitem, which has no
  // fixed result in the vendored data (see scripts/lib/recipes.ts).
  result?: RecipeResult;
  // shaped only
  pattern?: string[];
  key?: Record<string, Ingredient>;
  // shapeless + transmute
  ingredients?: Ingredient[];
  // special only
  note?: string;
}

export type RecipesOutput = Record<string, Recipe>;

export type IconOutput =
  | { type: "flat"; texture: string }
  | { type: "block"; top: string; side: string };

/**
 * A single defining gameplay stat for an item, shown on its recipe page.
 * At most one per item, chosen by priority in scripts/lib/item-stats.ts:
 * food > armor > weapon > tool. Most items (building blocks, etc.) have none.
 */
export type ItemStat =
  | { type: "food"; nutrition: number }
  | { type: "armor"; points: number }
  | { type: "weapon"; damage: number }
  | { type: "tool"; durability: number };

export interface Item {
  id: string;
  name: string;
  icon: IconOutput;
  stat?: ItemStat;
}

export type ItemsOutput = Record<string, Item>;

export interface Meta {
  version: string;
  counts: {
    shaped: number;
    shapeless: number;
    transmute: number;
    special: number;
    items: number;
    texturesCopied: number;
  };
  unresolvedIcons: string[];
}

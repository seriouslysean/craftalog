/**
 * Shared types for the recipe parser + validator pipeline.
 *
 * "Raw*" types describe the shape of the vendored mcmeta-summary JSON
 * (loosely typed, since the upstream data isn't ours to guarantee). The
 * generated-contract types below are derived from the zod schemas in
 * src/data/generated-schema.ts (the single source of truth for the shape
 * described in docs/PLAN.md) via `import type` + `z.infer`, so this file
 * carries zero runtime dependency on `astro`/zod — `tsx` erases type-only
 * imports entirely, preserving the boundary tsconfig.json's `exclude`
 * comment protects (no @types/node-shaped dependency creep into the Astro
 * type-checked surface, and vice versa).
 */
import type { z } from "astro/zod";
import type {
  iconSchema,
  ingredientSchema,
  itemSchema,
  itemStatSchema,
  recipeResultSchema,
  recipeSchema,
} from "../../src/data/generated-schema.ts";

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

/**
 * One face of a model element's `faces` map. `texture` (an indirection like
 * "#body" or an occasional literal ref) and `uv` (the face's texture-atlas
 * sub-rectangle, [u0,v0,u1,v1] in 0-16 texture-pixel space) are both read --
 * see scripts/lib/model.ts's extractCompoundElements, which crops the
 * "compound" icon type's faces to this rect instead of showing the whole
 * texture. `rotation`/`cullface` still aren't reproduced (no visible defect
 * from skipping cullface -- see extractCompoundElements' own comment on why
 * hidden/culled faces don't matter for a fixed isometric camera).
 */
export interface RawModelElementFace {
  texture: string;
  /** [u0, v0, u1, v1], 0-16 texture-pixel space. u0>u1 or v0>v1 signals a mirror on that axis. Optional -- see scripts/lib/model.ts's defaultFaceUv for the fallback when omitted. */
  uv?: [number, number, number, number];
  [key: string]: unknown;
}

/**
 * One element (a single axis-aligned box) of a block model's `elements`
 * array, in 0-16 block-space coordinates. `faces` is keyed by all 6
 * cardinal directions, and extractCompoundElements (scripts/lib/model.ts)
 * reads all 6 -- up/east/south are the only 3 a SIMPLE CONVEX box ever
 * shows from this catalog's fixed isometric camera (see ItemIcon.astro's
 * shared `rotateX(-35deg) rotateY(-45deg)` camera), but concave/hollow/
 * stepped shapes (e.g. composter, grindstone) genuinely expose down/north/
 * west-facing surfaces too.
 */
export interface RawModelElement {
  from: [number, number, number];
  to: [number, number, number];
  faces?: Partial<Record<"up" | "down" | "north" | "south" | "east" | "west", RawModelElementFace>>;
  [key: string]: unknown;
}

/** A single display context's transform (rotation in degrees [x,y,z]). Only `rotation` is read. */
export interface RawModelDisplayTransform {
  rotation?: [number, number, number];
  [key: string]: unknown;
}

export interface RawModel {
  parent?: string;
  textures?: Record<string, RawModelTextureValue>;
  /** Real per-element box geometry, when this model defines its own shape rather than inheriting a shared template's. */
  elements?: RawModelElement[];
  /** Per display-context transforms (gui, fixed, ground, ...) -- see scripts/lib/model.ts's gui-yaw-delta handling. */
  display?: Partial<Record<string, RawModelDisplayTransform>>;
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

export type Ingredient = z.infer<typeof ingredientSchema>;
export type RecipeResult = z.infer<typeof recipeResultSchema>;

/** Derived taxonomy label for browsing (see scripts/lib/family.ts) — always present on `Recipe.family`. */
export type Recipe = z.infer<typeof recipeSchema>;

export type RecipeType = Recipe["type"];

export type RecipesOutput = Record<string, Recipe>;

export type IconOutput = z.infer<typeof iconSchema>;

/**
 * A single defining gameplay stat for an item, shown on its recipe page.
 * At most one per item, chosen by priority in scripts/lib/item-stats.ts:
 * food > armor > weapon > tool. Most items (building blocks, etc.) have none.
 */
export type ItemStat = z.infer<typeof itemStatSchema>;

export type Item = z.infer<typeof itemSchema>;

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
  /** Result item ids whose family fell through to the category fallback (see scripts/lib/family.ts's `deriveFamily`) -- surfaces taxonomy gaps in a version-bump PR diff instead of silently bucketing them. */
  fallbackFamilyItems: string[];
}

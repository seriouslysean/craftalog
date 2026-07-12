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
  categorySchema,
  familySchema,
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
 * reads all 6 -- up/north/east are the only 3 a SIMPLE CONVEX box ever
 * shows from the compound camera (see ItemIcon.astro's `.compound`
 * `rotateX(-35deg) rotateY(-135deg)` camera, which matches vanilla's own
 * GUI face selection), but concave/hollow/stepped shapes (e.g. composter,
 * grindstone) genuinely expose down/south/west-facing surfaces too.
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

/** One entry from data/banner_pattern/data.json -- see scripts/lib/patterned-banner.ts. */
export interface RawBannerPatternEntry {
  asset_id: string;
  translation_key: string;
  [key: string]: unknown;
}

export type RawBannerPatternRegistry = Record<string, RawBannerPatternEntry>;

/**
 * One axis-aligned box in a Bedrock entity geometry (`.geo.json`) --
 * Bedrock's equivalent of a Java block model's `elements` array, used here
 * only for the copper golem statue (see scripts/lib/copper-golem-icon.ts).
 * `origin` is one corner (native model units, NOT a center), `size` the box
 * dimensions, `uv` the top-left of its box-UV unwrap on the shared atlas.
 * `rotation`/`mirror` are real Bedrock cube features this repo's extractor
 * doesn't implement (verified absent on every cube it currently reads;
 * `copperGolemCompoundIcon` throws if a future data bump introduces one
 * rather than silently mis-rendering).
 */
export interface RawBedrockCube {
  origin: [number, number, number];
  size: [number, number, number];
  uv: [number, number];
  inflate?: number;
  rotation?: [number, number, number];
  mirror?: boolean;
  [key: string]: unknown;
}

/** One named part of a Bedrock entity geometry -- only `cubes` is read; `pivot`/`rotation` (bone-level, not per-cube) are only meaningful when a rotation is actually applied, which this repo's one consumer verified is never the case for its source file. */
export interface RawBedrockBone {
  name: string;
  cubes?: RawBedrockCube[];
  rotation?: [number, number, number];
  [key: string]: unknown;
}

/** One named geometry (a `.geo.json` can bundle several, e.g. a base model plus attachment-only sub-geometries) -- select by `description.identifier`. */
export interface RawBedrockGeometry {
  description: {
    identifier: string;
    texture_width: number;
    texture_height: number;
    [key: string]: unknown;
  };
  bones: RawBedrockBone[];
}

/** The root shape of a Bedrock entity geometry file (`resource_pack/models/entity/*.geo.json`). */
export interface RawBedrockGeometryFile {
  "minecraft:geometry": RawBedrockGeometry[];
}

/**
 * One named part of a *legacy* (pre-1.12, `"format_version"` like "1.8.0"/
 * "1.10.0") Bedrock entity geometry -- same cube shape as `RawBedrockBone`
 * (reuses `RawBedrockCube`), but this older schema nests `pivot`/`rotation`
 * directly on the bone with no `description` wrapper, and a bone's parent is
 * a bone NAME (string), not implied by array position. Used only for the
 * shulker (see scripts/lib/shulker-icon.ts) -- `copper_golem.geo.json`
 * already uses the newer `minecraft:geometry` schema above.
 */
export interface RawLegacyBedrockBone {
  name: string;
  parent?: string;
  pivot?: [number, number, number];
  rotation?: [number, number, number];
  cubes?: RawBedrockCube[];
  [key: string]: unknown;
}

/** One named geometry in the legacy schema -- e.g. "geometry.shulker.v1.8", the key `shulker.entity.json`'s `geometry.default` references. */
export interface RawLegacyBedrockGeometry {
  texturewidth: number;
  textureheight: number;
  bones: RawLegacyBedrockBone[];
  [key: string]: unknown;
}

/**
 * The root shape of a legacy-format Bedrock entity geometry file
 * (`resource_pack/models/entity/*.geo.json` with a pre-1.12
 * `"format_version"`) -- every top-level key besides `format_version` is
 * itself a named geometry (Bedrock allows bundling several per file, same
 * idea as the newer schema's `minecraft:geometry` array, just keyed instead
 * of listed).
 */
export interface RawLegacyBedrockGeometryFile {
  format_version: string;
  [geometryKey: string]: RawLegacyBedrockGeometry | string;
}

// ---------------------------------------------------------------------------
// Generated data contract (see docs/PLAN.md "Generated data contract")
// ---------------------------------------------------------------------------

export type Ingredient = z.infer<typeof ingredientSchema>;
export type RecipeResult = z.infer<typeof recipeResultSchema>;

/**
 * The generator/validator's on-disk view of a recipe. `z.infer<typeof
 * recipeSchema>` alone gives the shape Astro's content loader produces
 * *after* resolving `family` as a `families` collection reference (see
 * src/content.config.ts's `RecipeData`, the Astro-runtime equivalent) —
 * but scripts/lib/generate.ts writes the raw pre-resolution JSON, where
 * `family` is still a plain family id string (e.g. "copper_goods"). This
 * type swaps that one field back to what's actually on disk.
 */
export type GeneratedRecipe = Omit<z.infer<typeof recipeSchema>, "family"> & {
  /** Family id (see scripts/lib/family.ts's deriveFamily), not yet resolved to a `families` collection reference. */
  family: string;
};

export type RecipeType = GeneratedRecipe["type"];

export type RecipesOutput = Record<string, GeneratedRecipe>;

export type IconOutput = z.infer<typeof iconSchema>;

/** The generic multi-element "compound" icon variant of IconOutput -- the shape every icon-builder module produces (see scripts/lib/compound-icon.ts for the shared construction helpers). */
export type CompoundIcon = Extract<IconOutput, { type: "compound" }>;

/** One box element of a CompoundIcon. */
export type CompoundElement = CompoundIcon["elements"][number];

/** One resolved face of a CompoundElement: a texture path plus its uv crop rect. */
export type CompoundFace = NonNullable<CompoundElement["faces"]["up"]>;

/**
 * A single defining gameplay stat for an item, shown on its recipe page.
 * At most one per item, chosen by priority in scripts/lib/item-stats.ts:
 * food > armor > weapon > tool. Most items (building blocks, etc.) have none.
 */
export type ItemStat = z.infer<typeof itemStatSchema>;

export type Item = z.infer<typeof itemSchema>;

export type ItemsOutput = Record<string, Item>;

/** No reference fields, so the on-disk shape and the Astro-loaded shape are identical -- see scripts/lib/category.ts's CATEGORIES. */
export type Category = z.infer<typeof categorySchema>;

export type CategoriesOutput = Record<string, Category>;

/**
 * The generator/validator's on-disk view of a family (see GeneratedRecipe's
 * doc comment above for why `category` -- a `categories` collection
 * reference -- needs the same on-disk-string override as `family` does on
 * Recipe).
 */
export type GeneratedFamily = Omit<z.infer<typeof familySchema>, "category"> & {
  /** Category id (see scripts/lib/family.ts's FAMILY_CATEGORY), not yet resolved to a `categories` collection reference. */
  category: string;
};

export type FamiliesOutput = Record<string, GeneratedFamily>;

/** One item whose bespoke icon extraction failed and degraded to the placeholder -- see MetaAudit.degradedIcons. */
export interface DegradedIcon {
  itemId: string;
  reason: string;
}

/**
 * The structured degradation record every parse run emits (meta.json's
 * `audit` key). PRESENTATION-layer derivations (icons, families, notes)
 * degrade gracefully instead of failing the run (see docs/PLAN.md's
 * core-vs-presentation contract); everything they degraded on is collected
 * here so the weekly update PR (which embeds meta.json in its body) surfaces
 * it as a curation queue instead of it vanishing silently. All lists are
 * sorted for deterministic output, and all are expected to be empty at a
 * healthy pin.
 */
export interface MetaAudit {
  /** Items whose bespoke icon extraction (Bedrock geometry, atlas-dimension checks, ...) failed and shipped the placeholder instead -- see scripts/lib/generate.ts's degrade helper. */
  degradedIcons: DegradedIcon[];
  /** Derivations that unexpectedly produced zero entries from non-empty vendored inputs (e.g. the patterned-banner sweep) -- see scripts/lib/generate.ts. */
  emptyDerivations: string[];
  /** Unknown NON-crafting recipe types excluded from the catalog (anything novel beyond scripts/lib/recipes.ts's KNOWN_EXCLUDED_TYPES) -- see transformRecipe. */
  excludedUnknownTypes: string[];
  /** Result item ids whose family fell through to the category fallback (see scripts/lib/family.ts's `deriveFamily`) -- surfaces taxonomy gaps needing a real family rule. */
  fallbackFamilyItems: string[];
  /** Unknown `minecraft:crafting_*` recipe types included with the generic note, pending a curated SPECIAL_NOTES entry -- see scripts/lib/recipes.ts's transformRecipe. */
  pendingSpecialTypes: string[];
  /** Head `kind`s missing from scripts/lib/head-icon.ts's HEAD_KIND_TEXTURES, degraded to the placeholder (a visibly-wrong particle swatch is worse) -- see scripts/lib/generate.ts. */
  unmappedHeadKinds: string[];
  /** Items whose icon resolution found no usable texture and shipped the placeholder. */
  unresolvedIcons: string[];
}

export interface Meta {
  version: string;
  counts: {
    shaped: number;
    shapeless: number;
    transmute: number;
    special: number;
    items: number;
    /** Every texture file a parse run writes under public/textures/ (verbatim vendor copies + synthesized/derived icons + the fixed HUD sprites) -- see scripts/lib/generate.ts's countTexturesWritten. */
    texturesWritten: number;
  };
  audit: MetaAudit;
}

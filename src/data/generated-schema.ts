import { reference } from "astro:content";
import { z } from "astro/zod";

// Single source of truth for the generated data contract described in
// docs/PLAN.md ("Generated data contract"). Consumed two ways: directly by
// src/content.config.ts (Astro content collections validate against these at
// build time), and via z.infer by scripts/lib/types.ts (the parser/validator
// pipeline, which is excluded from `astro check` and only needs the derived
// TS types, never the zod runtime — see that file's `import type` usage).
//
// `reference()` (from "astro:content") is safe to call here even though this
// file also feeds the Node-only parser/validator pipeline: scripts/lib/types.ts
// only ever does `import type` from this file, which tsx erases entirely, so
// the virtual "astro:content" module is never touched outside Astro's own
// Vite-processed graph (content.config.ts and friends).

export const categorySchema = z.object({
  id: z.string(),
  name: z.string(),
  /** Curated display order (1-9) for the top-level category nav -- see scripts/lib/category.ts. */
  order: z.number(),
});

export const familySchema = z.object({
  id: z.string(),
  name: z.string(),
  /** The owning category's id -- see scripts/lib/family.ts's FAMILY_CATEGORY. */
  category: reference("categories"),
});

export const ingredientSchema = z.object({
  /** Nonempty by contract -- an ingredient with zero candidate items would render as an empty slot; generation fails loudly before ever emitting one (see scripts/lib/ingredients.ts). */
  items: z.array(z.string()).min(1),
  tag: z.string().optional(),
});

export const recipeResultSchema = z.object({
  id: z.string(),
  count: z.number().int().positive(),
});

/** A shaped recipe's crafting-grid pattern: 1-3 rows of 1-3 single-char cells each, all rows the same width. */
const recipePatternSchema = z
  .array(z.string().min(1).max(3))
  .min(1)
  .max(3)
  .refine((rows) => new Set(rows.map((row) => row.length)).size === 1, {
    message: "pattern rows must all have the same width",
  });

const recipeObjectSchema = z.object({
  id: z.string(),
  type: z.enum(["shaped", "shapeless", "transmute", "special"]),
  category: z.string(),
  /** Derived browse taxonomy -- a reference to the families collection's id, e.g. "copper_goods" (see scripts/lib/family.ts's deriveFamily). */
  family: reference("families"),
  /** URL-safe /recipe/{item}/{slug}/ segment, unique within the recipe's result-item group (see scripts/lib/recipe-slug.ts). */
  slug: z.string(),
  group: z.string().optional(),
  /** This result item's shape-family collapse key, derived from vanilla item tags (e.g. "slabs") -- see scripts/lib/shape-tag.ts's deriveShapeTag. Absent when the result isn't in any allow-listed shape tag. */
  shapeTag: z.string().optional(),
  // Optional at the type level (special recipes may lack one upstream --
  // crafting_special_repairitem), but the per-type refinement below requires
  // it for every shaped/shapeless/transmute recipe, and generate.ts excludes
  // repairitem from emission -- so every committed recipe has one in practice.
  result: recipeResultSchema.optional(),
  // shaped only (required for that type -- see the per-type refinement below)
  pattern: recipePatternSchema.optional(),
  key: z.record(z.string().length(1), ingredientSchema).optional(),
  // shapeless (1-9, a 3x3 grid) + transmute (exactly 2: input + material)
  ingredients: z.array(ingredientSchema).min(1).max(9).optional(),
  // special only (required for that type)
  note: z.string().optional(),
  // special only -- the raw vanilla recipe type id (e.g.
  // "minecraft:crafting_special_bannerduplicate"), preserved because the
  // coarse `type: "special"` bucket above collapses ~11 distinct vanilla
  // types into one value. shaped/shapeless/transmute don't need this: each
  // already maps 1:1 to a single vanilla type via `type` itself. Consumed by
  // src/utils/self-referential-specials.ts to demote self-referential
  // specials (banner duplicate, shield decoration, ...) below the primary
  // variant tabs -- see scripts/lib/recipes.ts's transformRecipe. Optional
  // even for specials: synthetic patterned-banner entries have no vanilla
  // type at all (see scripts/lib/generate.ts).
  vanillaType: z.string().optional(),
  // special only -- true when the raw vendored recipe has an ingredient
  // field (`banner`, `target`, `map`, `source`, ...) equal to its own
  // result id, the deterministic signal that the recipe MODIFIES an
  // existing item of the same kind (banner duplicate, shield decoration,
  // leather re-dye, ...) rather than crafting a genuinely new one -- see
  // scripts/lib/recipes.ts's isSelfReferentialRaw. Persisted so consumers
  // (src/utils/self-referential-specials.ts) can demote these below the
  // primary variant tabs without hardcoding vanilla type ids. Omitted
  // (never `false`) when the signal is absent.
  selfReferential: z.boolean().optional(),
});

/**
 * Per-`type` structural requirements, enforced at validation time without
 * changing the inferred TS shape (a z.discriminatedUnion would make required
 * per-variant fields, but its inferred union breaks every existing consumer
 * that reads e.g. `recipe.pattern` without narrowing -- the field-optional
 * object shape above is the published contract).
 */
export const recipeSchema = recipeObjectSchema.superRefine((recipe, ctx) => {
  const requireField = (field: "result" | "pattern" | "key" | "ingredients" | "note"): void => {
    if (recipe[field] === undefined) {
      ctx.addIssue({
        code: "custom",
        path: [field],
        message: `a ${recipe.type} recipe requires "${field}"`,
      });
    }
  };

  switch (recipe.type) {
    case "shaped": {
      requireField("result");
      requireField("pattern");
      requireField("key");
      if (recipe.key && Object.keys(recipe.key).length === 0) {
        ctx.addIssue({
          code: "custom",
          path: ["key"],
          message: "a shaped recipe's key must define at least one ingredient",
        });
      }
      break;
    }
    case "shapeless": {
      requireField("result");
      requireField("ingredients");
      break;
    }
    case "transmute": {
      requireField("result");
      requireField("ingredients");
      if (recipe.ingredients && recipe.ingredients.length !== 2) {
        ctx.addIssue({
          code: "custom",
          path: ["ingredients"],
          message: "a transmute recipe has exactly 2 ingredients (input + material)",
        });
      }
      break;
    }
    case "special": {
      requireField("note");
      break;
    }
  }
});

/**
 * One resolved face of a "compound" element: a concrete `/textures/...`
 * path plus its texture-atlas crop rect ([u0,v0,u1,v1], 0-16 texture-pixel
 * space -- Minecraft's UV convention; u0>u1 or v0>v1 signals a mirror on
 * that axis). See ItemIcon.astro's computeUvCrop for how this is applied.
 */
export const compoundFaceSchema = z.object({
  texture: z.string(),
  uv: z.tuple([z.number(), z.number(), z.number(), z.number()]),
});

/**
 * One box element of a "compound" icon, already resolved to concrete
 * `/textures/...` paths. All 6 cardinal faces can be populated -- up/east/
 * south are the only 3 a SIMPLE CONVEX box ever shows from this catalog's
 * fixed isometric camera, but concave/hollow/stepped shapes (e.g.
 * composter's open-top hollow box, grindstone's post-and-wheel assembly)
 * genuinely expose down/north/west-facing surfaces too -- see
 * ItemIcon.astro's computeFaceStyle.
 */
export const compoundElementSchema = z.object({
  from: z.tuple([z.number(), z.number(), z.number()]),
  to: z.tuple([z.number(), z.number(), z.number()]),
  faces: z.object({
    up: compoundFaceSchema.optional(),
    down: compoundFaceSchema.optional(),
    north: compoundFaceSchema.optional(),
    south: compoundFaceSchema.optional(),
    east: compoundFaceSchema.optional(),
    west: compoundFaceSchema.optional(),
  }),
});

export const iconSchema = z.union([
  z.object({ type: z.literal("flat"), texture: z.string() }),
  z.object({ type: z.literal("block"), top: z.string(), side: z.string() }),
  z.object({ type: z.literal("slab"), top: z.string(), side: z.string() }),
  z.object({ type: z.literal("stairs"), top: z.string(), side: z.string() }),
  // Single-texture compound shapes (one material texture painted on every
  // face of a multi-element model) -- see ItemIcon.astro for each shape's
  // dedicated rendering branch.
  z.object({ type: z.literal("pressure_plate"), texture: z.string() }),
  z.object({ type: z.literal("wall"), texture: z.string() }),
  z.object({ type: z.literal("button"), texture: z.string() }),
  z.object({ type: z.literal("fence"), texture: z.string() }),
  z.object({ type: z.literal("fence_gate"), texture: z.string() }),
  // Generic multi-element compound: real per-element box geometry + resolved
  // per-face textures, for block models classifyChain doesn't recognize as
  // any of the shapes above (e.g. anvil) -- see ItemIcon.astro's "compound"
  // rendering branch and scripts/lib/model.ts's extractCompoundElements.
  z.object({
    type: z.literal("compound"),
    elements: z.array(compoundElementSchema),
    /** Extra Y rotation (degrees) applied on top of the shared camera, from this model's own display.gui override (see scripts/lib/model.ts). */
    yRotation: z.number(),
    /**
     * Tags a compound icon whose hand-authored geometry is far thinner/
     * narrower than a real block (banner's pole+crossbar+flag -- see
     * scripts/lib/banner-icon.ts -- and shield's single thin plate -- see
     * scripts/lib/shield-icon.ts) so ItemIcon.astro can apply that shape's
     * own calibrated --icon-scale instead of the generic cube-calibrated
     * one, which would otherwise render it tiny inside its box (the generic
     * scale is a safe-for-any-shape containment floor, not a "fill
     * efficiently" target -- see ItemIcon.astro's .item-icon--banner rule
     * for the derivation). Absent for every vendored-geometry compound
     * (anvil, grindstone, composter, ...), which all share the generic scale.
     */
    variant: z.enum(["banner", "shield"]).optional(),
  }),
]);

export const itemStatSchema = z.union([
  z.object({ type: z.literal("food"), nutrition: z.number() }),
  z.object({ type: z.literal("armor"), points: z.number() }),
  z.object({ type: z.literal("weapon"), damage: z.number() }),
  z.object({ type: z.literal("tool"), durability: z.number() }),
]);

export const itemSchema = z.object({
  id: z.string(),
  name: z.string(),
  /** URL-safe /recipe/{slug}/... segment, derived from `id` (not `name` -- several items share a display name, e.g. every smithing template is just "Smithing Template"), so this is globally unique. */
  slug: z.string(),
  icon: iconSchema,
  stat: itemStatSchema.optional(),
});

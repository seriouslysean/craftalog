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
  items: z.array(z.string()),
  tag: z.string().optional(),
});

export const recipeResultSchema = z.object({
  id: z.string(),
  count: z.number(),
});

export const recipeSchema = z.object({
  id: z.string(),
  type: z.enum(["shaped", "shapeless", "transmute", "special"]),
  category: z.string(),
  /** Derived browse taxonomy -- a reference to the families collection's id, e.g. "copper_goods" (see scripts/lib/family.ts's deriveFamily). */
  family: reference("families"),
  /** URL-safe /recipe/{item}/{slug}/ segment, unique within the recipe's result-item group (see scripts/lib/recipe-slug.ts). */
  slug: z.string(),
  group: z.string().optional(),
  // Optional in practice only for crafting_special_repairitem.
  result: recipeResultSchema.optional(),
  // shaped only
  pattern: z.array(z.string()).optional(),
  key: z.record(z.string(), ingredientSchema).optional(),
  // shapeless + transmute
  ingredients: z.array(ingredientSchema).optional(),
  // special only
  note: z.string().optional(),
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

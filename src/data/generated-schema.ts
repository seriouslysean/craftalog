import { z } from "astro/zod";

// Single source of truth for the generated data contract described in
// docs/PLAN.md ("Generated data contract"). Consumed two ways: directly by
// src/content.config.ts (Astro content collections validate against these at
// build time), and via z.infer by scripts/lib/types.ts (the parser/validator
// pipeline, which is excluded from `astro check` and only needs the derived
// TS types, never the zod runtime — see that file's `import type` usage).

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
  family: z.string(),
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

export const iconSchema = z.union([
  z.object({ type: z.literal("flat"), texture: z.string() }),
  z.object({ type: z.literal("block"), top: z.string(), side: z.string() }),
  z.object({ type: z.literal("slab"), top: z.string(), side: z.string() }),
  z.object({ type: z.literal("stairs"), top: z.string(), side: z.string() }),
  z.object({
    type: z.literal("bed"),
    headUp: z.string(),
    headEast: z.string(),
    headNorth: z.string(),
    footUp: z.string(),
    footEast: z.string(),
    footSouth: z.string(),
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

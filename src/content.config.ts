import { defineCollection } from "astro:content";
import { file } from "astro/loaders";
import { z } from "astro/zod";

// Mirrors the generated data contract in docs/PLAN.md ("Generated data
// contract"). This is the single source of truth for the shape of
// src/data/generated/{recipes,items}.json inside src/ — see scripts/lib/types.ts
// for the equivalent types used by the (excluded from `astro check`) parser.

const ingredientSchema = z.object({
  items: z.array(z.string()),
  tag: z.string().optional(),
});

const recipeResultSchema = z.object({
  id: z.string(),
  count: z.number(),
});

const recipeSchema = z.object({
  id: z.string(),
  type: z.enum(["shaped", "shapeless", "transmute", "special"]),
  category: z.string(),
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

const iconSchema = z.union([
  z.object({ type: z.literal("flat"), texture: z.string() }),
  z.object({ type: z.literal("block"), top: z.string(), side: z.string() }),
]);

const itemSchema = z.object({
  id: z.string(),
  name: z.string(),
  icon: iconSchema,
});

const recipes = defineCollection({
  loader: file("src/data/generated/recipes.json"),
  schema: recipeSchema,
});

const items = defineCollection({
  loader: file("src/data/generated/items.json"),
  schema: itemSchema,
});

export const collections = { recipes, items };

export type Ingredient = z.infer<typeof ingredientSchema>;
export type RecipeResult = z.infer<typeof recipeResultSchema>;
export type RecipeData = z.infer<typeof recipeSchema>;
export type IconData = z.infer<typeof iconSchema>;
export type ItemData = z.infer<typeof itemSchema>;

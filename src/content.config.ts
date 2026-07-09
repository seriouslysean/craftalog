import { defineCollection } from "astro:content";
import { file } from "astro/loaders";
import type { z } from "astro/zod";
import {
  categorySchema,
  familySchema,
  iconSchema,
  ingredientSchema,
  itemSchema,
  itemStatSchema,
  recipeResultSchema,
  recipeSchema,
} from "./data/generated-schema";

// Schemas live in ./data/generated-schema.ts (the single source of truth for
// the generated data contract in docs/PLAN.md) so scripts/lib/types.ts can
// derive the same shapes via z.infer instead of hand-mirroring them.

const recipes = defineCollection({
  loader: file("src/data/generated/recipes.json"),
  schema: recipeSchema,
});

const items = defineCollection({
  loader: file("src/data/generated/items.json"),
  schema: itemSchema,
});

const categories = defineCollection({
  loader: file("src/data/generated/categories.json"),
  schema: categorySchema,
});

const families = defineCollection({
  loader: file("src/data/generated/families.json"),
  schema: familySchema,
});

export const collections = { recipes, items, categories, families };

export type Ingredient = z.infer<typeof ingredientSchema>;
export type RecipeResult = z.infer<typeof recipeResultSchema>;
export type RecipeData = z.infer<typeof recipeSchema>;
export type IconData = z.infer<typeof iconSchema>;
export type ItemStatData = z.infer<typeof itemStatSchema>;
export type ItemData = z.infer<typeof itemSchema>;
export type CategoryData = z.infer<typeof categorySchema>;
export type FamilyData = z.infer<typeof familySchema>;

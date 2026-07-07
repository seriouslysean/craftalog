import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { deriveRecipeSlugSource } from "../scripts/lib/recipe-slug.ts";
import { slugify } from "../src/utils/slugify";
import type { ItemsOutput, RecipesOutput } from "../scripts/lib/types.ts";

describe("deriveRecipeSlugSource", () => {
  it("returns 'default' when the recipe id equals the item id exactly", () => {
    expect(deriveRecipeSlugSource("bone_meal", "bone_meal")).toBe("default");
  });

  it("strips the item id as a prefix, keeping the distinguishing suffix", () => {
    expect(deriveRecipeSlugSource("bone_meal_from_bone_block", "bone_meal")).toBe(
      "from_bone_block",
    );
  });

  it("strips the item id when embedded in the middle, not just as a prefix", () => {
    expect(deriveRecipeSlugSource("dye_black_wool", "black_wool")).toBe("dye");
  });

  it("strips a suffix-only match", () => {
    expect(deriveRecipeSlugSource("black_banner_duplicate", "black_banner")).toBe("duplicate");
  });

  it("falls back to the full recipe id when the item id doesn't appear at all", () => {
    expect(deriveRecipeSlugSource("book_cloning", "written_book")).toBe("book_cloning");
    expect(deriveRecipeSlugSource("map_cloning", "filled_map")).toBe("map_cloning");
  });

  it("never collides within a real magenta_dye-shaped 5-way group", () => {
    const ids = [
      "magenta_dye_from_allium",
      "magenta_dye_from_blue_red_pink",
      "magenta_dye_from_blue_red_white_dye",
      "magenta_dye_from_lilac",
      "magenta_dye_from_purple_and_pink",
    ];
    const slugs = ids.map((id) => deriveRecipeSlugSource(id, "magenta_dye"));
    expect(new Set(slugs).size).toBe(slugs.length);
  });
});

/**
 * Data-driven guard against the real generated data: catches a future
 * Minecraft version introducing a recipe/item that breaks slug uniqueness or
 * the URL-safe format, before it ever reaches a PR (including the weekly
 * update-data.yml version-bump PR).
 */
describe("generated slugs stay unique and URL-safe (regression guard for future mcmeta bumps)", () => {
  const recipes: RecipesOutput = JSON.parse(
    readFileSync(join(import.meta.dirname, "../src/data/generated/recipes.json"), "utf8"),
  );
  const items: ItemsOutput = JSON.parse(
    readFileSync(join(import.meta.dirname, "../src/data/generated/items.json"), "utf8"),
  );

  const SLUG_FORMAT = /^[a-z0-9]+(-[a-z0-9]+)*$/;

  it("every item slug matches the URL-safe slug format", () => {
    for (const [id, item] of Object.entries(items)) {
      expect(item.slug, `item "${id}" has slug "${item.slug}"`).toMatch(SLUG_FORMAT);
    }
  });

  it("every item slug is globally unique (two items never share a catalog URL)", () => {
    const bySlug = new Map<string, string[]>();
    for (const [id, item] of Object.entries(items)) {
      const ids = bySlug.get(item.slug) ?? [];
      ids.push(id);
      bySlug.set(item.slug, ids);
    }
    const collisions = [...bySlug.entries()].filter(([, ids]) => ids.length > 1);
    expect(collisions, JSON.stringify(collisions)).toEqual([]);
  });

  it("every recipe slug matches the URL-safe slug format", () => {
    for (const [id, recipe] of Object.entries(recipes)) {
      expect(recipe.slug, `recipe "${id}" has slug "${recipe.slug}"`).toMatch(SLUG_FORMAT);
    }
  });

  it("every recipe slug is unique within its own result-item group", () => {
    const byResult = new Map<string, string[]>();
    for (const [id, recipe] of Object.entries(recipes)) {
      const resultId = recipe.result?.id ?? id;
      const bucket = byResult.get(resultId) ?? [];
      bucket.push(recipe.slug);
      byResult.set(resultId, bucket);
    }

    const collisions: Array<[string, string[]]> = [];
    for (const [resultId, slugs] of byResult) {
      if (new Set(slugs).size !== slugs.length) collisions.push([resultId, slugs]);
    }
    expect(collisions, JSON.stringify(collisions)).toEqual([]);
  });

  it("every recipe slug matches slugify(deriveRecipeSlugSource(...)) for its own id/result", () => {
    for (const [id, recipe] of Object.entries(recipes)) {
      const resultId = recipe.result?.id ?? id;
      const expected = slugify(deriveRecipeSlugSource(id, resultId));
      expect(recipe.slug, `recipe "${id}"`).toBe(expected);
    }
  });
});

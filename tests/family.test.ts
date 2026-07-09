import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { CATEGORIES } from "../scripts/lib/category.ts";
import { buildItemTagIndex, deriveFamily, FAMILY_CATEGORY } from "../scripts/lib/family.ts";
import type {
  CategoriesOutput,
  FamiliesOutput,
  Meta,
  RecipesOutput,
} from "../scripts/lib/types.ts";

const emptyTagIndex = buildItemTagIndex({});

describe("deriveFamily — proposal fixes", () => {
  it("adds _tiles to the stone-variant id pattern (deepslate_tiles)", () => {
    const result = deriveFamily({ itemId: "deepslate_tiles", category: "building" }, emptyTagIndex);
    expect(result).toEqual({ id: "stone_variants", name: "Stone Variants", usedFallback: false });
  });

  it("still matches the pre-existing _bricks stone-variant pattern", () => {
    const result = deriveFamily(
      { itemId: "deepslate_bricks", category: "building" },
      emptyTagIndex,
    );
    expect(result.id).toBe("stone_variants");
    expect(result.usedFallback).toBe(false);
  });

  it("groups the new Compact Blocks items, including honey_block/slime_block", () => {
    const compactBlocks = [
      "hay_block",
      "bone_block",
      "dried_kelp_block",
      "nether_wart_block",
      "honeycomb_block",
      "bamboo_block",
      "bamboo_mosaic",
      "resin_block",
      "amethyst_block",
      "bricks",
      "clay",
      "potent_sulfur",
      "honey_block",
      "slime_block",
    ];
    for (const itemId of compactBlocks) {
      const result = deriveFamily({ itemId, category: "building" }, emptyTagIndex);
      expect(result, itemId).toEqual({
        id: "compact_blocks",
        name: "Compact Blocks",
        usedFallback: false,
      });
    }
  });

  it("groups the new Natural Blocks items", () => {
    const naturalBlocks = [
      "packed_ice",
      "blue_ice",
      "snow",
      "snow_block",
      "coarse_dirt",
      "packed_mud",
      "muddy_mangrove_roots",
      "magma_block",
    ];
    for (const itemId of naturalBlocks) {
      const result = deriveFamily({ itemId, category: "building" }, emptyTagIndex);
      expect(result, itemId).toEqual({
        id: "natural_blocks",
        name: "Natural Blocks",
        usedFallback: false,
      });
    }
  });

  it("dissolves the former 'Bars & Chains' family: iron_bars and iron_chain land in Decoration", () => {
    for (const itemId of ["iron_bars", "iron_chain"]) {
      const result = deriveFamily({ itemId, category: "building" }, emptyTagIndex);
      expect(result, itemId).toEqual({ id: "decoration", name: "Decoration", usedFallback: false });
    }
  });

  it("keeps copper bars/chain variants on Copper Goods, unaffected by the Bars & Chains dissolve", () => {
    for (const itemId of ["copper_bars", "copper_chain"]) {
      const result = deriveFamily({ itemId, category: "building" }, emptyTagIndex);
      expect(result.id, itemId).toBe("copper_goods");
    }
  });

  it("renames Tools & Utility to Utilities and moves firework_rocket/firework_star there", () => {
    for (const itemId of ["firework_rocket", "firework_star", "map"]) {
      const result = deriveFamily({ itemId, category: "misc" }, emptyTagIndex);
      expect(result.id, itemId).toBe("utilities");
      expect(result.name, itemId).toBe("Utilities");
    }
  });

  it("renames the compasses tag rule's target from Tools & Utility to Utilities", () => {
    const tagIndex = buildItemTagIndex({ compasses: { values: ["minecraft:compass"] } });
    const result = deriveFamily({ itemId: "compass", category: "misc" }, tagIndex);
    expect(result).toEqual({ id: "utilities", name: "Utilities", usedFallback: false });
  });

  it("moves jack_o_lantern into Decoration", () => {
    const result = deriveFamily({ itemId: "jack_o_lantern", category: "building" }, emptyTagIndex);
    expect(result).toEqual({ id: "decoration", name: "Decoration", usedFallback: false });
  });

  it("falls back an unrecognized misc-category item to the dormant 'Other' family", () => {
    const result = deriveFamily(
      { itemId: "some_unrecognized_future_item", category: "misc" },
      emptyTagIndex,
    );
    expect(result).toEqual({ id: "other", name: "Other", usedFallback: true });
  });

  it("retires the 'Building Blocks'/'Miscellaneous' fallback names in favor of 'Other Blocks'/'Other'", () => {
    const building = deriveFamily(
      { itemId: "some_unrecognized_future_block", category: "building" },
      emptyTagIndex,
    );
    expect(building).toEqual({ id: "other_blocks", name: "Other Blocks", usedFallback: true });

    const misc = deriveFamily(
      { itemId: "some_unrecognized_future_item", category: "misc" },
      emptyTagIndex,
    );
    expect(misc).toEqual({ id: "other", name: "Other", usedFallback: true });
  });
});

describe("FAMILY_CATEGORY totality", () => {
  const categoryIds = new Set(CATEGORIES.map((category) => category.id));

  it("has exactly 9 categories", () => {
    expect(CATEGORIES).toHaveLength(9);
  });

  it("maps every family to a real category id", () => {
    for (const [familyId, categoryId] of Object.entries(FAMILY_CATEGORY)) {
      expect(categoryIds.has(categoryId), `${familyId} -> ${categoryId}`).toBe(true);
    }
  });

  it("has no duplicate category ids or orders", () => {
    expect(new Set(CATEGORIES.map((c) => c.id)).size).toBe(CATEGORIES.length);
    expect(new Set(CATEGORIES.map((c) => c.order)).size).toBe(CATEGORIES.length);
  });
});

describe("real generated data — taxonomy totality and the fallbackFamilyItems success criterion", () => {
  const recipes: RecipesOutput = JSON.parse(
    readFileSync(join(import.meta.dirname, "../src/data/generated/recipes.json"), "utf8"),
  );
  const categories: CategoriesOutput = JSON.parse(
    readFileSync(join(import.meta.dirname, "../src/data/generated/categories.json"), "utf8"),
  );
  const families: FamiliesOutput = JSON.parse(
    readFileSync(join(import.meta.dirname, "../src/data/generated/families.json"), "utf8"),
  );
  const meta: Meta = JSON.parse(
    readFileSync(join(import.meta.dirname, "../src/data/generated/meta.json"), "utf8"),
  );

  it("fallbackFamilyItems is empty -- every item matches a real family rule, no generic-fallback leftovers", () => {
    expect(meta.fallbackFamilyItems).toEqual([]);
  });

  it("every family present in the committed data has a category that exists in categories.json", () => {
    const categoryIds = new Set(Object.keys(categories));
    for (const [id, family] of Object.entries(families)) {
      expect(
        categoryIds.has(family.category),
        `family "${id}" -> category "${family.category}"`,
      ).toBe(true);
    }
  });

  it("every recipe's family reference resolves to a real families.json entry", () => {
    const familyIds = new Set(Object.keys(families));
    for (const [id, recipe] of Object.entries(recipes)) {
      expect(familyIds.has(recipe.family), `recipe "${id}" -> family "${recipe.family}"`).toBe(
        true,
      );
    }
  });
});

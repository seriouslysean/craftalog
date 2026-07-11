import { describe, expect, it } from "vitest";
import { buildPagerSequence, pagerNeighbors, type PagerEntry } from "../src/utils/recipe-pager";
import { groupRecipes } from "../src/utils/recipe-groups";
import type { ItemData, RecipeData } from "../src/content.config";

const itemName = (id: string) => id.charAt(0).toUpperCase() + id.slice(1).replace(/_/g, " ");

function recipe(overrides: Partial<RecipeData> & { id: string }): RecipeData {
  return {
    type: "shapeless",
    category: "misc",
    // `family` is a `families` collection reference (see src/content.config.ts) --
    // "materials" matches the real generated families.json entry.
    family: { collection: "families", id: "materials" },
    slug: overrides.id,
    ...overrides,
  } as RecipeData;
}

const item = (overrides: Partial<ItemData> & { id: string }): ItemData =>
  ({
    name: itemName(overrides.id),
    slug: overrides.id.replace(/_/g, "-"),
    icon: { type: "flat", texture: "/textures/placeholder.png" },
    ...overrides,
  }) as ItemData;

const entry = (canonicalId: string, itemSlug: string): PagerEntry => ({
  canonicalId,
  displayName: itemName(canonicalId),
  item: null,
  itemSlug,
});

describe("buildPagerSequence", () => {
  it("builds one entry per item, sorted by display name", () => {
    const recipes = [
      recipe({ id: "stick", result: { id: "stick", count: 4 }, ingredients: [] }),
      recipe({ id: "arrow", result: { id: "arrow", count: 4 }, ingredients: [] }),
      recipe({ id: "melon", result: { id: "melon", count: 1 }, ingredients: [] }),
      // A second recipe for an existing item stays folded into its group --
      // the pager is per item, not per recipe.
      recipe({ id: "stick_from_bamboo", result: { id: "stick", count: 1 }, ingredients: [] }),
    ];
    const itemsMap = new Map(
      ["stick", "arrow", "melon"].map((id) => [id, item({ id })] as const),
    );

    const sequence = buildPagerSequence(groupRecipes(recipes, itemName), itemsMap);

    expect(sequence.map((e) => e.canonicalId)).toEqual(["arrow", "melon", "stick"]);
    expect(sequence.map((e) => e.itemSlug)).toEqual(["arrow", "melon", "stick"]);
    expect(sequence[0].item).toEqual(itemsMap.get("arrow"));
  });
});

describe("pagerNeighbors", () => {
  const sequence = [entry("arrow", "arrow"), entry("melon", "melon"), entry("stick", "stick")];

  it("returns the alphabetical neighbors for a middle entry", () => {
    const neighbors = pagerNeighbors(sequence, "melon");
    expect(neighbors.prevName).toBe("Arrow");
    expect(neighbors.prevHref).toBe("/recipe/arrow/");
    expect(neighbors.nextName).toBe("Stick");
    expect(neighbors.nextHref).toBe("/recipe/stick/");
  });

  it("wraps the first entry's prev to the last entry", () => {
    const neighbors = pagerNeighbors(sequence, "arrow");
    expect(neighbors.prevName).toBe("Stick");
    expect(neighbors.nextName).toBe("Melon");
  });

  it("wraps the last entry's next to the first entry", () => {
    const neighbors = pagerNeighbors(sequence, "stick");
    expect(neighbors.prevName).toBe("Melon");
    expect(neighbors.nextName).toBe("Arrow");
  });

  it("throws a descriptive error for an empty sequence", () => {
    expect(() => pagerNeighbors([], "arrow")).toThrow("pagerNeighbors: pager sequence is empty");
  });

  it("throws a descriptive error for an unknown canonical id", () => {
    expect(() => pagerNeighbors(sequence, "diamond")).toThrow(
      'pagerNeighbors: canonical id "diamond" not found in pager sequence',
    );
  });
});

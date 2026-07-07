import { describe, expect, it } from "vitest";
import {
  buildRecipeHrefMap,
  canonicalRecipePath,
  groupItemSlug,
  groupRecipes,
  indexByRecipeId,
  recipePath,
} from "../src/utils/recipe-groups";
import type { ItemData, RecipeData } from "../src/content.config";

const itemName = (id: string) => id.charAt(0).toUpperCase() + id.slice(1).replace(/_/g, " ");

function recipe(overrides: Partial<RecipeData> & { id: string }): RecipeData {
  return {
    type: "shapeless",
    category: "misc",
    family: "Materials",
    // Placeholder -- real slugs come from the data pipeline (scripts/lib/recipe-slug.ts)
    // and aren't what this file's fixtures are testing; override explicitly where a test cares.
    slug: overrides.id,
    ...overrides,
  } as RecipeData;
}

const item = (overrides: Partial<ItemData> & { id: string }): ItemData =>
  ({
    name: overrides.id,
    slug: overrides.id.replace(/_/g, "-"),
    icon: { type: "flat", texture: "/textures/placeholder.png" },
    ...overrides,
  }) as ItemData;

describe("groupRecipes", () => {
  it("groups two shapeless recipes with distinct 'from X' labels", () => {
    const recipes = [
      recipe({
        id: "bone_meal",
        result: { id: "bone_meal", count: 3 },
        ingredients: [{ items: ["bone"] }],
        slug: "default",
      }),
      recipe({
        id: "bone_meal_from_bone_block",
        result: { id: "bone_meal", count: 9 },
        ingredients: [{ items: ["bone_block"] }],
        slug: "from-bone-block",
      }),
    ];

    const groups = groupRecipes(recipes, itemName);
    expect(groups).toHaveLength(1);

    const group = groups[0];
    expect(group.resultId).toBe("bone_meal");
    expect(group.count).toBe(2);
    expect(group.canonicalId).toBe("bone_meal");
    expect(group.siblings.map((s) => s.recipeId)).toEqual([
      "bone_meal",
      "bone_meal_from_bone_block",
    ]);
    expect(group.siblings[0]).toMatchObject({
      label: "from Bone",
      iconItemId: "bone",
      slug: "default",
    });
    expect(group.siblings[1]).toMatchObject({
      label: "from Bone block",
      iconItemId: "bone_block",
      slug: "from-bone-block",
    });
  });

  it("labels every Suspicious-Stew-shaped sibling by its flower, never by the shared bowl", () => {
    const flowers = ["poppy", "dandelion", "wither_rose"];
    const recipes = flowers.map((flower) =>
      recipe({
        id: `suspicious_stew_from_${flower}`,
        result: { id: "suspicious_stew", count: 1 },
        ingredients: [{ items: ["bowl"] }, { items: ["brown_mushroom"] }, { items: [flower] }],
      }),
    );

    const [group] = groupRecipes(recipes, itemName);
    expect(group.siblings).toHaveLength(3);

    for (const sibling of group.siblings) {
      expect(sibling.label).not.toBe("from Bowl");
      expect(sibling.label).not.toContain("Bowl");
      expect(sibling.label).not.toContain("Brown mushroom");
    }

    const labels = group.siblings.map((s) => s.label);
    expect(new Set(labels).size).toBe(labels.length);
    expect(labels).toContain("from Poppy");
    expect(labels).toContain("from Dandelion");
    expect(labels).toContain("from Wither rose");
  });

  it("gives a mixed shaped+special group a note-based label and null iconItemId for the special sibling", () => {
    const recipes = [
      recipe({
        id: "black_banner",
        type: "shaped",
        family: "Banners",
        result: { id: "black_banner", count: 1 },
        pattern: ["###"],
        key: { "#": { items: ["black_wool"] } },
      }),
      recipe({
        id: "black_banner_duplicate",
        type: "special",
        family: "Banners",
        result: { id: "black_banner", count: 1 },
        note: "Combine a banner with a matching blank banner to duplicate its pattern.",
      }),
    ];

    const [group] = groupRecipes(recipes, itemName);
    const special = group.siblings.find((s) => s.recipeId === "black_banner_duplicate");
    const shaped = group.siblings.find((s) => s.recipeId === "black_banner");

    expect(special).toMatchObject({
      label: "Combine a banner with a matching blank …",
      iconItemId: null,
    });
    expect(shaped).toMatchObject({ label: "from Black wool", iconItemId: "black_wool" });
  });

  it("falls back to each sibling's first ingredient when they share nothing", () => {
    const recipes = [
      recipe({
        id: "orange_dye_from_red_yellow",
        result: { id: "orange_dye", count: 2 },
        ingredients: [{ items: ["red_dye"] }, { items: ["yellow_dye"] }],
      }),
      recipe({
        id: "orange_dye_from_torchflower",
        result: { id: "orange_dye", count: 1 },
        ingredients: [{ items: ["torchflower"] }],
      }),
    ];

    const [group] = groupRecipes(recipes, itemName);
    expect(group.siblings[0]).toMatchObject({ label: "from Red dye", iconItemId: "red_dye" });
    expect(group.siblings[1]).toMatchObject({
      label: "from Torchflower",
      iconItemId: "torchflower",
    });
  });

  it("labels a tag-based distinguishing ingredient using humanizeTagLabel", () => {
    const recipes = [
      recipe({
        id: "example_a",
        result: { id: "example", count: 1 },
        ingredients: [{ items: ["stick"] }],
      }),
      recipe({
        id: "example_b",
        result: { id: "example", count: 1 },
        ingredients: [{ items: ["oak_planks", "spruce_planks"], tag: "planks" }],
      }),
    ];

    const [group] = groupRecipes(recipes, itemName);
    const withTag = group.siblings.find((s) => s.recipeId === "example_b");
    expect(withTag).toMatchObject({ label: "from Any Planks", iconItemId: "oak_planks" });
  });

  it("marks a singleton with count 1, a null label, and canonicalId === id", () => {
    const recipes = [
      recipe({
        id: "stick",
        result: { id: "stick", count: 4 },
        ingredients: [{ items: ["oak_planks"] }],
      }),
    ];

    const [group] = groupRecipes(recipes, itemName);
    expect(group.count).toBe(1);
    expect(group.canonicalId).toBe("stick");
    expect(group.siblings[0]).toMatchObject({ label: null, iconItemId: null });
  });

  it("resolves the canonical id to the alphabetically-first recipe id regardless of input order", () => {
    const recipes = [
      recipe({
        id: "bone_meal_from_bone_block",
        result: { id: "bone_meal", count: 9 },
        ingredients: [{ items: ["bone_block"] }],
      }),
      recipe({
        id: "bone_meal",
        result: { id: "bone_meal", count: 3 },
        ingredients: [{ items: ["bone"] }],
      }),
    ];

    const [group] = groupRecipes(recipes, itemName);
    expect(group.canonicalId).toBe("bone_meal");
    expect(group.siblings[0].recipeId).toBe("bone_meal");
  });

  it("resolves a magenta_dye-shaped 5-way collision to unique labels", () => {
    const recipes = [
      recipe({
        id: "magenta_dye_from_allium",
        result: { id: "magenta_dye", count: 2 },
        ingredients: [{ items: ["allium"] }],
      }),
      recipe({
        id: "magenta_dye_from_blue_red_pink",
        result: { id: "magenta_dye", count: 2 },
        ingredients: [{ items: ["blue_dye"] }, { items: ["red_dye"] }, { items: ["pink_dye"] }],
      }),
      recipe({
        id: "magenta_dye_from_blue_red_white_dye",
        result: { id: "magenta_dye", count: 3 },
        ingredients: [
          { items: ["blue_dye"] },
          { items: ["red_dye"] },
          { items: ["red_dye"] },
          { items: ["white_dye"] },
        ],
      }),
      recipe({
        id: "magenta_dye_from_lilac",
        result: { id: "magenta_dye", count: 2 },
        ingredients: [{ items: ["lilac"] }],
      }),
      recipe({
        id: "magenta_dye_from_purple_and_pink",
        result: { id: "magenta_dye", count: 2 },
        ingredients: [{ items: ["purple_dye"] }, { items: ["pink_dye"] }],
      }),
    ];

    const [group] = groupRecipes(recipes, itemName);
    const labels = group.siblings.map((s) => s.label);
    expect(labels.every((label) => label !== null)).toBe(true);
    expect(new Set(labels).size).toBe(labels.length);
  });

  it("loads the real generated recipe data and finds every multi-recipe group's labels non-null and unique", async () => {
    const recipesModule = await import("../src/data/generated/recipes.json");
    const allRecipes = Object.values(recipesModule.default) as RecipeData[];

    const groups = groupRecipes(allRecipes, itemName);
    const multiRecipeGroups = groups.filter((g) => g.count > 1);
    expect(multiRecipeGroups.length).toBeGreaterThan(0);

    for (const group of multiRecipeGroups) {
      const labels = group.siblings.map((s) => s.label);
      expect(labels.every((label) => label !== null)).toBe(true);
      expect(new Set(labels).size).toBe(labels.length);
    }
  });
});

describe("groupItemSlug", () => {
  it("reads the result item's precomputed slug", () => {
    const recipes = [
      recipe({ id: "bone_meal", result: { id: "bone_meal", count: 3 }, ingredients: [] }),
    ];
    const [group] = groupRecipes(recipes, itemName);
    const itemsMap = new Map([["bone_meal", item({ id: "bone_meal", slug: "bone-meal" })]]);

    expect(groupItemSlug(group, itemsMap)).toBe("bone-meal");
  });

  it("falls back to slugifying the canonical recipe id when there's no result item (repair_item)", () => {
    const recipes = [recipe({ id: "repair_item", type: "special", slug: "default" })];
    const [group] = groupRecipes(recipes, itemName);

    expect(groupItemSlug(group, new Map())).toBe("repair-item");
  });
});

describe("canonicalRecipePath", () => {
  it("builds the bare /recipe/{item}/ path with no slug segment", () => {
    expect(canonicalRecipePath("bone-meal")).toBe("/recipe/bone-meal/");
  });
});

describe("recipePath", () => {
  it("omits the slug segment for the canonical recipe", () => {
    expect(recipePath("bone-meal", "bone_meal", "bone_meal", "default")).toBe("/recipe/bone-meal/");
  });

  it("keeps the slug segment for every other sibling", () => {
    expect(
      recipePath("bone-meal", "bone_meal", "bone_meal_from_bone_block", "from-bone-block"),
    ).toBe("/recipe/bone-meal/from-bone-block/");
  });
});

describe("indexByRecipeId", () => {
  it("looks up a group by any sibling's recipe id, not just the canonical one", () => {
    const recipes = [
      recipe({
        id: "bone_meal",
        result: { id: "bone_meal", count: 3 },
        ingredients: [{ items: ["bone"] }],
      }),
      recipe({
        id: "bone_meal_from_bone_block",
        result: { id: "bone_meal", count: 9 },
        ingredients: [{ items: ["bone_block"] }],
      }),
    ];

    const groups = groupRecipes(recipes, itemName);
    const byRecipeId = indexByRecipeId(groups);

    expect(byRecipeId.get("bone_meal")).toBe(groups[0]);
    expect(byRecipeId.get("bone_meal_from_bone_block")).toBe(groups[0]);
  });
});

describe("buildRecipeHrefMap", () => {
  it("maps a group's result id to its canonical recipe path", () => {
    const recipes = [
      recipe({ id: "bone_meal", result: { id: "bone_meal", count: 3 }, ingredients: [] }),
    ];
    const groups = groupRecipes(recipes, itemName);
    const itemsMap = new Map([["bone_meal", item({ id: "bone_meal", slug: "bone-meal" })]]);

    const hrefs = buildRecipeHrefMap(groups, itemsMap);
    expect(hrefs.get("bone_meal")).toBe("/recipe/bone-meal/");
  });

  it("omits items that aren't the result of any recipe", () => {
    const recipes = [
      recipe({ id: "bone_meal", result: { id: "bone_meal", count: 3 }, ingredients: [] }),
    ];
    const groups = groupRecipes(recipes, itemName);
    const itemsMap = new Map([["bone_meal", item({ id: "bone_meal", slug: "bone-meal" })]]);

    const hrefs = buildRecipeHrefMap(groups, itemsMap);
    expect(hrefs.has("bone")).toBe(false);
  });
});

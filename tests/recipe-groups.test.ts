import { describe, expect, it } from "vitest";
import {
  buildRecipeHrefMap,
  canonicalRecipePath,
  collapseVariantGroups,
  groupItemSlug,
  groupRecipes,
  recipePath,
  VARIANT_GROUP_META,
  variantGroupDefault,
  variantGroupDisplayName,
} from "../src/utils/recipe-groups";
import type { ItemData, RecipeData } from "../src/content.config";
import { loadGeneratedRecipes } from "./generated-recipes";

const itemName = (id: string) => id.charAt(0).toUpperCase() + id.slice(1).replace(/_/g, " ");

function recipe(overrides: Partial<RecipeData> & { id: string }): RecipeData {
  return {
    type: "shapeless",
    category: "misc",
    // `family` is a `families` collection reference (see src/content.config.ts),
    // not a plain display-name string -- "materials" matches the real
    // generated families.json entry so familyDisplayName resolves it to
    // "Materials" the same way real recipe data would.
    family: { collection: "families", id: "materials" },
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
        family: { collection: "families", id: "banners" },
        result: { id: "black_banner", count: 1 },
        pattern: ["###"],
        key: { "#": { items: ["black_wool"] } },
      }),
      recipe({
        id: "black_banner_duplicate",
        type: "special",
        family: { collection: "families", id: "banners" },
        result: { id: "black_banner", count: 1 },
        note: "Combine a banner with a matching blank banner to duplicate its pattern.",
        vanillaType: "minecraft:crafting_special_bannerduplicate",
      }),
    ];

    const [group] = groupRecipes(recipes, itemName);
    const special = group.siblings.find((s) => s.recipeId === "black_banner_duplicate");
    const shaped = group.siblings.find((s) => s.recipeId === "black_banner");

    expect(special).toMatchObject({
      label: "Combine a banner with a matching blank …",
      iconItemId: null,
      // `vanillaType` survives onto the sibling -- consumed by
      // src/utils/self-referential-specials.ts (via RecipePage.astro) to
      // demote this sibling below the primary variant tabs.
      vanillaType: "minecraft:crafting_special_bannerduplicate",
    });
    expect(shaped).toMatchObject({
      label: "from Black wool",
      iconItemId: "black_wool",
      vanillaType: undefined,
    });
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
    const allRecipes = loadGeneratedRecipes();

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

describe("collapseVariantGroups: copper oxidation-tier grouping", () => {
  // Vanilla's own `group` field doesn't reliably tie a copper shape's tiers
  // together (only some shapes group their 4 waxed tiers; the un-waxed base
  // and un-waxed oxidized tiers are often left with no group at all) --
  // groupRecipes derives an id-based collapse key from stripping copper's
  // oxidation/waxing prefixes as a fallback/supplement, tested here directly
  // against synthetic fixtures rather than only via the real generated data.
  const copperShapeRecipes = (shape: string, tiers: string[]): RecipeData[] =>
    tiers.map((tier) =>
      recipe({
        id: `${tier}${shape}`,
        result: { id: `${tier}${shape}`, count: 1 },
        ingredients: [{ items: ["copper_ingot"] }],
      }),
    );

  it("unifies a shape's un-waxed base + oxidized tiers + waxed tiers into one VariantGroup", () => {
    const recipes = copperShapeRecipes("cut_copper", [
      "",
      "exposed_",
      "weathered_",
      "oxidized_",
      "waxed_",
      "waxed_exposed_",
      "waxed_weathered_",
      "waxed_oxidized_",
    ]);
    const groups = groupRecipes(recipes, itemName);
    const { variantGroups, singletons } = collapseVariantGroups(groups);

    expect(singletons).toHaveLength(0);
    expect(variantGroups).toHaveLength(1);
    expect(variantGroups[0].groupKey).toBe("cut_copper");
    expect(variantGroups[0].variants.map((v) => v.resultId).toSorted()).toEqual(
      [
        "cut_copper",
        "exposed_cut_copper",
        "oxidized_cut_copper",
        "waxed_cut_copper",
        "waxed_exposed_cut_copper",
        "waxed_oxidized_cut_copper",
        "waxed_weathered_cut_copper",
        "weathered_cut_copper",
      ].toSorted(),
    );
  });

  it("unifies just the waxed tiers (no base recipe) under the bare shape id, e.g. copper_golem_statue", () => {
    const recipes = copperShapeRecipes("copper_golem_statue", [
      "waxed_",
      "waxed_exposed_",
      "waxed_weathered_",
      "waxed_oxidized_",
    ]);
    const groups = groupRecipes(recipes, itemName);
    const { variantGroups } = collapseVariantGroups(groups);

    expect(variantGroups).toHaveLength(1);
    expect(variantGroups[0].groupKey).toBe("copper_golem_statue");
  });

  it("aliases the bare block's tier ids (waxed_exposed_copper, ...) to copper_block, not the stripped bare 'copper'", () => {
    // Vanilla's own bare-block ids are irregular: the base item is
    // "copper_block", but its tier ids are "waxed_exposed_copper" etc --
    // stripping those gives bare "copper", which stripOxidationPrefixes
    // aliases to "copper_block" so this shape collapses under the same key
    // as its own base item's id.
    const tierIds = [
      "waxed_copper",
      "waxed_exposed_copper",
      "waxed_weathered_copper",
      "waxed_oxidized_copper",
    ];
    const recipes = [
      recipe({
        id: "copper_block",
        result: { id: "copper_block", count: 1 },
        ingredients: [{ items: ["copper_ingot"] }],
      }),
      ...tierIds.map((id) =>
        recipe({ id, result: { id, count: 1 }, ingredients: [{ items: ["honeycomb"] }] }),
      ),
    ];
    const groups = groupRecipes(recipes, itemName);
    const { variantGroups } = collapseVariantGroups(groups);

    expect(variantGroups).toHaveLength(1);
    expect(variantGroups[0].groupKey).toBe("copper_block");
    expect(variantGroups[0].variants.map((v) => v.resultId).toSorted()).toEqual(
      ["copper_block", ...tierIds].toSorted(),
    );
  });

  it("does not collapse a shape with only one recipe present (no siblings to unify)", () => {
    const recipes = copperShapeRecipes("copper_torch", [""]);
    const groups = groupRecipes(recipes, itemName);
    const { variantGroups, singletons } = collapseVariantGroups(groups);

    expect(variantGroups).toHaveLength(0);
    expect(singletons).toHaveLength(1);
    expect(singletons[0].variantKey).toBeUndefined();
  });

  it("never collapses dyed_armor (6 different shapes sharing a re-dye mechanism, not color variants of one shape)", () => {
    // Mirrors the real data: each armor piece's OWN craft recipe has no
    // group; only its "_dyed" sibling (a non-canonical, alphabetically-later
    // recipe id) carries group: "dyed_armor" -- so the canonical recipe's
    // group (what variantKey derives from) is undefined for every piece.
    const recipes = [
      recipe({
        id: "leather_boots",
        result: { id: "leather_boots", count: 1 },
        ingredients: [{ items: ["leather"] }],
      }),
      recipe({
        id: "leather_boots_dyed",
        type: "special",
        group: "dyed_armor",
        result: { id: "leather_boots", count: 1 },
        note: "Dye leather armor.",
      }),
      recipe({
        id: "wolf_armor",
        group: "dyed_armor",
        result: { id: "wolf_armor", count: 1 },
        ingredients: [{ items: ["armadillo_scute"] }],
      }),
    ];
    const groups = groupRecipes(recipes, itemName);
    const { variantGroups, singletons } = collapseVariantGroups(groups);

    expect(variantGroups.find((vg) => vg.groupKey === "dyed_armor")).toBeUndefined();
    // leather_boots' canonical recipe has no group at all (undefined);
    // wolf_armor's sole/canonical recipe DOES carry group: "dyed_armor"
    // directly, so it's a legitimate 1-member "dyed_armor" bucket --
    // demoted to a singleton same as any other lone stripped/grouped id.
    expect(singletons.map((s) => s.resultId).toSorted()).toEqual(["leather_boots", "wolf_armor"]);
  });

  it("loads the real generated recipe data and confirms copper shapes collapse without regressing dyed_armor", async () => {
    const allRecipes = loadGeneratedRecipes();

    const groups = groupRecipes(allRecipes, itemName);
    const { variantGroups } = collapseVariantGroups(groups);

    // cut_copper (the block itself, not a slab/stairs) plus copper_bulb/
    // copper_grate carry no shapeTag (no vendored tag unifies them across
    // materials -- see scripts/lib/shape-tag.ts), so they stay on the
    // oxidation-only derivation: an 8-member group of just their own tiers.
    for (const shape of ["cut_copper", "copper_bulb", "copper_grate"]) {
      const vg = variantGroups.find((v) => v.groupKey === shape);
      expect(vg, `expected a VariantGroup for "${shape}"`).toBeDefined();
      expect(vg!.variants.length).toBe(8);
    }

    // cut_copper_slab/cut_copper_stairs are DIFFERENT: they're both
    // oxidation-collapsible (own tiers) AND in #minecraft:slabs/#stairs
    // (shapeTag) -- shapeTag wins (see RecipeGroup.variantKey's precedence
    // doc comment), so they're no longer their own standalone 8-member
    // groups; they're folded into the shape-wide "slabs"/"stairs" groups
    // alongside every other material.
    expect(variantGroups.find((vg) => vg.groupKey === "cut_copper_slab")).toBeUndefined();
    expect(variantGroups.find((vg) => vg.groupKey === "cut_copper_stairs")).toBeUndefined();
    const slabsGroup = variantGroups.find((vg) => vg.groupKey === "slabs");
    const stairsGroup = variantGroups.find((vg) => vg.groupKey === "stairs");
    expect(slabsGroup?.variants.map((v) => v.resultId)).toContain("cut_copper_slab");
    expect(slabsGroup?.variants.map((v) => v.resultId)).toContain("oak_slab");
    expect(stairsGroup?.variants.map((v) => v.resultId)).toContain("cut_copper_stairs");
    expect(stairsGroup?.variants.map((v) => v.resultId)).toContain("oak_stairs");

    expect(variantGroups.find((vg) => vg.groupKey === "dyed_armor")).toBeUndefined();
    for (const resultId of [
      "leather_boots",
      "leather_chestplate",
      "leather_helmet",
      "wolf_armor",
    ]) {
      const group = groups.find((g) => g.resultId === resultId);
      expect(group?.variantKey, `${resultId} must never get a variantKey`).toBeUndefined();
    }
  });
});

describe("groupRecipes: shapeTag precedence over oxidation-strip and vanilla group", () => {
  // cut_copper_slab is the real case this precedence resolves: it's both
  // oxidation-collapsible (its own 8 waxing/exposure tiers) AND a member of
  // #minecraft:slabs (shapeTag, persisted by scripts/lib/shape-tag.ts) --
  // shapeTag must win, so it joins the single shape-wide "Slabs" card
  // (oak_slab, stone_slab, ...) rather than a standalone "Cut Copper Slab"
  // card of just its own tiers. Reproduced here against a minimal synthetic
  // fixture (not just the real-data integration test above) so the
  // precedence rule itself is pinned independent of what the current mcmeta
  // pin happens to contain.
  it("prefers shapeTag over an oxidation-eligible id, folding a copper shape into the shape-wide group", () => {
    const recipes: RecipeData[] = [
      recipe({
        id: "oak_slab",
        group: "wooden_slab",
        shapeTag: "slabs",
        result: { id: "oak_slab", count: 6 },
        ingredients: [{ items: ["oak_planks"] }],
      }),
      recipe({
        id: "stone_slab",
        shapeTag: "slabs",
        result: { id: "stone_slab", count: 6 },
        ingredients: [{ items: ["stone"] }],
      }),
      // Both oxidation-eligible (siblings below share its stripped id) AND
      // tagged into the same shape as oak_slab/stone_slab above.
      recipe({
        id: "cut_copper_slab",
        shapeTag: "slabs",
        result: { id: "cut_copper_slab", count: 6 },
        ingredients: [{ items: ["cut_copper"] }],
      }),
      recipe({
        id: "exposed_cut_copper_slab",
        shapeTag: "slabs",
        result: { id: "exposed_cut_copper_slab", count: 6 },
        ingredients: [{ items: ["exposed_cut_copper"] }],
      }),
      recipe({
        id: "waxed_cut_copper_slab",
        shapeTag: "slabs",
        result: { id: "waxed_cut_copper_slab", count: 1 },
        ingredients: [{ items: ["honeycomb"] }, { items: ["cut_copper_slab"] }],
      }),
    ];

    const groups = groupRecipes(recipes, itemName);
    const { variantGroups, singletons } = collapseVariantGroups(groups);

    // Not stranded on its own oxidation-only key ("cut_copper_slab") --
    // that key never appears as a real groupKey once shapeTag applies.
    expect(variantGroups.find((vg) => vg.groupKey === "cut_copper_slab")).toBeUndefined();
    expect(singletons.find((g) => g.resultId === "cut_copper_slab")).toBeUndefined();

    const slabsGroup = variantGroups.find((vg) => vg.groupKey === "slabs");
    expect(slabsGroup, 'expected one "slabs" VariantGroup').toBeDefined();
    expect(slabsGroup!.variants.map((v) => v.resultId).toSorted()).toEqual(
      [
        "oak_slab",
        "stone_slab",
        "cut_copper_slab",
        "exposed_cut_copper_slab",
        "waxed_cut_copper_slab",
      ].toSorted(),
    );
  });
});

describe("variantGroupDisplayName / variantGroupDefault", () => {
  it("uses the curated name/default when a VARIANT_GROUP_META entry exists", () => {
    const recipes = [
      recipe({ id: "acacia_boat", group: "boat", result: { id: "acacia_boat", count: 1 } }),
      recipe({ id: "oak_boat", group: "boat", result: { id: "oak_boat", count: 1 } }),
    ];
    const groups = groupRecipes(recipes, itemName);
    const [variantGroup] = collapseVariantGroups(groups).variantGroups;
    const itemsMap = new Map([
      ["acacia_boat", item({ id: "acacia_boat" })],
      ["oak_boat", item({ id: "oak_boat" })],
    ]);

    expect(variantGroupDisplayName(variantGroup, itemsMap)).toBe("Boat");
    expect(variantGroupDefault(variantGroup).resultId).toBe("oak_boat");
  });

  it("falls back to the alphabetically-first variant's own name when no meta entry exists", () => {
    const recipes = [
      recipe({ id: "made_up_a", group: "made_up_group", result: { id: "made_up_a", count: 1 } }),
      recipe({ id: "made_up_b", group: "made_up_group", result: { id: "made_up_b", count: 1 } }),
    ];
    const groups = groupRecipes(recipes, itemName);
    const [variantGroup] = collapseVariantGroups(groups).variantGroups;
    const itemsMap = new Map([
      ["made_up_a", item({ id: "made_up_a", name: "Made Up A" })],
      ["made_up_b", item({ id: "made_up_b", name: "Made Up B" })],
    ]);

    expect(variantGroupDisplayName(variantGroup, itemsMap)).toBe("Made Up A");
    expect(variantGroupDefault(variantGroup).resultId).toBe("made_up_a");
  });

  it("falls back to variants[0] if a meta entry's defaultResultId doesn't match any real member", () => {
    // Defensive case -- shouldn't happen for a real groupKey, but a stale/
    // mistyped defaultResultId must not throw or silently return undefined.
    const recipes = [
      recipe({ id: "acacia_boat", group: "boat", result: { id: "acacia_boat", count: 1 } }),
      recipe({ id: "birch_boat", group: "boat", result: { id: "birch_boat", count: 1 } }),
    ];
    const groups = groupRecipes(recipes, itemName);
    const [variantGroup] = collapseVariantGroups(groups).variantGroups;

    // "boat"'s real meta points at "oak_boat", which isn't a member of this
    // fixture's 2-variant group -- must fall back to variants[0], not throw.
    expect(variantGroupDefault(variantGroup).resultId).toBe("acacia_boat");
  });

  it("loads the real generated recipe data and confirms VARIANT_GROUP_META covers every groupKey", async () => {
    const allRecipes = loadGeneratedRecipes();

    const groups = groupRecipes(allRecipes, itemName);
    const { variantGroups } = collapseVariantGroups(groups);
    const missing = variantGroups
      .map((vg) => vg.groupKey)
      .filter((groupKey) => !(groupKey in VARIANT_GROUP_META));

    expect(
      missing,
      `every real groupKey needs a VARIANT_GROUP_META entry, missing: ${missing}`,
    ).toEqual([]);

    // Every curated defaultResultId must resolve to a real member of its
    // own group -- catches a typo'd id before it silently falls back.
    for (const variantGroup of variantGroups) {
      const defaultResultId = VARIANT_GROUP_META[variantGroup.groupKey]?.defaultResultId;
      if (!defaultResultId) continue;
      expect(
        variantGroup.variants.some((v) => v.resultId === defaultResultId),
        `VARIANT_GROUP_META["${variantGroup.groupKey}"].defaultResultId "${defaultResultId}" is not a real member`,
      ).toBe(true);
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

  it("falls back to slugifying the canonical recipe id when there's no result item", () => {
    const recipes = [recipe({ id: "some_resultless_recipe", type: "special", slug: "default" })];
    const [group] = groupRecipes(recipes, itemName);

    expect(groupItemSlug(group, new Map())).toBe("some-resultless-recipe");
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

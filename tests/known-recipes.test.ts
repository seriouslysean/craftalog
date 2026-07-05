import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import type { GeneratedRecipe } from "../scripts/lib/types";

/**
 * Golden tests: well-known vanilla recipes asserted from game knowledge,
 * independent of the mcmeta data the parser reads. These catch systematic
 * misreadings of vanilla semantics (e.g. transposed patterns) that unit
 * tests written against the parser's own understanding cannot.
 *
 * Runs against the committed generated data, so no submodules are needed.
 */
const recipes: Record<string, GeneratedRecipe> = JSON.parse(
  readFileSync(join(import.meta.dirname, "../src/data/generated/recipes.json"), "utf8"),
);

describe("known vanilla recipes survive conversion intact", () => {
  it("torch: coal or charcoal over a stick yields 4", () => {
    const torch = recipes.torch;
    expect(torch.type).toBe("shaped");
    expect(torch.pattern).toEqual(["X", "#"]);
    expect(torch.key?.X.items).toEqual(expect.arrayContaining(["coal", "charcoal"]));
    expect(torch.key?.["#"].items).toEqual(["stick"]);
    expect(torch.result?.count).toBe(4);
  });

  it("crafting table: 2x2 of any planks", () => {
    const table = recipes.crafting_table;
    expect(table.pattern).toEqual(["##", "##"]);
    expect(table.key?.["#"].tag).toBe("planks");
  });

  it("chest: ring of 8 planks", () => {
    const chest = recipes.chest;
    expect(chest.pattern).toEqual(["###", "# #", "###"]);
    expect(chest.key?.["#"].tag).toBe("planks");
  });

  it("furnace: ring of 8 stone crafting materials", () => {
    const furnace = recipes.furnace;
    expect(furnace.pattern).toEqual(["###", "# #", "###"]);
    expect(furnace.key?.["#"].tag).toBe("stone_crafting_materials");
  });

  it("tnt: gunpowder and sand alternating, sand tag includes red sand", () => {
    const tnt = recipes.tnt;
    expect(tnt.pattern).toEqual(["X#X", "#X#", "X#X"]);
    expect(tnt.key?.X.items).toEqual(["gunpowder"]);
    expect(tnt.key?.["#"].items).toEqual(expect.arrayContaining(["sand", "red_sand"]));
  });

  it("bookshelf: planks sandwiching a row of books", () => {
    const bookshelf = recipes.bookshelf;
    expect(bookshelf.pattern).toEqual(["###", "XXX", "###"]);
    expect(bookshelf.key?.X.items).toEqual(["book"]);
  });

  it("ladder: H-shape of sticks yields 3", () => {
    const ladder = recipes.ladder;
    expect(ladder.pattern).toEqual(["# #", "###", "# #"]);
    expect(ladder.result?.count).toBe(3);
  });

  it("mushroom stew: shapeless with both mushrooms and a bowl", () => {
    const stew = recipes.mushroom_stew;
    expect(stew.type).toBe("shapeless");
    const flat = stew.ingredients?.flatMap((ingredient) => ingredient.items);
    expect(flat).toEqual(expect.arrayContaining(["brown_mushroom", "red_mushroom", "bowl"]));
  });

  it("oak planks: shapeless from any oak log variant, yields 4", () => {
    const planks = recipes.oak_planks;
    expect(planks.type).toBe("shapeless");
    expect(planks.ingredients?.[0].tag).toBe("oak_logs");
    expect(planks.ingredients?.[0].items.length).toBeGreaterThanOrEqual(4);
    expect(planks.result?.count).toBe(4);
  });

  it("recipe totals account for every crafting-table recipe in the pin", () => {
    const byType = Object.values(recipes).reduce<Record<string, number>>((acc, recipe) => {
      acc[recipe.type] = (acc[recipe.type] ?? 0) + 1;
      return acc;
    }, {});
    // Update alongside a version bump; the validator enforces the true
    // source-of-truth match, this guards against accidental data edits.
    expect(byType.shaped).toBeGreaterThan(500);
    expect(byType.shapeless).toBeGreaterThan(200);
    expect(byType.transmute).toBeGreaterThan(0);
    expect(byType.special).toBeGreaterThan(0);
  });
});

describe("wood-variant semantics survive conversion intact", () => {
  const byGroup = Object.values(recipes).reduce<Record<string, GeneratedRecipe[]>>(
    (acc, recipe) => {
      if (recipe.group) (acc[recipe.group] ??= []).push(recipe);
      return acc;
    },
    {},
  );

  it("stick: ONE recipe where any plank type works (tag ingredient), not one per wood", () => {
    const stick = recipes.stick;
    expect(stick.pattern).toEqual(["#", "#"]);
    expect(stick.key?.["#"].tag).toBe("planks");
    expect(stick.key?.["#"].items.length).toBeGreaterThanOrEqual(11);
  });

  it("boats: one recipe PER wood, each locked to its own planks", () => {
    for (const boat of byGroup.boat) {
      const ingredient = boat.key?.["#"];
      expect(ingredient?.items).toHaveLength(1);
      expect(ingredient?.tag).toBeUndefined();
    }
    expect(recipes.oak_boat.key?.["#"].items).toEqual(["oak_planks"]);
    expect(recipes.spruce_boat.key?.["#"].items).toEqual(["spruce_planks"]);
  });

  it("boats: no crimson or warped boats, matching vanilla (no boats on lava)", () => {
    const boatIds = byGroup.boat.map((recipe) => recipe.id);
    expect(boatIds).not.toContain("crimson_boat");
    expect(boatIds).not.toContain("warped_boat");
    expect(boatIds).toContain("bamboo_raft");
  });

  it("per-wood families are complete for every plank type", () => {
    const woods = recipes.crafting_table.key?.["#"].items.map((plank) =>
      plank.replace(/_planks$/, ""),
    );
    for (const [group, suffix] of [
      ["wooden_door", "_door"],
      ["wooden_slab", "_slab"],
      ["wooden_stairs", "_stairs"],
      ["wooden_fence", "_fence"],
    ] as const) {
      const made = new Set(byGroup[group].map((recipe) => recipe.id));
      for (const wood of woods ?? []) {
        expect(made, `${group} missing ${wood}${suffix}`).toContain(`${wood}${suffix}`);
      }
    }
  });

  it("shaped placement is preserved verbatim: doors are a 2x3 column, mirrorable at match time", () => {
    expect(recipes.oak_door.pattern).toEqual(["##", "##", "##"]);
    expect(recipes.oak_door.result?.count).toBe(3);
  });
});

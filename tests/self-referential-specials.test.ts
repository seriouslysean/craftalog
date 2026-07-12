import { describe, expect, it } from "vitest";
import { groupRecipes } from "../src/utils/recipe-groups";
import type { RecipeData } from "../src/content.config";
import { loadGeneratedRecipes } from "./generated-recipes";

// Self-referential specials (banner duplicate, shield decoration, leather
// re-dye, ...) are flagged by the data pipeline as `selfReferential: true`
// on the recipe itself (see `selfReferential` in src/data/generated-schema.ts
// for the deterministic upstream signal) -- groupRecipes carries the flag
// onto each SiblingRecipe, and RecipePage.astro demotes flagged siblings
// below the primary variant tabs. No hardcoded vanilla-type-id allowlist
// exists anymore: these tests pin the flag's propagation and its fail-open
// default, plus what the real generated data actually flags.

const itemName = (id: string) => id.charAt(0).toUpperCase() + id.slice(1).replace(/_/g, " ");

function recipe(overrides: Partial<RecipeData> & { id: string }): RecipeData {
  return {
    type: "shapeless",
    category: "misc",
    family: { collection: "families", id: "materials" },
    slug: overrides.id,
    ...overrides,
  } as RecipeData;
}

describe("SiblingRecipe.selfReferential", () => {
  it("carries a flagged special recipe's selfReferential onto its sibling", () => {
    const recipes = [
      recipe({
        id: "black_banner",
        type: "shaped",
        result: { id: "black_banner", count: 1 },
        pattern: ["###"],
        key: { "#": { items: ["black_wool"] } },
      }),
      recipe({
        id: "black_banner_duplicate",
        type: "special",
        result: { id: "black_banner", count: 1 },
        note: "Combine a banner with a matching blank banner to duplicate its pattern.",
        selfReferential: true,
      }),
    ];

    const [group] = groupRecipes(recipes, itemName);
    const special = group.siblings.find((s) => s.recipeId === "black_banner_duplicate");
    const shaped = group.siblings.find((s) => s.recipeId === "black_banner");

    expect(special?.selfReferential).toBe(true);
    expect(shaped?.selfReferential).toBe(false);
  });

  it("fails open (false) when the flag is absent -- an unflagged special, e.g. one a future version bump introduces", () => {
    const recipes = [
      recipe({
        id: "firework_rocket",
        type: "special",
        result: { id: "firework_rocket", count: 3 },
        note: "Combine paper and gunpowder.",
      }),
    ];

    const [group] = groupRecipes(recipes, itemName);
    expect(group.siblings[0].selfReferential).toBe(false);
  });

  it("loads the real generated recipe data and finds the flag only on special recipes, propagated 1:1 onto siblings", () => {
    const allRecipes = loadGeneratedRecipes();
    const flaggedRecipes = allRecipes.filter((r) => r.selfReferential);

    // The pipeline flags a meaningful set (banner duplicates, book cloning,
    // firework star fade, map extending, shield decoration, leather
    // re-dye), and only ever on `type: "special"` -- shaped/shapeless/
    // transmute recipes always craft a new item.
    expect(flaggedRecipes.length).toBeGreaterThan(0);
    for (const flagged of flaggedRecipes) {
      expect(flagged.type, `${flagged.id} is flagged but not a special`).toBe("special");
    }

    const groups = groupRecipes(allRecipes, itemName);
    const flaggedSiblings = groups
      .flatMap((group) => group.siblings)
      .filter((sibling) => sibling.selfReferential);

    expect(flaggedSiblings.map((s) => s.recipeId).toSorted()).toEqual(
      flaggedRecipes.map((r) => r.id).toSorted(),
    );
  });
});

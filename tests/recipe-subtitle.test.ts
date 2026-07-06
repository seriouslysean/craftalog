import { describe, expect, it } from "vitest";
import { recipeSubtitle } from "../src/utils/recipe-subtitle";

const itemName = (id: string) => id.charAt(0).toUpperCase() + id.slice(1).replace(/_/g, " ");

describe("recipeSubtitle", () => {
  it("labels a shaped recipe with its first key ingredient", () => {
    const recipe = {
      id: "black_bed",
      type: "shaped" as const,
      category: "misc",
      pattern: ["###", "XXX"],
      key: {
        "#": { items: ["black_wool"] },
        X: { items: ["oak_planks", "spruce_planks"], tag: "planks" },
      },
    };
    expect(recipeSubtitle(recipe, itemName)).toBe("from Black wool");
  });

  it("labels a shapeless recipe with its first ingredient", () => {
    const recipe = {
      id: "black_dye_from_wither_rose",
      type: "shapeless" as const,
      category: "misc",
      ingredients: [{ items: ["wither_rose"] }],
    };
    expect(recipeSubtitle(recipe, itemName)).toBe("from Wither rose");
  });

  it("humanizes a tag-based first ingredient", () => {
    const recipe = {
      id: "example",
      type: "shapeless" as const,
      category: "misc",
      ingredients: [{ items: ["oak_planks", "spruce_planks"], tag: "planks" }],
    };
    expect(recipeSubtitle(recipe, itemName)).toBe("from Any Planks");
  });

  it("falls back to a truncated note for special recipes", () => {
    const recipe = {
      id: "black_banner_duplicate",
      type: "special" as const,
      category: "misc",
      note: "Combine a banner with a matching blank banner to duplicate its pattern.",
    };
    expect(recipeSubtitle(recipe, itemName)).toBe("Combine a banner with a matching blank …");
  });

  it("returns null when there's nothing to derive a label from", () => {
    const recipe = { id: "example", type: "shaped" as const, category: "misc" };
    expect(recipeSubtitle(recipe, itemName)).toBeNull();
  });
});

import { describe, expect, it } from "vitest";
import { normalizeIngredient } from "../scripts/lib/ingredients.ts";
import type { RawTagsData } from "../scripts/lib/types.ts";

describe("normalizeIngredient", () => {
  it("normalizes a single item id string", () => {
    expect(normalizeIngredient("minecraft:stick", {})).toEqual({ items: ["stick"] });
  });

  it("normalizes an array of interchangeable item ids", () => {
    expect(normalizeIngredient(["minecraft:coal", "minecraft:charcoal"], {})).toEqual({
      items: ["coal", "charcoal"],
    });
  });

  it("resolves a tag reference and keeps the tag name for labeling", () => {
    const tags: RawTagsData = {
      oak_logs: {
        values: [
          "minecraft:oak_log",
          "minecraft:oak_wood",
          "minecraft:stripped_oak_log",
          "minecraft:stripped_oak_wood",
        ],
      },
    };

    expect(normalizeIngredient("#minecraft:oak_logs", tags)).toEqual({
      items: ["oak_log", "oak_wood", "stripped_oak_log", "stripped_oak_wood"],
      tag: "oak_logs",
    });
  });

  it("de-duplicates an array ingredient's item ids", () => {
    expect(normalizeIngredient(["minecraft:stick", "minecraft:stick"], {})).toEqual({
      items: ["stick"],
    });
  });
});

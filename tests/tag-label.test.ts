import { describe, expect, it } from "vitest";
import { humanizeTagLabel, ingredientOption } from "../src/utils/tag-label";

const itemName = (id: string) => id.charAt(0).toUpperCase() + id.slice(1).replace(/_/g, " ");

describe("humanizeTagLabel", () => {
  it("humanizes a single-word tag", () => {
    expect(humanizeTagLabel("planks")).toBe("Any Planks");
  });

  it("humanizes a multi-word snake_case tag", () => {
    expect(humanizeTagLabel("oak_logs")).toBe("Any Oak Logs");
  });

  it("title-cases every word", () => {
    expect(humanizeTagLabel("wool_carpets")).toBe("Any Wool Carpets");
  });
});

describe("ingredientOption", () => {
  it("returns null for a single-item ingredient (nothing to show)", () => {
    expect(ingredientOption({ items: ["stick"] }, itemName)).toBeNull();
  });

  it("labels a tag-based multi-option ingredient with humanizeTagLabel's 'Any' prefix", () => {
    const ingredient = { items: ["oak_planks", "spruce_planks"], tag: "planks" };
    expect(ingredientOption(ingredient, itemName)).toEqual({
      label: "Any Planks",
      items: ["oak_planks", "spruce_planks"],
    });
  });

  it("labels a non-tag multi-option ingredient with the first item's name", () => {
    const ingredient = { items: ["coal", "charcoal"] };
    expect(ingredientOption(ingredient, itemName)).toEqual({
      label: "Coal",
      items: ["coal", "charcoal"],
    });
  });

  it("keeps every item id for the cycling display, not just the first", () => {
    const ingredient = {
      items: ["white_bed", "orange_bed", "magenta_bed", "light_blue_bed"],
    };
    expect(ingredientOption(ingredient, itemName)).toEqual({
      label: "White bed",
      items: ["white_bed", "orange_bed", "magenta_bed", "light_blue_bed"],
    });
  });
});

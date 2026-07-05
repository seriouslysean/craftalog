import { describe, expect, it } from "vitest";
import { humanizeTagLabel, ingredientLabel } from "../src/utils/tag-label";

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

describe("ingredientLabel", () => {
  it("returns null for a single-item ingredient (nothing to label)", () => {
    expect(ingredientLabel({ items: ["stick"] }, itemName)).toBeNull();
  });

  it("labels a tag-based multi-option ingredient with the humanized tag", () => {
    expect(
      ingredientLabel({ items: ["oak_planks", "spruce_planks"], tag: "planks" }, itemName),
    ).toBe("Any Planks");
  });

  it('labels a non-tag multi-option ingredient with the first item + "or N more"', () => {
    const ingredient = { items: ["coal", "charcoal"] };
    expect(ingredientLabel(ingredient, itemName)).toBe("Coal or 1 more");
  });

  it('counts "or N more" correctly for many variants', () => {
    const ingredient = {
      items: ["white_bed", "orange_bed", "magenta_bed", "light_blue_bed"],
    };
    expect(ingredientLabel(ingredient, itemName)).toBe("White bed or 3 more");
  });
});

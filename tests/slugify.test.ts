import { describe, expect, it } from "vitest";
import { slugify } from "../src/utils/slugify";

describe("slugify", () => {
  it("lowercases and hyphenates a spaced display name", () => {
    expect(slugify("Bone Meal")).toBe("bone-meal");
  });

  it("converts underscores to hyphens", () => {
    expect(slugify("dye_black_wool")).toBe("dye-black-wool");
  });

  it("collapses runs of non-alphanumeric characters into a single hyphen", () => {
    expect(slugify("Light Gray -- Dye!!")).toBe("light-gray-dye");
  });

  it("trims leading and trailing hyphens", () => {
    expect(slugify("_default_")).toBe("default");
  });

  it("leaves an already-clean slug unchanged", () => {
    expect(slugify("bone-block")).toBe("bone-block");
  });
});

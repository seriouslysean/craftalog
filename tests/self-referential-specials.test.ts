import { describe, expect, it } from "vitest";
import { isSelfReferentialSpecial } from "../src/utils/self-referential-specials";

describe("isSelfReferentialSpecial", () => {
  it("classifies every self-referential special type id as true", () => {
    expect(isSelfReferentialSpecial("minecraft:crafting_special_bannerduplicate")).toBe(true);
    expect(isSelfReferentialSpecial("minecraft:crafting_special_bookcloning")).toBe(true);
    expect(isSelfReferentialSpecial("minecraft:crafting_special_firework_star_fade")).toBe(true);
    expect(isSelfReferentialSpecial("minecraft:crafting_special_mapextending")).toBe(true);
    expect(isSelfReferentialSpecial("minecraft:crafting_special_repairitem")).toBe(true);
    expect(isSelfReferentialSpecial("minecraft:crafting_special_shielddecoration")).toBe(true);
    expect(isSelfReferentialSpecial("minecraft:crafting_dye")).toBe(true);
  });

  it("keeps genuine 'craft a new item' specials classified as false", () => {
    // Each of these produces an item that's absent from its own ingredient
    // list -- ground truth verified against vendor/mcmeta-summary/data/recipe
    // (see src/utils/self-referential-specials.ts's doc comment).
    expect(isSelfReferentialSpecial("minecraft:crafting_special_firework_rocket")).toBe(false);
    expect(isSelfReferentialSpecial("minecraft:crafting_special_firework_star")).toBe(false);
    expect(isSelfReferentialSpecial("minecraft:crafting_decorated_pot")).toBe(false);
    expect(isSelfReferentialSpecial("minecraft:crafting_imbue")).toBe(false);
  });

  it("fails open (false) for undefined -- every non-special recipe", () => {
    expect(isSelfReferentialSpecial(undefined)).toBe(false);
  });

  it("fails open (false) for an unrecognized vanilla type id -- e.g. a future version bump", () => {
    expect(isSelfReferentialSpecial("minecraft:crafting_special_some_future_type")).toBe(false);
  });
});

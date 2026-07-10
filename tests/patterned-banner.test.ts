import { describe, expect, it } from "vitest";
import { derivePatternedBanners, PATTERNED_BANNER_GROUP } from "../scripts/lib/patterned-banner.ts";
import type { RawBannerPatternRegistry, RawTagsData } from "../scripts/lib/types.ts";

const bannerPatternsRaw: RawBannerPatternRegistry = {
  base: { asset_id: "minecraft:base", translation_key: "block.minecraft.banner.base" },
  border: { asset_id: "minecraft:border", translation_key: "block.minecraft.banner.border" },
  creeper: { asset_id: "minecraft:creeper", translation_key: "block.minecraft.banner.creeper" },
  flow: { asset_id: "minecraft:flow", translation_key: "block.minecraft.banner.flow" },
  unnamed: { asset_id: "minecraft:unnamed", translation_key: "block.minecraft.banner.unnamed" },
};

const bannerPatternTagsRaw: RawTagsData = {
  no_item_required: { values: ["minecraft:border", "minecraft:unnamed"] },
  "pattern_item/creeper": { values: ["minecraft:creeper"] },
  "pattern_item/flow": { values: [{ id: "minecraft:flow", required: false }] },
};

const enUs = {
  "block.minecraft.banner.border.black": "Black Border",
  "block.minecraft.banner.creeper.black": "Black Creeper Charge",
  "block.minecraft.banner.flow.black": "Black Flow",
  // Deliberately no "block.minecraft.banner.unnamed.black" -- exercises the fallback.
};

const existingTextures = new Set([
  "entity/banner/border",
  "entity/banner/creeper",
  "entity/banner/unnamed",
  // Deliberately no "entity/banner/flow" -- exercises the missing-texture drop.
]);
const textureExists = (ref: string) => existingTextures.has(ref);

describe("derivePatternedBanners", () => {
  it("excludes 'base' -- present in the registry but in neither tag, so not loom-obtainable", () => {
    const entries = derivePatternedBanners(
      bannerPatternsRaw,
      bannerPatternTagsRaw,
      enUs,
      textureExists,
    );
    expect(entries.some((e) => e.patternId === "base")).toBe(false);
  });

  it("includes a no_item_required pattern with the generic (no item) note", () => {
    const entries = derivePatternedBanners(
      bannerPatternsRaw,
      bannerPatternTagsRaw,
      enUs,
      textureExists,
    );
    const border = entries.find((e) => e.patternId === "border");
    expect(border).toEqual({
      itemId: "patterned_banner_border",
      patternId: "border",
      name: "Black Border",
      note: "Apply in a loom: any banner + any dye. Shown as black on a white banner.",
      textureRef: "item/patterned_banner_border",
      patternTextureRef: "entity/banner/border",
    });
  });

  it("includes a pattern_item/*-gated pattern with the item-gated note, resolving values in {id,required} object form", () => {
    const entries = derivePatternedBanners(
      bannerPatternsRaw,
      bannerPatternTagsRaw,
      enUs,
      textureExists,
    );
    const creeper = entries.find((e) => e.patternId === "creeper");
    expect(creeper?.note).toBe(
      "Apply in a loom: any banner + any dye + this pattern's banner pattern item. Shown as black on a white banner.",
    );
  });

  it("drops a loom-obtainable pattern whose entity/banner texture doesn't exist on disk", () => {
    const entries = derivePatternedBanners(
      bannerPatternsRaw,
      bannerPatternTagsRaw,
      enUs,
      textureExists,
    );
    expect(entries.some((e) => e.patternId === "flow")).toBe(false);
  });

  it("falls back to a title-cased 'Black <id>' name when the lang key is missing", () => {
    const entries = derivePatternedBanners(
      bannerPatternsRaw,
      bannerPatternTagsRaw,
      enUs,
      textureExists,
    );
    const unnamed = entries.find((e) => e.patternId === "unnamed");
    expect(unnamed?.name).toBe("Black Unnamed");
  });

  it("returns entries sorted by pattern id", () => {
    const entries = derivePatternedBanners(
      bannerPatternsRaw,
      bannerPatternTagsRaw,
      enUs,
      textureExists,
    );
    const ids = entries.map((e) => e.patternId);
    expect(ids).toEqual([...ids].toSorted());
  });

  it("returns [] for empty registry/tags", () => {
    expect(derivePatternedBanners({}, {}, {}, textureExists)).toEqual([]);
  });

  it("exports the shared group key used to collapse these into one catalog card", () => {
    expect(PATTERNED_BANNER_GROUP).toBe("patterned_banner");
  });
});

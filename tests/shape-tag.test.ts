import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { buildItemTagIndex } from "../scripts/lib/family.ts";
import { deriveShapeTag, deriveShapeTagIds } from "../scripts/lib/shape-tag.ts";
import type { RawTagsData, RecipesOutput } from "../scripts/lib/types.ts";

describe("deriveShapeTagIds", () => {
  it("admits a tag whose wooden_X counterpart resolves to FEWER members (non-wood siblings exist to collapse)", () => {
    const tags: RawTagsData = {
      wooden_slabs: { values: ["minecraft:oak_slab", "minecraft:spruce_slab"] },
      slabs: { values: ["#minecraft:wooden_slabs", "minecraft:stone_slab"] },
    };
    expect(deriveShapeTagIds(tags)).toEqual(["slabs"]);
  });

  it("excludes a tag whose members are wood-only (|X| == |wooden_X|, e.g. fence_gates/signs today)", () => {
    const tags: RawTagsData = {
      wooden_fence_gates: { values: ["minecraft:oak_fence_gate"] },
      fence_gates: { values: ["#minecraft:wooden_fence_gates"] },
    };
    expect(deriveShapeTagIds(tags)).toEqual([]);
  });

  it("excludes a wooden_X tag with no bare X counterpart at all (e.g. wooden_pressure_plates today)", () => {
    const tags: RawTagsData = {
      wooden_pressure_plates: { values: ["minecraft:oak_pressure_plate"] },
    };
    expect(deriveShapeTagIds(tags)).toEqual([]);
  });

  it("admits the curated flat exception (walls -- vanilla has no wooden wall) only when it resolves non-empty", () => {
    expect(
      deriveShapeTagIds({
        walls: { values: ["minecraft:cobblestone_wall", "minecraft:polished_tuff_wall"] },
      }),
    ).toEqual(["walls"]);
    expect(deriveShapeTagIds({})).toEqual([]);
  });

  it("derives exactly the 7 known shape tags from the real vendored tag data (pin 26.2)", () => {
    const tagsRaw = JSON.parse(
      readFileSync(
        join(import.meta.dirname, "../vendor/mcmeta-summary/data/tag/item/data.json"),
        "utf8",
      ),
    ) as RawTagsData;
    expect(deriveShapeTagIds(tagsRaw)).toEqual([
      "buttons",
      "doors",
      "fences",
      "slabs",
      "stairs",
      "trapdoors",
      "walls",
    ]);
  });
});

describe("deriveShapeTag", () => {
  it("returns the shape tag for an item directly listed in it", () => {
    const tags: RawTagsData = {
      slabs: { values: ["minecraft:stone_slab", "minecraft:cut_copper_slab"] },
    };
    const index = buildItemTagIndex(tags);

    expect(deriveShapeTag("stone_slab", index, ["slabs"])).toBe("slabs");
    expect(deriveShapeTag("cut_copper_slab", index, ["slabs"])).toBe("slabs");
  });

  it("resolves through a nested #wooden_X sub-tag, matching vanilla's real slabs/stairs/etc shape", () => {
    const tags: RawTagsData = {
      wooden_slabs: { values: ["minecraft:oak_slab", "minecraft:spruce_slab"] },
      slabs: { values: ["#minecraft:wooden_slabs", "minecraft:stone_slab"] },
    };
    const index = buildItemTagIndex(tags);
    const shapeTagIds = deriveShapeTagIds(tags);

    expect(deriveShapeTag("oak_slab", index, shapeTagIds)).toBe("slabs");
    expect(deriveShapeTag("stone_slab", index, shapeTagIds)).toBe("slabs");
  });

  it("returns undefined for an item not in any derived shape tag", () => {
    const tags: RawTagsData = { slabs: { values: ["minecraft:stone_slab"] } };
    const index = buildItemTagIndex(tags);

    expect(deriveShapeTag("torch", index, ["slabs"])).toBeUndefined();
  });

  it("returns undefined for an item in a real vanilla tag the derivation doesn't admit -- e.g. 'copper', which spans several different shapes, not material variants of one shape", () => {
    const tags: RawTagsData = {
      copper: {
        values: ["minecraft:copper_block", "minecraft:lightning_rod", "minecraft:copper_bulb"],
      },
    };
    const index = buildItemTagIndex(tags);
    const shapeTagIds = deriveShapeTagIds(tags);

    expect(shapeTagIds).toEqual([]);
    expect(deriveShapeTag("copper_block", index, shapeTagIds)).toBeUndefined();
    expect(deriveShapeTag("lightning_rod", index, shapeTagIds)).toBeUndefined();
  });

  it("returns undefined when no tag data was indexed for this item at all", () => {
    const index = buildItemTagIndex({});
    expect(deriveShapeTag("oak_slab", index, ["slabs"])).toBeUndefined();
  });
});

describe("real generated data — shapeTag persistence and coverage", () => {
  const recipes: RecipesOutput = JSON.parse(
    readFileSync(join(import.meta.dirname, "../src/data/generated/recipes.json"), "utf8"),
  );

  it("persists shapeTag onto every current shape family's real result items", () => {
    const byShapeTag = new Map<string, Set<string>>();
    for (const recipe of Object.values(recipes)) {
      if (!recipe.shapeTag || !recipe.result) continue;
      const set = byShapeTag.get(recipe.shapeTag) ?? new Set<string>();
      set.add(recipe.result.id);
      byShapeTag.set(recipe.shapeTag, set);
    }

    // Every derived shape currently has real vanilla members in the pinned
    // mcmeta version -- if any of these ever comes back empty, either the
    // derivation or the vendored tag data has drifted and needs a look.
    for (const shape of ["slabs", "stairs", "walls", "buttons", "doors", "trapdoors", "fences"]) {
      expect(byShapeTag.get(shape)?.size ?? 0, `expected real "${shape}" members`).toBeGreaterThan(
        0,
      );
    }

    // ONLY those 7 -- the sweep must not over-admit same-suffix but
    // not-shape-family tags (banners, beds, candles).
    expect(Array.from(byShapeTag.keys()).toSorted()).toEqual([
      "buttons",
      "doors",
      "fences",
      "slabs",
      "stairs",
      "trapdoors",
      "walls",
    ]);

    // Wood + a non-wood material both land under "slabs" -- the concrete
    // proof that this is a real cross-material collapse, not just a rename
    // of the old wood-only "wooden_slab" group.
    expect(byShapeTag.get("slabs")?.has("oak_slab")).toBe(true);
    expect(byShapeTag.get("slabs")?.has("stone_slab")).toBe(true);
  });

  it("never assigns a shapeTag to a shape the derivation excludes (pressure plates -- no vendored cross-material tag exists)", () => {
    const stonePressurePlates = [
      "stone_pressure_plate",
      "polished_blackstone_pressure_plate",
      "heavy_weighted_pressure_plate",
      "light_weighted_pressure_plate",
    ];
    for (const id of stonePressurePlates) {
      const recipe = Object.values(recipes).find((r) => r.result?.id === id);
      expect(recipe?.shapeTag, `${id} should have no shapeTag`).toBeUndefined();
    }
  });
});

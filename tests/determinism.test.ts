import { describe, expect, it } from "vitest";
import { generate } from "../scripts/lib/generate.ts";
import { sortKeysDeep } from "../scripts/lib/strings.ts";
import type {
  RawItemDefinitionsData,
  RawModelsData,
  RawRecipesData,
  RawTagsData,
} from "../scripts/lib/types.ts";

const recipesRaw: RawRecipesData = {
  torch: {
    type: "minecraft:crafting_shaped",
    key: { "#": "minecraft:stick", X: ["minecraft:coal", "minecraft:charcoal"] },
    pattern: ["X", "#"],
    result: { count: 4, id: "minecraft:torch" },
  },
  oak_planks: {
    type: "minecraft:crafting_shapeless",
    category: "building",
    group: "planks",
    ingredients: ["#minecraft:oak_logs"],
    result: { count: 4, id: "minecraft:oak_planks" },
  },
  black_bundle: {
    type: "minecraft:crafting_transmute",
    category: "equipment",
    group: "bundle_dye",
    input: "#minecraft:bundles",
    material: "minecraft:black_dye",
    result: { id: "minecraft:black_bundle" },
  },
  repair_item: { type: "minecraft:crafting_special_repairitem" },
  furnace_smelt_ignored: { type: "minecraft:smelting", ingredient: "minecraft:iron_ore" },
};

const tagsRaw: RawTagsData = {
  oak_logs: { values: ["minecraft:oak_log", "minecraft:oak_wood"] },
  bundles: { values: ["minecraft:bundle", "minecraft:black_bundle"] },
};

const itemDefsRaw: RawItemDefinitionsData = {
  stick: { model: { type: "minecraft:model", model: "minecraft:item/stick" } },
  coal: { model: { type: "minecraft:model", model: "minecraft:item/coal" } },
  charcoal: { model: { type: "minecraft:model", model: "minecraft:item/charcoal" } },
  torch: { model: { type: "minecraft:model", model: "minecraft:item/torch" } },
  oak_log: { model: { type: "minecraft:model", model: "minecraft:block/oak_log" } },
  oak_wood: { model: { type: "minecraft:model", model: "minecraft:block/oak_log" } },
  oak_planks: { model: { type: "minecraft:model", model: "minecraft:block/oak_planks" } },
  black_dye: { model: { type: "minecraft:model", model: "minecraft:item/black_dye" } },
  black_bundle: {
    model: {
      type: "minecraft:special",
      base: "minecraft:item/bundle",
      model: { type: "minecraft:bundle" },
    },
  },
  bundle: {
    model: {
      type: "minecraft:special",
      base: "minecraft:item/bundle",
      model: { type: "minecraft:bundle" },
    },
  },
};

const modelsRaw: RawModelsData = {
  "item/stick": { parent: "minecraft:item/handheld", textures: { layer0: "minecraft:item/stick" } },
  "item/handheld": { parent: "minecraft:item/generated" },
  "item/generated": { parent: "builtin/generated" },
  "item/coal": { parent: "minecraft:item/generated", textures: { layer0: "minecraft:item/coal" } },
  "item/charcoal": {
    parent: "minecraft:item/generated",
    textures: { layer0: "minecraft:item/charcoal" },
  },
  "item/torch": {
    parent: "minecraft:item/generated",
    textures: { layer0: "minecraft:block/torch" },
  },
  "item/black_dye": {
    parent: "minecraft:item/generated",
    textures: { layer0: "minecraft:item/black_dye" },
  },
  "block/oak_log": {
    parent: "minecraft:block/cube_column",
    textures: { end: "minecraft:block/oak_log_top", side: "minecraft:block/oak_log" },
  },
  "block/cube_column": {},
  "block/oak_planks": {
    parent: "minecraft:block/cube_all",
    textures: { all: "minecraft:block/oak_planks" },
  },
  "block/cube_all": {},
};

const enUs = { "item.minecraft.stick": "Stick", "block.minecraft.oak_log": "Oak Log" };

// Every ref referenced above "exists" except this one, to exercise the unresolved/placeholder path.
const existingRefs = new Set([
  "item/stick",
  "item/coal",
  "item/charcoal",
  "block/torch",
  "block/oak_log_top",
  "block/oak_log",
  "block/oak_planks",
  "item/black_dye",
]);

function run() {
  return generate({
    version: "26.2",
    recipesRaw,
    tagsRaw,
    itemDefsRaw,
    modelsRaw,
    componentsRaw: {},
    enUs,
    textureExists: (ref) => existingRefs.has(ref),
  });
}

describe("generate determinism", () => {
  it("produces byte-identical (sorted) JSON across repeated runs", () => {
    const first = run();
    const second = run();

    expect(JSON.stringify(sortKeysDeep(first.recipes))).toBe(
      JSON.stringify(sortKeysDeep(second.recipes)),
    );
    expect(JSON.stringify(sortKeysDeep(first.items))).toBe(
      JSON.stringify(sortKeysDeep(second.items)),
    );
    expect(JSON.stringify(sortKeysDeep(first.meta))).toBe(
      JSON.stringify(sortKeysDeep(second.meta)),
    );
  });

  it("excludes out-of-scope recipe types and counts included types correctly", () => {
    const result = run();
    expect(Object.keys(result.recipes).toSorted()).toEqual([
      "black_bundle",
      "oak_planks",
      "repair_item",
      "torch",
    ]);
    expect(result.meta.counts).toEqual({
      shaped: 1,
      shapeless: 1,
      transmute: 1,
      special: 1,
      items: Object.keys(result.items).length,
      texturesCopied: result.texturesToCopy.size,
    });
  });

  it("includes only items referenced by included recipes (results + resolved ingredients)", () => {
    const result = run();
    // stick/coal/charcoal/torch (shaped), oak_log/oak_wood/oak_planks (shapeless),
    // bundle/black_bundle/black_dye (transmute). repair_item has no result/ingredients.
    expect(Object.keys(result.items).toSorted()).toEqual([
      "black_bundle",
      "black_dye",
      "bundle",
      "charcoal",
      "coal",
      "oak_log",
      "oak_planks",
      "oak_wood",
      "stick",
      "torch",
    ]);
  });

  it("falls back to the placeholder icon and records unresolved items whose model has no resolvable texture", () => {
    const result = run();
    // bundle/black_bundle use the minecraft:special renderer with no nested minecraft:model node.
    expect(result.meta.unresolvedIcons).toEqual(["black_bundle", "bundle"]);
    expect(result.items.bundle.icon).toEqual({
      type: "flat",
      texture: "/textures/placeholder.png",
    });
  });

  it("resolves a flat icon and a block icon correctly", () => {
    const result = run();
    expect(result.items.torch.icon).toEqual({ type: "flat", texture: "/textures/block/torch.png" });
    expect(result.items.oak_log.icon).toEqual({
      type: "block",
      top: "/textures/block/oak_log_top.png",
      side: "/textures/block/oak_log.png",
    });
    expect(result.items.stick.name).toBe("Stick");
    expect(result.items.oak_log.name).toBe("Oak Log");
  });
});

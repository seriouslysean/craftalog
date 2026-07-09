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
    ingredients: ["#minecraft:oak_logs", "minecraft:white_banner"],
    result: { count: 4, id: "minecraft:oak_planks" },
  },
  oak_slab: {
    type: "minecraft:crafting_shaped",
    category: "building",
    key: { "#": "minecraft:oak_planks" },
    pattern: ["###"],
    result: { count: 6, id: "minecraft:oak_slab" },
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
  oak_slab: { model: { type: "minecraft:model", model: "minecraft:block/oak_slab" } },
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
  white_banner: {
    model: {
      type: "minecraft:special",
      base: "minecraft:item/template_banner",
      model: { type: "minecraft:banner", color: "white" },
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
  "block/oak_slab": {
    parent: "minecraft:block/slab",
    textures: {
      bottom: "minecraft:block/oak_planks",
      top: "minecraft:block/oak_planks",
      side: "minecraft:block/oak_planks",
    },
  },
  "block/slab": {},
};

// Deliberately no model entry for "item/template_banner" — resolveIconCandidate short-circuits
// to a banner candidate before ever reaching the model chain.

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
  "block/white_wool",
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
      "oak_slab",
      "torch",
    ]);
    expect(result.meta.counts).toEqual({
      shaped: 2,
      shapeless: 1,
      transmute: 1,
      special: 0,
      items: Object.keys(result.items).length,
      texturesCopied: result.texturesToCopy.size,
    });
  });

  it("excludes a resultless special recipe (repair_item) entirely, not just from item collection", () => {
    const result = run();
    expect(result.recipes.repair_item).toBeUndefined();
  });

  it("includes only items referenced by included recipes (results + resolved ingredients)", () => {
    const result = run();
    // stick/coal/charcoal/torch (shaped), oak_log/oak_wood/oak_planks/white_banner (shapeless),
    // bundle/black_bundle/black_dye (transmute), oak_slab (shaped, ingredient oak_planks).
    // repair_item is excluded entirely (see the resultless-recipe test above).
    expect(Object.keys(result.items).toSorted()).toEqual([
      "black_bundle",
      "black_dye",
      "bundle",
      "charcoal",
      "coal",
      "oak_log",
      "oak_planks",
      "oak_slab",
      "oak_wood",
      "stick",
      "torch",
      "white_banner",
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

  it("resolves a slab icon correctly", () => {
    const result = run();
    expect(result.items.oak_slab.icon).toEqual({
      type: "slab",
      top: "/textures/block/oak_planks.png",
      side: "/textures/block/oak_planks.png",
    });
  });

  it("resolves a banner icon to a generated per-color texture and queues it for synthesis", () => {
    const result = run();
    expect(result.items.white_banner.icon).toEqual({
      type: "flat",
      texture: "/textures/item/white_banner.png",
    });
    expect(result.bannerIconsToSynthesize).toEqual(new Map([["white", "item/white_banner"]]));
  });
});

describe("generate: compound icon (real multi-element geometry)", () => {
  const compoundRecipesRaw: RawRecipesData = {
    widget: {
      type: "minecraft:crafting_shapeless",
      ingredients: ["minecraft:stick"],
      result: { id: "minecraft:widget" },
    },
    unresolvable_widget: {
      type: "minecraft:crafting_shapeless",
      ingredients: ["minecraft:stick"],
      result: { id: "minecraft:unresolvable_widget" },
    },
  };

  const compoundItemDefsRaw: RawItemDefinitionsData = {
    stick: { model: { type: "minecraft:model", model: "minecraft:item/stick" } },
    widget: { model: { type: "minecraft:model", model: "minecraft:block/widget" } },
    unresolvable_widget: {
      model: { type: "minecraft:model", model: "minecraft:block/unresolvable_widget" },
    },
  };

  const compoundModelsRaw: RawModelsData = {
    "item/stick": {
      parent: "minecraft:item/generated",
      textures: { layer0: "minecraft:item/stick" },
    },
    "item/generated": { parent: "builtin/generated" },
    "block/widget": {
      textures: { particle: "block/widget_body", body: "block/widget_body" },
      elements: [
        {
          from: [2, 0, 2],
          to: [14, 4, 14],
          faces: {
            up: { texture: "#body" },
            east: { texture: "#body" },
            south: { texture: "#body" },
          },
        },
      ],
    },
    // Every face texture here is missing from disk -- generate() should
    // fall back to the flat particle guess rather than leaving this
    // unresolved, since the old "unknown" fallback would have resolved it
    // fine as flat.
    "block/unresolvable_widget": {
      textures: { particle: "block/unresolvable_widget_particle" },
      elements: [
        {
          from: [0, 0, 0],
          to: [16, 16, 16],
          faces: { up: { texture: "#missing_var" } },
        },
      ],
    },
  };

  function runCompound() {
    return generate({
      version: "26.2",
      recipesRaw: compoundRecipesRaw,
      tagsRaw: {},
      itemDefsRaw: compoundItemDefsRaw,
      modelsRaw: compoundModelsRaw,
      componentsRaw: {},
      enUs: {},
      textureExists: (ref) =>
        new Set(["item/stick", "block/widget_body", "block/unresolvable_widget_particle"]).has(ref),
    });
  }

  it("resolves real element geometry to a compound icon with /textures/ prefixed faces and their uv crop rects", () => {
    const result = runCompound();
    expect(result.items.widget.icon).toEqual({
      type: "compound",
      yRotation: 0,
      elements: [
        {
          from: [2, 0, 2],
          to: [14, 4, 14],
          faces: {
            // None of these faces declare an explicit uv -- see
            // scripts/lib/model.ts's defaultFaceUv for the position-based
            // formula that derives [2,2,14,14] / [2,12,14,16] here.
            up: { texture: "/textures/block/widget_body.png", uv: [2, 2, 14, 14] },
            east: { texture: "/textures/block/widget_body.png", uv: [2, 12, 14, 16] },
            south: { texture: "/textures/block/widget_body.png", uv: [2, 12, 14, 16] },
          },
        },
      ],
    });
  });

  it("falls back to the flat particle guess when none of a compound's own element textures exist on disk", () => {
    const result = runCompound();
    expect(result.items.unresolvable_widget.icon).toEqual({
      type: "flat",
      texture: "/textures/block/unresolvable_widget_particle.png",
    });
    expect(result.meta.unresolvedIcons).not.toContain("unresolvable_widget");
  });
});

import { describe, expect, it } from "vitest";
import { findModelReference, resolveIconCandidate, walkModelChain } from "../scripts/lib/model.ts";
import type { RawItemDefinitionsData, RawModelsData } from "../scripts/lib/types.ts";

describe("walkModelChain", () => {
  it("walks a flat item parent chain merging textures (child overrides parent)", () => {
    const models: RawModelsData = {
      "item/torch": {
        parent: "minecraft:item/generated",
        textures: { layer0: "minecraft:block/torch" },
      },
      "item/generated": { parent: "builtin/generated" },
    };

    const chain = walkModelChain("minecraft:item/torch", models);

    expect(chain.chainNames).toEqual(["item/torch", "item/generated", "builtin/generated"]);
    expect(chain.mergedTextures).toEqual({ layer0: "minecraft:block/torch" });
  });

  it("resolves '#' indirections against the merged texture map", () => {
    const models: RawModelsData = {
      "block/oak_log": {
        parent: "minecraft:block/cube_column",
        textures: { end: "minecraft:block/oak_log_top", side: "minecraft:block/oak_log" },
      },
      "block/cube_column": {
        parent: "block/cube",
        textures: { particle: "#side", down: "#end", up: "#end", side: "#side" },
      },
      "block/cube": {},
    };

    const chain = walkModelChain("minecraft:block/oak_log", models);
    // Leaf ("block/oak_log") textures should win over the parent's indirections.
    expect(chain.mergedTextures.end).toBe("minecraft:block/oak_log_top");
    expect(chain.mergedTextures.side).toBe("minecraft:block/oak_log");
  });

  it("unwraps the extended { sprite } texture form (e.g. stained glass)", () => {
    const models: RawModelsData = {
      "block/glass": {
        parent: "block/cube_all",
        textures: { all: { sprite: "minecraft:block/glass", force_translucent: true } },
      },
      "block/cube_all": {},
    };

    const chain = walkModelChain("minecraft:block/glass", models);
    expect(chain.mergedTextures.all).toBe("minecraft:block/glass");
  });

  it("guards against parent cycles", () => {
    const models: RawModelsData = {
      "block/a": { parent: "minecraft:block/b" },
      "block/b": { parent: "minecraft:block/a" },
    };

    const chain = walkModelChain("minecraft:block/a", models);
    expect(chain.chainNames).toEqual(["block/a", "block/b"]);
  });
});

describe("findModelReference", () => {
  it("returns the model ref directly for a minecraft:model node", () => {
    expect(findModelReference({ type: "minecraft:model", model: "minecraft:item/stick" })).toBe(
      "minecraft:item/stick",
    );
  });

  it("depth-first searches nested select/condition/composite trees for the first minecraft:model node", () => {
    const node = {
      type: "minecraft:condition",
      property: "minecraft:broken",
      on_false: {
        type: "minecraft:select",
        cases: [
          {
            when: "diamond",
            model: { type: "minecraft:model", model: "minecraft:item/diamond_hoe" },
          },
        ],
        fallback: { type: "minecraft:model", model: "minecraft:item/wooden_hoe" },
      },
    };

    expect(findModelReference(node)).toBe("minecraft:item/diamond_hoe");
  });

  it("returns undefined when no nested minecraft:model node exists (e.g. banner special renderer)", () => {
    const node = {
      type: "minecraft:special",
      base: "minecraft:item/template_banner",
      model: { type: "minecraft:banner", color: "white" },
    };

    expect(findModelReference(node)).toBeUndefined();
  });
});

describe("resolveIconCandidate", () => {
  const models: RawModelsData = {
    "item/torch": {
      parent: "minecraft:item/generated",
      textures: { layer0: "minecraft:block/torch" },
    },
    "item/generated": { parent: "builtin/generated" },
    "block/oak_log": {
      parent: "minecraft:block/cube_column",
      textures: { end: "minecraft:block/oak_log_top", side: "minecraft:block/oak_log" },
    },
    "block/cube_column": { parent: "block/cube" },
    "block/cube": {},
    "block/white_wool": {
      parent: "minecraft:block/cube_all",
      textures: { all: "minecraft:block/white_wool" },
    },
    "block/cube_all": {},
    "block/melon": {
      parent: "minecraft:block/cube_bottom_top",
      textures: { top: "minecraft:block/melon_top", side: "minecraft:block/melon_side" },
    },
    "block/cube_bottom_top": {},
    "block/furnace": {
      parent: "minecraft:block/orientable",
      textures: { top: "minecraft:block/furnace_top", front: "minecraft:block/furnace_front" },
    },
    "block/orientable": {},
    "block/oak_slab": {
      parent: "minecraft:block/slab",
      textures: {
        bottom: "minecraft:block/oak_planks",
        top: "minecraft:block/oak_planks",
        side: "minecraft:block/oak_planks",
      },
    },
    "block/slab": {},
    "block/oak_stairs": {
      parent: "minecraft:block/stairs",
      textures: {
        bottom: "minecraft:block/oak_planks",
        top: "minecraft:block/oak_planks",
        side: "minecraft:block/oak_planks",
      },
    },
    "block/stairs": {},
  };

  const itemDefinitions: RawItemDefinitionsData = {
    torch: { model: { type: "minecraft:model", model: "minecraft:item/torch" } },
    oak_log: { model: { type: "minecraft:model", model: "minecraft:block/oak_log" } },
    white_wool: { model: { type: "minecraft:model", model: "minecraft:block/white_wool" } },
    melon: { model: { type: "minecraft:model", model: "minecraft:block/melon" } },
    furnace: { model: { type: "minecraft:model", model: "minecraft:block/furnace" } },
    oak_slab: { model: { type: "minecraft:model", model: "minecraft:block/oak_slab" } },
    oak_stairs: { model: { type: "minecraft:model", model: "minecraft:block/oak_stairs" } },
  };

  it("resolves a flat icon for an item/generated chain", () => {
    expect(resolveIconCandidate("torch", itemDefinitions, models)).toEqual({
      type: "flat",
      textureRef: "block/torch",
    });
  });

  it("resolves a block icon (top=end, side=side) for a cube_column chain", () => {
    expect(resolveIconCandidate("oak_log", itemDefinitions, models)).toEqual({
      type: "block",
      topRef: "block/oak_log_top",
      sideRef: "block/oak_log",
    });
  });

  it("resolves a block icon (top=side=all) for a cube_all chain", () => {
    expect(resolveIconCandidate("white_wool", itemDefinitions, models)).toEqual({
      type: "block",
      topRef: "block/white_wool",
      sideRef: "block/white_wool",
    });
  });

  it("resolves a block icon (top/side) for a cube_bottom_top chain", () => {
    expect(resolveIconCandidate("melon", itemDefinitions, models)).toEqual({
      type: "block",
      topRef: "block/melon_top",
      sideRef: "block/melon_side",
    });
  });

  it("resolves a block icon (top/front) for an orientable chain", () => {
    expect(resolveIconCandidate("furnace", itemDefinitions, models)).toEqual({
      type: "block",
      topRef: "block/furnace_top",
      sideRef: "block/furnace_front",
    });
  });

  it("resolves a slab icon (top/side) for a block/slab chain", () => {
    expect(resolveIconCandidate("oak_slab", itemDefinitions, models)).toEqual({
      type: "slab",
      topRef: "block/oak_planks",
      sideRef: "block/oak_planks",
    });
  });

  it("resolves a stairs icon (top/side) for a block/stairs chain", () => {
    expect(resolveIconCandidate("oak_stairs", itemDefinitions, models)).toEqual({
      type: "stairs",
      topRef: "block/oak_planks",
      sideRef: "block/oak_planks",
    });
  });

  it("returns undefined when the item has no definition", () => {
    expect(resolveIconCandidate("nonexistent", itemDefinitions, models)).toBeUndefined();
  });

  it("returns undefined when no model reference can be found (e.g. special renderer)", () => {
    const specials: RawItemDefinitionsData = {
      white_banner: {
        model: {
          type: "minecraft:special",
          base: "minecraft:item/template_banner",
          model: { type: "minecraft:banner" },
        },
      },
    };

    expect(resolveIconCandidate("white_banner", specials, models)).toBeUndefined();
  });
});

import { describe, expect, it } from "vitest";
import {
  findAllModelReferences,
  findModelReference,
  findSpecialModel,
  resolveIconCandidate,
  walkModelChain,
} from "../scripts/lib/model.ts";
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

describe("findAllModelReferences", () => {
  it("returns a single-element array for a plain minecraft:model node", () => {
    expect(
      findAllModelReferences({ type: "minecraft:model", model: "minecraft:item/stick" }),
    ).toEqual(["minecraft:item/stick"]);
  });

  it("collects every nested minecraft:model node, not just the first (e.g. a bed's composite)", () => {
    const node = {
      type: "minecraft:composite",
      models: [
        { type: "minecraft:model", model: "minecraft:block/black_bed_head" },
        {
          type: "minecraft:model",
          model: "minecraft:block/black_bed_foot",
          transformation: { translation: [0, 0, 1] },
        },
      ],
    };

    expect(findAllModelReferences(node)).toEqual([
      "minecraft:block/black_bed_head",
      "minecraft:block/black_bed_foot",
    ]);
  });

  it("returns an empty array when no minecraft:model node exists", () => {
    expect(
      findAllModelReferences({
        type: "minecraft:special",
        base: "minecraft:item/template_banner",
        model: { type: "minecraft:banner", color: "white" },
      }),
    ).toEqual([]);
  });
});

describe("findSpecialModel", () => {
  it("returns the base ref, special type, and special model config for a minecraft:special node", () => {
    const node = {
      type: "minecraft:special",
      base: "minecraft:item/template_banner",
      model: { type: "minecraft:banner", color: "white" },
    };

    expect(findSpecialModel(node)).toEqual({
      base: "minecraft:item/template_banner",
      specialType: "banner",
      specialModel: { type: "minecraft:banner", color: "white" },
    });
  });

  it("depth-first searches nested select/condition trees for the first minecraft:special node", () => {
    const node = {
      type: "minecraft:condition",
      property: "minecraft:using_item",
      on_false: {
        type: "minecraft:special",
        base: "minecraft:item/shield",
        model: { type: "minecraft:shield" },
      },
      on_true: {
        type: "minecraft:special",
        base: "minecraft:item/shield_blocking",
        model: { type: "minecraft:shield" },
      },
    };

    expect(findSpecialModel(node)?.base).toBe("minecraft:item/shield");
  });

  it("returns undefined when no nested minecraft:special node exists", () => {
    expect(
      findSpecialModel({ type: "minecraft:model", model: "minecraft:item/stick" }),
    ).toBeUndefined();
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
    "block/oxidized_lightning_rod": {
      parent: "minecraft:block/template_lightning_rod",
      textures: { texture: "minecraft:block/oxidized_lightning_rod" },
    },
    "block/template_lightning_rod": { parent: "block/block" },
    "block/black_bed_head": { parent: "minecraft:block/template_bed_head" },
    "block/template_bed_head": { parent: "block/template_bed" },
    "block/black_bed_foot": { parent: "minecraft:block/template_bed_foot" },
    "block/template_bed_foot": { parent: "block/template_bed" },
    "block/template_bed": {},
    "block/acacia_pressure_plate": {
      parent: "minecraft:block/pressure_plate_up",
      textures: { texture: "minecraft:block/acacia_planks" },
    },
    "block/pressure_plate_up": { parent: "block/thin_block" },
    "block/thin_block": { parent: "block/block" },
    "block/andesite_wall_inventory": {
      parent: "minecraft:block/wall_inventory",
      textures: { wall: "minecraft:block/andesite" },
    },
    "block/wall_inventory": { parent: "block/block" },
    "block/acacia_button_inventory": {
      parent: "minecraft:block/button_inventory",
      textures: { texture: "minecraft:block/acacia_planks" },
    },
    "block/button_inventory": { parent: "block/block" },
    "block/acacia_fence_inventory": {
      parent: "minecraft:block/fence_inventory",
      textures: { texture: "minecraft:block/acacia_planks" },
    },
    "block/fence_inventory": { parent: "block/block" },
    "block/acacia_fence_gate": {
      parent: "minecraft:block/template_fence_gate",
      textures: { texture: "minecraft:block/acacia_planks" },
    },
    "block/template_fence_gate": { parent: "block/block" },
    "block/bamboo_fence_inventory": {
      parent: "minecraft:block/custom_fence_inventory",
      textures: { texture: "minecraft:block/bamboo_planks" },
    },
    "block/custom_fence_inventory": { parent: "block/block" },
    "block/bamboo_fence_gate": {
      parent: "minecraft:block/template_custom_fence_gate",
      textures: { texture: "minecraft:block/bamboo_planks" },
    },
    "block/template_custom_fence_gate": { parent: "block/block" },
    "block/block": {},
  };

  const itemDefinitions: RawItemDefinitionsData = {
    torch: { model: { type: "minecraft:model", model: "minecraft:item/torch" } },
    oak_log: { model: { type: "minecraft:model", model: "minecraft:block/oak_log" } },
    white_wool: { model: { type: "minecraft:model", model: "minecraft:block/white_wool" } },
    melon: { model: { type: "minecraft:model", model: "minecraft:block/melon" } },
    furnace: { model: { type: "minecraft:model", model: "minecraft:block/furnace" } },
    oak_slab: { model: { type: "minecraft:model", model: "minecraft:block/oak_slab" } },
    oak_stairs: { model: { type: "minecraft:model", model: "minecraft:block/oak_stairs" } },
    oxidized_lightning_rod: {
      model: { type: "minecraft:model", model: "minecraft:block/oxidized_lightning_rod" },
    },
    black_bed: {
      model: {
        type: "minecraft:composite",
        models: [
          { type: "minecraft:model", model: "minecraft:block/black_bed_head" },
          {
            type: "minecraft:model",
            model: "minecraft:block/black_bed_foot",
            transformation: { translation: [0, 0, 1] },
          },
        ],
      },
    },
    acacia_pressure_plate: {
      model: { type: "minecraft:model", model: "minecraft:block/acacia_pressure_plate" },
    },
    andesite_wall: {
      model: { type: "minecraft:model", model: "minecraft:block/andesite_wall_inventory" },
    },
    acacia_button: {
      model: { type: "minecraft:model", model: "minecraft:block/acacia_button_inventory" },
    },
    acacia_fence: {
      model: { type: "minecraft:model", model: "minecraft:block/acacia_fence_inventory" },
    },
    acacia_fence_gate: {
      model: { type: "minecraft:model", model: "minecraft:block/acacia_fence_gate" },
    },
    bamboo_fence: {
      model: { type: "minecraft:model", model: "minecraft:block/bamboo_fence_inventory" },
    },
    bamboo_fence_gate: {
      model: { type: "minecraft:model", model: "minecraft:block/bamboo_fence_gate" },
    },
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

  it("resolves a lightning_rod candidate (textureRef) for a template_lightning_rod chain", () => {
    expect(resolveIconCandidate("oxidized_lightning_rod", itemDefinitions, models)).toEqual({
      type: "lightning_rod",
      textureRef: "block/oxidized_lightning_rod",
    });
  });

  it("resolves a bed's composite head+foot models to just its colorId (no Java texture resolution -- see scripts/lib/bedrock-colors.ts)", () => {
    expect(resolveIconCandidate("black_bed", itemDefinitions, models)).toEqual({
      type: "bed",
      colorId: "black",
    });
  });

  it("resolves a pressure_plate candidate (textureRef) for a pressure_plate_up chain", () => {
    expect(resolveIconCandidate("acacia_pressure_plate", itemDefinitions, models)).toEqual({
      type: "pressure_plate",
      textureRef: "block/acacia_planks",
    });
  });

  it("resolves a wall candidate (textureRef from the 'wall' var) for a wall_inventory chain", () => {
    expect(resolveIconCandidate("andesite_wall", itemDefinitions, models)).toEqual({
      type: "wall",
      textureRef: "block/andesite",
    });
  });

  it("resolves a button candidate (textureRef) for a button_inventory chain", () => {
    expect(resolveIconCandidate("acacia_button", itemDefinitions, models)).toEqual({
      type: "button",
      textureRef: "block/acacia_planks",
    });
  });

  it("resolves a fence candidate (textureRef) for a fence_inventory chain", () => {
    expect(resolveIconCandidate("acacia_fence", itemDefinitions, models)).toEqual({
      type: "fence",
      textureRef: "block/acacia_planks",
    });
  });

  it("resolves a fence_gate candidate (textureRef) for a template_fence_gate chain", () => {
    expect(resolveIconCandidate("acacia_fence_gate", itemDefinitions, models)).toEqual({
      type: "fence_gate",
      textureRef: "block/acacia_planks",
    });
  });

  it("resolves a fence candidate for bamboo's distinct custom_fence_inventory chain", () => {
    expect(resolveIconCandidate("bamboo_fence", itemDefinitions, models)).toEqual({
      type: "fence",
      textureRef: "block/bamboo_planks",
    });
  });

  it("resolves a fence_gate candidate for bamboo's distinct template_custom_fence_gate chain", () => {
    expect(resolveIconCandidate("bamboo_fence_gate", itemDefinitions, models)).toEqual({
      type: "fence_gate",
      textureRef: "block/bamboo_planks",
    });
  });

  it("returns undefined when the item has no definition", () => {
    expect(resolveIconCandidate("nonexistent", itemDefinitions, models)).toBeUndefined();
  });

  it("resolves a banner candidate (colorId) for a minecraft:special banner renderer", () => {
    const specials: RawItemDefinitionsData = {
      white_banner: {
        model: {
          type: "minecraft:special",
          base: "minecraft:item/template_banner",
          model: { type: "minecraft:banner", color: "white" },
        },
      },
    };

    expect(resolveIconCandidate("white_banner", specials, models)).toEqual({
      type: "banner",
      colorId: "white",
    });
  });

  it("falls back to the special renderer's base model for non-banner special types (e.g. shulker box)", () => {
    const specialModels: RawModelsData = {
      ...models,
      "item/black_shulker_box": {
        parent: "minecraft:item/template_shulker_box",
        textures: { particle: "minecraft:block/black_shulker_box" },
      },
      "item/template_shulker_box": {},
    };
    const specials: RawItemDefinitionsData = {
      black_shulker_box: {
        model: {
          type: "minecraft:special",
          base: "minecraft:item/black_shulker_box",
          model: { type: "minecraft:shulker_box", texture: "minecraft:shulker_black" },
        },
      },
    };

    expect(resolveIconCandidate("black_shulker_box", specials, specialModels)).toEqual({
      type: "flat",
      textureRef: "block/black_shulker_box",
    });
  });

  it("returns undefined when the special renderer's base has no resolvable texture", () => {
    const specials: RawItemDefinitionsData = {
      conduit: {
        model: {
          type: "minecraft:special",
          base: "minecraft:item/conduit_with_no_model_entry",
          model: { type: "minecraft:conduit" },
        },
      },
    };

    expect(resolveIconCandidate("conduit", specials, models)).toBeUndefined();
  });
});

describe("resolveIconCandidate: compound (generic multi-element)", () => {
  const compoundModels: RawModelsData = {
    // A shared template (like block/template_anvil) defines the real
    // geometry; the leaf (like block/anvil) only overrides one texture var.
    "block/template_widget": {
      parent: "block/block",
      textures: { particle: "block/widget_body", body: "block/widget_body" },
      elements: [
        {
          from: [2, 0, 2],
          to: [14, 4, 14],
          faces: {
            up: { texture: "#body" },
            east: { texture: "#body" },
            south: { texture: "#body" },
            // down/north/west aren't shown by a SIMPLE CONVEX box from this
            // catalog's fixed camera, but concave/hollow shapes (composter,
            // grindstone) genuinely expose them — all 6 should be kept.
            down: { texture: "#body" },
            north: { texture: "#body" },
            west: { texture: "#body" },
          },
        },
        {
          from: [3, 4, 0],
          to: [13, 10, 16],
          // Only east/south are culled/omitted here (e.g. occluded
          // in-world) — the candidate should carry just the faces the
          // model actually defines.
          faces: { east: { texture: "#top" }, south: { texture: "#top" } },
        },
      ],
    },
    "block/block": {},
    "block/widget": {
      parent: "minecraft:block/template_widget",
      textures: { top: "minecraft:block/widget_top" },
    },
    // block/heavy_core's real vendored quirk: a face texture ref with no
    // leading "#", naming a texture variable directly instead of the usual
    // "#varname" indirection — must still resolve via the textures map, not
    // be treated as an already-resolved literal ref.
    "block/bare_ref_widget": {
      textures: { all: "block/bare_ref_body" },
      elements: [{ from: [4, 0, 4], to: [12, 8, 12], faces: { up: { texture: "all" } } }],
    },
    // Overrides display.gui's yaw (45°) — 180° off the vanilla default
    // (225°) baked into block/block.json.
    "block/rotated_widget": {
      parent: "block/block",
      display: { gui: { rotation: [30, 45, 0] } },
      textures: { particle: "block/rotated_body" },
      elements: [{ from: [0, 0, 0], to: [16, 16, 16], faces: { up: { texture: "#particle" } } }],
    },
    // Exercises all 3 uv paths in one element: an explicit non-flipped
    // rect (passed through unchanged), an explicit flipped/un-sorted rect
    // like grindstone's real leg-element east face (uv: [10, 16, 6, 9] —
    // also passed through unchanged; flip handling lives entirely in
    // ItemIcon.astro's computeUvCrop, not extraction), and an omitted uv
    // (falls back to defaultFaceUv's position-derived rect).
    "block/uv_widget": {
      parent: "block/block",
      textures: { body: "block/uv_body" },
      elements: [
        {
          from: [0, 0, 0],
          to: [16, 16, 16],
          faces: {
            up: { texture: "#body", uv: [1, 2, 15, 14] },
            east: { texture: "#body", uv: [10, 16, 6, 9] },
            south: { texture: "#body" },
          },
        },
      ],
    },
  };

  const compoundItemDefinitions: RawItemDefinitionsData = {
    widget: { model: { type: "minecraft:model", model: "minecraft:block/widget" } },
    bare_ref_widget: {
      model: { type: "minecraft:model", model: "minecraft:block/bare_ref_widget" },
    },
    rotated_widget: {
      model: { type: "minecraft:model", model: "minecraft:block/rotated_widget" },
    },
    uv_widget: { model: { type: "minecraft:model", model: "minecraft:block/uv_widget" } },
  };

  it("extracts real element geometry with all 6 declared faces kept, and no gui override -> yRotation 0", () => {
    expect(resolveIconCandidate("widget", compoundItemDefinitions, compoundModels)).toEqual({
      type: "compound",
      yRotation: 0,
      flatFallbackRef: "block/widget_body",
      elements: [
        {
          from: [2, 0, 2],
          to: [14, 4, 14],
          faces: {
            up: { texture: "block/widget_body", uv: [2, 2, 14, 14] },
            down: { texture: "block/widget_body", uv: [2, 2, 14, 14] },
            north: { texture: "block/widget_body", uv: [2, 12, 14, 16] },
            south: { texture: "block/widget_body", uv: [2, 12, 14, 16] },
            east: { texture: "block/widget_body", uv: [2, 12, 14, 16] },
            west: { texture: "block/widget_body", uv: [2, 12, 14, 16] },
          },
        },
        {
          from: [3, 4, 0],
          to: [13, 10, 16],
          faces: {
            east: { texture: "block/widget_top", uv: [0, 6, 16, 12] },
            south: { texture: "block/widget_top", uv: [3, 6, 13, 12] },
          },
        },
      ],
    });
  });

  it("resolves a bare (non-'#') face texture value as a texture variable name, not a literal ref", () => {
    expect(
      resolveIconCandidate("bare_ref_widget", compoundItemDefinitions, compoundModels),
    ).toEqual({
      type: "compound",
      yRotation: 0,
      // No "particle"/"layer0" var here — falls back to the first
      // resolvable texture var in the merged map ("all").
      flatFallbackRef: "block/bare_ref_body",
      elements: [
        {
          from: [4, 0, 4],
          to: [12, 8, 12],
          faces: { up: { texture: "block/bare_ref_body", uv: [4, 4, 12, 12] } },
        },
      ],
    });
  });

  it("computes yRotation as the model's own display.gui yaw minus the vanilla default (225deg)", () => {
    const candidate = resolveIconCandidate(
      "rotated_widget",
      compoundItemDefinitions,
      compoundModels,
    );
    expect(candidate?.type).toBe("compound");
    expect(candidate).toMatchObject({ yRotation: 45 - 225 });
  });

  it("carries explicit uv rects through unchanged (including flipped/un-sorted ones), and derives a position-based default uv when omitted", () => {
    expect(resolveIconCandidate("uv_widget", compoundItemDefinitions, compoundModels)).toEqual({
      type: "compound",
      yRotation: 0,
      flatFallbackRef: "block/uv_body",
      elements: [
        {
          from: [0, 0, 0],
          to: [16, 16, 16],
          faces: {
            up: { texture: "block/uv_body", uv: [1, 2, 15, 14] },
            east: { texture: "block/uv_body", uv: [10, 16, 6, 9] },
            south: { texture: "block/uv_body", uv: [0, 0, 16, 16] },
          },
        },
      ],
    });
  });
});

describe("resolveIconCandidate: compound full-cube front swap", () => {
  // Vanilla puts a full-cube block's "front" texture on NORTH (observer,
  // crafter, chiseled bookshelf) — a face this catalog's mirrored camera
  // never shows. Extraction swaps north/south so the front lands on the
  // visible south slot (see swapFullCubeFrontFaces).
  const models: RawModelsData = {
    "block/block": {},
    "block/fronted_cube": {
      parent: "block/block",
      textures: {
        particle: "block/fc_top",
        top: "block/fc_top",
        side: "block/fc_side",
        front: "block/fc_front",
      },
      elements: [
        {
          from: [0, 0, 0],
          to: [16, 16, 16],
          faces: {
            up: { texture: "#top" },
            north: { texture: "#front", uv: [0, 0, 16, 16] },
            south: { texture: "#side", uv: [16, 0, 0, 16] },
            east: { texture: "#side" },
          },
        },
      ],
    },
    // Same face layout on a non-full-cube element — must NOT swap (a bare
    // face swap on partial geometry repaints physically distinct surfaces).
    "block/fronted_slab": {
      parent: "block/block",
      textures: { particle: "block/fs_top", front: "block/fs_front", side: "block/fs_side" },
      elements: [
        {
          from: [0, 0, 0],
          to: [16, 8, 16],
          faces: {
            north: { texture: "#front" },
            south: { texture: "#side" },
          },
        },
      ],
    },
  };

  const itemDefinitions: RawItemDefinitionsData = {
    fronted_cube: { model: { type: "minecraft:model", model: "minecraft:block/fronted_cube" } },
    fronted_slab: { model: { type: "minecraft:model", model: "minecraft:block/fronted_slab" } },
  };

  it("swaps north/south face data verbatim (texture + uv) for a single-element full cube", () => {
    const candidate = resolveIconCandidate("fronted_cube", itemDefinitions, models);
    expect(candidate).toMatchObject({
      type: "compound",
      elements: [
        {
          faces: {
            south: { texture: "block/fc_front", uv: [0, 0, 16, 16] },
            north: { texture: "block/fc_side", uv: [16, 0, 0, 16] },
          },
        },
      ],
    });
  });

  it("leaves non-full-cube elements unswapped", () => {
    const candidate = resolveIconCandidate("fronted_slab", itemDefinitions, models);
    expect(candidate).toMatchObject({
      type: "compound",
      elements: [
        {
          faces: {
            north: { texture: "block/fs_front" },
            south: { texture: "block/fs_side" },
          },
        },
      ],
    });
  });
});

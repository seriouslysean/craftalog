import { describe, expect, it } from "vitest";
import { generate } from "../scripts/lib/generate.ts";
import { sortKeysDeep } from "../scripts/lib/strings.ts";
import type {
  RawBannerPatternRegistry,
  RawBedrockGeometryFile,
  RawItemDefinitionsData,
  RawLegacyBedrockGeometryFile,
  RawModelsData,
  RawRecipesData,
  RawTagsData,
} from "../scripts/lib/types.ts";

// None of this file's fixtures produce a copper_golem_statue candidate, so
// an empty geometry list satisfies generate()'s input contract without
// exercising copperGolemCompoundIcon at all -- see copper-golem-icon.test.ts
// for that.
const emptyCopperGolemGeoRaw: RawBedrockGeometryFile = { "minecraft:geometry": [] };

// Same idea for shulker_box candidates -- see shulker-icon.test.ts for the
// real extraction coverage.
const emptyShulkerGeoRaw: RawLegacyBedrockGeometryFile = {
  format_version: "1.8.0",
  "geometry.shulker.v1.8": { texturewidth: 64, textureheight: 64, bones: [] },
};

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
  "entity/banner/banner_base",
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
    bannerPatternsRaw: {},
    bannerPatternTagsRaw: {},
    copperGolemGeoRaw: emptyCopperGolemGeoRaw,
    shulkerGeoRaw: emptyShulkerGeoRaw,
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

  it("resolves a banner icon to a hand-authored compound (pole + crossbar + tinted flag) and queues its atlas for synthesis", () => {
    const result = run();
    const icon = result.items.white_banner.icon;
    if (icon.type !== "compound") throw new Error(`expected compound icon, got ${icon.type}`);
    expect(icon.variant).toBe("banner");
    expect(icon.elements).toHaveLength(3);
    // Flag faces sample the per-color tinted atlas; pole/crossbar faces the
    // shared untinted copy (see scripts/lib/banner-icon.ts).
    const textures = new Set(
      icon.elements.flatMap((el) => Object.values(el.faces).map((face) => face.texture)),
    );
    expect(textures).toEqual(
      new Set(["/textures/item/white_banner.png", "/textures/item/banner_base.png"]),
    );
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
      bannerPatternsRaw: {},
      bannerPatternTagsRaw: {},
      copperGolemGeoRaw: emptyCopperGolemGeoRaw,
      shulkerGeoRaw: emptyShulkerGeoRaw,
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

describe("generate: patterned banners (synthetic recipes with no vanilla source)", () => {
  const bannerPatternsRaw: RawBannerPatternRegistry = {
    creeper: { asset_id: "minecraft:creeper", translation_key: "block.minecraft.banner.creeper" },
    border: { asset_id: "minecraft:border", translation_key: "block.minecraft.banner.border" },
  };
  const bannerPatternTagsRaw: RawTagsData = {
    no_item_required: { values: ["minecraft:border"] },
    "pattern_item/creeper": { values: ["minecraft:creeper"] },
  };
  const patternedBannerEnUs = {
    "block.minecraft.banner.creeper.black": "Black Creeper Charge",
    "block.minecraft.banner.border.black": "Black Border",
  };
  const patternTextures = new Set([
    "entity/banner/creeper",
    "entity/banner/border",
    "entity/banner/banner_base",
    "block/white_wool",
    "block/black_wool",
  ]);

  function runPatterned(
    textureExists: (ref: string) => boolean = (ref) => patternTextures.has(ref),
  ) {
    return generate({
      version: "26.2",
      recipesRaw: {},
      tagsRaw: {},
      itemDefsRaw: {},
      modelsRaw: {},
      componentsRaw: {},
      enUs: patternedBannerEnUs,
      bannerPatternsRaw,
      bannerPatternTagsRaw,
      copperGolemGeoRaw: emptyCopperGolemGeoRaw,
      shulkerGeoRaw: emptyShulkerGeoRaw,
      textureExists,
    });
  }

  it("injects one synthetic special recipe + compound-icon item per loom-obtainable pattern, sharing the patterned_banner group", () => {
    const result = runPatterned();
    expect(Object.keys(result.recipes).toSorted()).toEqual([
      "patterned_banner_border",
      "patterned_banner_creeper",
    ]);
    expect(result.recipes.patterned_banner_creeper).toEqual({
      id: "patterned_banner_creeper",
      type: "special",
      category: "misc",
      family: "banners",
      group: "patterned_banner",
      slug: "default",
      note: "Apply in a loom: any banner + any dye + this pattern's banner pattern item. Shown as black on a white banner.",
      result: { id: "patterned_banner_creeper", count: 1 },
    });
    expect(result.items.patterned_banner_creeper.name).toBe("Black Creeper Charge");
    expect(result.items.patterned_banner_creeper.icon.type).toBe("compound");
    expect(result.patternedBannerIconsToSynthesize).toEqual(
      new Map([
        ["creeper", "item/patterned_banner_creeper"],
        ["border", "item/patterned_banner_border"],
      ]),
    );
    expect(result.meta.counts.special).toBe(2);
  });

  it("registers the 'banners' family/category even with no other recipe using it", () => {
    const result = runPatterned();
    expect(result.families.banners).toBeDefined();
    expect(result.families.banners.category).toBe("colored_blocks");
  });

  it("produces byte-identical output across repeated runs", () => {
    const first = runPatterned();
    const second = runPatterned();
    expect(JSON.stringify(sortKeysDeep(first.recipes))).toBe(
      JSON.stringify(sortKeysDeep(second.recipes)),
    );
    expect(JSON.stringify(sortKeysDeep(first.items))).toBe(
      JSON.stringify(sortKeysDeep(second.items)),
    );
  });

  it("falls back to the placeholder icon when the shared banner base or wool textures are missing, rather than crashing", () => {
    const result = runPatterned((ref) => ref.startsWith("entity/banner/"));
    expect(result.items.patterned_banner_creeper.icon).toEqual({
      type: "flat",
      texture: "/textures/placeholder.png",
    });
    expect(result.meta.unresolvedIcons).toContain("patterned_banner_creeper");
    expect(result.patternedBannerIconsToSynthesize.size).toBe(0);
  });
});

describe("generate: shield (bespoke special renderer, no vendored geometry)", () => {
  const shieldRecipesRaw: RawRecipesData = {
    shield: {
      type: "minecraft:crafting_shaped",
      key: { "#": "minecraft:oak_planks", X: "minecraft:iron_ingot" },
      pattern: ["#X#", "###", "#"],
      result: { id: "minecraft:shield" },
    },
  };
  // Mirrors the real vendored shape (see tests/model.test.ts's matching case).
  const shieldItemDefsRaw: RawItemDefinitionsData = {
    shield: {
      model: {
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
      },
    },
  };

  function runShield(textureExists: (ref: string) => boolean) {
    return generate({
      version: "26.2",
      recipesRaw: shieldRecipesRaw,
      tagsRaw: {},
      itemDefsRaw: shieldItemDefsRaw,
      modelsRaw: {},
      componentsRaw: {},
      enUs: {},
      bannerPatternsRaw: {},
      bannerPatternTagsRaw: {},
      copperGolemGeoRaw: emptyCopperGolemGeoRaw,
      shulkerGeoRaw: emptyShulkerGeoRaw,
      textureExists,
      bedrockBedIconExists: () => false,
    });
  }

  it("resolves to a single-plate compound icon and queues the shared atlas for a verbatim copy", () => {
    const result = runShield((ref) => ref === "entity/shield/shield_base_nopattern");
    const icon = result.items.shield.icon;
    if (icon.type !== "compound") throw new Error(`expected compound icon, got ${icon.type}`);
    expect(icon.variant).toBe("shield");
    expect(icon.elements).toHaveLength(1);
    expect(
      Object.values(icon.elements[0].faces).every(
        (face) => face.texture === "/textures/item/shield_base_nopattern.png",
      ),
    ).toBe(true);
    expect(result.shieldIconToCopy).toBe(true);
    expect(result.meta.unresolvedIcons).not.toContain("shield");
  });

  it("falls back to the placeholder icon when the shared shield atlas doesn't exist on disk, rather than crashing", () => {
    const result = runShield(() => false);
    expect(result.items.shield.icon).toEqual({
      type: "flat",
      texture: "/textures/placeholder.png",
    });
    expect(result.meta.unresolvedIcons).toContain("shield");
    expect(result.shieldIconToCopy).toBe(false);
  });
});

describe("generate: copper golem statue (real geometry extracted from vendored Bedrock data)", () => {
  const copperGolemRecipesRaw: RawRecipesData = {
    waxed_copper_golem_statue: {
      type: "minecraft:crafting_shapeless",
      ingredients: ["minecraft:copper_golem_statue", "minecraft:honeycomb"],
      result: { id: "minecraft:waxed_copper_golem_statue" },
    },
  };
  // Mirrors the real vendored shape (see tests/model.test.ts's matching case).
  const copperGolemItemDefsRaw: RawItemDefinitionsData = {
    waxed_copper_golem_statue: {
      model: {
        type: "minecraft:select",
        block_state_property: "copper_golem_pose",
        cases: [],
        fallback: {
          type: "minecraft:special",
          base: "minecraft:item/template_copper_golem_statue",
          model: {
            type: "minecraft:copper_golem_statue",
            pose: "standing",
            texture: "minecraft:textures/entity/copper_golem/copper_golem.png",
          },
        },
      },
    },
  };
  const copperGolemGeoRaw: RawBedrockGeometryFile = {
    "minecraft:geometry": [
      {
        description: { identifier: "geometry.copper_golem", texture_width: 64, texture_height: 64 },
        bones: [
          { name: "root" },
          { name: "body", cubes: [{ origin: [-4, 5, -3], size: [8, 6, 6], uv: [0, 15] }] },
        ],
      },
    ],
  };

  function runCopperGolem(textureExists: (ref: string) => boolean) {
    return generate({
      version: "26.2",
      recipesRaw: copperGolemRecipesRaw,
      tagsRaw: {},
      itemDefsRaw: copperGolemItemDefsRaw,
      modelsRaw: {},
      componentsRaw: {},
      enUs: {},
      bannerPatternsRaw: {},
      bannerPatternTagsRaw: {},
      copperGolemGeoRaw,
      shulkerGeoRaw: emptyShulkerGeoRaw,
      textureExists,
      bedrockBedIconExists: () => false,
    });
  }

  it("resolves to a compound icon extracted from the real geometry and queues its Java texture for a verbatim copy", () => {
    const result = runCopperGolem((ref) => ref === "entity/copper_golem/copper_golem");
    const icon = result.items.waxed_copper_golem_statue.icon;
    if (icon.type !== "compound") throw new Error(`expected compound icon, got ${icon.type}`);
    expect(icon.variant).toBeUndefined();
    expect(icon.elements).toHaveLength(1);
    expect(icon.elements[0].faces.north?.texture).toBe("/textures/item/copper_golem.png");
    expect(result.copperGolemIconsToCopy).toEqual(
      new Map([["entity/copper_golem/copper_golem", "item/copper_golem"]]),
    );
    expect(result.meta.unresolvedIcons).not.toContain("waxed_copper_golem_statue");
  });

  it("falls back to the placeholder icon when the Java texture doesn't exist on disk, rather than crashing", () => {
    const result = runCopperGolem(() => false);
    expect(result.items.waxed_copper_golem_statue.icon).toEqual({
      type: "flat",
      texture: "/textures/placeholder.png",
    });
    expect(result.meta.unresolvedIcons).toContain("waxed_copper_golem_statue");
    expect(result.copperGolemIconsToCopy.size).toBe(0);
  });
});

describe("generate: shulker box (real geometry extracted from vendored Bedrock data, legacy schema)", () => {
  const shulkerRecipesRaw: RawRecipesData = {
    black_shulker_box: {
      type: "minecraft:crafting_shapeless",
      group: "shulker_box_dye",
      ingredients: ["minecraft:shulker_box", "minecraft:black_dye"],
      result: { id: "minecraft:black_shulker_box" },
    },
  };
  // Mirrors the real vendored shape (see tests/model.test.ts's matching case).
  const shulkerItemDefsRaw: RawItemDefinitionsData = {
    black_shulker_box: {
      model: {
        type: "minecraft:special",
        base: "minecraft:item/black_shulker_box",
        model: { type: "minecraft:shulker_box", texture: "minecraft:shulker_black" },
      },
    },
  };
  // Mirrors the real vendored shape (see scripts/lib/shulker-icon.ts's docstring).
  const shulkerGeoRaw: RawLegacyBedrockGeometryFile = {
    format_version: "1.8.0",
    "geometry.shulker.v1.8": {
      texturewidth: 64,
      textureheight: 64,
      bones: [
        { name: "lid", cubes: [{ origin: [-8, 4, -8], size: [16, 12, 16], uv: [0, 0] }] },
        { name: "base", cubes: [{ origin: [-8, 0, -8], size: [16, 8, 16], uv: [0, 28] }] },
        { name: "head", cubes: [{ origin: [-3, 6, -3], size: [6, 6, 6], uv: [0, 52] }] },
      ],
    },
  };

  function runShulker(textureExists: (ref: string) => boolean) {
    return generate({
      version: "26.2",
      recipesRaw: shulkerRecipesRaw,
      tagsRaw: {},
      itemDefsRaw: shulkerItemDefsRaw,
      modelsRaw: {},
      componentsRaw: {},
      enUs: {},
      bannerPatternsRaw: {},
      bannerPatternTagsRaw: {},
      copperGolemGeoRaw: emptyCopperGolemGeoRaw,
      shulkerGeoRaw,
      textureExists,
      bedrockBedIconExists: () => false,
    });
  }

  it("resolves to a compound icon extracted from the real geometry and queues its Java entity texture for a verbatim copy", () => {
    const result = runShulker((ref) => ref === "entity/shulker/shulker_black");
    const icon = result.items.black_shulker_box.icon;
    if (icon.type !== "compound") throw new Error(`expected compound icon, got ${icon.type}`);
    expect(icon.variant).toBeUndefined();
    expect(icon.elements).toHaveLength(2);
    expect(
      icon.elements.every((el) =>
        Object.values(el.faces).every(
          (face) => face.texture === "/textures/item/shulker_black.png",
        ),
      ),
    ).toBe(true);
    expect(result.shulkerIconsToCopy).toEqual(
      new Map([["entity/shulker/shulker_black", "item/shulker_black"]]),
    );
    expect(result.meta.unresolvedIcons).not.toContain("black_shulker_box");
  });

  it("falls back to the placeholder icon when the Java texture doesn't exist on disk, rather than crashing", () => {
    const result = runShulker(() => false);
    expect(result.items.black_shulker_box.icon).toEqual({
      type: "flat",
      texture: "/textures/placeholder.png",
    });
    expect(result.meta.unresolvedIcons).toContain("black_shulker_box");
    expect(result.shulkerIconsToCopy.size).toBe(0);
  });
});

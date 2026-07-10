import { describe, expect, it } from "vitest";
import { getFaces, iconSwapTextures, isIconGeometryUniform } from "../src/utils/icon-faces";
import { collapseVariantGroups, groupRecipes } from "../src/utils/recipe-groups";
import type { IconData, RecipeData } from "../src/content.config";

const itemName = (id: string) => id;

const compoundIconWithTexture = (texture: string): IconData => ({
  type: "compound",
  yRotation: 0,
  elements: [
    {
      from: [0, 0, 0],
      to: [16, 16, 16],
      faces: { up: { texture, uv: [0, 0, 16, 16] } },
    },
  ],
});

describe("getFaces", () => {
  it("returns no faces for a flat icon", () => {
    expect(getFaces({ type: "flat", texture: "/textures/item/stick.png" })).toEqual([]);
  });

  it("returns top/left/right for a block, mapping left+right to the side texture", () => {
    const icon: IconData = { type: "block", top: "/top.png", side: "/side.png" };
    expect(getFaces(icon)).toEqual([
      { className: "top", texture: "/top.png" },
      { className: "left", texture: "/side.png" },
      { className: "right", texture: "/side.png" },
    ]);
  });

  it("returns the same 3-face shape for a slab", () => {
    const icon: IconData = { type: "slab", top: "/top.png", side: "/side.png" };
    expect(getFaces(icon)).toEqual([
      { className: "top", texture: "/top.png" },
      { className: "left", texture: "/side.png" },
      { className: "right", texture: "/side.png" },
    ]);
  });

  it("returns 6 stepped-tread faces for stairs", () => {
    const icon: IconData = { type: "stairs", top: "/top.png", side: "/side.png" };
    expect(getFaces(icon)).toEqual([
      { className: "top-low", texture: "/top.png" },
      { className: "top-high", texture: "/top.png" },
      { className: "left-lower", texture: "/side.png" },
      { className: "left-upper", texture: "/side.png" },
      { className: "right", texture: "/side.png" },
      { className: "riser", texture: "/side.png" },
    ]);
  });

  it("returns top/left/right all from the single texture for pressure_plate and button", () => {
    const plate: IconData = { type: "pressure_plate", texture: "/plate.png" };
    const button: IconData = { type: "button", texture: "/button.png" };
    expect(getFaces(plate)).toEqual([
      { className: "top", texture: "/plate.png" },
      { className: "left", texture: "/plate.png" },
      { className: "right", texture: "/plate.png" },
    ]);
    expect(getFaces(button)).toEqual([
      { className: "top", texture: "/button.png" },
      { className: "left", texture: "/button.png" },
      { className: "right", texture: "/button.png" },
    ]);
  });

  it("returns no faces for wall/fence/fence_gate/compound (rendered via their own multi-part markup, not getFaces' li list)", () => {
    expect(getFaces({ type: "wall", texture: "/wall.png" })).toEqual([]);
    expect(getFaces({ type: "fence", texture: "/fence.png" })).toEqual([]);
    expect(getFaces({ type: "fence_gate", texture: "/gate.png" })).toEqual([]);
    expect(getFaces({ type: "compound", elements: [], yRotation: 0 })).toEqual([]);
  });
});

describe("iconSwapTextures", () => {
  it("returns a single-entry array for flat", () => {
    expect(iconSwapTextures({ type: "flat", texture: "/stick.png" })).toEqual(["/stick.png"]);
  });

  it("returns the 3-entry getFaces order for block", () => {
    const icon: IconData = { type: "block", top: "/top.png", side: "/side.png" };
    expect(iconSwapTextures(icon)).toEqual(["/top.png", "/side.png", "/side.png"]);
  });

  it("returns the 6-entry getFaces order for stairs", () => {
    const icon: IconData = { type: "stairs", top: "/top.png", side: "/side.png" };
    expect(iconSwapTextures(icon)).toEqual([
      "/top.png",
      "/top.png",
      "/side.png",
      "/side.png",
      "/side.png",
      "/side.png",
    ]);
  });

  it("returns a single-entry array for wall/fence/fence_gate, broadcast client-side to every same-texture slot", () => {
    expect(iconSwapTextures({ type: "wall", texture: "/wall.png" })).toEqual(["/wall.png"]);
    expect(iconSwapTextures({ type: "fence", texture: "/fence.png" })).toEqual(["/fence.png"]);
    expect(iconSwapTextures({ type: "fence_gate", texture: "/gate.png" })).toEqual(["/gate.png"]);
  });

  it("walks compound elements/faces in COMPOUND_FACE_DIRECTIONS order, skipping undeclared faces", () => {
    const icon: IconData = {
      type: "compound",
      yRotation: 0,
      elements: [
        {
          from: [0, 0, 0],
          to: [16, 16, 16],
          faces: {
            up: { texture: "/up.png", uv: [0, 0, 16, 16] },
            south: { texture: "/south.png", uv: [0, 0, 16, 16] },
          },
        },
        {
          from: [0, 0, 0],
          to: [8, 8, 8],
          faces: {
            east: { texture: "/east.png", uv: [0, 0, 16, 16] },
          },
        },
      ],
    };
    // up/down/north/south/east/west order, per element, in declaration order --
    // element 0 only declares up+south (down/north/east/west absent, skipped).
    expect(iconSwapTextures(icon)).toEqual(["/up.png", "/south.png", "/east.png"]);
  });

  it("returns [] for an empty compound (no elements)", () => {
    expect(iconSwapTextures({ type: "compound", elements: [], yRotation: 0 })).toEqual([]);
  });
});

describe("isIconGeometryUniform", () => {
  it("treats any two same-type non-compound icons as uniform regardless of texture paths", () => {
    const a: IconData = { type: "block", top: "/oak-top.png", side: "/oak-side.png" };
    const b: IconData = { type: "block", top: "/spruce-top.png", side: "/spruce-side.png" };
    expect(isIconGeometryUniform([a, b])).toBe(true);
  });

  it("treats a group with fewer than 2 icons as trivially uniform", () => {
    expect(isIconGeometryUniform([])).toBe(true);
    expect(isIconGeometryUniform([{ type: "flat", texture: "/stick.png" }])).toBe(true);
  });

  it("treats compound icons with the same from/to/uv/faces/yRotation as uniform, ignoring texture paths", () => {
    expect(
      isIconGeometryUniform([
        compoundIconWithTexture("/white.png"),
        compoundIconWithTexture("/red.png"),
      ]),
    ).toBe(true);
  });

  it("flags compound icons with a different uv rect as non-uniform (the real wooden_trapdoor case)", () => {
    const orientable: IconData = {
      type: "compound",
      yRotation: 0,
      elements: [
        {
          from: [0, 0, 0],
          to: [16, 16, 3],
          faces: { south: { texture: "/spruce_trapdoor.png", uv: [0, 0, 16, 3] } },
        },
      ],
    };
    const legacy: IconData = {
      type: "compound",
      yRotation: 0,
      elements: [
        {
          from: [0, 0, 0],
          to: [16, 16, 3],
          faces: { south: { texture: "/oak_trapdoor.png", uv: [0, 16, 16, 13] } },
        },
      ],
    };
    expect(isIconGeometryUniform([orientable, legacy])).toBe(false);
  });

  it("flags compound icons with different from/to, declared faces, or yRotation as non-uniform", () => {
    const base: IconData = {
      type: "compound",
      yRotation: 0,
      elements: [
        {
          from: [0, 0, 0],
          to: [16, 16, 16],
          faces: { up: { texture: "/a.png", uv: [0, 0, 16, 16] } },
        },
      ],
    };
    const differentTo: IconData = {
      ...base,
      elements: [{ ...base.elements[0], to: [16, 8, 16] }],
    };
    const differentFaces: IconData = {
      ...base,
      elements: [
        {
          ...base.elements[0],
          faces: {
            up: base.elements[0].faces.up!,
            south: { texture: "/b.png", uv: [0, 0, 16, 16] },
          },
        },
      ],
    };
    const differentYRotation: IconData = { ...base, yRotation: 90 };

    expect(isIconGeometryUniform([base, differentTo])).toBe(false);
    expect(isIconGeometryUniform([base, differentFaces])).toBe(false);
    expect(isIconGeometryUniform([base, differentYRotation])).toBe(false);
  });

  it("loads the real generated data and confirms every variant group is geometry-uniform except the known wooden_trapdoor split", async () => {
    // wooden_trapdoor: oak/dark_oak parent to vanilla's legacy
    // template_trapdoor_bottom (non-orientable uv); the other 10 woods
    // parent to the newer template_orientable_trapdoor_bottom -- a real
    // vanilla data split (verified against vendor/mcmeta-summary), not a
    // pipeline bug. variant-icons.json.ts's isIconGeometryUniform check
    // already degrades this one group safely (empty swap textures); this
    // test's real job is failing loudly if a FUTURE mcmeta bump introduces
    // a similar split in some other, currently-uniform group.
    const KNOWN_NONUNIFORM_GROUPS = new Set(["wooden_trapdoor"]);

    const recipesModule = await import("../src/data/generated/recipes.json");
    const itemsModule = await import("../src/data/generated/items.json");
    const allRecipes = Object.values(recipesModule.default) as RecipeData[];
    const items = itemsModule.default as unknown as Record<string, { icon: IconData }>;

    const groups = groupRecipes(allRecipes, itemName);
    const { variantGroups } = collapseVariantGroups(groups);
    expect(variantGroups.length).toBeGreaterThan(0);

    const unexpectedlyNonUniform = variantGroups
      .filter((vg) => !KNOWN_NONUNIFORM_GROUPS.has(vg.groupKey))
      .filter((vg) => {
        const icons = vg.variants
          .map((v) => items[v.resultId]?.icon)
          .filter((icon) => icon != null);
        return !isIconGeometryUniform(icons);
      })
      .map((vg) => vg.groupKey);

    expect(
      unexpectedlyNonUniform,
      `new geometry split found outside the known exception list: ${unexpectedlyNonUniform}`,
    ).toEqual([]);

    // The known exception must still actually be non-uniform -- if a future
    // mcmeta bump ever normalizes oak/dark_oak onto the orientable template,
    // this should fail so the exception list gets cleaned up, not left stale.
    const trapdoorGroup = variantGroups.find((vg) => vg.groupKey === "wooden_trapdoor");
    if (trapdoorGroup) {
      const icons = trapdoorGroup.variants
        .map((v) => items[v.resultId]?.icon)
        .filter((icon) => icon != null);
      expect(isIconGeometryUniform(icons)).toBe(false);
    }
  });
});

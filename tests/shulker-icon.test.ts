import { describe, expect, it } from "vitest";
import { shulkerCompoundIcon } from "../scripts/lib/shulker-icon.ts";
import type { RawLegacyBedrockGeometryFile } from "../scripts/lib/types.ts";

/**
 * Mirrors the real vendored shape (vendor/bedrock-samples/resource_pack/
 * models/entity/shulker.geo.json): the legacy pre-1.12 schema, keyed
 * directly by geometry name, with 3 bones -- `lid`, `base` (both rendered),
 * and `head` (the mob's fleshy foot part, verified fully interior to
 * lid+base and skipped -- see shulker-icon.ts's docstring). Numbers below
 * are the real vendored origin/size/uv, not invented.
 */
const baseGeo: RawLegacyBedrockGeometryFile = {
  format_version: "1.8.0",
  "geometry.shulker.v1.8": {
    texturewidth: 64,
    textureheight: 64,
    bones: [
      {
        name: "lid",
        pivot: [0, 0, 0],
        cubes: [{ origin: [-8, 4, -8], size: [16, 12, 16], uv: [0, 0] }],
      },
      {
        name: "base",
        pivot: [0, 0, 0],
        cubes: [{ origin: [-8, 0, -8], size: [16, 8, 16], uv: [0, 28] }],
      },
      {
        name: "head",
        pivot: [0, 12, 0],
        cubes: [{ origin: [-3, 6, -3], size: [6, 6, 6], uv: [0, 52] }],
      },
    ],
  },
};

describe("shulkerCompoundIcon", () => {
  const icon = shulkerCompoundIcon(baseGeo, "/textures/item/shulker_black.png");

  it("renders exactly 2 elements (lid + base) -- head is provably interior and omitted", () => {
    expect(icon.elements).toHaveLength(2);
  });

  it("returns a compound icon with no variant tag (real extracted geometry, not hand-authored -- like the golem, not banner/shield)", () => {
    expect(icon.type).toBe("compound");
    expect(icon.yRotation).toBe(-180);
    expect(icon.variant).toBeUndefined();
  });

  it("converts the lid cube's origin/size to engine from/to exactly (SCALE=1, no scaling needed)", () => {
    const lid = icon.elements.find((el) => el.from[1] === 4);
    expect(lid?.from).toEqual([0, 4, 0]);
    expect(lid?.to).toEqual([16, 16, 16]);
  });

  it("converts the base cube's origin/size to engine from/to exactly", () => {
    const base = icon.elements.find((el) => el.from[1] === 0);
    expect(base?.from).toEqual([0, 0, 0]);
    expect(base?.to).toEqual([16, 8, 16]);
  });

  it("computes the box-UV unwrap per face, verified against the real lid/base cubes' north/up rects", () => {
    const lid = icon.elements.find((el) => el.from[1] === 4);
    expect(lid?.faces.up?.uv).toEqual([4, 0, 8, 4]);
    expect(lid?.faces.north?.uv).toEqual([4, 4, 8, 7]);

    const base = icon.elements.find((el) => el.from[1] === 0);
    expect(base?.faces.down?.uv).toEqual([8, 7, 12, 11]);
    expect(base?.faces.north?.uv).toEqual([4, 11, 8, 13]);
  });

  it("declares all 6 faces on both elements, every face sampling the passed atlas path", () => {
    for (const el of icon.elements) {
      expect(Object.keys(el.faces).toSorted()).toEqual(
        ["down", "east", "north", "south", "up", "west"].toSorted(),
      );
      for (const face of Object.values(el.faces)) {
        expect(face.texture).toBe("/textures/item/shulker_black.png");
      }
    }
  });

  it("every from/to coordinate stays within the 0-16 reference cube, from < to per axis, and the union already fills it (no icon-scale variant needed)", () => {
    for (const el of icon.elements) {
      for (const axis of [0, 1, 2] as const) {
        expect(el.from[axis]).toBeGreaterThanOrEqual(0);
        expect(el.to[axis]).toBeLessThanOrEqual(16);
        expect(el.from[axis]).toBeLessThan(el.to[axis]);
      }
    }
    const [lid, base] = icon.elements;
    expect(Math.min(lid.from[1], base.from[1])).toBe(0);
    expect(Math.max(lid.to[1], base.to[1])).toBe(16);
  });

  it("works with no head bone at all (nothing to verify-and-skip)", () => {
    const noHeadGeo: RawLegacyBedrockGeometryFile = {
      format_version: "1.8.0",
      "geometry.shulker.v1.8": {
        texturewidth: 64,
        textureheight: 64,
        bones: [
          { name: "lid", cubes: [{ origin: [-8, 4, -8], size: [16, 12, 16], uv: [0, 0] }] },
          { name: "base", cubes: [{ origin: [-8, 0, -8], size: [16, 8, 16], uv: [0, 28] }] },
        ],
      },
    };
    const noHeadIcon = shulkerCompoundIcon(noHeadGeo, "/textures/item/shulker.png");
    expect(noHeadIcon.elements).toHaveLength(2);
  });

  it("throws when the expected geometry key isn't found", () => {
    const badGeo: RawLegacyBedrockGeometryFile = {
      format_version: "1.8.0",
      "geometry.something_else": { texturewidth: 64, textureheight: 64, bones: [] },
    };
    expect(() => shulkerCompoundIcon(badGeo, "/textures/item/shulker.png")).toThrow(
      /geometry\.shulker\.v1\.8/,
    );
  });

  it("throws when the texture dimensions aren't 64x64", () => {
    const badGeo: RawLegacyBedrockGeometryFile = {
      format_version: "1.8.0",
      "geometry.shulker.v1.8": { texturewidth: 32, textureheight: 32, bones: [] },
    };
    expect(() => shulkerCompoundIcon(badGeo, "/textures/item/shulker.png")).toThrow(/64x64/);
  });

  it("throws when the lid or base bone is missing", () => {
    const missingBaseGeo: RawLegacyBedrockGeometryFile = {
      format_version: "1.8.0",
      "geometry.shulker.v1.8": {
        texturewidth: 64,
        textureheight: 64,
        bones: [{ name: "lid", cubes: [{ origin: [-8, 4, -8], size: [16, 12, 16], uv: [0, 0] }] }],
      },
    };
    expect(() => shulkerCompoundIcon(missingBaseGeo, "/textures/item/shulker.png")).toThrow(
      /"base"/,
    );
  });

  it("throws when a cube declares rotation or mirror -- unimplemented features, fail loud rather than silently mis-render", () => {
    const rotatedGeo: RawLegacyBedrockGeometryFile = {
      format_version: "1.8.0",
      "geometry.shulker.v1.8": {
        texturewidth: 64,
        textureheight: 64,
        bones: [
          {
            name: "lid",
            cubes: [{ origin: [-8, 4, -8], size: [16, 12, 16], uv: [0, 0], rotation: [0, 45, 0] }],
          },
          { name: "base", cubes: [{ origin: [-8, 0, -8], size: [16, 8, 16], uv: [0, 28] }] },
        ],
      },
    };
    expect(() => shulkerCompoundIcon(rotatedGeo, "/textures/item/shulker.png")).toThrow();
  });

  it("throws on an unexpected bone name -- a future bedrock-samples update needs review, not silent misrendering", () => {
    const extraBoneGeo: RawLegacyBedrockGeometryFile = {
      format_version: "1.8.0",
      "geometry.shulker.v1.8": {
        texturewidth: 64,
        textureheight: 64,
        bones: [
          { name: "lid", cubes: [{ origin: [-8, 4, -8], size: [16, 12, 16], uv: [0, 0] }] },
          { name: "base", cubes: [{ origin: [-8, 0, -8], size: [16, 8, 16], uv: [0, 28] }] },
          { name: "tentacle", cubes: [{ origin: [0, 0, 0], size: [1, 1, 1], uv: [0, 0] }] },
        ],
      },
    };
    expect(() => shulkerCompoundIcon(extraBoneGeo, "/textures/item/shulker.png")).toThrow(
      /tentacle/,
    );
  });

  it("throws when a future geometry update makes 'head' no longer fully interior to lid+base", () => {
    const exposedHeadGeo: RawLegacyBedrockGeometryFile = {
      format_version: "1.8.0",
      "geometry.shulker.v1.8": {
        texturewidth: 64,
        textureheight: 64,
        bones: [
          { name: "lid", cubes: [{ origin: [-8, 4, -8], size: [16, 12, 16], uv: [0, 0] }] },
          { name: "base", cubes: [{ origin: [-8, 0, -8], size: [16, 8, 16], uv: [0, 28] }] },
          // Poked outside the footprint on x (real head is x:[-3,3]) --
          // no longer fully interior.
          { name: "head", cubes: [{ origin: [-12, 6, -3], size: [6, 6, 6], uv: [0, 52] }] },
        ],
      },
    };
    expect(() => shulkerCompoundIcon(exposedHeadGeo, "/textures/item/shulker.png")).toThrow(
      /interior/,
    );
  });

  it("loads the real generated data and confirms a colored + the undyed shulker box both use extracted geometry, not the old flat block-texture fallback (the literal bug this feature fixes)", async () => {
    const itemsModule = await import("../src/data/generated/items.json");
    const items = itemsModule.default as Record<
      string,
      { icon: { type: string; elements?: { faces: Record<string, { texture: string }> }[] } }
    >;
    for (const id of ["black_shulker_box", "shulker_box"]) {
      const itemIcon = items[id]?.icon;
      expect(itemIcon?.type, `${id} should be a compound icon`).toBe("compound");
      expect(
        itemIcon?.elements,
        `${id} should have 2 real extracted elements (lid+base)`,
      ).toHaveLength(2);
      const textures =
        itemIcon?.elements?.flatMap((el) => Object.values(el.faces).map((f) => f.texture)) ?? [];
      expect(textures.every((texture) => texture.includes("shulker"))).toBe(true);
      expect(textures.some((texture) => texture.includes("_shulker_box"))).toBe(false);
    }
  });
});

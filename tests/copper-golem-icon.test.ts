import { describe, expect, it } from "vitest";
import { copperGolemCompoundIcon } from "../scripts/lib/copper-golem-icon.ts";
import type { RawBedrockGeometryFile } from "../scripts/lib/types.ts";

/**
 * A trimmed fixture mirroring the real vendored shape: two named bones with
 * real cubes (`body`, `head` -- verified exact numbers below against the
 * real geometry.copper_golem file, not invented), two empty attachment
 * bones (`root`, `rightItem` -- nothing to extract, confirming they're
 * silently skipped rather than erroring), an `inflate`d cube (`ball`, same
 * numbers as the real antenna ball), and a second, unrelated geometry
 * (`.flower`) that must be ignored by identifier selection.
 */
const baseGeo: RawBedrockGeometryFile = {
  "minecraft:geometry": [
    {
      description: {
        identifier: "geometry.copper_golem",
        texture_width: 64,
        texture_height: 64,
      },
      bones: [
        { name: "root" },
        { name: "body", cubes: [{ origin: [-4, 5, -3], size: [8, 6, 6], uv: [0, 15] }] },
        { name: "head", cubes: [{ origin: [-4, 11, -5], size: [8, 5, 10], uv: [0, 0] }] },
        { name: "rightItem" },
        {
          name: "ball",
          cubes: [{ origin: [-2, 20, -2], size: [4, 4, 4], uv: [37, 0], inflate: -0.01 }],
        },
      ],
    },
    {
      description: {
        identifier: "geometry.copper_golem.flower",
        texture_width: 64,
        texture_height: 64,
      },
      bones: [{ name: "flower", cubes: [{ origin: [0, 0, 0], size: [1, 1, 1], uv: [0, 0] }] }],
    },
  ],
};

describe("copperGolemCompoundIcon", () => {
  const icon = copperGolemCompoundIcon(baseGeo, "/textures/item/copper_golem.png");

  it("selects geometry.copper_golem by identifier, ignoring the sibling .flower geometry", () => {
    // 3 real cubes (body, head, ball) -- the flower geometry's cube and the
    // two empty attachment bones (root, rightItem) contribute nothing.
    expect(icon.elements).toHaveLength(3);
  });

  it("returns a compound icon with no variant tag (real extracted geometry, not hand-authored -- like anvil, not banner/shield)", () => {
    expect(icon.type).toBe("compound");
    expect(icon.yRotation).toBe(-90);
    expect(icon.variant).toBeUndefined();
  });

  it("converts a plain cube's origin/size to engine from/to exactly (body)", () => {
    const body = icon.elements.find((el) => el.from[1] === 3.3333);
    expect(body?.from).toEqual([5.3333, 3.3333, 6]);
    expect(body?.to).toEqual([10.6667, 7.3333, 10]);
  });

  it("converts a plain cube's origin/size to engine from/to exactly (head)", () => {
    const head = icon.elements.find((el) => el.from[1] === 7.3333);
    expect(head?.from).toEqual([5.3333, 7.3333, 4.6667]);
    expect(head?.to).toEqual([10.6667, 10.6667, 11.3333]);
  });

  it("honors a cube's inflate (expand/shrink) before scaling (ball)", () => {
    const ball = icon.elements.find((el) => el.from[1] === 13.34);
    expect(ball?.from).toEqual([6.6733, 13.34, 6.6733]);
    expect(ball?.to).toEqual([9.3267, 15.9933, 9.3267]);
  });

  it("computes the box-UV unwrap per face, verified against the real body cube's north/up rects", () => {
    const body = icon.elements.find((el) => el.from[1] === 3.3333);
    expect(body?.faces.north?.uv).toEqual([1.5, 5.25, 3.5, 6.75]);
    expect(body?.faces.up?.uv).toEqual([1.5, 3.75, 3.5, 5.25]);
    expect(body?.faces.south?.uv).toEqual([5, 5.25, 7, 6.75]);
    expect(body?.faces.west?.uv).toEqual([0, 5.25, 1.5, 6.75]);
    expect(body?.faces.east?.uv).toEqual([3.5, 5.25, 5, 6.75]);
    expect(body?.faces.down?.uv).toEqual([3.5, 3.75, 5.5, 5.25]);
  });

  it("declares all 6 faces on every element, every face sampling the passed atlas path", () => {
    for (const el of icon.elements) {
      expect(Object.keys(el.faces).toSorted()).toEqual(
        ["down", "east", "north", "south", "up", "west"].toSorted(),
      );
      for (const face of Object.values(el.faces)) {
        expect(face.texture).toBe("/textures/item/copper_golem.png");
      }
    }
  });

  it("every from/to coordinate stays within the 0-16 reference cube, from < to per axis", () => {
    for (const el of icon.elements) {
      for (const axis of [0, 1, 2] as const) {
        expect(el.from[axis]).toBeGreaterThanOrEqual(0);
        expect(el.to[axis]).toBeLessThanOrEqual(16);
        expect(el.from[axis]).toBeLessThan(el.to[axis]);
      }
    }
  });

  it("throws when the expected geometry identifier isn't found", () => {
    const badGeo: RawBedrockGeometryFile = {
      "minecraft:geometry": [
        {
          description: {
            identifier: "geometry.something_else",
            texture_width: 64,
            texture_height: 64,
          },
          bones: [],
        },
      ],
    };
    expect(() => copperGolemCompoundIcon(badGeo, "/textures/item/copper_golem.png")).toThrow(
      /geometry\.copper_golem/,
    );
  });

  it("throws when the texture dimensions aren't 64x64", () => {
    const badGeo: RawBedrockGeometryFile = {
      "minecraft:geometry": [
        {
          description: {
            identifier: "geometry.copper_golem",
            texture_width: 32,
            texture_height: 32,
          },
          bones: [],
        },
      ],
    };
    expect(() => copperGolemCompoundIcon(badGeo, "/textures/item/copper_golem.png")).toThrow(
      /64x64/,
    );
  });

  it("throws when a cube declares rotation or mirror -- unimplemented features, fail loud rather than silently mis-render", () => {
    const rotatedCubeGeo: RawBedrockGeometryFile = {
      "minecraft:geometry": [
        {
          description: {
            identifier: "geometry.copper_golem",
            texture_width: 64,
            texture_height: 64,
          },
          bones: [
            {
              name: "body",
              cubes: [{ origin: [-4, 5, -3], size: [8, 6, 6], uv: [0, 15], rotation: [0, 45, 0] }],
            },
          ],
        },
      ],
    };
    expect(() =>
      copperGolemCompoundIcon(rotatedCubeGeo, "/textures/item/copper_golem.png"),
    ).toThrow();

    const mirroredCubeGeo: RawBedrockGeometryFile = {
      "minecraft:geometry": [
        {
          description: {
            identifier: "geometry.copper_golem",
            texture_width: 64,
            texture_height: 64,
          },
          bones: [
            {
              name: "body",
              cubes: [{ origin: [-4, 5, -3], size: [8, 6, 6], uv: [0, 15], mirror: true }],
            },
          ],
        },
      ],
    };
    expect(() =>
      copperGolemCompoundIcon(mirroredCubeGeo, "/textures/item/copper_golem.png"),
    ).toThrow();
  });

  it("throws when a bone declares rotation", () => {
    const rotatedBoneGeo: RawBedrockGeometryFile = {
      "minecraft:geometry": [
        {
          description: {
            identifier: "geometry.copper_golem",
            texture_width: 64,
            texture_height: 64,
          },
          bones: [
            {
              name: "body",
              rotation: [0, 45, 0],
              cubes: [{ origin: [-4, 5, -3], size: [8, 6, 6], uv: [0, 15] }],
            },
          ],
        },
      ],
    };
    expect(() =>
      copperGolemCompoundIcon(rotatedBoneGeo, "/textures/item/copper_golem.png"),
    ).toThrow();
  });

  it("loads the real generated data and confirms all 4 tiers use extracted geometry, not the old flat copper-block fallback (the literal bug this feature fixes)", async () => {
    const itemsModule = await import("../src/data/generated/items.json");
    const items = itemsModule.default as Record<
      string,
      { icon: { type: string; elements?: unknown[] } }
    >;
    const tiers = [
      "waxed_copper_golem_statue",
      "waxed_exposed_copper_golem_statue",
      "waxed_oxidized_copper_golem_statue",
      "waxed_weathered_copper_golem_statue",
    ];
    for (const id of tiers) {
      const tierIcon = items[id]?.icon;
      expect(tierIcon?.type, `${id} should be a compound icon`).toBe("compound");
      expect(tierIcon?.elements, `${id} should have 9 real extracted elements`).toHaveLength(9);
    }
  });
});

import { describe, expect, it } from "vitest";
import { chestCompoundIcon } from "../scripts/lib/chest-icon.ts";

describe("chestCompoundIcon", () => {
  const icon = chestCompoundIcon("/textures/item/chest_normal.png");

  it("builds a bottom + lid compound icon with no variant tag (fills the reference cube like copper golem, not a thin hand-authored shape like banner/shield)", () => {
    expect(icon.type).toBe("compound");
    expect(icon.variant).toBeUndefined();
    expect(icon.yRotation).toBe(-180);
    expect(icon.elements).toHaveLength(2);
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

  it("bottom box is 14x10x14, inset 1 unit on x/z, grounded at y=0 (atlas-verified size, texOffs(0,19))", () => {
    const bottom = icon.elements.find((el) => el.from[1] === 0);
    expect(bottom?.from).toEqual([1, 0, 1]);
    expect(bottom?.to).toEqual([15, 10, 15]);
  });

  it("lid box is 14x5x14, same x/z inset, overlapping the bottom's top by 1 unit (atlas-verified size, texOffs(0,0))", () => {
    const lid = icon.elements.find((el) => el.from[1] === 9);
    expect(lid?.from).toEqual([1, 9, 1]);
    expect(lid?.to).toEqual([15, 14, 15]);
  });

  it("declares all 6 faces on every element, every face sampling the passed atlas path", () => {
    for (const el of icon.elements) {
      expect(Object.keys(el.faces).toSorted()).toEqual(
        ["down", "east", "north", "south", "up", "west"].toSorted(),
      );
      for (const face of Object.values(el.faces)) {
        expect(face.texture).toBe("/textures/item/chest_normal.png");
      }
    }
  });

  it("computes the box-UV unwrap per face, verified against the real bottom box's north/up rects", () => {
    const bottom = icon.elements.find((el) => el.from[1] === 0);
    expect(bottom?.faces.up?.uv).toEqual([3.5, 4.75, 7, 8.25]);
    expect(bottom?.faces.down?.uv).toEqual([7, 4.75, 10.5, 8.25]);
    expect(bottom?.faces.north?.uv).toEqual([3.5, 8.25, 7, 10.75]);
    expect(bottom?.faces.east?.uv).toEqual([7, 8.25, 10.5, 10.75]);
    expect(bottom?.faces.west?.uv).toEqual([0, 8.25, 3.5, 10.75]);
    expect(bottom?.faces.south?.uv).toEqual([10.5, 8.25, 14, 10.75]);
  });

  it("computes the box-UV unwrap per face, verified against the real lid box's north/up rects", () => {
    const lid = icon.elements.find((el) => el.from[1] === 9);
    expect(lid?.faces.up?.uv).toEqual([3.5, 0, 7, 3.5]);
    expect(lid?.faces.down?.uv).toEqual([7, 0, 10.5, 3.5]);
    expect(lid?.faces.north?.uv).toEqual([3.5, 3.5, 7, 4.75]);
    expect(lid?.faces.east?.uv).toEqual([7, 3.5, 10.5, 4.75]);
    expect(lid?.faces.west?.uv).toEqual([0, 3.5, 3.5, 4.75]);
    expect(lid?.faces.south?.uv).toEqual([10.5, 3.5, 14, 4.75]);
  });

  it("every declared uv crop stays inside the 0-16 uv space, well-formed", () => {
    for (const el of icon.elements) {
      for (const face of Object.values(el.faces)) {
        const [u0, v0, u1, v1] = face.uv;
        expect(u0).toBeLessThan(u1);
        expect(v0).toBeLessThan(v1);
        expect(u0).toBeGreaterThanOrEqual(0);
        expect(u1).toBeLessThanOrEqual(16);
        expect(v0).toBeGreaterThanOrEqual(0);
        expect(v1).toBeLessThanOrEqual(16);
      }
    }
  });

  it("a different atlas path produces the same geometry, only the sampled texture changes (e.g. the copper tiers)", () => {
    const copperIcon = chestCompoundIcon("/textures/item/chest_copper.png");
    expect(copperIcon.elements).toEqual(
      icon.elements.map((el) => ({
        ...el,
        faces: Object.fromEntries(
          Object.entries(el.faces).map(([face, data]) => [
            face,
            { ...data, texture: "/textures/item/chest_copper.png" },
          ]),
        ),
      })),
    );
  });

  it("loads the real generated data and confirms every chest-family item shows a real compound icon, not the old flat particle-texture fallback (the literal bug this feature fixes)", async () => {
    const itemsModule = await import("../src/data/generated/items.json");
    const items = itemsModule.default as Record<
      string,
      { icon: { type: string; elements?: unknown[] } }
    >;
    const chestIds = [
      "chest",
      "trapped_chest",
      "ender_chest",
      "copper_chest",
      "exposed_copper_chest",
      "oxidized_copper_chest",
      "weathered_copper_chest",
      "waxed_copper_chest",
      "waxed_exposed_copper_chest",
      "waxed_oxidized_copper_chest",
      "waxed_weathered_copper_chest",
    ];
    for (const id of chestIds) {
      const chestIcon = items[id]?.icon;
      expect(chestIcon?.type, `${id} should be a compound icon`).toBe("compound");
      expect(chestIcon?.elements, `${id} should have 2 real elements (bottom + lid)`).toHaveLength(
        2,
      );
    }
  });
});

import { describe, expect, it } from "vitest";
import { shieldCompoundIcon } from "../scripts/lib/shield-icon.ts";

describe("shieldCompoundIcon", () => {
  const icon = shieldCompoundIcon("/textures/item/shield_base_nopattern.png");

  it("builds a single plate element that fits the 0-16 reference cube, tagged with the shield icon-scale variant", () => {
    expect(icon.type).toBe("compound");
    expect(icon.variant).toBe("shield");
    expect(icon.yRotation).toBe(-250);
    expect(icon.elements).toHaveLength(1);
    const [plate] = icon.elements;
    for (const axis of [0, 1, 2] as const) {
      expect(plate.from[axis]).toBeGreaterThanOrEqual(0);
      expect(plate.to[axis]).toBeLessThanOrEqual(16);
      expect(plate.from[axis]).toBeLessThan(plate.to[axis]);
    }
    // Full engine height -- the plate's own native height (22) is what
    // gets scaled to fill 0-16, unlike banner's shorter pole+crossbar+flag.
    expect(plate.from[1]).toBe(0);
    expect(plate.to[1]).toBe(16);
  });

  it("every declared face samples the passed atlas texture", () => {
    const [plate] = icon.elements;
    for (const face of Object.values(plate.faces)) {
      expect(face.texture).toBe("/textures/item/shield_base_nopattern.png");
    }
  });

  it("declares exactly south/west/east/up -- south is the visible front, west/east the rim edges, up the top strip", () => {
    const [plate] = icon.elements;
    expect(Object.keys(plate.faces).toSorted()).toEqual(["east", "south", "up", "west"]);
  });

  it("omits north (back) -- the plate is only 1 native unit thick, the same near-coplanar distance that caused banner's flag ghosting, and is never visible from this camera", () => {
    const [plate] = icon.elements;
    expect(plate.faces.north).toBeUndefined();
  });

  it("omits down -- the camera pitches downward, so a shield's bottom edge is never visible", () => {
    const [plate] = icon.elements;
    expect(plate.faces.down).toBeUndefined();
  });

  it("declares uv crops inside the atlas's real plate unwrap region (0-16 uv space over the 64x64 template), well-formed", () => {
    const [plate] = icon.elements;
    // South (front) is the 12x22 wood-grain crop at pixel (1,1) -- [0.25,
    // 0.25, 3.25, 5.75] in 0-16 uv space (pixel / 4 on a 64px atlas).
    expect(plate.faces.south?.uv).toEqual([0.25, 0.25, 3.25, 5.75]);
    for (const face of Object.values(plate.faces)) {
      const [u0, v0, u1, v1] = face.uv;
      expect(u0).toBeLessThan(u1);
      expect(v0).toBeLessThan(v1);
      expect(u0).toBeGreaterThanOrEqual(0);
      expect(u1).toBeLessThanOrEqual(16);
      expect(v0).toBeGreaterThanOrEqual(0);
      expect(v1).toBeLessThanOrEqual(16);
    }
  });

  it("loads the real generated data and confirms shield no longer shows the wrong dark_oak_planks fallback (the literal bug this feature fixes)", async () => {
    const itemsModule = await import("../src/data/generated/items.json");
    const shield = itemsModule.default.shield;
    expect(shield.icon.type).toBe("compound");
    expect(shield.icon.type === "compound" && shield.icon.variant).toBe("shield");
    const textures =
      shield.icon.type === "compound"
        ? shield.icon.elements.flatMap((el) => Object.values(el.faces).map((f) => f.texture))
        : [];
    expect(textures.every((texture) => !texture.includes("dark_oak_planks"))).toBe(true);
  });
});

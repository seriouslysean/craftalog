import { describe, expect, it } from "vitest";
import { decoratedPotCompoundIcon } from "../scripts/lib/decorated-pot-icon.ts";

describe("decoratedPotCompoundIcon", () => {
  const icon = decoratedPotCompoundIcon(
    "/textures/item/decorated_pot_base.png",
    "/textures/item/decorated_pot_side.png",
  );

  it("builds a 2-element compound icon (body + neck) that fits the 0-16 reference cube, no icon-scale variant tag", () => {
    expect(icon.type).toBe("compound");
    expect(icon.variant).toBeUndefined();
    expect(icon.yRotation).toBe(-180);
    expect(icon.elements).toHaveLength(2);
    for (const el of icon.elements) {
      for (const axis of [0, 1, 2] as const) {
        expect(el.from[axis]).toBeGreaterThanOrEqual(0);
        expect(el.to[axis]).toBeLessThanOrEqual(16);
        expect(el.from[axis]).toBeLessThan(el.to[axis]);
      }
    }
  });

  it("the body reaches the floor (y=0) and the neck reaches the full engine height (y=16), touching at the real scaled seam", () => {
    const [body, neck] = icon.elements;
    expect(body.from[1]).toBe(0);
    expect(neck.to[1]).toBe(16);
    // Real native gap (body top y=16, neck bottom y=17, both scaled by
    // 16/20) -- see this module's docstring on the deliberately-omitted
    // collar. Not zero, but small (< 1 engine unit out of 16).
    expect(neck.from[1] - body.to[1]).toBeCloseTo(0.8, 4);
  });

  it("the body is a 14x16x14 box (x/z inset 1 native unit from the block's full footprint), the neck an 8x3x8 box centered above it", () => {
    const [body, neck] = icon.elements;
    expect(body.to[0] - body.from[0]).toBeCloseTo(11.2, 4); // 14 native * (16/20)
    expect(body.to[2] - body.from[2]).toBeCloseTo(11.2, 4);
    expect(neck.to[0] - neck.from[0]).toBeCloseTo(6.4, 4); // 8 native * (16/20)
    expect(neck.to[2] - neck.from[2]).toBeCloseTo(6.4, 4);
    // Neck centered on the same x/z midpoint (8) as the body.
    expect((neck.from[0] + neck.to[0]) / 2).toBeCloseTo(8, 4);
    expect((neck.from[2] + neck.to[2]) / 2).toBeCloseTo(8, 4);
    expect((body.from[0] + body.to[0]) / 2).toBeCloseTo(8, 4);
  });

  it("the body's 4 side faces all sample the same undecorated 'brick' crop -- the plain crafted item has no sherds", () => {
    const [body] = icon.elements;
    const sideFaces = [body.faces.north, body.faces.south, body.faces.east, body.faces.west];
    for (const face of sideFaces) {
      expect(face?.texture).toBe("/textures/item/decorated_pot_side.png");
      expect(face?.uv).toEqual([1, 0, 15, 16]);
    }
  });

  it("the body's up/down faces sample the base atlas's two distinct top/bottom disc crops", () => {
    const [body] = icon.elements;
    expect(body.faces.up?.texture).toBe("/textures/item/decorated_pot_base.png");
    expect(body.faces.down?.texture).toBe("/textures/item/decorated_pot_base.png");
    expect(body.faces.up?.uv).not.toEqual(body.faces.down?.uv);
  });

  it("the neck declares all 6 faces (stepped geometry, matching copper-golem-icon.ts's precedent, not shield's 4-face omission)", () => {
    const [, neck] = icon.elements;
    expect(Object.keys(neck.faces).toSorted()).toEqual(
      ["down", "east", "north", "south", "up", "west"].toSorted(),
    );
    for (const face of Object.values(neck.faces)) {
      expect(face.texture).toBe("/textures/item/decorated_pot_base.png");
    }
  });

  it("the neck's east/west faces are NOT swapped by the real renderer's 180deg X-axis flip (only up/down and north/south are)", () => {
    const [, neck] = icon.elements;
    expect(neck.faces.east?.uv).toEqual([8, 4, 12, 5.5]);
    expect(neck.faces.west?.uv).toEqual([0, 4, 4, 5.5]);
  });

  it("every declared face's uv crop is well-formed (u0<u1, v0<v1, inside the 0-16 uv space)", () => {
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

  it("loads the real generated data and confirms decorated_pot no longer shows the flat block/terracotta fallback (the literal bug this feature fixes)", async () => {
    const itemsModule = await import("../src/data/generated/items.json");
    const decoratedPot = itemsModule.default.decorated_pot;
    expect(decoratedPot.icon.type).toBe("compound");
    const textures =
      decoratedPot.icon.type === "compound"
        ? decoratedPot.icon.elements.flatMap((el) => Object.values(el.faces).map((f) => f.texture))
        : [];
    expect(textures.length).toBeGreaterThan(0);
    expect(textures.every((texture) => !texture.includes("terracotta"))).toBe(true);
  });
});

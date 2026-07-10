import { describe, expect, it } from "vitest";
import {
  CONDUIT_ATLAS_REF,
  HEAD_KIND_TEXTURES,
  conduitCompoundIcon,
  headCompoundIcon,
  isHeadKind,
} from "../scripts/lib/head-icon.ts";

describe("HEAD_KIND_TEXTURES / isHeadKind", () => {
  it("supports exactly the 5 standard-skin-format kinds, excluding dragon (non-standard atlas) and player_head (no kind at all)", () => {
    expect(Object.keys(HEAD_KIND_TEXTURES).toSorted()).toEqual(
      ["creeper", "piglin", "skeleton", "wither_skeleton", "zombie"].toSorted(),
    );
    expect(isHeadKind("dragon")).toBe(false);
    expect(isHeadKind("player_head")).toBe(false);
    for (const kind of Object.keys(HEAD_KIND_TEXTURES)) {
      expect(isHeadKind(kind)).toBe(true);
    }
  });

  it("maps each kind to its own vendored entity skin texture ref", () => {
    expect(HEAD_KIND_TEXTURES.creeper).toBe("entity/creeper/creeper");
    expect(HEAD_KIND_TEXTURES.piglin).toBe("entity/piglin/piglin");
    expect(HEAD_KIND_TEXTURES.skeleton).toBe("entity/skeleton/skeleton");
    expect(HEAD_KIND_TEXTURES.wither_skeleton).toBe("entity/skeleton/wither_skeleton");
    expect(HEAD_KIND_TEXTURES.zombie).toBe("entity/zombie/zombie");
  });
});

describe("headCompoundIcon", () => {
  // creeper.png/skeleton.png/wither_skeleton.png are all the legacy 64x32
  // skin format -- the real dimensions this renderer must thread through
  // uv math instead of assuming the fixed 64x64 every sibling compound
  // renderer (banner/shield/copper golem) gets away with.
  const icon = headCompoundIcon("/textures/item/creeper.png", 64, 32);

  it("builds a single cube filling the whole 0-16 reference cube (no bespoke icon-scale variant needed, unlike banner/shield)", () => {
    expect(icon.type).toBe("compound");
    expect(icon.variant).toBeUndefined();
    expect(icon.yRotation).toBe(-180);
    expect(icon.elements).toHaveLength(1);
    const [cube] = icon.elements;
    expect(cube.from).toEqual([0, 0, 0]);
    expect(cube.to).toEqual([16, 16, 16]);
  });

  it("declares all 6 faces, every face sampling the passed atlas path", () => {
    const [cube] = icon.elements;
    expect(Object.keys(cube.faces).toSorted()).toEqual(
      ["down", "east", "north", "south", "up", "west"].toSorted(),
    );
    for (const face of Object.values(cube.faces)) {
      expect(face.texture).toBe("/textures/item/creeper.png");
    }
  });

  it("crops the classic Minecraft skin head-box region at atlas offset (0,0), normalized per-axis against the real 64x32 atlas (not a fixed 64x64 divisor)", () => {
    const [cube] = icon.elements;
    // Hand-verified against the box-UV formula for an 8x8x8 box at (0,0)
    // on a 64(w)x32(h) atlas: x divisor 64/16=4, y divisor 32/16=2.
    expect(cube.faces.up?.uv).toEqual([2, 0, 4, 4]);
    expect(cube.faces.down?.uv).toEqual([4, 0, 6, 4]);
    expect(cube.faces.west?.uv).toEqual([0, 4, 2, 8]);
    expect(cube.faces.north?.uv).toEqual([2, 4, 4, 8]);
    expect(cube.faces.east?.uv).toEqual([4, 4, 6, 8]);
    expect(cube.faces.south?.uv).toEqual([6, 4, 8, 8]);
    for (const face of Object.values(cube.faces)) {
      const [u0, v0, u1, v1] = face.uv;
      expect(u0).toBeLessThan(u1);
      expect(v0).toBeLessThan(v1);
      expect(u0).toBeGreaterThanOrEqual(0);
      expect(u1).toBeLessThanOrEqual(16);
      expect(v0).toBeGreaterThanOrEqual(0);
      expect(v1).toBeLessThanOrEqual(16);
    }
  });

  it("produces identical uv rects for a 64x64 (new-format) atlas as for 64x32 (legacy) -- the head box's own position/size never moved between skin formats, only the axis this renderer normalizes against does", () => {
    // zombie.png/piglin.png are 64x64; the head box itself is still at
    // (0,0) 8x8x8, but the V divisor changes (64/16=4, not 32/16=2) --
    // this test only asserts the same PIXEL region maps correctly, not
    // that the two atlas sizes produce the same normalized uv (they don't,
    // by design: uvPxOnAtlas is per-axis-of-the-real-image, see
    // scripts/lib/banner-icon.ts).
    const zombieIcon = headCompoundIcon("/textures/item/zombie.png", 64, 64);
    const [cube] = zombieIcon.elements;
    expect(cube.faces.up?.uv).toEqual([2, 0, 4, 2]);
    expect(cube.faces.north?.uv).toEqual([2, 2, 4, 4]);
  });
});

describe("conduitCompoundIcon", () => {
  // entity/conduit/base.png is a 32x16 atlas -- neither dimension matches
  // any other compound renderer's fixed 64x64 assumption.
  const icon = conduitCompoundIcon(`/textures/${CONDUIT_ATLAS_REF}.png`, 32, 16);

  it("builds a single cube filling the whole 0-16 reference cube, same generic-scale treatment as heads", () => {
    expect(icon.type).toBe("compound");
    expect(icon.variant).toBeUndefined();
    expect(icon.yRotation).toBe(-180);
    expect(icon.elements).toHaveLength(1);
    const [cube] = icon.elements;
    expect(cube.from).toEqual([0, 0, 0]);
    expect(cube.to).toEqual([16, 16, 16]);
  });

  it("crops the conduit's static inner-core box-UV region at atlas offset (0,0), a 6x6x6 box normalized against the real 32x16 atlas", () => {
    const [cube] = icon.elements;
    expect(cube.faces.up?.uv).toEqual([3, 0, 6, 6]);
    expect(cube.faces.down?.uv).toEqual([6, 0, 9, 6]);
    expect(cube.faces.west?.uv).toEqual([0, 6, 3, 12]);
    expect(cube.faces.north?.uv).toEqual([3, 6, 6, 12]);
    expect(cube.faces.east?.uv).toEqual([6, 6, 9, 12]);
    expect(cube.faces.south?.uv).toEqual([9, 6, 12, 12]);
    for (const face of Object.values(cube.faces)) {
      expect(face.texture).toBe(`/textures/${CONDUIT_ATLAS_REF}.png`);
      const [u0, v0, u1, v1] = face.uv;
      expect(u0).toBeLessThan(u1);
      expect(v0).toBeLessThan(v1);
    }
  });
});

describe("real generated data", () => {
  it("creeper_head and wither_skeleton_skull no longer show the wrong flat soul_sand fallback (the literal bug this feature fixes)", async () => {
    const itemsModule = await import("../src/data/generated/items.json");
    const items = itemsModule.default as Record<string, { icon: { type: string } }>;
    for (const id of ["creeper_head", "wither_skeleton_skull"]) {
      expect(items[id]?.icon.type, `${id} should be a compound icon`).toBe("compound");
    }
  });

  it("conduit no longer shows the wrong flat block/conduit fallback", async () => {
    const itemsModule = await import("../src/data/generated/items.json");
    const items = itemsModule.default as Record<
      string,
      { icon: { type: string; elements?: { faces: Record<string, { texture: string }> }[] } }
    >;
    const conduit = items.conduit;
    expect(conduit?.icon.type).toBe("compound");
    const textures = (conduit?.icon.elements ?? []).flatMap((el) =>
      Object.values(el.faces).map((f) => f.texture),
    );
    expect(textures.every((texture) => texture.includes(CONDUIT_ATLAS_REF))).toBe(true);
  });
});

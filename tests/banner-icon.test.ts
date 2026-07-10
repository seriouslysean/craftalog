import { PNG } from "pngjs";
import { describe, expect, it } from "vitest";
import { bannerCompoundIcon, generateBannerAtlas } from "../scripts/lib/banner-icon.ts";

/** Builds a PNG buffer from a row-major grid of [r, g, b, a] pixels. */
function buildPng(
  width: number,
  height: number,
  pixels: [number, number, number, number][],
): Buffer {
  const png = new PNG({ width, height });
  pixels.forEach(([r, g, b, a], i) => {
    png.data[i * 4] = r;
    png.data[i * 4 + 1] = g;
    png.data[i * 4 + 2] = b;
    png.data[i * 4 + 3] = a;
  });
  return PNG.sync.write(png);
}

describe("generateBannerAtlas", () => {
  it("tints every opaque pixel with the wool's average color and leaves transparent pixels untouched", () => {
    // 2x2 atlas stand-in: three opaque grayscale pixels, one transparent.
    const base = buildPng(2, 2, [
      [200, 200, 200, 255],
      [100, 100, 100, 255],
      [255, 255, 255, 255],
      [0, 0, 0, 0],
    ]);

    // Solid red wool texture (with one transparent pixel that must not skew the average).
    const wool = buildPng(2, 2, [
      [200, 0, 0, 255],
      [200, 0, 0, 255],
      [200, 0, 0, 255],
      [0, 0, 0, 0],
    ]);

    const atlas = PNG.sync.read(generateBannerAtlas(base, wool));

    // Same dimensions as the source -- a full-atlas tint, not a crop.
    expect(atlas.width).toBe(2);
    expect(atlas.height).toBe(2);
    // intensity/255 * tint (200,0,0), alpha preserved.
    expect([...atlas.data.subarray(0, 4)]).toEqual([157, 0, 0, 255]);
    expect([...atlas.data.subarray(4, 8)]).toEqual([78, 0, 0, 255]);
    expect([...atlas.data.subarray(8, 12)]).toEqual([200, 0, 0, 255]);
    expect(atlas.data[15]).toBe(0);
  });
});

describe("bannerCompoundIcon", () => {
  const icon = bannerCompoundIcon(
    "/textures/item/red_banner.png",
    "/textures/item/banner_base.png",
  );

  it("builds 3 elements (pole, crossbar, flag) that fit the 0-16 reference cube, tagged with the banner icon-scale variant", () => {
    expect(icon.type).toBe("compound");
    expect(icon.variant).toBe("banner");
    expect(icon.elements).toHaveLength(3);
    for (const el of icon.elements) {
      for (const axis of [0, 1, 2] as const) {
        expect(el.from[axis]).toBeGreaterThanOrEqual(0);
        expect(el.to[axis]).toBeLessThanOrEqual(16);
        expect(el.from[axis]).toBeLessThan(el.to[axis]);
      }
    }
  });

  it("routes only the flag's faces to the tinted atlas and the pole/crossbar's to the untinted one", () => {
    const [pole, crossbar, flag] = icon.elements;
    for (const face of Object.values(pole.faces)) {
      expect(face.texture).toBe("/textures/item/banner_base.png");
    }
    for (const face of Object.values(crossbar.faces)) {
      expect(face.texture).toBe("/textures/item/banner_base.png");
    }
    for (const face of Object.values(flag.faces)) {
      expect(face.texture).toBe("/textures/item/red_banner.png");
    }
  });

  it("omits the pole's up and south faces -- both exactly coplanar with a wider neighbor (crossbar's down, flag's north) that fully covers them, and z-fight if both are declared", () => {
    const [pole, crossbar, flag] = icon.elements;
    // Coplanar pair 1: pole top (y = to[1]) === crossbar bottom (y = from[1]).
    expect(pole.to[1]).toBe(crossbar.from[1]);
    // Coplanar pair 2: pole south (z = to[2]) === flag north/back (z = from[2]).
    expect(pole.to[2]).toBe(flag.from[2]);
    // The pole's footprint is fully inside both neighbors' wider footprints
    // on the shared plane, so its own faces there are never visible.
    expect(pole.from[0]).toBeGreaterThanOrEqual(crossbar.from[0]);
    expect(pole.to[0]).toBeLessThanOrEqual(crossbar.to[0]);
    expect(pole.from[0]).toBeGreaterThanOrEqual(flag.from[0]);
    expect(pole.to[0]).toBeLessThanOrEqual(flag.to[0]);
    expect(pole.faces.up).toBeUndefined();
    expect(pole.faces.south).toBeUndefined();
  });

  it("omits the flag's north (back) face -- interior surface never visible from outside, and close enough to the pole's dropped south face at this icon's tiny render size to ghost/double-image instead of depth-sorting cleanly", () => {
    const [, , flag] = icon.elements;
    expect(flag.faces.north).toBeUndefined();
    // The front (visible) face is still declared, at the crop the old flat
    // icon used.
    expect(flag.faces.south).toBeDefined();
  });

  it("declares uv crops inside the atlas's real unwrap regions (0-16 uv space over the 64x64 template)", () => {
    // The flag's visible front face is the 20x40 rect at pixel (1,1) --
    // the same crop the old flat icon used -- which is [0.25, 0.25, 5.25,
    // 10.25] in 0-16 uv space (pixel / 4 on a 64px atlas).
    expect(icon.elements[2].faces.south?.uv).toEqual([0.25, 0.25, 5.25, 10.25]);
    // Every uv rect stays inside the atlas's opaque unwrap band (rows 0-46
    // of 64 -> v <= 11.5) and is well-formed.
    for (const el of icon.elements) {
      for (const face of Object.values(el.faces)) {
        const [u0, v0, u1, v1] = face.uv;
        expect(u0).toBeLessThan(u1);
        expect(v0).toBeLessThan(v1);
        expect(u0).toBeGreaterThanOrEqual(0);
        expect(u1).toBeLessThanOrEqual(16);
        expect(v0).toBeGreaterThanOrEqual(0);
        expect(v1).toBeLessThanOrEqual(11.5);
      }
    }
  });
});

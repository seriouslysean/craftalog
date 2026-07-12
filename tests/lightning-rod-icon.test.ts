import { PNG } from "pngjs";
import { describe, expect, it } from "vitest";
import {
  deriveLightningRodRegions,
  generateLightningRodIcon,
} from "../scripts/lib/lightning-rod-icon.ts";
import type { RawModelElement } from "../scripts/lib/types.ts";

/**
 * The real vendored block/template_lightning_rod elements (trimmed to the
 * fields the derivation reads): a 4x4x4 cap at the top of the block space
 * with a [0,0,4,4] north uv, and a 2x2x12 pole below it with a [0,4,2,16]
 * north uv.
 */
const templateElements: RawModelElement[] = [
  {
    from: [6, 12, 6],
    to: [10, 16, 10],
    faces: { north: { texture: "#texture", uv: [0, 0, 4, 4] } },
  },
  {
    from: [7, 0, 7],
    to: [9, 12, 9],
    faces: { north: { texture: "#texture", uv: [0, 4, 2, 16] } },
  },
];

/** Builds a 16x16 PNG buffer, defaulting to transparent, with the given pixels set by [x, y]. */
function buildAtlas(pixels: Map<string, [number, number, number, number]>): Buffer {
  const png = new PNG({ width: 16, height: 16 });
  for (let y = 0; y < 16; y += 1) {
    for (let x = 0; x < 16; x += 1) {
      const idx = (16 * y + x) * 4;
      const [r, g, b, a] = pixels.get(`${x},${y}`) ?? [0, 0, 0, 0];
      png.data[idx] = r;
      png.data[idx + 1] = g;
      png.data[idx + 2] = b;
      png.data[idx + 3] = a;
    }
  }
  return PNG.sync.write(png);
}

function pixelAt(png: PNG, x: number, y: number): [number, number, number, number] {
  const idx = (png.width * y + x) * 4;
  return [png.data[idx], png.data[idx + 1], png.data[idx + 2], png.data[idx + 3]];
}

describe("deriveLightningRodRegions", () => {
  it("derives the cap + pole crop/placement from the real template model's own elements", () => {
    expect(deriveLightningRodRegions(templateElements)).toEqual([
      // Cap: north uv [0,0,4,4]; destination x = from[0] = 6, y = 16 - to[1] = 0.
      { src: { x: 0, y: 0, width: 4, height: 4 }, dest: { x: 6, y: 0 } },
      // Pole: north uv [0,4,2,16]; destination x = 7, y = 16 - 12 = 4.
      { src: { x: 0, y: 4, width: 2, height: 12 }, dest: { x: 7, y: 4 } },
    ]);
  });

  it("returns undefined when an element lacks a north uv (fall back to the generic path, don't guess)", () => {
    expect(
      deriveLightningRodRegions([
        { from: [6, 12, 6], to: [10, 16, 10], faces: { north: { texture: "#texture" } } },
      ]),
    ).toBeUndefined();
  });

  it("returns undefined when a crop isn't exactly destination-sized (the no-scaling invariant)", () => {
    expect(
      deriveLightningRodRegions([
        {
          from: [6, 12, 6],
          to: [10, 16, 10],
          faces: { north: { texture: "#texture", uv: [0, 0, 8, 4] } },
        },
      ]),
    ).toBeUndefined();
  });
});

describe("generateLightningRodIcon", () => {
  it("places the cap and pole UV crops at the model's own element offsets, leaving the rest transparent", () => {
    const pixels = new Map<string, [number, number, number, number]>();
    // Cap UV region [0,0]-[4,4): solid green.
    for (let y = 0; y < 4; y += 1) {
      for (let x = 0; x < 4; x += 1) pixels.set(`${x},${y}`, [0, 200, 0, 255]);
    }
    // Pole UV region [0,4]-[2,16): solid blue.
    for (let y = 4; y < 16; y += 1) {
      for (let x = 0; x < 2; x += 1) pixels.set(`${x},${y}`, [0, 0, 200, 255]);
    }
    // Padding outside both regions (e.g. columns 4-15 below row 4) stays transparent and must be ignored.
    const atlas = buildAtlas(pixels);

    const icon = PNG.sync.read(
      generateLightningRodIcon(atlas, deriveLightningRodRegions(templateElements)!),
    );

    expect(icon.width).toBe(16);
    expect(icon.height).toBe(16);

    // Cap lands at columns 6-9, rows 0-3.
    for (let y = 0; y < 4; y += 1) {
      for (let x = 6; x < 10; x += 1) expect(pixelAt(icon, x, y)).toEqual([0, 200, 0, 255]);
    }
    // Pole lands at columns 7-8, rows 4-15.
    for (let y = 4; y < 16; y += 1) {
      for (let x = 7; x < 9; x += 1) expect(pixelAt(icon, x, y)).toEqual([0, 0, 200, 255]);
    }
    // Everywhere else is transparent.
    expect(pixelAt(icon, 0, 0)).toEqual([0, 0, 0, 0]);
    expect(pixelAt(icon, 15, 15)).toEqual([0, 0, 0, 0]);
    expect(pixelAt(icon, 6, 4)).toEqual([0, 0, 0, 0]);
  });
});

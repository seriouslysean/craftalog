import { PNG } from "pngjs";
import { describe, expect, it } from "vitest";
import { generateLightningRodIcon } from "../scripts/lib/lightning-rod-icon.ts";

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

describe("generateLightningRodIcon", () => {
  it("crops the top cap and side strip UV regions and upscales each to 16x16", () => {
    const pixels = new Map<string, [number, number, number, number]>();
    // Top cap region [0,0]-[4,4): solid green.
    for (let y = 0; y < 4; y += 1) {
      for (let x = 0; x < 4; x += 1) pixels.set(`${x},${y}`, [0, 200, 0, 255]);
    }
    // Side strip region [0,4]-[2,16): solid blue.
    for (let y = 4; y < 16; y += 1) {
      for (let x = 0; x < 2; x += 1) pixels.set(`${x},${y}`, [0, 0, 200, 255]);
    }
    // Padding outside both regions (e.g. columns 4-15) stays transparent and must be ignored.
    const atlas = buildAtlas(pixels);

    const { top, side } = generateLightningRodIcon(atlas);
    const topPng = PNG.sync.read(top);
    const sidePng = PNG.sync.read(side);

    expect(topPng.width).toBe(16);
    expect(topPng.height).toBe(16);
    expect(sidePng.width).toBe(16);
    expect(sidePng.height).toBe(16);

    for (let i = 0; i < topPng.data.length; i += 4) {
      expect([topPng.data[i], topPng.data[i + 1], topPng.data[i + 2], topPng.data[i + 3]]).toEqual([
        0, 200, 0, 255,
      ]);
    }
    for (let i = 0; i < sidePng.data.length; i += 4) {
      expect([
        sidePng.data[i],
        sidePng.data[i + 1],
        sidePng.data[i + 2],
        sidePng.data[i + 3],
      ]).toEqual([0, 0, 200, 255]);
    }
  });
});

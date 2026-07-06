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

function pixelAt(png: PNG, x: number, y: number): [number, number, number, number] {
  const idx = (png.width * y + x) * 4;
  return [png.data[idx], png.data[idx + 1], png.data[idx + 2], png.data[idx + 3]];
}

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

    const icon = PNG.sync.read(generateLightningRodIcon(atlas));

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

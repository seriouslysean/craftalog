import { PNG } from "pngjs";
import { describe, expect, it } from "vitest";
import { generateBannerIcon } from "../scripts/lib/banner-icon.ts";

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

describe("generateBannerIcon", () => {
  it("crops to the opaque front-face region and tints it with the wool's average color", () => {
    // 6-wide base: a 2x2 opaque white square at (0,0)-(1,1) is the "front face";
    // columns 2-5 are opaque too but outside the front-face search width and must be ignored.
    const width = 6;
    const height = 2;
    const basePixels: [number, number, number, number][] = [];
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        basePixels.push(x < 2 ? [200, 200, 200, 255] : [0, 0, 0, 0]);
      }
    }
    const base = buildPng(width, height, basePixels);

    // Solid red wool texture (with one transparent pixel that must not skew the average).
    const wool = buildPng(2, 2, [
      [200, 0, 0, 255],
      [200, 0, 0, 255],
      [200, 0, 0, 255],
      [0, 0, 0, 0],
    ]);

    const icon = PNG.sync.read(generateBannerIcon(base, wool));

    expect(icon.width).toBe(2);
    expect(icon.height).toBe(2);
    for (let i = 0; i < icon.data.length; i += 4) {
      // 200/255 intensity * pure red (200,0,0) tint => round(156.86) = 157, alpha preserved.
      expect(icon.data[i]).toBe(157);
      expect(icon.data[i + 1]).toBe(0);
      expect(icon.data[i + 2]).toBe(0);
      expect(icon.data[i + 3]).toBe(255);
    }
  });
});

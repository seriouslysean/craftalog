import { PNG } from "pngjs";
import { describe, expect, it } from "vitest";
import { generatePatternedBannerIcon } from "../scripts/lib/patterned-banner-icon.ts";

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

describe("generatePatternedBannerIcon", () => {
  it("tints the base white and the pattern black-ish, then composites the pattern over the base, blending partial alpha", () => {
    // Base atlas: 3 opaque grayscale pixels, intensities 200/200/100.
    const bannerBase = buildPng(3, 1, [
      [200, 200, 200, 255],
      [200, 200, 200, 255],
      [100, 100, 100, 255],
    ]);
    // White wool -- tint multiplier of exactly 1, so the base's own
    // intensity carries through unchanged (keeps the expected math simple).
    const baseWool = buildPng(1, 1, [[255, 255, 255, 255]]);

    // Pattern atlas: pixel 0 fully transparent (nothing drawn there --
    // base must show through completely untouched), pixel 1 fully opaque,
    // pixel 2 half-opaque, both intensity 100.
    const pattern = buildPng(3, 1, [
      [100, 100, 100, 0],
      [100, 100, 100, 255],
      [100, 100, 100, 128],
    ]);
    // An arbitrary, non-white tint so the multiply is verifiable (real
    // usage tints with black_wool's average, close to but not exactly
    // (0,0,0) -- this fixture stands in with a distinguishable color).
    const patternWool = buildPng(1, 1, [[50, 100, 150, 255]]);

    const icon = PNG.sync.read(
      generatePatternedBannerIcon(bannerBase, pattern, baseWool, patternWool),
    );

    // Pixel 0: pattern fully transparent -- tinted base (200 * 1 = 200) shows through untouched.
    expect([icon.data[0], icon.data[1], icon.data[2], icon.data[3]]).toEqual([200, 200, 200, 255]);

    // Pixel 1: pattern fully opaque -- shows the pattern's own tinted color.
    // round(100/255*50) = 20, round(100/255*100) = 39, round(100/255*150) = 59.
    expect([icon.data[4], icon.data[5], icon.data[6], icon.data[7]]).toEqual([20, 39, 59, 255]);

    // Pixel 2: pattern at alpha 128/255 over a tinted base of (100,100,100).
    // R: round((20*128 + 100*127) / 255) = round(15260/255) = 60
    // G: round((39*128 + 100*127) / 255) = round(17692/255) = 69
    // B: round((59*128 + 100*127) / 255) = round(20252/255) = 79
    // A: round(max(1, 128/255) * 255) = 255 (base is fully opaque).
    expect([icon.data[8], icon.data[9], icon.data[10], icon.data[11]]).toEqual([60, 69, 79, 255]);
  });
});

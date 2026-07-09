import { PNG } from "pngjs";
import { describe, expect, it } from "vitest";
import { generateLeatherArmorIcon } from "../scripts/lib/leather-armor-icon.ts";

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

describe("generateLeatherArmorIcon", () => {
  it("tints the grayscale base with the default leather color and composites the overlay on top, blending partial alpha", () => {
    // Uniform opaque grayscale base (intensity 200) across all 3 pixels.
    const layer0 = buildPng(3, 1, [
      [200, 200, 200, 255],
      [200, 200, 200, 255],
      [200, 200, 200, 255],
    ]);

    // Overlay: fully transparent, fully opaque, and half-opaque, same color everywhere it shows.
    const layer1 = buildPng(3, 1, [
      [50, 100, 150, 0],
      [50, 100, 150, 255],
      [50, 100, 150, 128],
    ]);

    const icon = PNG.sync.read(generateLeatherArmorIcon(layer0, layer1));

    // Pixel 0: overlay fully transparent -- tinted base shows through untouched.
    // 200/255 intensity * default leather color (160,101,64):
    // round(200/255*160) = round(125.49) = 125
    // round(200/255*101) = round(79.22)  = 79
    // round(200/255*64)  = round(50.20)  = 50
    expect([icon.data[0], icon.data[1], icon.data[2], icon.data[3]]).toEqual([125, 79, 50, 255]);

    // Pixel 1: overlay fully opaque -- shows the overlay's own untinted color.
    expect([icon.data[4], icon.data[5], icon.data[6], icon.data[7]]).toEqual([50, 100, 150, 255]);

    // Pixel 2: overlay at alpha 128/255 -- src-over blend of overlay onto the tinted base.
    // R: round(50*128/255 + 125*127/255) = round(22275/255) = round(87.35) = 87
    // G: round(100*128/255 + 79*127/255) = round(22833/255) = round(89.54) = 90
    // B: round(150*128/255 + 50*127/255) = round(25550/255) = round(100.20) = 100
    // A: round(max(1, 128/255)*255) = 255 (base is fully opaque)
    expect([icon.data[8], icon.data[9], icon.data[10], icon.data[11]]).toEqual([87, 90, 100, 255]);
  });
});

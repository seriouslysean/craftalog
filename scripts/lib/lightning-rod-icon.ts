import { PNG } from "pngjs";

/**
 * `block/template_lightning_rod.json` (shared by every oxidation variant)
 * packs its two-element geometry into one texture instead of a paintable
 * per-face surface: a 4x4 top cap at [0,0] and a 2x12 side strip at [0,4].
 * These are its exact UV rects.
 */
const TOP_UV = { x: 0, y: 0, width: 4, height: 4 };
const SIDE_UV = { x: 0, y: 4, width: 2, height: 12 };

interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

function crop(png: PNG, rect: Rect): PNG {
  const cropped = new PNG({ width: rect.width, height: rect.height });
  PNG.bitblt(png, cropped, rect.x, rect.y, rect.width, rect.height, 0, 0);
  return cropped;
}

/** Nearest-neighbor upscale to `size`x`size` — keeps the pixel-art look sharp instead of blurring a tiny crop. */
function upscale(png: PNG, size: number): PNG {
  const out = new PNG({ width: size, height: size });
  for (let y = 0; y < size; y += 1) {
    const srcY = Math.floor((y / size) * png.height);
    for (let x = 0; x < size; x += 1) {
      const srcX = Math.floor((x / size) * png.width);
      const srcIdx = (png.width * srcY + srcX) * 4;
      const destIdx = (size * y + x) * 4;
      out.data[destIdx] = png.data[srcIdx];
      out.data[destIdx + 1] = png.data[srcIdx + 1];
      out.data[destIdx + 2] = png.data[srcIdx + 2];
      out.data[destIdx + 3] = png.data[srcIdx + 3];
    }
  }
  return out;
}

/**
 * Generates the top/side cube-face icons for a lightning rod variant by
 * cropping its two real UV regions out of the shared atlas texture and
 * upscaling each to a full 16x16 face, instead of showing the atlas
 * unclipped as a flat icon (a sliver of content jammed in one corner).
 */
export function generateLightningRodIcon(atlasPng: Buffer): { top: Buffer; side: Buffer } {
  const atlas = PNG.sync.read(atlasPng);
  const top = upscale(crop(atlas, TOP_UV), 16);
  const side = upscale(crop(atlas, SIDE_UV), 16);
  return { top: PNG.sync.write(top), side: PNG.sync.write(side) };
}

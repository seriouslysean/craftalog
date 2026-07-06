import { PNG } from "pngjs";

/**
 * Banner colors render in-game via a 3D model: a single grayscale template
 * (`entity/banner/banner_base.png`) tinted per dye color, plus optional
 * pattern layers. Plain colored banners have no patterns, so cropping the
 * template's front-facing region and tinting it with the dye's color
 * reproduces the in-game look as a flat icon.
 *
 * The front-facing flag (plus its bottom fringe) occupies the left portion
 * of the 64x64 template; the remaining width holds the pole/edge faces used
 * for the 3D model and isn't part of the flat icon.
 */
const FRONT_FACE_SEARCH_WIDTH = 44;

interface BoundingBox {
  minX: number;
  minY: number;
  width: number;
  height: number;
}

function opaqueBoundingBox(png: PNG, searchWidth: number): BoundingBox {
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;

  for (let y = 0; y < png.height; y += 1) {
    for (let x = 0; x < Math.min(searchWidth, png.width); x += 1) {
      const alpha = png.data[(png.width * y + x) * 4 + 3];
      if (alpha === 0) continue;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }

  return { minX, minY, width: maxX - minX + 1, height: maxY - minY + 1 };
}

function crop(png: PNG, box: BoundingBox): PNG {
  const cropped = new PNG({ width: box.width, height: box.height });
  PNG.bitblt(png, cropped, box.minX, box.minY, box.width, box.height, 0, 0);
  return cropped;
}

/** Average color of a texture's opaque pixels, used as the banner's tint color. */
function averageOpaqueColor(png: PNG): [r: number, g: number, b: number] {
  let r = 0;
  let g = 0;
  let b = 0;
  let count = 0;

  for (let i = 0; i < png.data.length; i += 4) {
    if (png.data[i + 3] === 0) continue;
    r += png.data[i];
    g += png.data[i + 1];
    b += png.data[i + 2];
    count += 1;
  }

  if (count === 0) return [255, 255, 255];
  return [Math.round(r / count), Math.round(g / count), Math.round(b / count)];
}

/** Multiplies each opaque pixel's grayscale intensity by the tint color, alpha untouched. */
function tint(png: PNG, [tintR, tintG, tintB]: [number, number, number]): void {
  for (let i = 0; i < png.data.length; i += 4) {
    if (png.data[i + 3] === 0) continue;
    png.data[i] = Math.round((png.data[i] / 255) * tintR);
    png.data[i + 1] = Math.round((png.data[i + 1] / 255) * tintG);
    png.data[i + 2] = Math.round((png.data[i + 2] / 255) * tintB);
  }
}

/**
 * Generates a flat banner icon by cropping the vanilla banner template to
 * its front-facing region and tinting it with the wool texture's average
 * color for the same dye color.
 */
export function generateBannerIcon(bannerBasePng: Buffer, woolPng: Buffer): Buffer {
  const base = PNG.sync.read(bannerBasePng);
  const wool = PNG.sync.read(woolPng);

  const box = opaqueBoundingBox(base, FRONT_FACE_SEARCH_WIDTH);
  const icon = crop(base, box);
  tint(icon, averageOpaqueColor(wool));

  return PNG.sync.write(icon);
}

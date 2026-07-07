import { PNG } from "pngjs";

/**
 * Banner colors render in-game via a 3D model (`BannerFlagModel`), not a flat
 * sprite: a 20x40x1 flag cuboid textured from `entity/banner/banner_base.png`
 * via the standard box UV unwrap (`texOffs(0, 0).addBox(-10, 0, -2, 20, 40, 1)`
 * in the decompiled model source), tinted per dye color, plus optional pattern
 * layers. Plain colored banners have no patterns, so cropping just the flag's
 * front face out of that unwrap and tinting it with the dye's color reproduces
 * the in-game look as a flat icon.
 *
 * A box's front face sits at the unwrap origin offset by the box's own depth
 * (1px) on both axes, sized to the box's width x height (20x40) -- the rest of
 * the 64x64 template holds the flag's other faces plus the crossbar/pole
 * geometry, none of which belong in a flat icon crop. The true aspect ratio
 * (1:2, tall) only comes through once the crop stops at the front face; the
 * previous alpha-bounding-box approach swept up the adjacent back/side faces
 * too (they're opaque and touch the front face with no gap), which is why the
 * generated icon used to come out ~square instead of banner-shaped.
 */
interface BoundingBox {
  minX: number;
  minY: number;
  width: number;
  height: number;
}

const FLAG_FRONT_FACE: BoundingBox = { minX: 1, minY: 1, width: 20, height: 40 };

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
 * the flag's front face and tinting it with the wool texture's average
 * color for the same dye color.
 */
export function generateBannerIcon(bannerBasePng: Buffer, woolPng: Buffer): Buffer {
  const base = PNG.sync.read(bannerBasePng);
  const wool = PNG.sync.read(woolPng);

  const icon = crop(base, FLAG_FRONT_FACE);
  tint(icon, averageOpaqueColor(wool));

  return PNG.sync.write(icon);
}

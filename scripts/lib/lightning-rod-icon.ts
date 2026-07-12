import { PNG } from "pngjs";

import type { RawModelElement } from "./types.ts";

/**
 * `block/template_lightning_rod.json` (shared by every oxidation variant) is
 * a custom two-element model rather than a plain cube: a 4x4x4 cap at the
 * very top of the block's space, and a thin 2x2xN pole filling the rest
 * below it. Its "texture" is a UV atlas for that geometry, not a paintable
 * surface, so no flat/cube heuristic can resolve it correctly.
 *
 * The crop/placement math is DERIVED from the template model's own vendored
 * `elements` (see deriveLightningRodRegions below, called from
 * scripts/lib/model.ts's lightning_rod branch): each element's north-face
 * `uv` rect is the source crop, and its block-space from/to box is the
 * destination (x straight through; y flipped to image rows, since row 0 =
 * top = highest y). Placing the real crops at the real offsets reconstructs
 * the rod's actual silhouette (thin pole, wider cap) — no scaling needed,
 * since the model authors each uv rect exactly destination-sized (asserted
 * during derivation; a mismatch fails the derivation, and model.ts degrades
 * to the generic element-geometry path instead).
 */

/** One derived atlas crop + its placement on the 16x16 icon canvas, both in integer pixels. */
export interface AtlasRegion {
  src: { x: number; y: number; width: number; height: number };
  dest: { x: number; y: number };
}

const ICON_SIZE = 16;

/**
 * Derives the flat-icon reconstruction regions from the lightning rod
 * template model's own elements -- one region per element, source rect from
 * the north-face uv, destination from the element's block-space box (y
 * flipped to image rows). Returns undefined when any element can't be
 * derived (no north uv, a crop that isn't exactly destination-sized,
 * non-integer or out-of-canvas coordinates), so the caller can fall back to
 * the generic resolution path.
 */
export function deriveLightningRodRegions(elements: RawModelElement[]): AtlasRegion[] | undefined {
  const regions: AtlasRegion[] = [];

  for (const element of elements) {
    const northUv = element.faces?.north?.uv;
    if (!northUv) return undefined;
    const [u0, v0, u1, v1] = northUv;
    const width = u1 - u0;
    const height = v1 - v0;
    const destX = element.from[0];
    const destY = ICON_SIZE - element.to[1];

    const sameSizeAsDestination =
      width === element.to[0] - element.from[0] && height === element.to[1] - element.from[1];
    const integral = [u0, v0, width, height, destX, destY].every(Number.isInteger);
    const insideCanvas =
      width > 0 &&
      height > 0 &&
      destX >= 0 &&
      destY >= 0 &&
      destX + width <= ICON_SIZE &&
      destY + height <= ICON_SIZE;
    if (!sameSizeAsDestination || !integral || !insideCanvas) return undefined;

    regions.push({ src: { x: u0, y: v0, width, height }, dest: { x: destX, y: destY } });
  }

  return regions.length > 0 ? regions : undefined;
}

/**
 * Generates a flat lightning rod icon by placing the model's real UV regions
 * (cap + pole) onto a transparent canvas at their real model positions,
 * instead of showing the atlas unclipped (a sliver of content jammed in one
 * corner) or stretching it into a solid-looking cube.
 */
export function generateLightningRodIcon(atlasPng: Buffer, regions: AtlasRegion[]): Buffer {
  const atlas = PNG.sync.read(atlasPng);
  const icon = new PNG({ width: ICON_SIZE, height: ICON_SIZE });
  for (const { src, dest } of regions) {
    PNG.bitblt(atlas, icon, src.x, src.y, src.width, src.height, dest.x, dest.y);
  }
  return PNG.sync.write(icon);
}

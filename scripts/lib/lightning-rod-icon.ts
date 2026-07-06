import { PNG } from "pngjs";

/**
 * `block/template_lightning_rod.json` (shared by every oxidation variant) is
 * a custom two-element model rather than a plain cube: a 4x4x4 cap at the
 * very top of the block's space, and a thin 2x2xN pole filling the rest
 * below it. Its "texture" is a UV atlas for that geometry, not a paintable
 * surface, so no flat/cube heuristic can resolve it correctly.
 *
 * Both regions below are that model's own "north" face UV rects, and both
 * destinations are that model's own element bounding boxes (block-space y
 * flipped to image rows, since row 0 = top = highest y). Placing the real
 * crops at the real offsets reconstructs the rod's actual silhouette (thin
 * pole, wider cap) — no scaling needed, since each UV rect is already the
 * same size as its destination.
 */
const CAP_SRC = { x: 0, y: 0, width: 4, height: 4 };
const CAP_DEST = { x: 6, y: 0 };
const POLE_SRC = { x: 0, y: 4, width: 2, height: 12 };
const POLE_DEST = { x: 7, y: 4 };

const ICON_SIZE = 16;

/**
 * Generates a flat lightning rod icon by placing its two real UV regions
 * (cap + pole) onto a transparent canvas at their real model positions,
 * instead of showing the atlas unclipped (a sliver of content jammed in one
 * corner) or stretching it into a solid-looking cube.
 */
export function generateLightningRodIcon(atlasPng: Buffer): Buffer {
  const atlas = PNG.sync.read(atlasPng);
  const icon = new PNG({ width: ICON_SIZE, height: ICON_SIZE });
  PNG.bitblt(
    atlas,
    icon,
    CAP_SRC.x,
    CAP_SRC.y,
    CAP_SRC.width,
    CAP_SRC.height,
    CAP_DEST.x,
    CAP_DEST.y,
  );
  PNG.bitblt(
    atlas,
    icon,
    POLE_SRC.x,
    POLE_SRC.y,
    POLE_SRC.width,
    POLE_SRC.height,
    POLE_DEST.x,
    POLE_DEST.y,
  );
  return PNG.sync.write(icon);
}

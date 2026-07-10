import { PNG } from "pngjs";
import { tint } from "./banner-icon.ts";

/**
 * Leather armor's real in-game color comes from runtime dye tinting: the
 * game renders `layer0` (a grayscale base) multiplied by the equipped dye
 * color (default `0xA06540` when un-dyed), then composites `layer1`
 * (`*_overlay.png`, the stitching/trim detail) on top untinted. This static
 * icon pipeline has no equivalent of that runtime step -- it only ever
 * copied `layer0`'s raw grayscale bytes, which is why every leather armor
 * icon rendered as flat gray instead of the familiar brown leather. Baking
 * the default-color tint + overlay composite in at build time reproduces
 * the un-dyed in-game look as a static PNG.
 */
const DEFAULT_LEATHER_COLOR: [number, number, number] = [160, 101, 64];

/**
 * Composites `overlay` on top of `base` in place using standard src-over
 * alpha blending. Overlay textures aren't guaranteed binary alpha (one of
 * leather armor's 5 vanilla overlay textures ships as grayscale+alpha), so
 * this blends per-pixel rather than assuming a hard opaque/transparent edge.
 */
export function compositeOver(base: PNG, overlay: PNG): void {
  for (let i = 0; i < base.data.length; i += 4) {
    const overlayAlpha = overlay.data[i + 3] / 255;
    if (overlayAlpha === 0) continue;
    const baseAlpha = base.data[i + 3] / 255;

    for (let channel = 0; channel < 3; channel += 1) {
      base.data[i + channel] = Math.round(
        overlay.data[i + channel] * overlayAlpha + base.data[i + channel] * (1 - overlayAlpha),
      );
    }
    base.data[i + 3] = Math.round(Math.max(baseAlpha, overlayAlpha) * 255);
  }
}

/**
 * Generates a flat leather armor icon by tinting the grayscale base layer
 * with the default (un-dyed) leather color and compositing the untinted
 * trim overlay on top.
 */
export function generateLeatherArmorIcon(layer0Png: Buffer, layer1Png: Buffer): Buffer {
  const base = PNG.sync.read(layer0Png);
  const overlay = PNG.sync.read(layer1Png);

  tint(base, DEFAULT_LEATHER_COLOR);
  compositeOver(base, overlay);

  return PNG.sync.write(base);
}

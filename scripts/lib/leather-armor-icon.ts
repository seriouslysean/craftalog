import { PNG } from "pngjs";
import { tint } from "./banner-icon.ts";

/**
 * Leather armor's real in-game color comes from runtime dye tinting: the
 * game renders `layer0` (a grayscale base) multiplied by the equipped dye
 * color, then composites `layer1` (`*_overlay.png`, the stitching/trim
 * detail) on top untinted. This static icon pipeline has no equivalent of
 * that runtime step -- it only ever copied `layer0`'s raw grayscale bytes,
 * which is why every leather armor icon rendered as flat gray instead of
 * the familiar brown leather. Baking the default-color tint + overlay
 * composite in at build time reproduces the un-dyed in-game look as a
 * static PNG. The un-dyed color itself is data, not a constant: each
 * leather item's own definition carries a `minecraft:dye` tint with a
 * `default` packed-ARGB int (-6265536 = 0xFFA06540 = rgb(160,101,64) at
 * the current pin) -- see scripts/lib/model.ts's findDyeTintDefault and
 * argbToRgb below.
 */

/** Unpacks a Java packed-ARGB color int (as vendored item definitions carry it, e.g. -6265536) to its [r, g, b] channels -- alpha is dropped (tinting never uses it). */
export function argbToRgb(argb: number): [number, number, number] {
  return [(argb >>> 16) & 0xff, (argb >>> 8) & 0xff, argb & 0xff];
}

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
 * with the item's own default (un-dyed) tint color -- read from its item
 * definition's `minecraft:dye` tint, see this file's docstring -- and
 * compositing the untinted trim overlay on top.
 */
export function generateLeatherArmorIcon(
  layer0Png: Buffer,
  layer1Png: Buffer,
  color: [number, number, number],
): Buffer {
  const base = PNG.sync.read(layer0Png);
  const overlay = PNG.sync.read(layer1Png);

  tint(base, color);
  compositeOver(base, overlay);

  return PNG.sync.write(base);
}

import { PNG } from "pngjs";

/**
 * Crops a vertical animation strip down to its first frame.
 *
 * Animated block textures (stonecutter_saw, sculk_sensor_tendril_*, magma,
 * sea_lantern, ...) ship as a vertical strip of square frames (a 16-wide
 * texture with N frames is 16xN*16) plus a .png.mcmeta timing file. This
 * catalog's icons are static, and every icon renderer sizes textures
 * assuming a single square frame: ItemIcon.astro's computeUvCrop maps a
 * face's 0-16 uv space across the full image (a strip passed through
 * untouched renders as multiple vertically-squashed frames -- the
 * stonecutter saw bug), and flat/cube icons object-fit a square slot.
 * Cropping at copy time keeps that square-frame invariant pipeline-wide
 * instead of teaching every consumer about frame counts.
 *
 * Height <= width passes the source through byte-identical -- square
 * textures of any resolution (e.g. the 32x32 shelves) are never strips.
 */
export function firstAnimationFrame(source: Buffer): Buffer {
  const png = PNG.sync.read(source);
  if (png.height <= png.width) return source;
  const frame = new PNG({ width: png.width, height: png.width });
  PNG.bitblt(png, frame, 0, 0, png.width, png.width, 0, 0);
  return PNG.sync.write(frame);
}

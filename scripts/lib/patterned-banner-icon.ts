import { PNG } from "pngjs";
import { averageOpaqueColor, tint } from "./banner-icon.ts";
import { compositeOver } from "./leather-armor-icon.ts";

/**
 * Generates a patterned banner's flag atlas: a white base tinted from
 * `baseWoolPng`'s average color, with the pattern layer (tinted from
 * `patternWoolPng`'s average color) composited on top. Every pattern
 * texture (`entity/banner/<id>.png`) shares the exact same 64x64 UV layout
 * as `banner_base.png` -- vanilla itself renders a patterned banner this
 * way, tinting and layering atlases rather than compositing a flat sprite --
 * so this is the same tint() this file's banner-icon.ts sibling already
 * uses for plain banners, applied twice and composited once via the same
 * compositeOver() leather armor already uses for its overlay layer.
 * bannerCompoundIcon's existing uv crops then pull the flag's front-face
 * region out of this one composited atlas exactly like every other banner.
 */
export function generatePatternedBannerIcon(
  bannerBasePng: Buffer,
  patternPng: Buffer,
  baseWoolPng: Buffer,
  patternWoolPng: Buffer,
): Buffer {
  const base = PNG.sync.read(bannerBasePng);
  const pattern = PNG.sync.read(patternPng);

  tint(base, averageOpaqueColor(PNG.sync.read(baseWoolPng)));
  tint(pattern, averageOpaqueColor(PNG.sync.read(patternWoolPng)));
  compositeOver(base, pattern);

  return PNG.sync.write(base);
}

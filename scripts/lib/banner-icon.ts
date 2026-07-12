import { PNG } from "pngjs";

import { faceWith } from "./compound-icon.ts";
import type { CompoundIcon } from "./types.ts";

/**
 * Banners render in-game via a 3D entity model (`BannerModel`), not a flat
 * sprite or a vendored block model -- template_banner.json / block/banner.json
 * carry only `textures`/`display`, zero `elements`. The geometry below is
 * therefore hand-authored for the "compound" icon engine
 * (ItemIcon.astro's computeFaceStyle/computeUvCrop), from three sources of
 * differing confidence:
 *
 * 1. CITED -- the flag box: `texOffs(0, 0).addBox(-10, 0, -2, 20, 40, 1)`
 *    (decompiled model source, quoted here since the original flat-icon
 *    implementation).
 * 2. ATLAS-VERIFIED -- the pole (2x42x2 @ texOffs 44,0) and crossbar
 *    (20x2x2 @ texOffs 0,42) box dimensions: probing
 *    entity/banner/banner_base.png's alpha channel shows exactly three
 *    opaque regions, each matching the standard box-UV unwrap
 *    (width 2*(depth+width), height depth+height, top/bottom strips inset
 *    by depth) for exactly those dimensions at exactly those offsets:
 *    flag cols 0-41 rows 0-40, pole cols 44-51 rows 0-43 (top/bottom pair
 *    at cols 46-49 rows 0-1), crossbar cols 0-43 rows 42-45 (top/bottom at
 *    cols 2-41 rows 42-43). No other layout fits.
 * 3. HAND-AUTHORED -- the boxes' relative placement (pole centered on the
 *    block, crossbar sitting on the pole's top spanning the flag's width,
 *    flag hanging from the crossbar down the camera-facing side of the
 *    pole) and the 16/44 scale that fits the 44-unit-tall assembly into
 *    the engine's 0-16 reference cube. Vanilla's own renderer composes
 *    these via per-part entity transforms (including a negative-z scale
 *    flip), so the raw addBox origins aren't directly usable -- placement
 *    is derived to match the in-game standing banner / inventory icon
 *    appearance instead.
 *
 * Tinting matches vanilla's split, confirmed by the atlas pixels
 * themselves: the flag's unwrap region is near-white grayscale (a tint
 * target), while the pole/crossbar regions ship pre-colored wood-brown
 * (rendered untinted). So the flag's faces sample a per-dye-color tinted
 * copy of the atlas and the pole/crossbar faces sample an untinted shared
 * copy -- see generateBannerAtlas + scripts/parse.ts's banner loop.
 */

/** Vendor texture ref of the shared banner template atlas (64x64, all three boxes' UV unwraps). */
export const BANNER_TEMPLATE_TEXTURE_REF = "entity/banner/banner_base";

/**
 * The atlas pixel dimensions this file's hand-authored uv crops (uvPx's
 * 64x64 assumption) were verified against. generate.ts checks the real
 * vendored atlas still matches and degrades the icon (placeholder +
 * meta.audit.degradedIcons) on a mismatch, instead of silently stretching
 * wrong crops over the geometry.
 */
export const BANNER_ATLAS_SIZE = { width: 64, height: 64 } as const;

/**
 * The banner special renderer's base model ref ("minecraft:" stripped) --
 * every colored banner item's own definition names it as `base`, and it
 * carries the vendored `display.gui.rotation` ([30, 20, 0] at the current
 * pin) the icon's extra yaw is derived from (yaw 20 - default 225 = -205,
 * via scripts/lib/model.ts's findGuiYawDelta). Exported so generate.ts can
 * run the identical derivation for SYNTHETIC patterned-banner entries,
 * which have no vanilla item definition of their own to read `base` from.
 * Net effect of the derived yaw: the flag shows nearly face-on (its south
 * face), turned ~20deg, matching the vanilla inventory icon's
 * angled-flag-plus-pole look. (The gui transform's translation/scale are
 * ignored -- the engine's --icon-scale containment already normalizes size,
 * same as every other compound icon.)
 */
export const BANNER_BASE_MODEL_REF = "item/template_banner";

/** Generated texture ref for the untinted atlas copy the pole/crossbar faces sample. */
export const BANNER_BASE_ATLAS_REF = "item/banner_base";

/** 16 model units / 44 native units: pole (42) + crossbar (2) stacked is the assembly's full height. */
const SCALE = 16 / 44;

/** Rounds to 4 decimals so the generated JSON stays compact and stable. */
export function round4(n: number): number {
  return Math.round(n * 10000) / 10000;
}

/**
 * Converts a pixel rect on an atlas of the given real pixel dimensions to
 * this engine's own uv convention: a PER-AXIS 0-16 space where 16 units
 * always represents that axis's full image span, independent of the other
 * axis and independent of the atlas's real resolution (see
 * ItemIcon.astro's computeUvCrop, which stretches the referenced texture
 * file to fill exactly that normalized space via CSS background-size
 * percentages). `uvPx` below is the common case of this for a square 64x64
 * atlas (every hand-authored compound icon before scripts/lib/head-icon.ts
 * happened to use one); non-square vendored atlases (e.g. a 64x32 legacy
 * mob-skin texture) need the real width/height threaded through instead,
 * since x and y need different divisors.
 */
export function uvPxOnAtlas(
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  atlasWidth: number,
  atlasHeight: number,
): [number, number, number, number] {
  return [
    round4((x0 * 16) / atlasWidth),
    round4((y0 * 16) / atlasHeight),
    round4((x1 * 16) / atlasWidth),
    round4((y1 * 16) / atlasHeight),
  ];
}

/** Converts a pixel rect on a 64x64 atlas to the engine's 0-16 uv space (16/64 = exact quarters). */
export function uvPx(
  x0: number,
  y0: number,
  x1: number,
  y1: number,
): [number, number, number, number] {
  return uvPxOnAtlas(x0, y0, x1, y1, 64, 64);
}

/**
 * Builds the banner "compound" icon: pole + crossbar (untinted shared
 * atlas) + hanging flag (per-color tinted atlas). Coordinates are the
 * native entity-model units scaled by 16/44 into the engine's 0-16 cube,
 * centered on x/z = 8; the flag hangs against the pole's south face (the
 * side `guiYawDelta` turns toward the camera) with its bottom edge
 * 2 native units above the ground, mirroring the in-game standing banner.
 * `guiYawDelta` is derived from the item's own base model chain (see
 * BANNER_BASE_MODEL_REF's doc comment) rather than hardcoded here.
 */
export function bannerCompoundIcon(
  flagTexturePath: string,
  baseTexturePath: string,
  guiYawDelta: number,
): CompoundIcon {
  const flag = faceWith(flagTexturePath);
  const base = faceWith(baseTexturePath);

  const poleTop = round4(42 * SCALE);
  const poleHalf = round4(SCALE); // pole cross-section is 2 units wide, centered
  const flagHalf = round4(10 * SCALE); // flag/crossbar are 20 units wide, centered

  return {
    type: "compound",
    yRotation: guiYawDelta,
    // Tells ItemIcon.astro to use the banner-specific --icon-scale instead
    // of the generic cube-calibrated one -- this assembly's real footprint
    // (thin flag/pole, not a full 16x16x16 box) projects much smaller under
    // the shared safety-floor scale, which measurably rendered "tiny" in the
    // box (see .item-icon--banner's derivation comment in ItemIcon.astro).
    variant: "banner",
    elements: [
      // Pole: 2x42x2, centered on the block, ground to crossbar. No "up"
      // face: the crossbar's down face sits exactly coplanar on top of it
      // (both at y = poleTop, pole footprint fully inside the bar's), so
      // declaring both z-fights -- confirmed as a flickering dark notch on
      // the rendered crossbar before this face was dropped. Same reasoning
      // drops "south" here: the flag's north (back) face sits exactly
      // coplanar with it (both at z = 8+poleHalf, pole footprint fully
      // inside the flag's much wider one), and the flag hangs directly in
      // front of this face regardless -- confirmed as a static pole-colored
      // vertical line bisecting the rendered flag before this face was
      // dropped (worst-case visible on white_banner's near-white flag).
      {
        from: [round4(8 - poleHalf), 0, round4(8 - poleHalf)],
        to: [round4(8 + poleHalf), poleTop, round4(8 + poleHalf)],
        faces: {
          down: base(uvPx(48, 0, 50, 2)),
          west: base(uvPx(44, 2, 46, 44)),
          north: base(uvPx(46, 2, 48, 44)),
          east: base(uvPx(48, 2, 50, 44)),
        },
      },
      // Crossbar: 20x2x2, sitting on the pole's top, spanning the flag's width.
      {
        from: [round4(8 - flagHalf), poleTop, round4(8 - poleHalf)],
        to: [round4(8 + flagHalf), 16, round4(8 + poleHalf)],
        faces: {
          up: base(uvPx(2, 42, 22, 44)),
          down: base(uvPx(22, 42, 42, 44)),
          west: base(uvPx(0, 44, 2, 46)),
          south: base(uvPx(2, 44, 22, 46)),
          east: base(uvPx(22, 44, 24, 46)),
          north: base(uvPx(24, 44, 44, 46)),
        },
      },
      // Flag: 20x40x1, hanging from the crossbar against the pole's south
      // face, stopping 2 native units short of the ground. South face is
      // the flag front crop (the face the gui yaw turns toward the camera).
      // No "north" (back) face: it's the interior surface facing the pole,
      // never visible from outside the assembly under any of this camera's
      // rotations -- confirmed as a ghosting/double-image artifact on the
      // rendered cloth (two near-identical, slightly offset crops of the
      // same texture both painting) before this face was dropped, worst-case
      // visible on white_banner's near-white flag. Unlike the pole's dropped
      // up/south faces, this isn't an exactly-coplanar pair (the flag is a
      // genuine 1-unit-thick box, so its own north and south sit at
      // different depths) -- but at this icon's tiny rendered size the two
      // near-parallel, near-fully-overlapping faces are close enough that
      // the browser's 3D depth-sort doesn't reliably order them, so the
      // fix is the same: don't declare the face that's never meant to be
      // seen anyway.
      {
        from: [round4(8 - flagHalf), round4(2 * SCALE), round4(8 + poleHalf)],
        to: [round4(8 + flagHalf), poleTop, round4(8 + poleHalf + SCALE)],
        faces: {
          up: flag(uvPx(1, 0, 21, 1)),
          down: flag(uvPx(21, 0, 41, 1)),
          west: flag(uvPx(0, 1, 1, 41)),
          east: flag(uvPx(21, 1, 22, 41)),
          south: flag(uvPx(1, 1, 21, 41)),
        },
      },
    ],
  };
}

/** Average color of a texture's opaque pixels, used as the banner's tint color. */
export function averageOpaqueColor(png: PNG): [r: number, g: number, b: number] {
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
export function tint(png: PNG, [tintR, tintG, tintB]: [number, number, number]): void {
  for (let i = 0; i < png.data.length; i += 4) {
    if (png.data[i + 3] === 0) continue;
    png.data[i] = Math.round((png.data[i] / 255) * tintR);
    png.data[i + 1] = Math.round((png.data[i + 1] / 255) * tintG);
    png.data[i + 2] = Math.round((png.data[i + 2] / 255) * tintB);
  }
}

/**
 * Generates a dye-colored copy of the full banner template atlas by tinting
 * every opaque pixel with the same dye's wool texture's average color. The
 * flag's faces uv-crop their regions out of this tinted copy; the tint also
 * covers the pole/crossbar regions of this file, but nothing samples those
 * from the tinted copy (they sample the untinted BANNER_BASE_ATLAS_REF).
 */
export function generateBannerAtlas(bannerBasePng: Buffer, woolPng: Buffer): Buffer {
  const atlas = PNG.sync.read(bannerBasePng);
  const wool = PNG.sync.read(woolPng);

  tint(atlas, averageOpaqueColor(wool));

  return PNG.sync.write(atlas);
}

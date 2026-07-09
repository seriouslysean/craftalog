import { PNG } from "pngjs";

import type { IconOutput } from "./types.ts";

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
type CompoundIcon = Extract<IconOutput, { type: "compound" }>;
type CompoundFace = NonNullable<CompoundIcon["elements"][number]["faces"]["up"]>;

/** Vendor texture ref of the shared banner template atlas (64x64, all three boxes' UV unwraps). */
export const BANNER_TEMPLATE_TEXTURE_REF = "entity/banner/banner_base";

/** Generated texture ref for the untinted atlas copy the pole/crossbar faces sample. */
export const BANNER_BASE_ATLAS_REF = "item/banner_base";

/**
 * Extra GUI yaw for banner icons, on top of the compound camera's default:
 * template_banner.json declares `display.gui.rotation: [30, 20, 0]` where
 * the inherited block default is [30, 225, 0], so the delta is 20 - 225 =
 * -205 -- the same guiYaw-minus-default formula scripts/lib/model.ts's
 * findGuiYawDelta applies to vendored element models. Net effect: the flag
 * shows nearly face-on (its south face), turned ~20deg, matching the
 * vanilla inventory icon's angled-flag-plus-pole look. (The gui transform's
 * translation/scale are ignored -- the engine's --icon-scale containment
 * already normalizes size, same as every other compound icon.)
 */
const BANNER_GUI_YAW_DELTA = -205;

/** 16 model units / 44 native units: pole (42) + crossbar (2) stacked is the assembly's full height. */
const SCALE = 16 / 44;

/** Rounds to 4 decimals so the generated JSON stays compact and stable. */
function round4(n: number): number {
  return Math.round(n * 10000) / 10000;
}

/** Converts a pixel rect on the 64x64 atlas to the engine's 0-16 uv space (16/64 = exact quarters). */
function uvPx(x0: number, y0: number, x1: number, y1: number): [number, number, number, number] {
  return [x0 / 4, y0 / 4, x1 / 4, y1 / 4];
}

/**
 * Builds the banner "compound" icon: pole + crossbar (untinted shared
 * atlas) + hanging flag (per-color tinted atlas). Coordinates are the
 * native entity-model units scaled by 16/44 into the engine's 0-16 cube,
 * centered on x/z = 8; the flag hangs against the pole's south face (the
 * side BANNER_GUI_YAW_DELTA turns toward the camera) with its bottom edge
 * 2 native units above the ground, mirroring the in-game standing banner.
 */
export function bannerCompoundIcon(flagTexturePath: string, baseTexturePath: string): CompoundIcon {
  const flag = (uv: [number, number, number, number]): CompoundFace => ({
    texture: flagTexturePath,
    uv,
  });
  const base = (uv: [number, number, number, number]): CompoundFace => ({
    texture: baseTexturePath,
    uv,
  });

  const poleTop = round4(42 * SCALE);
  const poleHalf = round4(SCALE); // pole cross-section is 2 units wide, centered
  const flagHalf = round4(10 * SCALE); // flag/crossbar are 20 units wide, centered

  return {
    type: "compound",
    yRotation: BANNER_GUI_YAW_DELTA,
    elements: [
      // Pole: 2x42x2, centered on the block, ground to crossbar. No "up"
      // face: the crossbar's down face sits exactly coplanar on top of it
      // (both at y = poleTop, pole footprint fully inside the bar's), so
      // declaring both z-fights -- confirmed as a flickering dark notch on
      // the rendered crossbar before this face was dropped.
      {
        from: [round4(8 - poleHalf), 0, round4(8 - poleHalf)],
        to: [round4(8 + poleHalf), poleTop, round4(8 + poleHalf)],
        faces: {
          down: base(uvPx(48, 0, 50, 2)),
          west: base(uvPx(44, 2, 46, 44)),
          north: base(uvPx(46, 2, 48, 44)),
          east: base(uvPx(48, 2, 50, 44)),
          south: base(uvPx(50, 2, 52, 44)),
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
      {
        from: [round4(8 - flagHalf), round4(2 * SCALE), round4(8 + poleHalf)],
        to: [round4(8 + flagHalf), poleTop, round4(8 + poleHalf + SCALE)],
        faces: {
          up: flag(uvPx(1, 0, 21, 1)),
          down: flag(uvPx(21, 0, 41, 1)),
          west: flag(uvPx(0, 1, 1, 41)),
          east: flag(uvPx(21, 1, 22, 41)),
          south: flag(uvPx(1, 1, 21, 41)),
          north: flag(uvPx(22, 1, 42, 41)),
        },
      },
    ],
  };
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

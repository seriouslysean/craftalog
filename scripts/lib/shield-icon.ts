import { round4, uvPx } from "./banner-icon.ts";
import { faceWith } from "./compound-icon.ts";
import type { CompoundIcon } from "./types.ts";

/**
 * Shields render in-game via a bespoke Java renderer (`ShieldItemRenderer`),
 * not a vendored block model -- item/shield.json carries only `textures`/
 * `display`, zero `elements`. The geometry below is hand-authored for the
 * "compound" icon engine (ItemIcon.astro's computeFaceStyle/computeUvCrop),
 * from two sources of differing confidence:
 *
 * 1. ATLAS-VERIFIED -- the plate box (12x22x1 @ texOffs 0,0): probing
 *    entity/shield/shield_base_nopattern.png's alpha channel shows a
 *    26-column-wide, 23-row-tall opaque region matching the standard box-UV
 *    unwrap (width 2*(depth+width), height depth+height) for exactly those
 *    dimensions at that offset -- row 0 (the 1px-tall top/bottom cap band,
 *    depth=1) spans columns 1-24 (the un-antialiased cap edge; columns 0/25
 *    only appear from row 1 on), rows 1-22 (the height=22 side-face band)
 *    span columns 0-25. A second, separate opaque region -- a 16-wide,
 *    12-tall unwrap immediately to the right (columns 26-41, rows 0-11),
 *    only painted in its rows 6-11 side-face band -- matches a small 2x6x6
 *    handle/boss box at texOffs(26,0). This second box is deliberately
 *    dropped: see the "handle omission" note below.
 * 2. CITED -- the icon yaw: item/shield's own vendored `display.gui.rotation`
 *    is [15, -25, -5] (vendor/mcmeta-summary/assets/model/data.json). Yaw
 *    delta = -25 - 225 = -250, the same `findGuiYawDelta` formula
 *    scripts/lib/model.ts applies to every other vendored element model
 *    (matching this session's banner derivation, -205, for the same
 *    default-yaw-225 baseline). Pitch/roll are ignored -- the compound
 *    camera's pitch is fixed and shared across every icon type.
 *
 * Handle omission: the handle is a real part of the in-game model, but is
 * geometrically guaranteed invisible from this icon's fixed camera (35deg
 * pitch, ~25deg net yaw). Handle native extents are +-1 (x) / +-3 (y) vs the
 * plate's +-6 (x) / +-11 (y) -- a 5-unit x-margin and 8-unit y-margin. Worst
 * case the handle's rear face sits 9 native units behind the plate's front
 * plane; at this camera that projects to at most 9*tan(25deg) =~ 4.2 units
 * of horizontal parallax and 9*tan(35deg) =~ 6.3 units of vertical parallax
 * -- both comfortably inside the plate's margins on every side, for either
 * candidate handle z-origin. Declaring it anyway would only add the exact
 * multi-element near-coplanar z-fighting risk this session's banner work
 * needed three separate fixes for for zero visible benefit -- so it's left
 * out, matching the "don't declare a face that's never meant to be seen"
 * precedent already established for banner's pole/flag.
 *
 * No tinting: unlike banners (16 dye colors) or patterned banners (42
 * patterns x tint), there is exactly one `shield` item in the catalog --
 * shield_decoration's result is the same plain `shield`, not a colored
 * variant -- so this samples shield_base_nopattern.png (the pre-painted
 * wood-brown atlas) verbatim, no runtime tinting step at all.
 */

/** Vendor texture ref of the pre-painted, no-pattern shield atlas (64x64). */
export const SHIELD_TEMPLATE_TEXTURE_REF = "entity/shield/shield_base_nopattern";

/** Generated texture ref the icon's faces sample -- a verbatim copy of the template (see scripts/parse.ts). */
export const SHIELD_ATLAS_REF = "item/shield_base_nopattern";

/**
 * Extra GUI yaw for the shield icon, on top of the compound camera's default
 * -135deg (see ItemIcon.astro's `.compound` rule): item/shield.json declares
 * `display.gui.rotation: [15, -25, -5]` where the inherited block default is
 * [30, 225, 0], so the yaw delta is -25 - 225 = -250.
 */
const SHIELD_GUI_YAW_DELTA = -250;

/** 16 model units / 22 native units: the plate's own height is the assembly's full height. */
const SCALE = 16 / 22;

/**
 * Builds the shield "compound" icon: a single hand-authored plate box
 * (front, two rim edges, top strip -- see this file's docstring for why the
 * back face and the handle are both omitted). Coordinates are the native
 * entity-model units scaled by 16/22 into the engine's 0-16 cube, centered
 * on x/z = 8.
 */
export function shieldCompoundIcon(atlasTexturePath: string): CompoundIcon {
  const face = faceWith(atlasTexturePath);

  const halfWidth = round4(6 * SCALE);
  const halfDepth = round4(0.5 * SCALE);

  return {
    type: "compound",
    yRotation: SHIELD_GUI_YAW_DELTA,
    variant: "shield",
    elements: [
      {
        from: [round4(8 - halfWidth), 0, round4(8 - halfDepth)],
        to: [round4(8 + halfWidth), 16, round4(8 + halfDepth)],
        faces: {
          up: face(uvPx(1, 0, 13, 1)),
          west: face(uvPx(0, 1, 1, 23)),
          south: face(uvPx(1, 1, 13, 23)),
          east: face(uvPx(13, 1, 14, 23)),
        },
      },
    ],
  };
}

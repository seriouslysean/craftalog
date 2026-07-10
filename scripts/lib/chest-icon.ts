import { round4 } from "./banner-icon.ts";
import { faceUVs } from "./bedrock-geometry.ts";
import type { IconOutput } from "./types.ts";

/**
 * Chests (chest, trapped_chest, ender_chest, and the 4 copper tiers x
 * waxed/un-waxed) are `minecraft:special` entity-rendered items
 * (item/chest.json's `base` -- item/template_chest -- carries only a
 * tier-agnostic `particle` texture, zero `elements`) -- Java has no
 * data-side geometry for the shape at all, since Mojang hardcodes the mesh
 * in `ChestSpecialRenderer`/`ChestModel` (code, not data). Unlike the
 * copper golem statue, `vendor/bedrock-samples` has no chest geometry
 * either (searched resource_pack/models/entity/*.geo.json -- no match), so
 * this is the same "neither vendored source has real shape data" situation
 * banner/shield were in: hand-authored geometry for the "compound" icon
 * engine, from two sources of differing confidence:
 *
 * 1. ATLAS-VERIFIED -- the two boxes' width/height/depth and texture
 *    offsets: probing entity/chest/normal.png's alpha channel (every
 *    chest-family texture shares this exact layout -- confirmed on
 *    trapped/ender/copper/copper_exposed/copper_oxidized/copper_weathered
 *    too) shows two box-UV unwraps: a 14w x 5h x 14d box at texOffs(0,0)
 *    (rows 0-13 the top/bottom strip, cols 14-41; rows 14-18 the
 *    west/north/east/south side band, cols 0-55) and a 14w x 10h x 14d box
 *    at texOffs(0,19) (rows 19-32 top/bottom, cols 14-41; rows 33-42 side
 *    band, cols 0-55) -- exactly CHEST_LID_BOX / CHEST_BOTTOM_BOX below.
 *    A third, smaller unwrap (a 2w x 4h x 1d box at texOffs(0,0), reusing
 *    the lid's own top-left corner) is also present -- this is the small
 *    latch/lock clasp on the chest's front -- but is deliberately NOT
 *    modeled: its exact mounting face and depth aren't recoverable from a
 *    2D texture atlas alone (unlike lid/bottom, whose relative stacking is
 *    visually unambiguous), and it's a small enough decorative detail that
 *    omitting it carries the same "zero visible benefit, avoids
 *    unverifiable placement + z-fighting risk" reasoning shield's handle
 *    omission already established in this codebase.
 * 2. HAND-AUTHORED -- the two boxes' placement in the engine's 0-16
 *    reference cube: both share the same 14x14 (x/z) footprint, inset by 1
 *    unit on every side (matching this catalog's own pressure_plate/button
 *    inset convention, and a highly stable, long-unchanged vanilla visual
 *    fact -- a chest visibly doesn't touch its neighboring blocks' edges).
 *    The bottom sits on the ground (y 0-10, its own atlas-verified height);
 *    the lid sits on top with a deliberate 1-unit overlap (y 9-14, not
 *    10-15) so the closed assembly's total height is 14 of 16 units, not
 *    15 -- matching the general, long-stable "chest doesn't fill its full
 *    block height" appearance and avoiding a visible gap/seam at the
 *    lid/bottom boundary.
 *
 * Every face this file declares (all 6 per box, via the shared box-UV
 * `faceUVs` helper) is queued for the renderer, same as copper golem's
 * real-geometry elements -- no camera-facing-face cherry-picking like
 * shield's thin plate needed, since bottom+lid together nearly fill the
 * reference cube (a simple, non-concave stacked pair, not a thin
 * off-center assembly), so the "compound" element's normal preserve-3d
 * z-sorting handles visibility correctly with no manual face selection
 * (matching the "no culling pass" precedent already established for
 * anvil/grindstone/golem -- see scripts/lib/generate.ts's
 * resolveCompoundElements docstring).
 *
 * `yRotation: -180` is CITED directly from vendored data (not decompiled
 * Java source): item/template_chest.json's own `display.gui.rotation` is
 * [30, 45, 0] (vendor/mcmeta-summary/assets/model/data.json) -- the
 * inherited block default is [30, 225, 0], so the delta is 45 - 225 = -180,
 * the same `findGuiYawDelta` formula scripts/lib/model.ts applies to every
 * vendored element model (and the exact same [30, 45, 0] gui rotation
 * fence_gate's own template already uses -- see ItemIcon.astro's
 * `.fence-gate` camera comment for the same "180deg from default" case).
 * No new `variant` schema tag needed: like copper golem (and unlike
 * banner/shield), this geometry already fills the engine's reference cube,
 * so the generic cube-calibrated `--icon-scale` applies unchanged.
 */
type CompoundIcon = Extract<IconOutput, { type: "compound" }>;
type CompoundElement = CompoundIcon["elements"][number];
type CompoundFace = NonNullable<CompoundElement["faces"]["up"]>;

/** Extra GUI yaw on top of the compound camera's default -- see this file's docstring. */
const CHEST_GUI_YAW_DELTA = -180;

/** [width, height, depth, texOffsU, texOffsV] -- both atlas-verified (see this file's docstring). */
const CHEST_LID_BOX = { w: 14, h: 5, d: 14, u: 0, v: 0 };
const CHEST_BOTTOM_BOX = { w: 14, h: 10, d: 14, u: 0, v: 19 };

function boxElement(
  box: { w: number; h: number; d: number; u: number; v: number },
  from: [number, number, number],
  atlasTexturePath: string,
): CompoundElement {
  const to: [number, number, number] = [
    round4(from[0] + box.w),
    round4(from[1] + box.h),
    round4(from[2] + box.d),
  ];
  const uvs = faceUVs(box.u, box.v, box.w, box.h, box.d);
  const face = (uv: [number, number, number, number]): CompoundFace => ({
    texture: atlasTexturePath,
    uv,
  });

  return {
    from,
    to,
    faces: {
      up: face(uvs.up),
      down: face(uvs.down),
      north: face(uvs.north),
      south: face(uvs.south),
      east: face(uvs.east),
      west: face(uvs.west),
    },
  };
}

/**
 * Builds a chest's "compound" icon: a bottom box (0-10) + a lid box
 * (9-14, overlapping the bottom by 1 unit) -- see this file's docstring for
 * the full derivation. `atlasTexturePath` is the already-`withBase()`-free
 * `/textures/...` path every face samples (one shared path per chest
 * texture variant -- normal/trapped/ender/4 copper tiers).
 */
export function chestCompoundIcon(atlasTexturePath: string): CompoundIcon {
  return {
    type: "compound",
    yRotation: CHEST_GUI_YAW_DELTA,
    elements: [
      boxElement(CHEST_BOTTOM_BOX, [1, 0, 1], atlasTexturePath),
      boxElement(CHEST_LID_BOX, [1, 9, 1], atlasTexturePath),
    ],
  };
}

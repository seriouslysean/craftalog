import { round4 } from "./banner-icon.ts";
import { faceWith } from "./compound-icon.ts";
import type { CompoundElement, CompoundIcon } from "./types.ts";

/**
 * The decorated pot is a `minecraft:special` entity-rendered item
 * (assets/item_definition/data.json's "decorated_pot" entry wraps
 * `item/decorated_pot` in `{ type: "minecraft:special", model: { type:
 * "minecraft:decorated_pot" } }`, same shape as shield's own special
 * wrapper), but unlike shield its "base" fallback model
 * (item/decorated_pot.json, and its block/decorated_pot.json twin) carries
 * only a tier-agnostic `particle: block/terracotta` -- zero `elements`.
 * Mojang hardcodes the real mesh in `DecoratedPotRenderer` (code, not data),
 * and `vendor/bedrock-samples` has no `.geo.json` for this entity either
 * (verified: no decorated_pot geometry file exists anywhere under
 * bedrock-samples, unlike copper golem's real Bedrock geometry) -- so this
 * is genuinely the shield/banner case (hand-authored geometry needed), not
 * the copper-golem case (real geometry to extract).
 *
 * Geometry confidence: ATLAS-VERIFIED, exhaustively. The two vendored entity
 * textures this file crops --
 * entity/decorated_pot/decorated_pot_base.png (32x32) and
 * entity/decorated_pot/decorated_pot_side.png (16x16) -- were probed
 * pixel-by-pixel (alpha channel + color boundaries) to recover the box-UV
 * layout independently, then cross-checked against a public decompiled copy
 * of Minecraft's real `DecoratedPotRenderer.createBaseLayer()` /
 * `createSidesLayer()` (Mojang-mapped client source; used only to confirm
 * box origins/sizes/texOffs and to catch the 180degree bone flip below --
 * the actual geometry encoded here was independently re-derived against the
 * vendored PNGs' own pixel content, not copied from that source). The two
 * accounting passes agree exactly: decorated_pot_base.png has 640 opaque
 * pixels total; this file's BODY top/bottom crops (14x14 each, 392px) plus
 * NECK top/bottom/side-band crops (8x8 + 8x8 + 32x3, 224px) sum to 616,
 * and the remaining 24px is exactly (and only) a separate 6x1x6 collar/lip
 * sub-box's own thin side-band row (texOffs(0,5) in the real renderer) --
 * see "collar omission" below. decorated_pot_side.png is 224/256 opaque
 * (14x16, a 1px transparent border), exactly the single "brick" (undecorated)
 * crop this file uses verbatim on all 4 body side faces.
 *
 * Two elements, in the real renderer's own object-space (0-16 native units,
 * matching this engine's own convention 1:1 -- no re-centering needed):
 *
 * 1. BODY: a 14(x)x16(y)x14(z) box, x/z inset 1 unit from the full 0-16
 *    footprint (`createSidesLayer`: 4 separate flat NORTH-only quads, each
 *    rotated to one wall of a box spanning x/z [1,15], y [0,16]). Side
 *    faces sample decorated_pot_side.png's single "brick" crop -- the
 *    plain crafted `decorated_pot` has no sherds, so all 4 sides use the
 *    undecorated pattern uniformly (`getSideMaterial` falls back to
 *    `Sheets.DECORATED_POT_SIDE` when a side has no sherd item). Top/bottom
 *    come from `createBaseLayer`'s "top"/"bottom" parts -- flat 14x14 discs
 *    at y=16/y=0, NO rotation applied (`PartPose.offsetAndRotation(1,16,1,
 *    0,0,0)` / `(1,0,1,0,0,0)`), so their box-UV up/down crops map directly
 *    with no relabeling.
 * 2. NECK: an 8(x)x3(y)x8(z) box centered above the body (x/z [4,12]),
 *    authored in `createBaseLayer` at LOCAL y[17,20] then flipped 180degrees
 *    about the X axis and translated (`PartPose.offsetAndRotation(0,37,16,
 *    PI,0,0)`) to its real WORLD position y[17,20] (this specific flip
 *    happens to preserve the bounding box's y/z extents exactly, since both
 *    were authored symmetrically around the flip's own pivot -- verified by
 *    direct computation, not assumed). The flip negates y and z, which
 *    swaps which box-UV crop lands on which WORLD-facing side: the local
 *    "up"/"down" crops swap (the real vendored texture's local-"down" crop
 *    becomes the world-visible top), and local "north"/"south" swap (their
 *    positions AND their outward normals both flip, landing local-"north"
 *    at world +Z and local-"south" at world -Z) -- local "east"/"west" are
 *    untouched (X isn't part of a 180degree X-axis rotation). All 6 world
 *    faces are declared (matching copper-golem-icon.ts's precedent for
 *    real, non-coplanar multi-element geometry, rather than shield's
 *    selective 4-face omission for a single near-coplanar plate) since the
 *    body-to-neck step is exactly the kind of "stepped shape" ItemIcon.astro's
 *    computeFaceStyle docstring calls out as needing more than the 3
 *    simple-convex-box faces.
 *
 * Collar omission: the real renderer also has a tiny 6x1x6 "lip" sub-box
 * (texOffs(0,5), local y[20,21] -> world y[16,17]) bridging the 1-native-unit
 * air gap between the body's flat top disc (world y=16) and the neck's own
 * base (world y=17). Dropped here: its own box-UV top/bottom crops overlap
 * entirely with pixels the body/neck crops above already claim (confirmed by
 * the pixel-accounting above -- only its 24px side-band row is genuinely
 * unclaimed), so there's no clean non-overlapping crop for it, and
 * geometrically the "gap" it fills sits directly above the body's own
 * opaque, same-toned top disc -- looking through it exposes more of that
 * same terracotta surface, not a hole to nothing. Same cost/benefit shield's
 * handle omission made: real but sub-1-native-unit-tall, geometrically minor,
 * not worth the crop ambiguity for an icon at this scale.
 */

/** Vendor texture ref of the pot's undecorated "brick" side atlas (16x16). */
export const DECORATED_POT_SIDE_TEMPLATE_TEXTURE_REF = "entity/decorated_pot/decorated_pot_side";
/** Vendor texture ref of the pot's base/neck structural atlas (32x32). */
export const DECORATED_POT_BASE_TEMPLATE_TEXTURE_REF = "entity/decorated_pot/decorated_pot_base";

/**
 * The two atlases' pixel dimensions this file's pixel-probed uv crops
 * (uvBase's 32x32 halving, uvSide's 16x16 identity) were verified against.
 * generate.ts checks the real vendored atlases still match and degrades the
 * icon (placeholder + meta.audit.degradedIcons) on a mismatch, instead of
 * silently stretching wrong crops over the body/neck.
 */
export const DECORATED_POT_BASE_ATLAS_SIZE = { width: 32, height: 32 } as const;
export const DECORATED_POT_SIDE_ATLAS_SIZE = { width: 16, height: 16 } as const;

/** Generated texture ref the body's side faces sample -- a verbatim copy of the template (see scripts/parse.ts). */
export const DECORATED_POT_SIDE_ATLAS_REF = "item/decorated_pot_side";
/** Generated texture ref the body's top/bottom + the neck's faces sample -- a verbatim copy of the template (see scripts/parse.ts). */
export const DECORATED_POT_BASE_ATLAS_REF = "item/decorated_pot_base";

/**
 * Extra GUI yaw for the decorated pot icon, on top of the compound camera's
 * default -135deg (see ItemIcon.astro's `.compound` rule): item/decorated_pot.json
 * declares `display.gui.rotation: [30, 45, 0]` where the inherited block
 * default is [30, 225, 0], so the yaw delta is 45 - 225 = -180.
 */
const DECORATED_POT_GUI_YAW_DELTA = -180;

/** 16 engine units / 20 native units: the real assembly's full height (body 0-16 plus the neck's own 17-20) is what fills the reference cube. */
const SCALE = 16 / 20;

/** Converts a pixel rect on the 32x32 decorated_pot_base.png atlas to the engine's 0-16 uv space (16/32 = halves). */
function uvBase(x0: number, y0: number, x1: number, y1: number): [number, number, number, number] {
  return [x0 / 2, y0 / 2, x1 / 2, y1 / 2];
}

/** decorated_pot_side.png is 16x16 -- pixel coords already ARE the engine's 0-16 uv space (identity), named for symmetry/clarity with uvBase. */
function uvSide(x0: number, y0: number, x1: number, y1: number): [number, number, number, number] {
  return [x0, y0, x1, y1];
}

/** Scales a native x/z coordinate into engine space, re-centering around the shared 8-unit midpoint so the assembly stays centered after a non-1 scale (native x/z already run 0-16 like the engine's own convention, centered at 8, matching the real renderer). */
function engineXZ(native: number): number {
  return round4((native - 8) * SCALE + 8);
}

function engineY(native: number): number {
  return round4(native * SCALE);
}

/**
 * Builds the decorated pot's compound icon: a 14x16x14 body (undecorated
 * "brick" sides, structural top/bottom caps) plus an 8x3x8 neck sitting
 * centered on top -- see this file's docstring for the full derivation of
 * both elements' geometry and texture crops.
 */
export function decoratedPotCompoundIcon(
  baseAtlasTexturePath: string,
  sideAtlasTexturePath: string,
): CompoundIcon {
  const baseFace = faceWith(baseAtlasTexturePath);
  const sideFace = faceWith(sideAtlasTexturePath);

  // All 4 body sides share the identical undecorated "brick" crop (the
  // plain crafted decorated_pot has no sherds -- see this file's docstring).
  const bodySide = sideFace(uvSide(1, 0, 15, 16));

  const body: CompoundElement = {
    from: [engineXZ(1), engineY(0), engineXZ(1)],
    to: [engineXZ(15), engineY(16), engineXZ(15)],
    faces: {
      up: baseFace(uvBase(0, 13, 14, 27)),
      down: baseFace(uvBase(14, 13, 28, 27)),
      north: bodySide,
      south: bodySide,
      east: bodySide,
      west: bodySide,
    },
  };

  const neck: CompoundElement = {
    from: [engineXZ(4), engineY(17), engineXZ(4)],
    to: [engineXZ(12), engineY(20), engineXZ(12)],
    faces: {
      // Local "down"/"up" swap under the real renderer's 180deg X-axis flip
      // -- see this file's docstring.
      up: baseFace(uvBase(16, 0, 24, 8)),
      down: baseFace(uvBase(8, 0, 16, 8)),
      // Local "north"/"south" also swap (both position and outward normal).
      south: baseFace(uvBase(8, 8, 16, 11)),
      north: baseFace(uvBase(24, 8, 32, 11)),
      // East/west are untouched by an X-axis rotation.
      east: baseFace(uvBase(16, 8, 24, 11)),
      west: baseFace(uvBase(0, 8, 8, 11)),
    },
  };

  return {
    type: "compound",
    yRotation: DECORATED_POT_GUI_YAW_DELTA,
    elements: [body, neck],
  };
}

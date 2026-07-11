import { boxUvFaces } from "./bedrock-geometry.ts";
import { facesFrom } from "./compound-icon.ts";
import type { CompoundElement, CompoundIcon } from "./types.ts";

/**
 * Mob heads/skulls (the `minecraft:head` special renderer -- creeper,
 * piglin, skeleton, wither_skeleton, zombie -- and player heads, a separate
 * `minecraft:player_head` special type) and the conduit (`minecraft:conduit`)
 * all render in-game via bespoke Java special renderers, not a vendored
 * block model: item/template_skull.json and item/conduit.json both carry
 * only `textures.particle` (soul_sand / block/conduit -- both placeholders
 * with no bearing on the item's real appearance) plus display transforms,
 * zero `elements`. Same bug class as shield/banner: every head fell through
 * to the generic "grab the particle texture" fallback, rendering as a flat
 * soul_sand swatch regardless of kind; conduit rendered as a flat crop of
 * its own (also-wrong) placeholder block texture.
 *
 * Geometry is hand-authored for both (Minecraft has no vendored shape data
 * for either -- same situation as shield): a single cube, all 6 faces,
 * box-UV-unwrapped from atlas offset (0,0) on the item's own vendored
 * entity texture:
 *
 * - Heads: an 8x8x8 cube sampling the classic Minecraft skin "head" box-UV
 *   region -- the same convention every humanoid/creature skin texture
 *   uses for its head cube (top/bottom strip, then west/north/east/south
 *   bands), always at atlas offset (0,0) regardless of whether the rest of
 *   the skin is the legacy 64x32 layout (creeper/skeleton/wither_skeleton)
 *   or the extended 64x64 layout (piglin/zombie) -- the head box's own
 *   position/size never moved between those formats. ATLAS-VERIFIED for
 *   every kind in HEAD_KIND_TEXTURES: probing each real vendored texture's
 *   alpha channel shows the expected two-band opaque region (a 16px-wide,
 *   8px-tall top+bottom band at columns 8-23, then a 32px-wide, 8px-tall
 *   side band at columns 0-31) at rows 0-15 in every case (some individual
 *   pixels inside that region are transparent for legitimate art reasons --
 *   skeleton's eye sockets, piglin's ear/tusk cutouts -- that doesn't
 *   change the unwrap region itself, same as vanilla's own skull renderer
 *   samples this exact region regardless of those holes).
 *
 * - Conduit: a 6x6x6 cube sampling entity/conduit/base.png (the solid inner
 *   core/eye-housing, always visible and not itself animated -- unlike the
 *   outer rotating wireframe "cage" and the separate billboard eye-pupil
 *   overlay sprites, both deliberately omitted: the cage is a thin, mostly-
 *   transparent frame this renderer's flat-box-face model can't represent
 *   at all, and the eye overlay is a camera-facing billboard, a rendering
 *   technique this static-icon engine has no equivalent for -- so the
 *   static core alone is the honest, renderable subset, the same "omit
 *   what this simple box model genuinely can't show" reasoning shield
 *   applied to its handle). ATLAS-VERIFIED: probing base.png's alpha
 *   channel shows exactly the expected box-UV region for a 6x6x6 cube at
 *   offset (0,0) on this 32x16 atlas (a 12px-wide, 6px-tall top+bottom
 *   band at columns 6-17, a 24px-wide, 6px-tall side band at columns 0-23),
 *   both at rows 0-11, zero opaque pixels outside it.
 *
 * Neither atlas is the uniform 64x64 every other hand-authored compound
 * icon (banner/shield/copper-golem) happened to use -- heads' legacy skins
 * are 64x32, conduit's is 32x16 -- so this file's uv math threads each
 * texture's own real pixel dimensions through boxUvFaces (scripts/lib/
 * bedrock-geometry.ts, built on banner-icon.ts's uvPxOnAtlas, which
 * generalizes the fixed-64x64 uvPx every sibling renderer uses) rather
 * than assuming a fixed size.
 *
 * "dragon" is deliberately excluded from HEAD_KIND_TEXTURES: dragon_head
 * samples entity/enderdragon/dragon.png, a 256x256 rigged-model atlas that
 * does NOT follow the standard skin box-UV convention at all (verified: no
 * matching opaque region at any offset) -- this renderer can't produce a
 * correct crop for it. dragon_head also isn't referenced by any generated
 * recipe today (it's a creative/command-only item, never craftable), so
 * this costs nothing in practice; scripts/lib/model.ts's classification
 * fails open to the pre-existing flat fallback for any kind absent here,
 * same as before this renderer existed.
 *
 * player_head has no `kind` at all (a separate `minecraft:player_head`
 * special type) and no static texture -- its real appearance is the
 * owning player's live skin, which this static-data pipeline has no source
 * for -- so scripts/lib/model.ts never routes it here either, same
 * fail-open reasoning.
 */

/** The vanilla `kind` enum values (Java's `SkullBlock.Types`) this renderer supports -- see this file's docstring for why "dragon" is excluded. */
export type HeadKind = "creeper" | "piglin" | "skeleton" | "wither_skeleton" | "zombie";

/** `kind` -> vendored Java entity skin texture ref sampling the standard head box-UV region at atlas offset (0,0). */
export const HEAD_KIND_TEXTURES: Record<HeadKind, string> = {
  creeper: "entity/creeper/creeper",
  piglin: "entity/piglin/piglin",
  skeleton: "entity/skeleton/skeleton",
  wither_skeleton: "entity/skeleton/wither_skeleton",
  zombie: "entity/zombie/zombie",
};

export function isHeadKind(value: string): value is HeadKind {
  return Object.hasOwn(HEAD_KIND_TEXTURES, value);
}

/**
 * Extra GUI yaw for head icons, on top of the compound camera's default
 * -135deg (see ItemIcon.astro's `.compound` rule): item/template_skull.json
 * (the `base` every head kind's item definition resolves to -- verified
 * dragon_head.json's own override declares the identical rotation, so this
 * is uniform across every kind) declares `display.gui.rotation: [30, 45, 0]`
 * where the inherited block default is [30, 225, 0], so yaw delta =
 * 45 - 225 = -180 -- the same guiYaw-minus-default formula
 * scripts/lib/model.ts's findGuiYawDelta applies to vendored element models.
 */
const HEAD_GUI_YAW_DELTA = -180;

/** Native size (all 3 axes) of the classic Minecraft skin head-box cube. */
const HEAD_SIZE = 8;

/** Vendor texture ref of the conduit's real, static inner core (see this file's docstring for why the rotating cage + billboard eye overlay are both omitted). */
export const CONDUIT_TEXTURE_REF = "entity/conduit/base";

/** Generated texture ref the conduit icon's faces sample -- a verbatim copy of CONDUIT_TEXTURE_REF (see scripts/parse.ts). Explicitly named (not derived from the source basename, which is just "base") to avoid a collision-prone generated filename. */
export const CONDUIT_ATLAS_REF = "item/conduit_base";

/**
 * Extra GUI yaw for the conduit icon: item/conduit.json declares
 * `display.gui.rotation: [30, 45, 0]` -- the identical value to
 * HEAD_GUI_YAW_DELTA's source, but cited/derived independently since
 * they're conceptually unrelated items that merely happen to share this
 * vanilla default -- so yaw delta = 45 - 225 = -180.
 */
const CONDUIT_GUI_YAW_DELTA = -180;

/** Native size (all 3 axes) of the conduit's inner core cube. */
const CONDUIT_SIZE = 6;

/**
 * Builds a single-cube "compound" icon: one `size`x`size`x`size` box, all 6
 * faces, box-UV-unwrapped from atlas offset (0,0) on the given real atlas
 * (`atlasWidth`x`atlasHeight` -- see boxUvFaces/uvPxOnAtlas for why these
 * must be the texture's own real pixel dimensions, not assumed). Scaled to
 * fill the engine's whole 0-16 reference cube on every axis -- the same
 * "fill the box" convention every vendored-geometry compound icon already
 * uses (e.g. copper golem's own assembly), so the generic --icon-scale
 * (calibrated as a safe containment floor for a real block-sized shape)
 * renders this at a normal, non-tiny size with no bespoke variant needed,
 * unlike banner/shield's genuinely thinner-than-a-block hand-authored
 * geometry.
 */
function entityCubeIcon(
  atlasTexturePath: string,
  atlasWidth: number,
  atlasHeight: number,
  size: number,
  yRotation: number,
): CompoundIcon {
  const uv = boxUvFaces(0, 0, size, size, size, atlasWidth, atlasHeight);

  const element: CompoundElement = {
    from: [0, 0, 0],
    to: [16, 16, 16],
    faces: facesFrom(uv, atlasTexturePath),
  };

  return { type: "compound", yRotation, elements: [element] };
}

/**
 * Builds a mob head's "compound" icon -- see this file's docstring for the
 * full derivation. `atlasTexturePath` is the generated copy of that kind's
 * own vendored skin texture; `atlasWidth`/`atlasHeight` are that texture's
 * own real pixel dimensions (64x32 for creeper/skeleton/wither_skeleton's
 * legacy-format skins, 64x64 for piglin/zombie's new-format skins -- the
 * head box's position/size is identical either way).
 */
export function headCompoundIcon(
  atlasTexturePath: string,
  atlasWidth: number,
  atlasHeight: number,
): CompoundIcon {
  return entityCubeIcon(atlasTexturePath, atlasWidth, atlasHeight, HEAD_SIZE, HEAD_GUI_YAW_DELTA);
}

/**
 * Builds the conduit's "compound" icon -- see this file's docstring for the
 * full derivation. `atlasTexturePath` is the generated copy of
 * CONDUIT_TEXTURE_REF; `atlasWidth`/`atlasHeight` are that texture's own
 * real pixel dimensions (32x16).
 */
export function conduitCompoundIcon(
  atlasTexturePath: string,
  atlasWidth: number,
  atlasHeight: number,
): CompoundIcon {
  return entityCubeIcon(
    atlasTexturePath,
    atlasWidth,
    atlasHeight,
    CONDUIT_SIZE,
    CONDUIT_GUI_YAW_DELTA,
  );
}

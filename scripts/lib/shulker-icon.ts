import { convertBedrockCube } from "./bedrock-geometry.ts";
import type {
  CompoundElement,
  CompoundIcon,
  RawBedrockCube,
  RawLegacyBedrockBone,
  RawLegacyBedrockGeometryFile,
} from "./types.ts";

/**
 * The shulker box is a `minecraft:special` entity-rendered item
 * (item/template_shulker_box.json carries only `display`, zero `elements`)
 * -- Java has no data-side shape geometry for it at all, since Mojang
 * hardcodes the mesh in a bespoke special renderer, same bug class as the
 * shield/copper golem statue this session already fixed. Same playbook as
 * the golem (`scripts/lib/copper-golem-icon.ts`, study that file first):
 * `vendor/bedrock-samples` ships the shulker's real entity geometry as a
 * Bedrock `.geo.json`, genuine data-driven extraction, not hand-authored
 * like banner/shield needed. Unlike the golem's file, `shulker.geo.json`
 * uses the older pre-1.12 Bedrock schema (`"format_version": "1.8.0"`,
 * geometries keyed directly at the top level instead of a `"minecraft:
 * geometry"` array -- see `RawLegacyBedrockGeometryFile` in types.ts) --
 * `shulker.entity.json`'s `description.geometry.default` points at
 * `"geometry.shulker.v1.8"`, the key this file reads. The box-UV unwrap +
 * cube-to-element math (`convertBedrockCube`) is shared with
 * copper-golem-icon.ts via scripts/lib/bedrock-geometry.ts.
 *
 * Textures come from the Java side (mcmeta-assets,
 * `textures/entity/shulker/shulker[_<color>].png`) -- confirmed genuinely
 * distinct from Bedrock's own copies in spirit (Bedrock even uses a
 * different color name, "silver", for Java's "light_gray" -- see
 * scripts/lib/bedrock-colors.ts), so this stays Java-only for pixels,
 * matching every other icon in the catalog; Bedrock only ever contributes
 * the one thing Java's data doesn't have here: the shape. All 16 dye colors
 * plus the undyed default are covered generically -- `textureRef` is read
 * straight off the item definition's own `model.texture` field
 * (scripts/lib/model.ts), no hand list of color names anywhere.
 *
 * Geometry confidence: ATLAS-VERIFIED. `geometry.shulker.v1.8` has 3 bones
 * -- `lid` (16x12x16 @ uv 0,0), `base` (16x8x16 @ uv 0,28), `head` (a small
 * 6x6x6 cube @ uv 0,52, the shulker mob's fleshy foot part, only exposed
 * mid-peek-animation). Probing the real `shulker_black.png` texture's alpha
 * channel: 1812 opaque pixels total, split exactly 924 (lid's predicted
 * unwrap region) + 672 (base's) + 216 (head's), zero pixels anywhere else
 * -- an exhaustive proof the 3-bone accounting is complete, same rigor as
 * the golem's 1324-pixel check. No bone or cube here carries `rotation` or
 * `mirror` (confirmed by reading the file), so bind-pose cube origin/size
 * maps directly to engine space.
 *
 * `head` is deliberately OMITTED from the rendered elements, even though it
 * has a real cube: its full extent (x:[-3,3], y:[6,12], z:[-3,3]) sits
 * entirely INSIDE the union of `lid` (x/z:[-8,8], y:[4,16]) and `base`
 * (x/z:[-8,8], y:[0,8]) -- same x/z footprint on both, and their y-ranges
 * overlap (lid starts at 4, base ends at 8, so the stack has no gap) --
 * meaning `head` is 100% interior on every axis, for every closed (bind
 * pose) camera angle, not just this catalog's fixed one. This is a
 * stronger, exhaustive version of the same "don't declare a face that's
 * never meant to be seen" reasoning shield's handle omission used (that one
 * relied on a worst-case parallax bound, not full containment) -- declaring
 * it anyway would only add gratuitous z-fighting risk for zero visible
 * benefit. `shulkerCompoundIcon` re-verifies this containment numerically
 * at generate time (`assertHeadCubeIsInterior`), so a future bedrock-samples
 * update that changes the head's shape or position fails loudly instead of
 * silently under- or over-rendering.
 *
 * `yRotation: -180` is CITED from item/template_shulker_box.json's own
 * vendored `display.gui.rotation: [30, 45, 0]` (yaw 45, minus the inherited
 * block default of 225 = -180 -- same `guiYaw - 225` formula
 * scripts/lib/model.ts's findGuiYawDelta and banner/shield's own citations
 * use), the same methodology precedent as banner/shield (not the golem's
 * empirical-eyeballing exception, which was needed only because the golem
 * has a strongly asymmetric humanoid silhouette a wrong yaw would visibly
 * break). Spot-checked against the real vanilla inventory icon
 * (minecraft.wiki's `Invicon_Shulker_Box.png`): it reads as a plain
 * near-uniform box (lighter top, two shaded side faces, no strong
 * asymmetric front-facing cue at icon resolution), consistent with this
 * citation -- unlike the golem, there was no visible mismatch to catch.
 *
 * SCALE = 1 (16 model units / 16 native units): unlike the golem's
 * taller-than-a-block standing entity (16/24), the shulker's own lid+base
 * stack already spans exactly 0-16 natively (base y:[0,8], lid y:[4,16]) --
 * a real block, sized like every other block's model space, so no
 * scale-down is needed. Combined with the x/z footprint already spanning
 * the full -8..8 range, the extracted geometry already fills the engine's
 * 0-16 reference cube on every axis, same as the golem (see that file's
 * docstring) -- so, like the golem, this needs no `variant` schema tag; the
 * generic compound `--icon-scale` already fits it.
 */
const SHULKER_GEOMETRY_KEY = "geometry.shulker.v1.8";
const LID_BONE_NAME = "lid";
const BASE_BONE_NAME = "base";
/** Real cube, deliberately unrendered -- fully interior to lid+base, see this file's docstring. */
const HEAD_BONE_NAME = "head";

const SHULKER_GUI_YAW_DELTA = 45 - 225;

/** 16 model units / 16 native units: the box's own lid+base stack already spans a full block (see this file's docstring). */
const SCALE = 1;

/**
 * Looks up a named bone and returns its single cube, validating the shape
 * this extractor assumes still holds (exactly one cube, no rotation/mirror
 * on the bone or its cube) -- same defensive "fail loud, don't silently
 * mis-render" style as copper-golem-icon.ts.
 */
function requireSingleCube(
  bone: RawLegacyBedrockBone | undefined,
  boneName: string,
): RawBedrockCube {
  if (!bone) {
    throw new Error(
      `shulker geometry: expected a "${boneName}" bone -- vendored bedrock-samples geo.json may have changed shape`,
    );
  }
  const cubes = bone.cubes ?? [];
  if (cubes.length !== 1) {
    throw new Error(
      `shulker geometry: expected bone "${boneName}" to declare exactly 1 cube, got ${cubes.length}`,
    );
  }
  const [cube] = cubes;
  if (cube.rotation || cube.mirror || bone.rotation) {
    throw new Error(
      `shulker geometry: bone "${boneName}" or its cube declares rotation/mirror -- this extractor only supports plain axis-aligned bind-pose cubes (verified absent in the current vendored file; a future update may have introduced one)`,
    );
  }
  return cube;
}

/**
 * Re-verifies at generate time that `head` is still fully interior to the
 * `lid`+`base` stack (see this file's top docstring for the full geometric
 * argument) -- throws rather than silently mis-rendering if a future
 * bedrock-samples update changes any of the three cubes such that the
 * containment no longer holds.
 */
function assertHeadCubeIsInterior(
  head: RawBedrockCube,
  lid: RawBedrockCube,
  base: RawBedrockCube,
): void {
  const sameFootprint =
    lid.origin[0] === base.origin[0] &&
    lid.size[0] === base.size[0] &&
    lid.origin[2] === base.origin[2] &&
    lid.size[2] === base.size[2];
  const stackY0 = Math.min(lid.origin[1], base.origin[1]);
  const stackY1 = Math.max(lid.origin[1] + lid.size[1], base.origin[1] + base.size[1]);
  const noGapInStack =
    Math.max(lid.origin[1], base.origin[1]) <=
    Math.min(lid.origin[1] + lid.size[1], base.origin[1] + base.size[1]);

  const [headX0, headY0, headZ0] = head.origin;
  const headX1 = headX0 + head.size[0];
  const headY1 = headY0 + head.size[1];
  const headZ1 = headZ0 + head.size[2];
  const [footprintX0, , footprintZ0] = lid.origin;
  const footprintX1 = footprintX0 + lid.size[0];
  const footprintZ1 = footprintZ0 + lid.size[2];

  const interior =
    sameFootprint &&
    noGapInStack &&
    headX0 >= footprintX0 &&
    headX1 <= footprintX1 &&
    headZ0 >= footprintZ0 &&
    headZ1 <= footprintZ1 &&
    headY0 >= stackY0 &&
    headY1 <= stackY1;

  if (!interior) {
    throw new Error(
      `shulker geometry: "head" bone is no longer fully interior to "lid"+"base" -- the omission this file's docstring justifies needs re-verification against the new shape`,
    );
  }
}

/**
 * Builds the shulker box's compound icon (lid + base only -- see this
 * file's docstring for why `head` is omitted) from the real vendored
 * Bedrock entity geometry. `atlasTexturePath` is the already-`withBase()`
 * -free `/textures/...` path both cubes' faces sample -- one path per color
 * (16 dyed + undyed), geometry never varies by color.
 */
export function shulkerCompoundIcon(
  geoRaw: RawLegacyBedrockGeometryFile,
  atlasTexturePath: string,
): CompoundIcon {
  const geometry = geoRaw[SHULKER_GEOMETRY_KEY];
  if (!geometry || typeof geometry === "string") {
    throw new Error(
      `shulker geometry: expected key "${SHULKER_GEOMETRY_KEY}" not found -- vendored bedrock-samples geo.json may have changed shape`,
    );
  }

  if (geometry.texturewidth !== 64 || geometry.textureheight !== 64) {
    throw new Error(
      `shulker geometry: expected a 64x64 UV space, got ${geometry.texturewidth}x${geometry.textureheight} -- the face-UV formula this depends on (scripts/lib/bedrock-geometry.ts) assumes 64x64`,
    );
  }

  const knownBoneNames = new Set([LID_BONE_NAME, BASE_BONE_NAME, HEAD_BONE_NAME]);
  const unknownBone = geometry.bones.find((bone) => !knownBoneNames.has(bone.name));
  if (unknownBone) {
    throw new Error(
      `shulker geometry: unexpected bone "${unknownBone.name}" -- this extractor only knows "lid"/"base" (rendered) and "head" (verified fully interior, skipped -- see this file's docstring); a future bedrock-samples update may have added geometry that needs review`,
    );
  }

  const lidCube = requireSingleCube(
    geometry.bones.find((bone) => bone.name === LID_BONE_NAME),
    LID_BONE_NAME,
  );
  const baseCube = requireSingleCube(
    geometry.bones.find((bone) => bone.name === BASE_BONE_NAME),
    BASE_BONE_NAME,
  );
  const headBone = geometry.bones.find((bone) => bone.name === HEAD_BONE_NAME);
  if (headBone) {
    assertHeadCubeIsInterior(requireSingleCube(headBone, HEAD_BONE_NAME), lidCube, baseCube);
  }

  const elements: CompoundElement[] = [
    convertBedrockCube(lidCube, atlasTexturePath, SCALE),
    convertBedrockCube(baseCube, atlasTexturePath, SCALE),
  ];

  return {
    type: "compound",
    yRotation: SHULKER_GUI_YAW_DELTA,
    elements,
  };
}

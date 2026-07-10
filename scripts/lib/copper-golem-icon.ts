import { round4, uvPx } from "./banner-icon.ts";
import type { IconOutput, RawBedrockCube, RawBedrockGeometryFile } from "./types.ts";

/**
 * The copper golem statue is a `minecraft:special` entity-rendered item
 * (item/template_copper_golem_statue.json carries only a tier-agnostic
 * `particle: block/copper_block`, zero `elements`) -- Java has no data-side
 * geometry for it at all, since Mojang hardcodes the mesh in
 * `CopperGolemStatueSpecialRenderer` (code, not data). Unlike banners/
 * shields, which needed hand-authored geometry because NEITHER vendored
 * source has real shape data, this one has real data: `vendor/bedrock-samples`
 * ships the golem's actual entity model as a Bedrock `.geo.json` (bones +
 * axis-aligned cubes, the Bedrock equivalent of a Java block model's
 * `elements` array). This file extracts that real geometry into this
 * catalog's generic "compound" icon type -- the same category as
 * `extractCompoundElements` (scripts/lib/model.ts) uses for anvil/
 * grindstone, not the hand-authored category banner-icon.ts/shield-icon.ts
 * are in.
 *
 * Textures still come from the Java side (mcmeta-assets) -- confirmed
 * byte-for-byte identical to bedrock-samples' own copies of the same 4
 * tier PNGs, so there's no reason to depend on Bedrock for pixels, only
 * for the one thing Java doesn't have: the shape.
 *
 * Geometry confidence: ATLAS-VERIFIED. `geometry.copper_golem`'s 9 cubes
 * (root/rightItem are empty attachment bones, nothing to extract) were
 * converted via the standard Bedrock box-UV unwrap (same convention as a
 * Java skin texture: top/bottom strip, then west/north/east/south around
 * the sides) and cross-checked against the real vendored texture's own
 * alpha channel: every one of the texture's 1324 opaque pixels falls
 * inside one of the 9 predicted unwrap regions, with zero opaque pixels
 * anywhere else -- an exhaustive proof the unwrap accounting is complete,
 * not a spot-check. No bone or cube in this geometry (unlike its sibling
 * `geometry.copper_golem.flower`, ignored entirely) carries `rotation`,
 * `mirror`, or a nonzero effect from `pivot` (pivot only matters when a
 * rotation is actually applied) -- confirmed by reading every bone/cube in
 * the file -- so each cube's own `origin`/`size` maps directly to engine
 * space with no bone-hierarchy transform composition needed.
 *
 * `yRotation: -90` (net yaw -135 + -90 = -25... normalized: -135-90=-225
 * ~= +135 mod 360) is CITED differently from the geometry: it's pinned
 * empirically against the real vanilla inventory sprite (face on
 * screen-left), since the vanilla icon's exact camera transform lives in
 * renderer code, not vendored data, the same way banner/shield's own
 * gui-yaw deltas were vendored-data-derived but their final on-screen
 * orientation was still confirmed by eye against a reference render.
 */
const GOLEM_GEOMETRY_IDENTIFIER = "geometry.copper_golem";
const GOLEM_YAW = -90;

/** 16 model units / 24 native units: the golem's own full standing height (feet to antenna-ball top) is the assembly's full height. */
const SCALE = 16 / 24;

type CompoundIcon = Extract<IconOutput, { type: "compound" }>;
type CompoundElement = CompoundIcon["elements"][number];
type CompoundFace = NonNullable<CompoundElement["faces"]["up"]>;

interface FaceUVs {
  up: [number, number, number, number];
  down: [number, number, number, number];
  north: [number, number, number, number];
  south: [number, number, number, number];
  east: [number, number, number, number];
  west: [number, number, number, number];
}

/**
 * The Bedrock box-UV unwrap for a cube of size w(width, x) x h(height, y) x
 * d(depth, z) at atlas offset (u,v) -- same convention a Java player-skin
 * texture uses (front face famously at a fixed offset from the unwrap's
 * origin). Verified exhaustively against the real texture -- see this
 * file's top docstring.
 */
function faceUVs(u: number, v: number, w: number, h: number, d: number): FaceUVs {
  return {
    up: uvPx(u + d, v, u + d + w, v + d),
    down: uvPx(u + d + w, v, u + d + 2 * w, v + d),
    north: uvPx(u + d, v + d, u + d + w, v + d + h),
    east: uvPx(u + d + w, v + d, u + d + w + d, v + d + h),
    west: uvPx(u, v + d, u + d, v + d + h),
    south: uvPx(u + 2 * d + w, v + d, u + 2 * d + 2 * w, v + d + h),
  };
}

/**
 * Converts one Bedrock cube (native units, one corner + size, optional
 * uniform `inflate` expand) to an engine-space element (0-16 cube,
 * centered on x/z = 8, feet at y = 0 -- matching Bedrock's own object-space
 * convention for this entity, which is already feet-at-origin).
 */
function convertCube(cube: RawBedrockCube, atlasTexturePath: string): CompoundElement {
  const [ox, oy, oz] = cube.origin;
  const [w, h, d] = cube.size;
  const inflate = cube.inflate ?? 0;

  const x0 = ox - inflate;
  const x1 = ox + w + inflate;
  const y0 = oy - inflate;
  const y1 = oy + h + inflate;
  const z0 = oz - inflate;
  const z1 = oz + d + inflate;

  const from: [number, number, number] = [
    round4(x0 * SCALE + 8),
    round4(y0 * SCALE),
    round4(z0 * SCALE + 8),
  ];
  const to: [number, number, number] = [
    round4(x1 * SCALE + 8),
    round4(y1 * SCALE),
    round4(z1 * SCALE + 8),
  ];

  const [u, v] = cube.uv;
  const uvs = faceUVs(u, v, w, h, d);
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
 * Builds the copper golem statue's compound icon from the real vendored
 * Bedrock entity geometry -- see this file's docstring for the full
 * derivation. `atlasTexturePath` is the already-`withBase()`-free
 * `/textures/...` path every cube's faces sample (one shared path per
 * tier -- geometry never varies by tier, only the texture, confirmed by
 * `copper_golem.render_controllers.json`'s single shared `Geometry.default`).
 */
export function copperGolemCompoundIcon(
  geoRaw: RawBedrockGeometryFile,
  atlasTexturePath: string,
): CompoundIcon {
  const geometry = geoRaw["minecraft:geometry"].find(
    (g) => g.description.identifier === GOLEM_GEOMETRY_IDENTIFIER,
  );
  if (!geometry) {
    throw new Error(
      `copper golem geometry: expected identifier "${GOLEM_GEOMETRY_IDENTIFIER}" not found -- vendored bedrock-samples geo.json may have changed shape`,
    );
  }

  const { texture_width, texture_height } = geometry.description;
  if (texture_width !== 64 || texture_height !== 64) {
    throw new Error(
      `copper golem geometry: expected a 64x64 UV space, got ${texture_width}x${texture_height} -- the face-UV formula in this file assumes 64x64`,
    );
  }

  const elements: CompoundElement[] = [];
  for (const bone of geometry.bones) {
    for (const cube of bone.cubes ?? []) {
      if (cube.rotation || cube.mirror || bone.rotation) {
        throw new Error(
          `copper golem geometry: bone "${bone.name}" or one of its cubes declares rotation/mirror -- this extractor only supports plain axis-aligned bind-pose cubes (verified absent in the current vendored file; a future update may have introduced one)`,
        );
      }
      elements.push(convertCube(cube, atlasTexturePath));
    }
  }

  return {
    type: "compound",
    yRotation: GOLEM_YAW,
    elements,
  };
}

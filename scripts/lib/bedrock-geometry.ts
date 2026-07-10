import { round4, uvPx } from "./banner-icon.ts";
import type { IconOutput, RawBedrockCube } from "./types.ts";

/**
 * Shared Bedrock-entity-geometry-to-"compound"-icon math, used by every
 * renderer that extracts REAL box geometry from a vendored
 * `resource_pack/models/entity/*.geo.json` (as opposed to hand-authoring
 * geometry the way banner-icon.ts/shield-icon.ts do, where neither vendored
 * source has real shape data at all) -- currently
 * scripts/lib/copper-golem-icon.ts and scripts/lib/shulker-icon.ts. Both
 * consumers independently verified this box-UV unwrap formula against their
 * own real vendored texture's alpha channel (every opaque pixel falls
 * inside a predicted unwrap region, none left over) -- see each consumer's
 * own module docstring for its specific numbers.
 */
type CompoundIcon = Extract<IconOutput, { type: "compound" }>;
export type CompoundElement = CompoundIcon["elements"][number];
type CompoundFace = NonNullable<CompoundElement["faces"]["up"]>;

export interface FaceUVs {
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
 * origin).
 */
export function faceUVs(u: number, v: number, w: number, h: number, d: number): FaceUVs {
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
 * uniform `inflate` expand) to an engine-space element (0-16 cube, centered
 * on x/z = 8, feet at y = 0 -- matching Bedrock's own object-space
 * convention for these entities, which are already feet-at-origin). `scale`
 * is each consumer's own native-height -> 16-engine-unit ratio (e.g. the
 * golem's 16/24 for its taller-than-a-block standing height, the shulker's
 * 16/16 since its box already matches a full block -- see each consumer's
 * own derivation).
 */
export function convertBedrockCube(
  cube: RawBedrockCube,
  atlasTexturePath: string,
  scale: number,
): CompoundElement {
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
    round4(x0 * scale + 8),
    round4(y0 * scale),
    round4(z0 * scale + 8),
  ];
  const to: [number, number, number] = [
    round4(x1 * scale + 8),
    round4(y1 * scale),
    round4(z1 * scale + 8),
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

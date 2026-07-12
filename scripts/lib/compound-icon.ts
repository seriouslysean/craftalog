import type { CompoundElement, CompoundFace } from "./types.ts";

/**
 * A bespoke icon extractor's "this vendored input no longer matches the
 * shape I know how to extract" failure (unexpected geometry identifier,
 * bone/cube layout, UV-space size, ...). Icons are PRESENTATION, not core
 * recipe data (see docs/PLAN.md): generate.ts catches exactly this error
 * type at each extractor call site and degrades that ONE item to the
 * placeholder + a meta.audit.degradedIcons entry, instead of the whole
 * parse aborting. Anything else thrown is a real bug and still propagates.
 */
export class IconExtractionError extends Error {}

/** A face's uv crop rect: [u0, v0, u1, v1] in the engine's per-axis 0-16 space (see scripts/lib/banner-icon.ts's uvPxOnAtlas). */
export type FaceUv = [number, number, number, number];

/** One uv rect per cardinal face -- the shape boxUvFaces (scripts/lib/bedrock-geometry.ts) produces from a box-UV unwrap. */
export interface FaceUVs {
  up: FaceUv;
  down: FaceUv;
  north: FaceUv;
  south: FaceUv;
  east: FaceUv;
  west: FaceUv;
}

/**
 * Returns a CompoundFace factory bound to one texture path -- the
 * `(uv) => ({ texture, uv })` closure every icon-builder module needs,
 * defined once instead of per module.
 */
export function faceWith(texture: string): (uv: FaceUv) => CompoundFace {
  return (uv) => ({ texture, uv });
}

/**
 * Builds all 6 cardinal faces of a CompoundElement from a box-UV unwrap,
 * every face sampling the same texture -- the common case for entity-cube
 * icons (bedrock geometry extraction, chests, heads, conduit).
 */
export function facesFrom(uvs: FaceUVs, texture: string): CompoundElement["faces"] {
  const face = faceWith(texture);
  return {
    up: face(uvs.up),
    down: face(uvs.down),
    north: face(uvs.north),
    south: face(uvs.south),
    east: face(uvs.east),
    west: face(uvs.west),
  };
}

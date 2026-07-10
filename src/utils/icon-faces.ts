import type { IconData } from "../content.config";

export interface Face {
  className: string;
  texture: string;
}

/** Builds the CSS-cube faces for a 3D icon. `block`/`slab` share the 3-face cube; `stairs` adds a stepped tread. */
export function getFaces(icon: IconData): Face[] {
  if (icon.type === "stairs") {
    return [
      { className: "top-low", texture: icon.top },
      { className: "top-high", texture: icon.top },
      { className: "left-lower", texture: icon.side },
      { className: "left-upper", texture: icon.side },
      { className: "right", texture: icon.side },
      { className: "riser", texture: icon.side },
    ];
  }

  if (icon.type === "block" || icon.type === "slab") {
    return [
      { className: "top", texture: icon.top },
      { className: "left", texture: icon.side },
      { className: "right", texture: icon.side },
    ];
  }

  if (icon.type === "pressure_plate" || icon.type === "button") {
    return [
      { className: "top", texture: icon.texture },
      { className: "left", texture: icon.texture },
      { className: "right", texture: icon.texture },
    ];
  }

  return [];
}

/**
 * Fixed face iteration order for "compound" icons. Shared between
 * ItemIcon.astro's getCompoundFaces (full style computation) and this file's
 * iconSwapTextures (texture-only) so the two can never drift out of sync on
 * ordering -- both must walk each element's faces in the exact same order
 * for the homepage's positional texture-swap (see iconSwapTextures) to line
 * up with what's actually rendered.
 */
export const COMPOUND_FACE_DIRECTIONS = ["up", "down", "north", "south", "east", "west"] as const;

/**
 * Ordered texture URLs for every already-rendered swappable slot of an icon
 * -- powers the homepage's client-side search "face-swap" (see
 * src/pages/variant-icons.json.ts + index.astro's applyTextures). Within one
 * collapsed variant group (e.g. all 10 boat woods, all 16 banner colors),
 * every member shares the exact same shape/geometry -- only the
 * material/color differs -- so swapping to a different variant never needs
 * to recompute layout/positioning, only which texture each already-rendered
 * slot points at.
 *
 * Slot order/count matches ItemIcon.astro's own rendering exactly:
 * getFaces()'s order for block-family icons (reused directly, so the two can
 * never disagree on which texture goes on which face); a single-entry array
 * for wall/fence/fence_gate, whose several parts all paint the same shared
 * texture (the client broadcasts one entry to every slot -- see
 * index.astro's applyTextures); and COMPOUND_FACE_DIRECTIONS order for
 * "compound" icons, one entry per declared face.
 */
export function iconSwapTextures(icon: IconData): string[] {
  if (icon.type === "flat") return [icon.texture];

  if (icon.type === "wall" || icon.type === "fence" || icon.type === "fence_gate") {
    return [icon.texture];
  }

  if (icon.type === "compound") {
    const textures: string[] = [];
    for (const element of icon.elements) {
      for (const direction of COMPOUND_FACE_DIRECTIONS) {
        const face = element.faces[direction];
        if (face) textures.push(face.texture);
      }
    }
    return textures;
  }

  return getFaces(icon).map((face) => face.texture);
}

/**
 * Strips every texture-path field from an icon, leaving only the geometry
 * (box coordinates, declared face directions, uv crop rects, rotation) --
 * used by isIconGeometryUniform to check whether a texture-only swap is safe
 * within a variant group. For every type except "compound", the type alone
 * IS the full geometry (top/side/texture are the only per-type fields, and
 * they're always texture paths), so any two same-type icons are trivially
 * uniform; "compound" is the one type with real non-texture geometry (per-
 * element from/to, per-face uv) that CAN legitimately differ between two
 * same-shape items -- see isIconGeometryUniform's own comment.
 */
function iconGeometryFingerprint(icon: IconData): unknown {
  if (icon.type !== "compound") return { type: icon.type };

  return {
    type: icon.type,
    yRotation: icon.yRotation,
    variant: icon.variant,
    elements: icon.elements.map((element) => ({
      from: element.from,
      to: element.to,
      faces: Object.fromEntries(
        COMPOUND_FACE_DIRECTIONS.filter((direction) => element.faces[direction]).map(
          (direction) => [direction, { uv: element.faces[direction]!.uv }],
        ),
      ),
    })),
  };
}

/**
 * Whether every icon in a variant group shares byte-identical geometry (see
 * iconGeometryFingerprint), i.e. whether iconSwapTextures' texture-URL-only
 * swap is safe for this group. This does NOT always hold: verified against
 * the real generated data (see tests/icon-faces.test.ts's regression test),
 * 41 of 42 current variant groups pass, but wooden_trapdoor's oak/dark_oak
 * members use vanilla's legacy non-orientable trapdoor template (different
 * per-face uv rects -- flipped/offset top and side crops) while its other 10
 * woods use the newer orientable template -- a real vanilla data split, not
 * a pipeline bug (see scripts/lib/model.ts and vendor/mcmeta-summary's
 * template_trapdoor_bottom vs template_orientable_trapdoor_bottom). A future
 * mcmeta version bump could introduce a similar split in a currently-uniform
 * group; this check lets a caller (variant-icons.json.ts) degrade that one
 * group safely (omit its swap textures) without a hand-maintained denylist.
 */
export function isIconGeometryUniform(icons: IconData[]): boolean {
  if (icons.length <= 1) return true;
  const [first, ...rest] = icons.map((icon) => JSON.stringify(iconGeometryFingerprint(icon)));
  return rest.every((fingerprint) => fingerprint === first);
}

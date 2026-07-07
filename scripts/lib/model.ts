import type {
  RawItemDefinitionsData,
  RawModel,
  RawModelsData,
  RawModelTextureValue,
} from "./types.ts";
import { stripMcPrefix } from "./strings.ts";

/** Normalizes a texture map entry to a plain string ref/indirection, unwrapping the extended `{ sprite }` form. */
function normalizeTextureValue(value: RawModelTextureValue): string {
  return typeof value === "string" ? value : value.sprite;
}

const FLAT_TERMINALS = new Set(["item/generated", "item/handheld", "builtin/generated"]);

// Parents whose shared "texture" is a UV atlas for bespoke multi-element
// geometry (the lightning rod's thin pole + base) rather than a paintable
// surface. Unlike fences (also custom elements via the "unknown" fallback
// below, but textured with an ordinary repeating block texture that still
// reads fine as a flat icon from any crop), this atlas can't be shown
// unclipped as a flat icon. scripts/lib/lightning-rod-icon.ts instead places
// its two real UV crops onto a transparent canvas at the model's own
// element offsets, reconstructing the rod's actual silhouette.
const LIGHTNING_ROD_ATLAS_PARENTS = new Set(["block/template_lightning_rod"]);

// Beds are the only `minecraft:composite` items (head + foot sub-models) and
// the only ones using this bespoke multi-element parent. Used below to tell
// which of a composite's two model refs is the head (see
// `findAllModelReferences` + the composite branch in `resolveIconCandidate`).
const BED_HEAD_PARENTS = new Set(["block/template_bed_head"]);

// Shared, material-agnostic geometry templates for 5 more block shapes that
// otherwise fell through to the generic "unknown" flat-texture fallback (a
// crop of the block's own `particle`/`texture` var, which doesn't read as
// the real shape -- a fence just looked like a flat plank square). Each is a
// single-texture shape (one material texture painted on every face), unlike
// bed's multi-texture composite.
const PRESSURE_PLATE_PARENTS = new Set(["block/pressure_plate_up"]);
const WALL_PARENTS = new Set(["block/wall_inventory"]);
const BUTTON_PARENTS = new Set(["block/button_inventory"]);
// Bamboo is the one exception to "shared template" for these two shapes --
// it has its own parent (`custom_fence_inventory` / `template_custom_fence_gate`)
// since bamboo planks need a narrower post/bar cross-section than every other
// wood type. The declared element coordinates differ (bars span a shorter
// z-range), but the *rendered silhouette* is identical once posts occlude the
// bar's ends, so both map to the same fence/fence_gate icon types and CSS.
const FENCE_PARENTS = new Set(["block/fence_inventory", "block/custom_fence_inventory"]);
const FENCE_GATE_PARENTS = new Set([
  "block/template_fence_gate",
  "block/template_custom_fence_gate",
]);

type ChainCategory =
  | "flat"
  | "cube_all"
  | "cube_column"
  | "cube_bottom_top"
  | "cube"
  | "orientable"
  | "slab"
  | "stairs"
  | "lightning_rod"
  | "bed_head"
  | "pressure_plate"
  | "wall"
  | "button"
  | "fence"
  | "fence_gate"
  | "unknown";

/**
 * Classifies a resolved model parent chain (ordered leaf -> root) against
 * the icon heuristics from docs/PLAN.md. The first match walking outward
 * from the leaf wins, since more specific parents (e.g. block/cube_all)
 * always sit closer to the leaf than the generic parents they extend
 * (e.g. block/cube).
 */
function classifyChain(chainNames: string[]): ChainCategory {
  for (const name of chainNames) {
    if (FLAT_TERMINALS.has(name)) return "flat";
    if (LIGHTNING_ROD_ATLAS_PARENTS.has(name)) return "lightning_rod";
    if (BED_HEAD_PARENTS.has(name)) return "bed_head";
    if (PRESSURE_PLATE_PARENTS.has(name)) return "pressure_plate";
    if (WALL_PARENTS.has(name)) return "wall";
    if (BUTTON_PARENTS.has(name)) return "button";
    if (FENCE_PARENTS.has(name)) return "fence";
    if (FENCE_GATE_PARENTS.has(name)) return "fence_gate";
    if (name === "block/cube_all") return "cube_all";
    if (name === "block/cube_column" || name === "block/cube_column_horizontal")
      return "cube_column";
    if (name === "block/cube_bottom_top") return "cube_bottom_top";
    if (name === "block/orientable") return "orientable";
    if (name === "block/cube") return "cube";
    if (name === "block/slab") return "slab";
    if (name === "block/stairs") return "stairs";
  }
  return "unknown";
}

export interface ModelChain {
  /** Model names (no "minecraft:" prefix), ordered from leaf to root. */
  chainNames: string[];
  /** Merged texture variable map: root values, overridden by descendants. */
  mergedTextures: Record<string, string>;
}

/**
 * Walks a model's `parent` chain, merging each model's `textures` map along
 * the way (root values first, overridden by more specific descendants).
 * Guards against cycles and excessive depth.
 */
export function walkModelChain(modelRef: string, models: RawModelsData, maxDepth = 32): ModelChain {
  const chainNames: string[] = [];
  const layers: Record<string, string>[] = [];

  let current: string | undefined = stripMcPrefix(modelRef);
  let depth = 0;
  while (current && depth < maxDepth && !chainNames.includes(current)) {
    chainNames.push(current);
    const model: RawModel | undefined = models[current];
    if (!model) break;
    const textures: Record<string, string> = {};
    for (const [key, value] of Object.entries(model.textures ?? {})) {
      textures[key] = normalizeTextureValue(value);
    }
    layers.push(textures);
    current = model.parent ? stripMcPrefix(model.parent) : undefined;
    depth += 1;
  }

  const mergedTextures: Record<string, string> = {};
  for (let i = layers.length - 1; i >= 0; i -= 1) {
    Object.assign(mergedTextures, layers[i]);
  }

  return { chainNames, mergedTextures };
}

/** Resolves a texture variable, following "#name" indirections to a final concrete ref. */
function resolveTextureRef(
  key: string,
  merged: Record<string, string>,
  depth = 0,
): string | undefined {
  if (depth > 16) return undefined;
  const raw = merged[key];
  if (raw === undefined) return undefined;
  if (raw.startsWith("#")) return resolveTextureRef(raw.slice(1), merged, depth + 1);
  return stripMcPrefix(raw);
}

/** Best-effort fallback: the first texture variable in the merged map that resolves to a concrete ref. */
function firstResolvableTexture(merged: Record<string, string>): string | undefined {
  for (const key of Object.keys(merged)) {
    const resolved = resolveTextureRef(key, merged);
    if (resolved) return resolved;
  }
  return undefined;
}

/**
 * Depth-first search for the first nested `{ type: "minecraft:model", model: <ref> }`
 * node inside an item definition's `model` tree. Handles the common case
 * directly, and falls back to searching `select`/`condition`/`composite`/
 * `range_dispatch`/`special` trees for non-`minecraft:model` types.
 */
export function findModelReference(node: unknown): string | undefined {
  if (!node || typeof node !== "object") return undefined;

  const obj = node as Record<string, unknown>;
  if (obj.type === "minecraft:model" && typeof obj.model === "string") {
    return obj.model;
  }

  for (const value of Object.values(obj)) {
    if (Array.isArray(value)) {
      for (const item of value) {
        const found = findModelReference(item);
        if (found) return found;
      }
    } else if (value && typeof value === "object") {
      const found = findModelReference(value);
      if (found) return found;
    }
  }

  return undefined;
}

/**
 * Same depth-first search as `findModelReference`, but collects every nested
 * `{ type: "minecraft:model", model: <ref> }` node instead of stopping at the
 * first -- used to pull both sub-model refs out of a bed's `minecraft:composite`
 * item definition (head first, then foot, matching the composite's own
 * `models` array order).
 */
export function findAllModelReferences(node: unknown): string[] {
  if (!node || typeof node !== "object") return [];

  const obj = node as Record<string, unknown>;
  const refs: string[] = [];
  if (obj.type === "minecraft:model" && typeof obj.model === "string") {
    refs.push(obj.model);
  }

  for (const value of Object.values(obj)) {
    if (Array.isArray(value)) {
      for (const item of value) refs.push(...findAllModelReferences(item));
    } else if (value && typeof value === "object") {
      refs.push(...findAllModelReferences(value));
    }
  }

  return refs;
}

export interface SpecialModel {
  /** The flat/block model this special renderer falls back to for e.g. inventory display. */
  base: string;
  /** The special renderer's kind, e.g. "banner", "shulker_box", "chest" (no "minecraft:" prefix). */
  specialType: string;
  /** The special renderer's own config object, e.g. `{ type: "minecraft:banner", color: "white" }`. */
  specialModel: Record<string, unknown>;
}

/**
 * Depth-first search for the first nested `{ type: "minecraft:special", base: <ref>, model: {...} }`
 * node — the shape used by items rendered via a bespoke Java renderer (banners, shulker boxes,
 * chests, skulls, shields, ...) rather than a plain block/item model.
 */
export function findSpecialModel(node: unknown): SpecialModel | undefined {
  if (!node || typeof node !== "object") return undefined;

  const obj = node as Record<string, unknown>;
  if (obj.type === "minecraft:special" && typeof obj.base === "string" && obj.model) {
    const specialModel = obj.model as Record<string, unknown>;
    if (typeof specialModel.type === "string") {
      return { base: obj.base, specialType: stripMcPrefix(specialModel.type), specialModel };
    }
  }

  for (const value of Object.values(obj)) {
    if (Array.isArray(value)) {
      for (const item of value) {
        const found = findSpecialModel(item);
        if (found) return found;
      }
    } else if (value && typeof value === "object") {
      const found = findSpecialModel(value);
      if (found) return found;
    }
  }

  return undefined;
}

export type IconCandidate =
  | { type: "flat"; textureRef: string }
  | { type: "block"; topRef: string; sideRef: string }
  | { type: "slab"; topRef: string; sideRef: string }
  | { type: "stairs"; topRef: string; sideRef: string }
  /** A colored banner — resolved to a generated icon (see scripts/lib/banner-icon.ts), not a vendored texture. */
  | { type: "banner"; colorId: string }
  /** A lightning rod variant — top/side cropped from `textureRef`'s atlas (see scripts/lib/lightning-rod-icon.ts), not a vendored texture. */
  | { type: "lightning_rod"; textureRef: string }
  /** A bed color — resolved to a pre-baked Bedrock Edition sprite (see scripts/lib/bedrock-colors.ts), not a vendored Java texture. */
  | { type: "bed"; colorId: string }
  /** Single-texture compound shapes: one material texture painted on every face of a multi-element model (see ItemIcon.astro's dedicated rendering branch for each). */
  | { type: "pressure_plate"; textureRef: string }
  | { type: "wall"; textureRef: string }
  | { type: "button"; textureRef: string }
  | { type: "fence"; textureRef: string }
  | { type: "fence_gate"; textureRef: string };

/**
 * Resolves an item's icon down to bare texture refs (e.g. "block/oak_log_top",
 * no "minecraft:" prefix, no extension). Returns undefined when nothing in
 * the item definition / model chain resolves to a texture — the caller
 * (parse.ts) is responsible for falling back to the placeholder icon and
 * recording the item id as unresolved.
 */
export function resolveIconCandidate(
  itemId: string,
  itemDefinitions: RawItemDefinitionsData,
  models: RawModelsData,
): IconCandidate | undefined {
  const definition = itemDefinitions[itemId];
  if (!definition) return undefined;

  // Beds are the only `minecraft:composite` item today: 2 sub-model refs
  // (head, foot). We only need the color, not full texture resolution --
  // the icon itself is a pre-baked Bedrock Edition sprite, not reconstructed
  // from these Java textures (see scripts/lib/bedrock-colors.ts).
  const allModelRefs = findAllModelReferences(definition.model);
  if (allModelRefs.length === 2) {
    const headChain = walkModelChain(allModelRefs[0], models);
    if (classifyChain(headChain.chainNames) === "bed_head") {
      const headModelName = stripMcPrefix(allModelRefs[0]);
      const colorId = headModelName
        .split("/")
        .pop()
        ?.replace(/_bed_head$/, "");
      return colorId ? { type: "bed", colorId } : undefined;
    }
  }

  const modelRef = findModelReference(definition.model);
  const special = modelRef ? undefined : findSpecialModel(definition.model);

  if (special?.specialType === "banner" && typeof special.specialModel.color === "string") {
    return { type: "banner", colorId: special.specialModel.color };
  }

  const resolvedModelRef = modelRef ?? special?.base;
  if (!resolvedModelRef) return undefined;

  const chain = walkModelChain(resolvedModelRef, models);
  const category = classifyChain(chain.chainNames);
  const resolve = (key: string): string | undefined => resolveTextureRef(key, chain.mergedTextures);

  switch (category) {
    case "flat": {
      const textureRef =
        resolve("layer0") ?? resolve("particle") ?? firstResolvableTexture(chain.mergedTextures);
      return textureRef ? { type: "flat", textureRef } : undefined;
    }
    case "cube_all": {
      const ref = resolve("all");
      return ref ? { type: "block", topRef: ref, sideRef: ref } : undefined;
    }
    case "cube_column": {
      const topRef = resolve("end");
      const sideRef = resolve("side");
      return topRef && sideRef ? { type: "block", topRef, sideRef } : undefined;
    }
    case "cube_bottom_top": {
      const topRef = resolve("top");
      const sideRef = resolve("side");
      return topRef && sideRef ? { type: "block", topRef, sideRef } : undefined;
    }
    case "cube": {
      const topRef = resolve("up");
      const sideRef = resolve("north");
      return topRef && sideRef ? { type: "block", topRef, sideRef } : undefined;
    }
    case "orientable": {
      const topRef = resolve("top");
      const sideRef = resolve("front");
      return topRef && sideRef ? { type: "block", topRef, sideRef } : undefined;
    }
    case "slab": {
      const topRef = resolve("top");
      const sideRef = resolve("side");
      return topRef && sideRef ? { type: "slab", topRef, sideRef } : undefined;
    }
    case "stairs": {
      const topRef = resolve("top");
      const sideRef = resolve("side");
      return topRef && sideRef ? { type: "stairs", topRef, sideRef } : undefined;
    }
    case "lightning_rod": {
      const textureRef = resolve("texture");
      return textureRef ? { type: "lightning_rod", textureRef } : undefined;
    }
    case "pressure_plate": {
      const textureRef = resolve("texture");
      return textureRef ? { type: "pressure_plate", textureRef } : undefined;
    }
    case "wall": {
      const textureRef = resolve("wall");
      return textureRef ? { type: "wall", textureRef } : undefined;
    }
    case "button": {
      const textureRef = resolve("texture");
      return textureRef ? { type: "button", textureRef } : undefined;
    }
    case "fence": {
      const textureRef = resolve("texture");
      return textureRef ? { type: "fence", textureRef } : undefined;
    }
    case "fence_gate": {
      const textureRef = resolve("texture");
      return textureRef ? { type: "fence_gate", textureRef } : undefined;
    }
    case "unknown":
    default: {
      const textureRef =
        resolve("particle") ?? resolve("layer0") ?? firstResolvableTexture(chain.mergedTextures);
      return textureRef ? { type: "flat", textureRef } : undefined;
    }
  }
}

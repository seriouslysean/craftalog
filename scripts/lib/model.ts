import { isHeadKind } from "./head-icon.ts";
import type { HeadKind } from "./head-icon.ts";
import type {
  RawItemDefinitionsData,
  RawModel,
  RawModelElement,
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

  // A `minecraft:select` node's `fallback` is the item's default/year-round
  // appearance; `cases` are conditional overrides (e.g. chest/trapped_chest's
  // Christmas Dec-24-to-26 texture swap, whose special model genuinely names
  // a different texture than the fallback -- unlike the copper golem statue's
  // pose cases, which all name the same texture, so DFS order never mattered
  // there). This catalog renders exactly one static icon per item, so the
  // fallback -- the item's real default inventory appearance -- must win
  // over whichever `cases` entry a plain DFS below happens to reach first.
  if (obj.type === "minecraft:select" && obj.fallback) {
    const fromFallback = findSpecialModel(obj.fallback);
    if (fromFallback) return fromFallback;
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

/** One resolved face of a "compound" element: a bare texture ref (no "/textures/" prefix — parse.ts adds that) plus its texture-atlas crop rect. */
export interface CompoundFaceCandidate {
  texture: string;
  /** [u0, v0, u1, v1], 0-16 texture-pixel space (explicit from the model JSON, or defaultFaceUv's position-derived fallback). */
  uv: [number, number, number, number];
}

/** A single box element for the generic "compound" icon type. */
export interface CompoundElementCandidate {
  from: [number, number, number];
  to: [number, number, number];
  faces: Partial<
    Record<"up" | "down" | "north" | "south" | "east" | "west", CompoundFaceCandidate>
  >;
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
  /** The shield — resolved to a hand-authored compound icon (see scripts/lib/shield-icon.ts), not a vendored texture. Only one candidate exists (the plain `shield` item, no color/pattern variants), so this carries no further data. */
  | { type: "shield" }
  /** A copper golem statue tier — resolved to a compound icon extracted from real vendored Bedrock entity geometry (see scripts/lib/copper-golem-icon.ts), not hand-authored. `textureRef` is this tier's Java texture ref (e.g. "entity/copper_golem/copper_golem_exposed"), read straight from the item definition's own `texture` field. */
  | { type: "copper_golem_statue"; textureRef: string }
  /** A shulker box color (16 dyed + undyed) — resolved to a compound icon extracted from real vendored Bedrock entity geometry (see scripts/lib/shulker-icon.ts), not hand-authored. `textureRef` is this color's Java entity texture ref (e.g. "entity/shulker/shulker_black", or "entity/shulker/shulker" for undyed), read straight from the item definition's own `texture` field — covers all 16 dye colors + undyed generically, no hand list. */
  | { type: "shulker_box"; textureRef: string }
  /** A mob head (skull block item) — resolved to a compound icon cropped from `kind`'s own vendored entity skin texture (see scripts/lib/head-icon.ts), not a vendored block model. Only kinds in HEAD_KIND_TEXTURES reach here — "dragon" and player heads fail open to the existing base-model chain resolution instead (see resolveIconCandidate). */
  | { type: "head"; kind: HeadKind }
  /** The conduit — resolved to a compound icon cropped from its own vendored entity texture (see scripts/lib/head-icon.ts), the same treatment as heads. Only one variant exists, so this carries no further data. */
  | { type: "conduit" }
  /** A chest-family texture variant — resolved to a hand-authored compound icon (see scripts/lib/chest-icon.ts), not a vendored texture. `textureName` is the bare entity-atlas name (e.g. "normal", "trapped", "ender", "copper", "copper_exposed") read straight from the item definition's own `texture` field, mapping to `entity/chest/<textureName>.png`. */
  | { type: "chest"; textureName: string }
  /** The decorated pot — resolved to a hand-authored compound icon (see scripts/lib/decorated-pot-icon.ts), not a vendored texture. Only one candidate exists (the plain `decorated_pot` item, no sherd-pattern variants — patterned pots aren't a distinct catalog item), so this carries no further data. */
  | { type: "decorated_pot" }
  /** Single-texture compound shapes: one material texture painted on every face of a multi-element model (see ItemIcon.astro's dedicated rendering branch for each). */
  | { type: "pressure_plate"; textureRef: string }
  | { type: "wall"; textureRef: string }
  | { type: "button"; textureRef: string }
  | { type: "fence"; textureRef: string }
  | { type: "fence_gate"; textureRef: string }
  /**
   * Generic multi-element compound (e.g. anvil): real per-element box
   * geometry, each face resolved to its own texture. See
   * extractCompoundElements. `flatFallbackRef` is the same particle/layer0
   * guess the plain "unknown" flat fallback would have used — a safety net
   * for generate.ts in case none of this candidate's own element textures
   * actually exist as files (so a chain with elements never regresses to
   * fully unresolved when the old flat guess would have worked fine).
   */
  | {
      type: "compound";
      elements: CompoundElementCandidate[];
      yRotation: number;
      flatFallbackRef?: string;
    };

// The vanilla default `display.gui` transform every block model inherits
// unless it overrides "gui" itself: block/block.json (the root parent of
// nearly every block model) declares `rotation: [30, 225, 0]`. Only the yaw
// (index 1) matters here — see findGuiYawDelta.
const DEFAULT_GUI_YAW = 225;

/**
 * Walks a model's parent chain (leaf to root, same order as walkModelChain's
 * chainNames) looking for the first model that defines its own `elements`
 * array — typically a shared template parent (e.g. block/template_anvil),
 * not the leaf itself. Returns undefined when nothing in the chain has real
 * element geometry (the common case — most items fall through classifyChain
 * to a named shape or the flat fallback well before this is ever called).
 */
function findElementsInChain(
  chainNames: string[],
  models: RawModelsData,
): RawModelElement[] | undefined {
  for (const name of chainNames) {
    const elements = models[name]?.elements;
    if (elements && elements.length > 0) return elements;
  }
  return undefined;
}

/**
 * Walks the chain for the first model that declares its own `display.gui`
 * override, and returns its yaw (rotation[1]) minus the vanilla default
 * (225°) — i.e. how much extra Y rotation this specific model's inventory
 * icon needs on top of the shared camera, same idea already established for
 * fence_gate (whose `display.gui` yaw of 45° is 180° off the default, so it
 * gets an extra rotateY(180deg) — see ItemIcon.astro). Returns 0 when no
 * model in the chain overrides "gui" (inherits the default unchanged, e.g.
 * anvil — see the "why gui, not fixed" note on extractCompoundElements).
 */
function findGuiYawDelta(chainNames: string[], models: RawModelsData): number {
  for (const name of chainNames) {
    const guiYaw = models[name]?.display?.gui?.rotation?.[1];
    if (guiYaw !== undefined) return guiYaw - DEFAULT_GUI_YAW;
  }
  return 0;
}

/**
 * Resolves one element face's texture attribute against the merged texture
 * map. Normally "#body"-style, but at least one vendored model
 * (block/heavy_core) omits the "#" on its own texture variable ("all"
 * instead of "#all") despite every other vanilla model prefixing texture
 * variable refs — so a variable-name lookup is always tried first
 * (stripping a leading "#" if present), falling back to treating the raw
 * value as an already-resolved literal ref only when no such variable exists.
 */
function resolveElementFaceTexture(
  rawTexture: string,
  merged: Record<string, string>,
): string | undefined {
  const key = rawTexture.startsWith("#") ? rawTexture.slice(1) : rawTexture;
  const viaVariable = resolveTextureRef(key, merged);
  if (viaVariable) return viaVariable;
  return rawTexture.startsWith("#") ? undefined : stripMcPrefix(rawTexture);
}

/**
 * Minecraft's default `uv` for a face that omits an explicit rect: derived
 * from the element's own from/to position on the two axes relevant to that
 * face -- NOT a flat [0,0,16,16] for every face (verified two ways against
 * this repo's own vendored vanilla models: (1) template_anvil.json's
 * explicit north/south-face uv for its base element, [2,12,14,16], is
 * exactly what this formula derives for that face/element when left to
 * default -- vanilla only bothers overriding uv where the result needs to
 * differ from this default, so an explicit value matching it is strong
 * confirmation; (2) composter.json's 5 split elements declare no explicit
 * uv on ANY face, and only tile seamlessly -- no visible seam between the
 * two corner posts and two side rails sharing one "side"/"top" texture --
 * if each element's own from/to position selects its own sub-region of
 * that shared texture, not the same full 16x16 crop repeated on every
 * element). Matches vanilla's own default-UV algorithm (BlockElement, the
 * Java client's block-model loader).
 */
function defaultFaceUv(
  face: "up" | "down" | "north" | "south" | "east" | "west",
  from: [number, number, number],
  to: [number, number, number],
): [number, number, number, number] {
  const [x0, y0, z0] = from;
  const [x1, y1, z1] = to;
  switch (face) {
    case "up":
      return [x0, z0, x1, z1];
    case "down":
      return [x0, 16 - z1, x1, 16 - z0];
    case "north":
      return [16 - x1, 16 - y1, 16 - x0, 16 - y0];
    case "south":
      return [x0, 16 - y1, x1, 16 - y0];
    case "west":
      return [z0, 16 - y1, z1, 16 - y0];
    case "east":
      return [16 - z1, 16 - y1, 16 - z0, 16 - y0];
  }
}

/**
 * Extracts a generic "compound" icon candidate from a model chain's real
 * element geometry, for block models classifyChain doesn't recognize as any
 * named shape (e.g. anvil, whose 4-element template_anvil parent has no
 * dedicated classifyChain branch). All 6 declared faces are kept per
 * element -- up/north/east are the only 3 a SIMPLE CONVEX box ever shows
 * from the compound camera (rotateX(-35deg) rotateY(-135deg), matching the
 * face set vanilla's own GUI camera [30, 225, 0] shows: east on
 * screen-left, north on screen-right -- see ItemIcon.astro's .compound
 * rule for the evidence), but concave/hollow/stepped shapes (e.g.
 * composter's open-top hollow box, grindstone's post-and-wheel assembly)
 * genuinely expose down/south/west-facing surfaces too (see
 * ItemIcon.astro's computeFaceStyle, which renders whichever of the 6 a
 * given element actually has). Each kept face also carries its `uv` crop
 * rect (explicit from the model JSON, or defaultFaceUv's fallback) --
 * see ItemIcon.astro's computeUvCrop for how that's applied. Returns
 * undefined when the chain has no element geometry, or when every
 * element's faces are undefined/unresolvable (so the caller can fall back
 * to the flat-texture guess).
 *
 * yRotation is sourced from `display.gui` (the vanilla inventory-icon
 * display context), NOT `display.fixed` (the item-frame context) — a block
 * model's `display.fixed` transform has no bearing on how it looks in an
 * inventory/GUI slot, which is what this catalog's icons emulate. Verified
 * against vendor/mcmeta-assets/assets/minecraft/models/block/block.json
 * (the root parent nearly every block model inherits from), whose `display`
 * object lists "gui" as its own context distinct from "fixed"/"ground"/
 * "thirdperson_righthand"/etc. — the same distinction the already-shipped
 * fence_gate handling relies on (see findGuiYawDelta).
 */
function extractCompoundElements(
  chainNames: string[],
  merged: Record<string, string>,
  models: RawModelsData,
): { elements: CompoundElementCandidate[]; yRotation: number } | undefined {
  const rawElements = findElementsInChain(chainNames, models);
  if (!rawElements) return undefined;

  const elements: CompoundElementCandidate[] = [];
  for (const rawEl of rawElements) {
    const faces: CompoundElementCandidate["faces"] = {};
    for (const face of ["up", "down", "north", "south", "east", "west"] as const) {
      const rawFace = rawEl.faces?.[face];
      if (!rawFace) continue;
      const ref = resolveElementFaceTexture(rawFace.texture, merged);
      if (!ref) continue;
      const uv = rawFace.uv ?? defaultFaceUv(face, rawEl.from, rawEl.to);
      faces[face] = { texture: ref, uv };
    }
    if (Object.keys(faces).length > 0) elements.push({ from: rawEl.from, to: rawEl.to, faces });
  }
  if (elements.length === 0) return undefined;

  return { elements, yRotation: findGuiYawDelta(chainNames, models) };
}

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

  if (
    special?.specialType === "copper_golem_statue" &&
    typeof special.specialModel.texture === "string"
  ) {
    // e.g. "minecraft:textures/entity/copper_golem/copper_golem_exposed.png"
    // -> "entity/copper_golem/copper_golem_exposed". findSpecialModel always
    // resolves a `minecraft:select`'s `fallback` (this item's `standing`
    // pose case) over its `cases`, but every one of this item's cases names
    // the same texture anyway (unlike chest's Christmas case, below), so
    // which one is picked wouldn't actually change the result here.
    const textureRef = stripMcPrefix(special.specialModel.texture)
      .replace(/^textures\//, "")
      .replace(/\.png$/, "");
    return { type: "copper_golem_statue", textureRef };
  }

  if (special?.specialType === "shield") {
    return { type: "shield" };
  }

  if (special?.specialType === "shulker_box" && typeof special.specialModel.texture === "string") {
    // e.g. "minecraft:shulker_black" -> "entity/shulker/shulker_black";
    // "minecraft:shulker" (the undyed default, no color suffix) ->
    // "entity/shulker/shulker". Covers all 16 dye colors + undyed
    // generically off this one field, no hand list of color names.
    const textureName = stripMcPrefix(special.specialModel.texture);
    return { type: "shulker_box", textureRef: `entity/shulker/${textureName}` };
  }

  if (special?.specialType === "head" && typeof special.specialModel.kind === "string") {
    const { kind } = special.specialModel;
    if (isHeadKind(kind)) {
      return { type: "head", kind };
    }
    // Unsupported kind (currently just "dragon", whose entity texture isn't
    // a standard skin box-UV atlas -- see scripts/lib/head-icon.ts) -- fall
    // through to the base-model chain resolution below, same fail-open
    // behavior as before this renderer existed (and as player_head, which
    // has no `kind` at all, always did).
  }

  if (special?.specialType === "conduit") {
    return { type: "conduit" };
  }

  if (special?.specialType === "chest" && typeof special.specialModel.texture === "string") {
    // e.g. "minecraft:normal" -> "normal". `chest`/`trapped_chest` wrap this
    // in a `minecraft:select` on `local_time` with a Dec-24-to-26 "christmas"
    // case -- findSpecialModel's fallback-first rule (see its own comment)
    // guarantees this always reads the year-round texture, never the
    // seasonal one.
    const textureName = stripMcPrefix(special.specialModel.texture);
    return { type: "chest", textureName };
  }

  if (special?.specialType === "decorated_pot") {
    return { type: "decorated_pot" };
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

      // Before committing to a flat texture, check whether some model in
      // the chain has real element geometry (e.g. anvil's template_anvil
      // parent) — if so, render the actual shape instead of a flat crop of
      // its particle/layer0 texture. The flat guess still rides along as
      // flatFallbackRef in case none of the compound's own element textures
      // exist as files (generate.ts is the one that can check).
      const compound = extractCompoundElements(chain.chainNames, chain.mergedTextures, models);
      if (compound) return { type: "compound", ...compound, flatFallbackRef: textureRef };

      return textureRef ? { type: "flat", textureRef } : undefined;
    }
  }
}

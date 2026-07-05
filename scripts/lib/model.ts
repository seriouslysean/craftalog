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

type ChainCategory =
  | "flat"
  | "cube_all"
  | "cube_column"
  | "cube_bottom_top"
  | "cube"
  | "orientable"
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
    if (name === "block/cube_all") return "cube_all";
    if (name === "block/cube_column" || name === "block/cube_column_horizontal")
      return "cube_column";
    if (name === "block/cube_bottom_top") return "cube_bottom_top";
    if (name === "block/orientable") return "orientable";
    if (name === "block/cube") return "cube";
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

export type IconCandidate =
  | { type: "flat"; textureRef: string }
  | { type: "block"; topRef: string; sideRef: string };

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

  const modelRef = findModelReference(definition.model);
  if (!modelRef) return undefined;

  const chain = walkModelChain(modelRef, models);
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
    case "unknown":
    default: {
      const textureRef =
        resolve("particle") ?? resolve("layer0") ?? firstResolvableTexture(chain.mergedTextures);
      return textureRef ? { type: "flat", textureRef } : undefined;
    }
  }
}

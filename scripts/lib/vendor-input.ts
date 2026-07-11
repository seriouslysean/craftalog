/**
 * Shared vendor-input loading for the parse + validate entry points. Both
 * MUST read the exact same files with the exact same shapes for validate's
 * drift check to mean anything -- so the whole block lives here once,
 * instead of being duplicated in lockstep across scripts/parse.ts and
 * scripts/validate.ts.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { PNG } from "pngjs";

import type { GenerateInput } from "./generate.ts";
import type {
  RawBannerPatternRegistry,
  RawBedrockGeometryFile,
  RawItemComponentsData,
  RawItemDefinitionsData,
  RawLangFile,
  RawLegacyBedrockGeometryFile,
  RawModelsData,
  RawRecipesData,
  RawTagsData,
} from "./types.ts";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(scriptDir, "../..");

export const VENDOR_SUMMARY_DIR = path.join(ROOT, "vendor/mcmeta-summary");
export const VENDOR_TEXTURES_DIR = path.join(ROOT, "vendor/mcmeta-assets/assets/minecraft/textures");
export const VENDOR_BEDROCK_ITEMS_DIR = path.join(
  ROOT,
  "vendor/bedrock-samples/resource_pack/textures/items",
);
export const VENDOR_BEDROCK_MODELS_DIR = path.join(
  ROOT,
  "vendor/bedrock-samples/resource_pack/models/entity",
);

function readJson<T>(filePath: string): T {
  return JSON.parse(fs.readFileSync(filePath, "utf8")) as T;
}

/**
 * Reads every vendored input file (mcmeta-summary JSON, bedrock-samples
 * geometry) and builds the I/O closures (texture existence/dimension checks
 * against mcmeta-assets, bed icon checks against bedrock-samples) that
 * scripts/lib/generate.ts's in-memory pipeline needs. Requires the vendor/
 * submodules to be populated (`npm run vendor:init`).
 */
export function loadVendorGenerateInput(): GenerateInput {
  const version = fs.readFileSync(path.join(VENDOR_SUMMARY_DIR, "version.txt"), "utf8").trim();
  const recipesRaw = readJson<RawRecipesData>(
    path.join(VENDOR_SUMMARY_DIR, "data/recipe/data.json"),
  );
  const tagsRaw = readJson<RawTagsData>(path.join(VENDOR_SUMMARY_DIR, "data/tag/item/data.json"));
  const itemDefsRaw = readJson<RawItemDefinitionsData>(
    path.join(VENDOR_SUMMARY_DIR, "assets/item_definition/data.json"),
  );
  const modelsRaw = readJson<RawModelsData>(
    path.join(VENDOR_SUMMARY_DIR, "assets/model/data.json"),
  );
  const componentsRaw = readJson<RawItemComponentsData>(
    path.join(VENDOR_SUMMARY_DIR, "item_components/data.json"),
  );
  const langRaw = readJson<RawLangFile>(path.join(VENDOR_SUMMARY_DIR, "assets/lang/data.json"));
  const enUs = langRaw.en_us ?? {};
  const bannerPatternsRaw = readJson<RawBannerPatternRegistry>(
    path.join(VENDOR_SUMMARY_DIR, "data/banner_pattern/data.json"),
  );
  const bannerPatternTagsRaw = readJson<RawTagsData>(
    path.join(VENDOR_SUMMARY_DIR, "data/tag/banner_pattern/data.json"),
  );
  const copperGolemGeoRaw = readJson<RawBedrockGeometryFile>(
    path.join(VENDOR_BEDROCK_MODELS_DIR, "copper_golem.geo.json"),
  );
  const shulkerGeoRaw = readJson<RawLegacyBedrockGeometryFile>(
    path.join(VENDOR_BEDROCK_MODELS_DIR, "shulker.geo.json"),
  );

  const textureExists = (ref: string): boolean =>
    fs.existsSync(path.join(VENDOR_TEXTURES_DIR, `${ref}.png`));
  const textureDimensions = (ref: string): { width: number; height: number } | undefined => {
    const filePath = path.join(VENDOR_TEXTURES_DIR, `${ref}.png`);
    if (!fs.existsSync(filePath)) return undefined;
    const { width, height } = PNG.sync.read(fs.readFileSync(filePath));
    return { width, height };
  };
  const bedrockBedIconExists = (bedrockColorName: string): boolean =>
    fs.existsSync(path.join(VENDOR_BEDROCK_ITEMS_DIR, `bed_${bedrockColorName}.png`));

  return {
    version,
    recipesRaw,
    tagsRaw,
    itemDefsRaw,
    modelsRaw,
    componentsRaw,
    enUs,
    bannerPatternsRaw,
    bannerPatternTagsRaw,
    copperGolemGeoRaw,
    shulkerGeoRaw,
    textureExists,
    textureDimensions,
    bedrockBedIconExists,
  };
}

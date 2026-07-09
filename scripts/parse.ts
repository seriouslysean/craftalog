/**
 * Parses vendored mcmeta-summary + mcmeta-assets data into the generated
 * data contract described in docs/PLAN.md: src/data/generated/{recipes,items,meta}.json
 * and the referenced texture PNGs under public/textures/{item,block}/.
 *
 * Run via `npm run parse`. Requires the vendor/ submodules to be populated
 * (`npm run vendor:init`).
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { generateBannerIcon } from "./lib/banner-icon.ts";
import { generate } from "./lib/generate.ts";
import { HUD_ICON_RELATIVE_PATHS, HUD_ICON_VENDOR_BASE } from "./lib/hud-icons.ts";
import { generateLeatherArmorIcon } from "./lib/leather-armor-icon.ts";
import { generateLightningRodIcon } from "./lib/lightning-rod-icon.ts";
import { sortKeysDeep } from "./lib/strings.ts";
import type {
  RawItemComponentsData,
  RawItemDefinitionsData,
  RawLangFile,
  RawModelsData,
  RawRecipesData,
  RawTagsData,
} from "./lib/types.ts";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(scriptDir, "..");

const VENDOR_SUMMARY_DIR = path.join(ROOT, "vendor/mcmeta-summary");
const VENDOR_TEXTURES_DIR = path.join(ROOT, "vendor/mcmeta-assets/assets/minecraft/textures");
const VENDOR_BEDROCK_ITEMS_DIR = path.join(
  ROOT,
  "vendor/bedrock-samples/resource_pack/textures/items",
);
const GENERATED_DIR = path.join(ROOT, "src/data/generated");
const PUBLIC_TEXTURES_DIR = path.join(ROOT, "public/textures");

function readJson<T>(filePath: string): T {
  return JSON.parse(fs.readFileSync(filePath, "utf8")) as T;
}

function writeJson(filePath: string, data: unknown): void {
  const sorted = sortKeysDeep(data);
  fs.writeFileSync(filePath, `${JSON.stringify(sorted, null, 2)}\n`);
}

function main(): void {
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

  const textureExists = (ref: string): boolean =>
    fs.existsSync(path.join(VENDOR_TEXTURES_DIR, `${ref}.png`));
  const bedrockBedIconExists = (bedrockColorName: string): boolean =>
    fs.existsSync(path.join(VENDOR_BEDROCK_ITEMS_DIR, `bed_${bedrockColorName}.png`));

  const {
    recipes,
    items,
    meta,
    texturesToCopy,
    bannerIconsToSynthesize,
    lightningRodIconsToSynthesize,
    bedIconsToCopy,
    leatherArmorIconsToSynthesize,
  } = generate({
    version,
    recipesRaw,
    tagsRaw,
    itemDefsRaw,
    modelsRaw,
    componentsRaw,
    enUs,
    textureExists,
    bedrockBedIconExists,
  });

  // Clean + repopulate the generated texture dirs.
  const itemTexturesDir = path.join(PUBLIC_TEXTURES_DIR, "item");
  const blockTexturesDir = path.join(PUBLIC_TEXTURES_DIR, "block");
  const hudTexturesDir = path.join(PUBLIC_TEXTURES_DIR, "hud");
  fs.rmSync(itemTexturesDir, { recursive: true, force: true });
  fs.rmSync(blockTexturesDir, { recursive: true, force: true });
  fs.rmSync(hudTexturesDir, { recursive: true, force: true });
  fs.mkdirSync(itemTexturesDir, { recursive: true });
  fs.mkdirSync(blockTexturesDir, { recursive: true });
  fs.mkdirSync(hudTexturesDir, { recursive: true });

  for (const ref of texturesToCopy) {
    const sourcePath = path.join(VENDOR_TEXTURES_DIR, `${ref}.png`);
    const destPath = path.join(PUBLIC_TEXTURES_DIR, `${ref}.png`);
    fs.mkdirSync(path.dirname(destPath), { recursive: true });
    fs.copyFileSync(sourcePath, destPath);
  }

  const bannerBasePath = path.join(VENDOR_TEXTURES_DIR, "entity/banner/banner_base.png");
  const bannerBasePng = fs.readFileSync(bannerBasePath);
  for (const [colorId, ref] of bannerIconsToSynthesize) {
    const woolPath = path.join(VENDOR_TEXTURES_DIR, `block/${colorId}_wool.png`);
    const destPath = path.join(PUBLIC_TEXTURES_DIR, `${ref}.png`);
    fs.mkdirSync(path.dirname(destPath), { recursive: true });
    fs.writeFileSync(destPath, generateBannerIcon(bannerBasePng, fs.readFileSync(woolPath)));
  }

  for (const [textureRef, ref] of lightningRodIconsToSynthesize) {
    const atlasPath = path.join(VENDOR_TEXTURES_DIR, `${textureRef}.png`);
    const destPath = path.join(PUBLIC_TEXTURES_DIR, `${ref}.png`);
    fs.mkdirSync(path.dirname(destPath), { recursive: true });
    fs.writeFileSync(destPath, generateLightningRodIcon(fs.readFileSync(atlasPath)));
  }

  for (const [, ref] of leatherArmorIconsToSynthesize) {
    const layer0Path = path.join(VENDOR_TEXTURES_DIR, `${ref}.png`);
    const layer1Path = path.join(VENDOR_TEXTURES_DIR, `${ref}_overlay.png`);
    const destPath = path.join(PUBLIC_TEXTURES_DIR, `${ref}.png`);
    fs.mkdirSync(path.dirname(destPath), { recursive: true });
    fs.writeFileSync(
      destPath,
      generateLeatherArmorIcon(fs.readFileSync(layer0Path), fs.readFileSync(layer1Path)),
    );
  }

  // Bed icons are a pre-baked Bedrock Edition sprite, not a Java texture --
  // no synthesis, just a straight copy with the color-name remap applied
  // (see scripts/lib/bedrock-colors.ts).
  for (const [javaColorId, bedrockColorName] of bedIconsToCopy) {
    const sourcePath = path.join(VENDOR_BEDROCK_ITEMS_DIR, `bed_${bedrockColorName}.png`);
    const destPath = path.join(PUBLIC_TEXTURES_DIR, `item/bed_${javaColorId}.png`);
    fs.mkdirSync(path.dirname(destPath), { recursive: true });
    fs.copyFileSync(sourcePath, destPath);
  }

  for (const relativePath of HUD_ICON_RELATIVE_PATHS) {
    const sourcePath = path.join(VENDOR_TEXTURES_DIR, HUD_ICON_VENDOR_BASE, relativePath);
    const destPath = path.join(hudTexturesDir, relativePath);
    fs.mkdirSync(path.dirname(destPath), { recursive: true });
    fs.copyFileSync(sourcePath, destPath);
  }

  fs.mkdirSync(GENERATED_DIR, { recursive: true });
  writeJson(path.join(GENERATED_DIR, "recipes.json"), recipes);
  writeJson(path.join(GENERATED_DIR, "items.json"), items);
  writeJson(path.join(GENERATED_DIR, "meta.json"), meta);

  console.log("Craftalog parse summary");
  console.log("========================");
  console.log(`mcmeta version:   ${meta.version}`);
  console.log(`shaped recipes:   ${meta.counts.shaped}`);
  console.log(`shapeless:        ${meta.counts.shapeless}`);
  console.log(`transmute:        ${meta.counts.transmute}`);
  console.log(`special:          ${meta.counts.special}`);
  console.log(`items:            ${meta.counts.items}`);
  console.log(`textures copied:  ${meta.counts.texturesCopied}`);
  console.log(`banner icons:     ${bannerIconsToSynthesize.size}`);
  console.log(`lightning rod icons: ${lightningRodIconsToSynthesize.size}`);
  console.log(`bed icons:        ${bedIconsToCopy.size}`);
  console.log(`leather armor icons: ${leatherArmorIconsToSynthesize.size}`);
  console.log(`unresolved icons: ${meta.unresolvedIcons.length}`);
  if (meta.unresolvedIcons.length > 0) {
    const preview = meta.unresolvedIcons.slice(0, 20).join(", ");
    console.log(`  ${preview}${meta.unresolvedIcons.length > 20 ? ", ..." : ""}`);
  }
  console.log(`fallback family:  ${meta.fallbackFamilyItems.length}`);
  if (meta.fallbackFamilyItems.length > 0) {
    const preview = meta.fallbackFamilyItems.slice(0, 20).join(", ");
    console.log(`  ${preview}${meta.fallbackFamilyItems.length > 20 ? ", ..." : ""}`);
  }
}

main();

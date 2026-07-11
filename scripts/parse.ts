/**
 * Parses vendored mcmeta-summary + mcmeta-assets data into the generated
 * data contract described in docs/PLAN.md:
 * src/data/generated/{recipes,items,categories,families,meta}.json
 * and the referenced texture PNGs under public/textures/{item,block}/.
 *
 * Run via `npm run parse`. Requires the vendor/ submodules to be populated
 * (`npm run vendor:init`).
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  BANNER_BASE_ATLAS_REF,
  BANNER_TEMPLATE_TEXTURE_REF,
  generateBannerAtlas,
} from "./lib/banner-icon.ts";
import {
  DECORATED_POT_BASE_ATLAS_REF,
  DECORATED_POT_BASE_TEMPLATE_TEXTURE_REF,
  DECORATED_POT_SIDE_ATLAS_REF,
  DECORATED_POT_SIDE_TEMPLATE_TEXTURE_REF,
} from "./lib/decorated-pot-icon.ts";
import { generate } from "./lib/generate.ts";
import { CONDUIT_ATLAS_REF, CONDUIT_TEXTURE_REF, HEAD_KIND_TEXTURES } from "./lib/head-icon.ts";
import { HUD_ICON_RELATIVE_PATHS, HUD_ICON_VENDOR_BASE } from "./lib/hud-icons.ts";
import { generateLeatherArmorIcon } from "./lib/leather-armor-icon.ts";
import { generateLightningRodIcon } from "./lib/lightning-rod-icon.ts";
import { generatePatternedBannerIcon } from "./lib/patterned-banner-icon.ts";
import { SHIELD_ATLAS_REF, SHIELD_TEMPLATE_TEXTURE_REF } from "./lib/shield-icon.ts";
import { sortKeysDeep } from "./lib/strings.ts";
import { firstAnimationFrame } from "./lib/texture-frame.ts";
import {
  VENDOR_BEDROCK_ITEMS_DIR,
  VENDOR_TEXTURES_DIR,
  loadVendorGenerateInput,
} from "./lib/vendor-input.ts";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(scriptDir, "..");

const GENERATED_DIR = path.join(ROOT, "src/data/generated");
const PUBLIC_TEXTURES_DIR = path.join(ROOT, "public/textures");

// Staging siblings for the atomic-ish swap: everything is generated into
// these first, and only swapped into the real locations once the whole run
// has succeeded -- a mid-run failure leaves the committed tree untouched
// instead of half-deleted (see the swap at the end of main()).
const STAGING_TEXTURES_DIR = `${PUBLIC_TEXTURES_DIR}.tmp`;
const STAGING_GENERATED_DIR = `${GENERATED_DIR}.tmp`;

/** The subdirectories of public/textures/ that parse owns (placeholder.png at the root is committed, never regenerated). */
const TEXTURE_SUBDIRS = ["item", "block", "hud"] as const;

const GENERATED_FILES = [
  "recipes.json",
  "items.json",
  "categories.json",
  "families.json",
  "meta.json",
] as const;

function writeJson(filePath: string, data: unknown): void {
  const sorted = sortKeysDeep(data);
  fs.writeFileSync(filePath, `${JSON.stringify(sorted, null, 2)}\n`);
}

function cleanStagingDirs(): void {
  fs.rmSync(STAGING_TEXTURES_DIR, { recursive: true, force: true });
  fs.rmSync(STAGING_GENERATED_DIR, { recursive: true, force: true });
}

function main(): void {
  const input = loadVendorGenerateInput();

  const {
    recipes,
    items,
    categories,
    families,
    meta,
    texturesToCopy,
    bannerIconsToSynthesize,
    lightningRodIconsToSynthesize,
    bedIconsToCopy,
    leatherArmorIconsToSynthesize,
    patternedBannerIconsToSynthesize,
    shieldIconToCopy,
    copperGolemIconsToCopy,
    shulkerIconsToCopy,
    headIconsToCopy,
    conduitIconToCopy,
    chestIconsToCopy,
    decoratedPotIconToCopy,
  } = generate(input);

  // Populate fresh staging texture dirs (swapped into place at the end).
  cleanStagingDirs();
  const hudTexturesDir = path.join(STAGING_TEXTURES_DIR, "hud");
  for (const sub of TEXTURE_SUBDIRS) {
    fs.mkdirSync(path.join(STAGING_TEXTURES_DIR, sub), { recursive: true });
  }

  for (const ref of texturesToCopy) {
    const sourcePath = path.join(VENDOR_TEXTURES_DIR, `${ref}.png`);
    const destPath = path.join(STAGING_TEXTURES_DIR, `${ref}.png`);
    fs.mkdirSync(path.dirname(destPath), { recursive: true });
    // Animation strips are cropped to their first frame -- see texture-frame.ts.
    fs.writeFileSync(destPath, firstAnimationFrame(fs.readFileSync(sourcePath)));
  }

  if (bannerIconsToSynthesize.size > 0 || patternedBannerIconsToSynthesize.size > 0) {
    const bannerBasePath = path.join(VENDOR_TEXTURES_DIR, `${BANNER_TEMPLATE_TEXTURE_REF}.png`);
    const bannerBasePng = fs.readFileSync(bannerBasePath);
    // The untinted atlas copy every banner's (plain or patterned) pole/
    // crossbar faces sample.
    const baseAtlasDest = path.join(STAGING_TEXTURES_DIR, `${BANNER_BASE_ATLAS_REF}.png`);
    fs.mkdirSync(path.dirname(baseAtlasDest), { recursive: true });
    fs.writeFileSync(baseAtlasDest, bannerBasePng);
    // One tinted atlas copy per dye color, for the flag faces.
    for (const [colorId, ref] of bannerIconsToSynthesize) {
      const woolPath = path.join(VENDOR_TEXTURES_DIR, `block/${colorId}_wool.png`);
      const destPath = path.join(STAGING_TEXTURES_DIR, `${ref}.png`);
      fs.mkdirSync(path.dirname(destPath), { recursive: true });
      fs.writeFileSync(destPath, generateBannerAtlas(bannerBasePng, fs.readFileSync(woolPath)));
    }

    if (patternedBannerIconsToSynthesize.size > 0) {
      // Canonical example: black pattern on a white banner (see
      // scripts/lib/patterned-banner.ts) -- both wool tints are shared
      // across every pattern, read once.
      const whiteWoolPng = fs.readFileSync(path.join(VENDOR_TEXTURES_DIR, "block/white_wool.png"));
      const blackWoolPng = fs.readFileSync(path.join(VENDOR_TEXTURES_DIR, "block/black_wool.png"));
      for (const [patternId, ref] of patternedBannerIconsToSynthesize) {
        const patternPath = path.join(VENDOR_TEXTURES_DIR, `entity/banner/${patternId}.png`);
        const destPath = path.join(STAGING_TEXTURES_DIR, `${ref}.png`);
        fs.mkdirSync(path.dirname(destPath), { recursive: true });
        fs.writeFileSync(
          destPath,
          generatePatternedBannerIcon(
            bannerBasePng,
            fs.readFileSync(patternPath),
            whiteWoolPng,
            blackWoolPng,
          ),
        );
      }
    }
  }

  for (const [textureRef, ref] of lightningRodIconsToSynthesize) {
    const atlasPath = path.join(VENDOR_TEXTURES_DIR, `${textureRef}.png`);
    const destPath = path.join(STAGING_TEXTURES_DIR, `${ref}.png`);
    fs.mkdirSync(path.dirname(destPath), { recursive: true });
    fs.writeFileSync(destPath, generateLightningRodIcon(fs.readFileSync(atlasPath)));
  }

  for (const [, ref] of leatherArmorIconsToSynthesize) {
    const layer0Path = path.join(VENDOR_TEXTURES_DIR, `${ref}.png`);
    const layer1Path = path.join(VENDOR_TEXTURES_DIR, `${ref}_overlay.png`);
    const destPath = path.join(STAGING_TEXTURES_DIR, `${ref}.png`);
    fs.mkdirSync(path.dirname(destPath), { recursive: true });
    fs.writeFileSync(
      destPath,
      generateLeatherArmorIcon(fs.readFileSync(layer0Path), fs.readFileSync(layer1Path)),
    );
  }

  // The shield atlas is pre-painted wood-brown already (only one plain
  // shield exists in the catalog, no dye variants) -- no tinting, just a
  // verbatim copy (see scripts/lib/shield-icon.ts).
  if (shieldIconToCopy) {
    const sourcePath = path.join(VENDOR_TEXTURES_DIR, `${SHIELD_TEMPLATE_TEXTURE_REF}.png`);
    const destPath = path.join(STAGING_TEXTURES_DIR, `${SHIELD_ATLAS_REF}.png`);
    fs.mkdirSync(path.dirname(destPath), { recursive: true });
    fs.copyFileSync(sourcePath, destPath);
  }

  // Copper golem statue textures are already real Java assets (mcmeta-assets
  // -- confirmed byte-identical to bedrock-samples' own copies) -- only the
  // shape is extracted from Bedrock (see scripts/lib/copper-golem-icon.ts),
  // so the texture itself is just a verbatim copy, same as shield/bed.
  for (const [textureRef, ref] of copperGolemIconsToCopy) {
    const sourcePath = path.join(VENDOR_TEXTURES_DIR, `${textureRef}.png`);
    const destPath = path.join(STAGING_TEXTURES_DIR, `${ref}.png`);
    fs.mkdirSync(path.dirname(destPath), { recursive: true });
    fs.copyFileSync(sourcePath, destPath);
  }

  // Shulker box textures are already real Java assets (mcmeta-assets) --
  // only the shape is extracted from Bedrock (see
  // scripts/lib/shulker-icon.ts), so the texture itself is just a verbatim
  // copy, same as shield/copper golem/bed.
  for (const [textureRef, ref] of shulkerIconsToCopy) {
    const sourcePath = path.join(VENDOR_TEXTURES_DIR, `${textureRef}.png`);
    const destPath = path.join(STAGING_TEXTURES_DIR, `${ref}.png`);
    fs.mkdirSync(path.dirname(destPath), { recursive: true });
    fs.copyFileSync(sourcePath, destPath);
  }

  // Chest textures are already real Java assets (mcmeta-assets) -- only the
  // shape is hand-authored (see scripts/lib/chest-icon.ts), so the texture
  // itself is just a verbatim copy, same as shield/copper golem.
  for (const [textureName, ref] of chestIconsToCopy) {
    const sourcePath = path.join(VENDOR_TEXTURES_DIR, `entity/chest/${textureName}.png`);
    const destPath = path.join(STAGING_TEXTURES_DIR, `${ref}.png`);
    fs.mkdirSync(path.dirname(destPath), { recursive: true });
    fs.copyFileSync(sourcePath, destPath);
  }

  // Head/conduit textures are already real Java entity assets -- only the
  // shape (a hand-authored cube, box-UV-cropped from the atlas's own real
  // pixel dimensions) is synthesized in generate() (see
  // scripts/lib/head-icon.ts); the texture itself is just a verbatim copy,
  // same as shield/copper golem/bed.
  for (const [kind, ref] of headIconsToCopy) {
    const sourcePath = path.join(VENDOR_TEXTURES_DIR, `${HEAD_KIND_TEXTURES[kind]}.png`);
    const destPath = path.join(STAGING_TEXTURES_DIR, `${ref}.png`);
    fs.mkdirSync(path.dirname(destPath), { recursive: true });
    fs.copyFileSync(sourcePath, destPath);
  }

  if (conduitIconToCopy) {
    const sourcePath = path.join(VENDOR_TEXTURES_DIR, `${CONDUIT_TEXTURE_REF}.png`);
    const destPath = path.join(STAGING_TEXTURES_DIR, `${CONDUIT_ATLAS_REF}.png`);
    fs.mkdirSync(path.dirname(destPath), { recursive: true });
    fs.copyFileSync(sourcePath, destPath);
  }

  // Both decorated pot atlases (structural base + undecorated "brick" side)
  // are pre-painted already (only one plain decorated_pot exists in the
  // catalog, no sherd-pattern variants) -- no synthesis, just verbatim
  // copies (see scripts/lib/decorated-pot-icon.ts).
  if (decoratedPotIconToCopy) {
    const baseSourcePath = path.join(
      VENDOR_TEXTURES_DIR,
      `${DECORATED_POT_BASE_TEMPLATE_TEXTURE_REF}.png`,
    );
    const baseDestPath = path.join(STAGING_TEXTURES_DIR, `${DECORATED_POT_BASE_ATLAS_REF}.png`);
    fs.mkdirSync(path.dirname(baseDestPath), { recursive: true });
    fs.copyFileSync(baseSourcePath, baseDestPath);

    const sideSourcePath = path.join(
      VENDOR_TEXTURES_DIR,
      `${DECORATED_POT_SIDE_TEMPLATE_TEXTURE_REF}.png`,
    );
    const sideDestPath = path.join(STAGING_TEXTURES_DIR, `${DECORATED_POT_SIDE_ATLAS_REF}.png`);
    fs.mkdirSync(path.dirname(sideDestPath), { recursive: true });
    fs.copyFileSync(sideSourcePath, sideDestPath);
  }

  // Bed icons are a pre-baked Bedrock Edition sprite, not a Java texture --
  // no synthesis, just a straight copy with the color-name remap applied
  // (see scripts/lib/bedrock-colors.ts).
  for (const [javaColorId, bedrockColorName] of bedIconsToCopy) {
    const sourcePath = path.join(VENDOR_BEDROCK_ITEMS_DIR, `bed_${bedrockColorName}.png`);
    const destPath = path.join(STAGING_TEXTURES_DIR, `item/bed_${javaColorId}.png`);
    fs.mkdirSync(path.dirname(destPath), { recursive: true });
    fs.copyFileSync(sourcePath, destPath);
  }

  for (const relativePath of HUD_ICON_RELATIVE_PATHS) {
    const sourcePath = path.join(VENDOR_TEXTURES_DIR, HUD_ICON_VENDOR_BASE, relativePath);
    const destPath = path.join(hudTexturesDir, relativePath);
    fs.mkdirSync(path.dirname(destPath), { recursive: true });
    fs.copyFileSync(sourcePath, destPath);
  }

  fs.mkdirSync(STAGING_GENERATED_DIR, { recursive: true });
  writeJson(path.join(STAGING_GENERATED_DIR, "recipes.json"), recipes);
  writeJson(path.join(STAGING_GENERATED_DIR, "items.json"), items);
  writeJson(path.join(STAGING_GENERATED_DIR, "categories.json"), categories);
  writeJson(path.join(STAGING_GENERATED_DIR, "families.json"), families);
  writeJson(path.join(STAGING_GENERATED_DIR, "meta.json"), meta);

  // Everything generated cleanly -- swap staging into place. Deleting the
  // old trees only here (not before generation) keeps a mid-run failure
  // from leaving a mixed/partial tree behind.
  for (const sub of TEXTURE_SUBDIRS) {
    const realDir = path.join(PUBLIC_TEXTURES_DIR, sub);
    fs.rmSync(realDir, { recursive: true, force: true });
    fs.renameSync(path.join(STAGING_TEXTURES_DIR, sub), realDir);
  }
  fs.mkdirSync(GENERATED_DIR, { recursive: true });
  for (const fileName of GENERATED_FILES) {
    // renameSync atomically replaces an existing file on the same filesystem.
    fs.renameSync(path.join(STAGING_GENERATED_DIR, fileName), path.join(GENERATED_DIR, fileName));
  }
  cleanStagingDirs();

  console.log("Craftalog parse summary");
  console.log("========================");
  console.log(`mcmeta version:   ${meta.version}`);
  console.log(`shaped recipes:   ${meta.counts.shaped}`);
  console.log(`shapeless:        ${meta.counts.shapeless}`);
  console.log(`transmute:        ${meta.counts.transmute}`);
  console.log(`special:          ${meta.counts.special}`);
  console.log(`items:            ${meta.counts.items}`);
  console.log(`categories:       ${Object.keys(categories).length}`);
  console.log(`families:         ${Object.keys(families).length}`);
  console.log(`textures written: ${meta.counts.texturesWritten} (${texturesToCopy.size} vendor copies + synthesized/derived icons + ${HUD_ICON_RELATIVE_PATHS.length} hud sprites)`);
  console.log(`banner icons:     ${bannerIconsToSynthesize.size}`);
  console.log(`lightning rod icons: ${lightningRodIconsToSynthesize.size}`);
  console.log(`bed icons:        ${bedIconsToCopy.size}`);
  console.log(`leather armor icons: ${leatherArmorIconsToSynthesize.size}`);
  console.log(`patterned banner icons: ${patternedBannerIconsToSynthesize.size}`);
  console.log(`shield icon:      ${shieldIconToCopy ? 1 : 0}`);
  console.log(`copper golem icons: ${copperGolemIconsToCopy.size}`);
  console.log(`shulker box icons: ${shulkerIconsToCopy.size}`);
  console.log(`head icons:       ${headIconsToCopy.size}`);
  console.log(`conduit icon:     ${conduitIconToCopy ? 1 : 0}`);
  console.log(`chest icons:      ${chestIconsToCopy.size}`);
  console.log(`decorated pot icon: ${decoratedPotIconToCopy ? 1 : 0}`);
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

try {
  main();
} catch (error) {
  cleanStagingDirs();
  throw error;
}

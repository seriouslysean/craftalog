/**
 * Validates the committed generated data (src/data/generated/*.json).
 *
 * Default mode re-runs the full parse in memory from the vendor/ submodules
 * and deep-compares the result against the committed files — any mismatch
 * means the committed data has drifted from the pinned mcmeta version.
 *
 * `--offline` skips the reparse (no submodules required) and only runs the
 * internal-consistency checks against the committed files as-is.
 *
 * Run via `npm run validate` (or `npm run validate -- --offline`).
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { generate } from "./lib/generate.ts";
import { HUD_ICON_RELATIVE_PATHS } from "./lib/hud-icons.ts";
import { sortKeysDeep } from "./lib/strings.ts";
import type {
  ItemsOutput,
  Meta,
  RawItemComponentsData,
  RawItemDefinitionsData,
  RawLangFile,
  RawModelsData,
  RawRecipesData,
  RawTagsData,
  RecipesOutput,
} from "./lib/types.ts";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(scriptDir, "..");

const VENDOR_SUMMARY_DIR = path.join(ROOT, "vendor/mcmeta-summary");
const VENDOR_TEXTURES_DIR = path.join(ROOT, "vendor/mcmeta-assets/assets/minecraft/textures");
const GENERATED_DIR = path.join(ROOT, "src/data/generated");
const PUBLIC_DIR = path.join(ROOT, "public");

const OFFLINE = process.argv.includes("--offline");

function readJson<T>(filePath: string): T {
  return JSON.parse(fs.readFileSync(filePath, "utf8")) as T;
}

const errors: string[] = [];

function fail(message: string): void {
  errors.push(message);
}

function loadCommitted(): { recipes: RecipesOutput; items: ItemsOutput; meta: Meta } {
  return {
    recipes: readJson<RecipesOutput>(path.join(GENERATED_DIR, "recipes.json")),
    items: readJson<ItemsOutput>(path.join(GENERATED_DIR, "items.json")),
    meta: readJson<Meta>(path.join(GENERATED_DIR, "meta.json")),
  };
}

/** Reports a readable diff summary between two JSON-serializable values (top-level keys only). */
function diffSummary(
  label: string,
  expected: Record<string, unknown>,
  actual: Record<string, unknown>,
): void {
  const expectedKeys = new Set(Object.keys(expected));
  const actualKeys = new Set(Object.keys(actual));

  const missing = [...expectedKeys].filter((key) => !actualKeys.has(key));
  const extra = [...actualKeys].filter((key) => !expectedKeys.has(key));
  const changed = [...expectedKeys]
    .filter((key) => actualKeys.has(key))
    .filter(
      (key) =>
        JSON.stringify(sortKeysDeep(expected[key])) !== JSON.stringify(sortKeysDeep(actual[key])),
    );

  if (missing.length === 0 && extra.length === 0 && changed.length === 0) return;

  fail(`${label} drifted from the committed data:`);
  if (missing.length > 0)
    fail(
      `  missing keys (present in reparse, absent in committed): ${missing.slice(0, 5).join(", ")}${missing.length > 5 ? ` (+${missing.length - 5} more)` : ""}`,
    );
  if (extra.length > 0)
    fail(
      `  extra keys (present in committed, absent in reparse): ${extra.slice(0, 5).join(", ")}${extra.length > 5 ? ` (+${extra.length - 5} more)` : ""}`,
    );
  if (changed.length > 0) {
    fail(
      `  changed keys: ${changed.slice(0, 5).join(", ")}${changed.length > 5 ? ` (+${changed.length - 5} more)` : ""}`,
    );
    for (const key of changed.slice(0, 3)) {
      fail(`    ${key}:`);
      fail(`      expected: ${JSON.stringify(sortKeysDeep(expected[key]))}`);
      fail(`      actual:   ${JSON.stringify(sortKeysDeep(actual[key]))}`);
    }
  }
}

function checkDrift(committed: { recipes: RecipesOutput; items: ItemsOutput; meta: Meta }): void {
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

  const fresh = generate({
    version,
    recipesRaw,
    tagsRaw,
    itemDefsRaw,
    modelsRaw,
    componentsRaw,
    enUs,
    textureExists,
  });

  diffSummary("recipes.json", fresh.recipes, committed.recipes);
  diffSummary("items.json", fresh.items, committed.items);
  diffSummary(
    "meta.json",
    fresh.meta as unknown as Record<string, unknown>,
    committed.meta as unknown as Record<string, unknown>,
  );
}

function checkInternalConsistency(committed: {
  recipes: RecipesOutput;
  items: ItemsOutput;
  meta: Meta;
}): void {
  const { recipes, items, meta } = committed;
  const itemIds = new Set(Object.keys(items));

  for (const [id, recipe] of Object.entries(recipes)) {
    const referencedIds: string[] = [];
    if (recipe.result) referencedIds.push(recipe.result.id);
    if (recipe.key) {
      for (const ingredient of Object.values(recipe.key)) referencedIds.push(...ingredient.items);
    }
    if (recipe.ingredients) {
      for (const ingredient of recipe.ingredients) referencedIds.push(...ingredient.items);
    }

    for (const itemId of referencedIds) {
      if (!itemIds.has(itemId)) {
        fail(`recipe "${id}" references unknown item id "${itemId}" (not in items.json)`);
      }
    }

    if (recipe.type === "shaped") {
      if (!recipe.pattern || !recipe.key) {
        fail(`recipe "${id}" is shaped but missing pattern/key`);
        continue;
      }
      if (recipe.pattern.length > 3) {
        fail(`recipe "${id}" pattern has ${recipe.pattern.length} rows (max 3)`);
      }
      for (const row of recipe.pattern) {
        if (row.length > 3) {
          fail(`recipe "${id}" pattern row "${row}" has ${row.length} columns (max 3)`);
        }
        for (const char of row) {
          if (char !== " " && !(char in recipe.key)) {
            fail(`recipe "${id}" pattern uses key "${char}" which is not defined in "key"`);
          }
        }
      }
    }
  }

  for (const [id, item] of Object.entries(items)) {
    const texturePaths =
      item.icon.type === "flat" ? [item.icon.texture] : [item.icon.top, item.icon.side];
    for (const texturePath of texturePaths) {
      const onDisk = path.join(PUBLIC_DIR, texturePath.replace(/^\//, ""));
      if (!fs.existsSync(onDisk)) {
        fail(`item "${id}" icon references missing texture file: ${texturePath}`);
      }
    }
  }

  for (const relativePath of HUD_ICON_RELATIVE_PATHS) {
    const onDisk = path.join(PUBLIC_DIR, "textures/hud", relativePath);
    if (!fs.existsSync(onDisk)) {
      fail(`missing HUD icon texture: textures/hud/${relativePath} (run "npm run parse")`);
    }
  }

  if (meta.counts.shaped < 1) fail("meta.counts.shaped is < 1");
  if (meta.counts.shapeless < 1) fail("meta.counts.shapeless is < 1");
  if (meta.counts.transmute < 1) fail("meta.counts.transmute is < 1");
  if (meta.counts.special < 1) fail("meta.counts.special is < 1");
  if (meta.counts.items < 1) fail("meta.counts.items is < 1");
}

function main(): void {
  if (!fs.existsSync(path.join(GENERATED_DIR, "recipes.json"))) {
    console.error(`No generated data found at ${GENERATED_DIR}. Run "npm run parse" first.`);
    process.exit(1);
  }

  const committed = loadCommitted();

  checkInternalConsistency(committed);

  if (OFFLINE) {
    console.log("Running in --offline mode: skipped submodule reparse/drift check.");
  } else if (!fs.existsSync(path.join(VENDOR_SUMMARY_DIR, "version.txt"))) {
    fail(
      `vendor/mcmeta-summary is not populated (run "npm run vendor:init"), and --offline was not passed.`,
    );
  } else {
    checkDrift(committed);
  }

  if (errors.length > 0) {
    console.error("Validation FAILED:");
    for (const error of errors) console.error(`  ${error}`);
    process.exit(1);
  }

  console.log("Validation passed");
  console.log(
    `  recipes: ${Object.keys(committed.recipes).length} (shaped ${committed.meta.counts.shaped}, shapeless ${committed.meta.counts.shapeless}, transmute ${committed.meta.counts.transmute}, special ${committed.meta.counts.special})`,
  );
  console.log(`  items:   ${Object.keys(committed.items).length}`);
  console.log(`  unresolved icons: ${committed.meta.unresolvedIcons.length}`);
}

main();

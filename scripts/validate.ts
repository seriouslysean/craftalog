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
import {
  VENDOR_BEDROCK_ITEMS_DIR,
  VENDOR_SUMMARY_DIR,
  VENDOR_TEXTURES_DIR,
  loadVendorGenerateInput,
} from "./lib/vendor-input.ts";
import type {
  CategoriesOutput,
  FamiliesOutput,
  ItemsOutput,
  Meta,
  RecipesOutput,
} from "./lib/types.ts";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(scriptDir, "..");

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

// Non-blocking findings: presentation-layer degradations (meta.audit) that
// must be VISIBLE -- printed prominently and carried in meta.json for the
// weekly PR body -- but must never fail the automated weekly update (see
// docs/PLAN.md's core-vs-presentation contract). Core-data corruption
// (drift, slug collisions, missing texture files, empty ingredients, count
// floors) still uses fail() above.
const warnings: string[] = [];

function warn(message: string): void {
  warnings.push(message);
}

/** First 10 entries of an audit list, "..."-truncated -- keeps warning lines readable. */
function preview(entries: string[]): string {
  return `${entries.slice(0, 10).join(", ")}${entries.length > 10 ? ", ..." : ""}`;
}

interface Committed {
  recipes: RecipesOutput;
  items: ItemsOutput;
  categories: CategoriesOutput;
  families: FamiliesOutput;
  meta: Meta;
}

function loadCommitted(): Committed {
  return {
    recipes: readJson<RecipesOutput>(path.join(GENERATED_DIR, "recipes.json")),
    items: readJson<ItemsOutput>(path.join(GENERATED_DIR, "items.json")),
    categories: readJson<CategoriesOutput>(path.join(GENERATED_DIR, "categories.json")),
    families: readJson<FamiliesOutput>(path.join(GENERATED_DIR, "families.json")),
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

function checkDrift(committed: Committed): void {
  const fresh = generate(loadVendorGenerateInput());

  diffSummary("recipes.json", fresh.recipes, committed.recipes);
  diffSummary("items.json", fresh.items, committed.items);
  diffSummary("categories.json", fresh.categories, committed.categories);
  diffSummary("families.json", fresh.families, committed.families);
  diffSummary(
    "meta.json",
    fresh.meta as unknown as Record<string, unknown>,
    committed.meta as unknown as Record<string, unknown>,
  );
}

function checkInternalConsistency(committed: Committed): void {
  const { recipes, items, categories, families, meta } = committed;
  const itemIds = new Set(Object.keys(items));
  const familyIds = new Set(Object.keys(families));
  const categoryIds = new Set(Object.keys(categories));

  // /recipe/{item}/{slug}/ requires the slug to be unique within its result
  // item's group -- deriveRecipeSlugSource's docstring claims this but the
  // derivation isn't injective, so verify it here.
  const recipeSlugKeys = new Set<string>();

  for (const [id, recipe] of Object.entries(recipes)) {
    const referencedIds: string[] = [];
    const ingredients: { items: string[] }[] = [];
    if (recipe.result) referencedIds.push(recipe.result.id);
    if (recipe.key) ingredients.push(...Object.values(recipe.key));
    if (recipe.ingredients) ingredients.push(...recipe.ingredients);
    for (const ingredient of ingredients) {
      referencedIds.push(...ingredient.items);
      if (ingredient.items.length === 0) {
        fail(`recipe "${id}" has an ingredient with zero items`);
      }
    }

    for (const itemId of referencedIds) {
      if (!itemIds.has(itemId)) {
        fail(`recipe "${id}" references unknown item id "${itemId}" (not in items.json)`);
      }
    }

    if (!familyIds.has(recipe.family)) {
      fail(`recipe "${id}" references unknown family id "${recipe.family}" (not in families.json)`);
    }

    const slugKey = `${recipe.result?.id ?? ""}::${recipe.slug}`;
    if (recipeSlugKeys.has(slugKey)) {
      fail(
        `recipe "${id}" duplicates slug "${recipe.slug}" within result item "${recipe.result?.id}" -- /recipe/{item}/{slug}/ URLs would collide`,
      );
    }
    recipeSlugKeys.add(slugKey);

    if (recipe.type === "shapeless" || recipe.type === "transmute") {
      const count = recipe.ingredients?.length ?? 0;
      if (count < 1 || count > 9) {
        fail(`recipe "${id}" has ${count} ingredients (a crafting grid holds 1-9)`);
      }
    }

    if (recipe.type === "shaped") {
      if (!recipe.pattern || !recipe.key) {
        fail(`recipe "${id}" is shaped but missing pattern/key`);
        continue;
      }
      if (recipe.pattern.length < 1 || recipe.pattern.length > 3) {
        fail(`recipe "${id}" pattern has ${recipe.pattern.length} rows (must be 1-3)`);
      }
      if (new Set(recipe.pattern.map((row) => row.length)).size > 1) {
        fail(`recipe "${id}" pattern rows have inconsistent widths`);
      }
      for (const row of recipe.pattern) {
        if (row.length < 1 || row.length > 3) {
          fail(`recipe "${id}" pattern row "${row}" has ${row.length} columns (must be 1-3)`);
        }
        for (const char of row) {
          if (char !== " " && !(char in recipe.key)) {
            fail(`recipe "${id}" pattern uses key "${char}" which is not defined in "key"`);
          }
        }
      }
    }
  }

  // Every family that appears in the generated data must resolve to a real
  // top-level category -- generate.ts already enforces this at parse time
  // (see its FAMILY_CATEGORY lookup), but re-checking the committed JSON
  // directly here (same "validate-time invariant" as the item-id checks
  // above) catches drift even if that guarantee is ever weakened, mirroring
  // the fallbackFamilyItems taxonomy-gap audit this data already carries.
  for (const [id, family] of Object.entries(families)) {
    if (!categoryIds.has(family.category)) {
      fail(
        `family "${id}" references unknown category id "${family.category}" (not in categories.json)`,
      );
    }
  }

  // Presentation-layer degradations: prominent warnings, never failures --
  // the weekly automated update must be able to land a version bump whose
  // only defects are curation work (missing family rules, unresolved or
  // degraded icons, uncurated special notes), with every instance surfaced
  // in meta.audit for the PR body. See docs/PLAN.md.
  if (meta.audit.fallbackFamilyItems.length > 0) {
    warn(
      `${meta.audit.fallbackFamilyItems.length} item(s) fell through to a generic family fallback ` +
        `(meta.audit.fallbackFamilyItems: ${preview(meta.audit.fallbackFamilyItems)}) -- add a real scripts/lib/family.ts rule for each.`,
    );
  }

  if (meta.audit.unresolvedIcons.length > 0) {
    warn(
      `${meta.audit.unresolvedIcons.length} item(s) have unresolved icons and ship the placeholder ` +
        `(meta.audit.unresolvedIcons: ${preview(meta.audit.unresolvedIcons)}) -- fix icon resolution for each.`,
    );
  }

  if (meta.audit.degradedIcons.length > 0) {
    warn(
      `${meta.audit.degradedIcons.length} item(s) degraded to the placeholder after a bespoke icon extraction failure ` +
        `(meta.audit.degradedIcons: ${preview(meta.audit.degradedIcons.map((entry) => `${entry.itemId} (${entry.reason})`))}) -- re-verify the extractor's assumptions against the new vendored data.`,
    );
  }

  if (meta.audit.pendingSpecialTypes.length > 0) {
    warn(
      `${meta.audit.pendingSpecialTypes.length} unknown crafting recipe type(s) included with the generic note ` +
        `(meta.audit.pendingSpecialTypes: ${preview(meta.audit.pendingSpecialTypes)}) -- add a curated SPECIAL_NOTES entry for each (scripts/lib/recipes.ts).`,
    );
  }

  if (meta.audit.excludedUnknownTypes.length > 0) {
    warn(
      `${meta.audit.excludedUnknownTypes.length} unknown non-crafting recipe type(s) excluded from the catalog ` +
        `(meta.audit.excludedUnknownTypes: ${preview(meta.audit.excludedUnknownTypes)}) -- add each to KNOWN_EXCLUDED_TYPES if genuinely out of scope (scripts/lib/recipes.ts).`,
    );
  }

  if (meta.audit.unmappedHeadKinds.length > 0) {
    warn(
      `${meta.audit.unmappedHeadKinds.length} head kind(s) missing from HEAD_KIND_TEXTURES ship the placeholder ` +
        `(meta.audit.unmappedHeadKinds: ${preview(meta.audit.unmappedHeadKinds)}) -- add a skin-texture mapping for each (scripts/lib/head-icon.ts).`,
    );
  }

  if (meta.audit.emptyDerivations.length > 0) {
    warn(
      `${meta.audit.emptyDerivations.length} derivation(s) unexpectedly produced zero entries from non-empty vendored inputs ` +
        `(meta.audit.emptyDerivations: ${preview(meta.audit.emptyDerivations)}) -- the sweep's assumptions no longer hold, review its module.`,
    );
  }

  // Item slugs are the /recipe/{slug}/ URL segment -- globally unique by
  // contract (derived from `id`, but slugify isn't injective, so verify).
  const itemSlugs = new Set<string>();
  for (const [id, item] of Object.entries(items)) {
    if (itemSlugs.has(item.slug)) {
      fail(`item "${id}" duplicates slug "${item.slug}" -- /recipe/{slug}/ URLs would collide`);
    }
    itemSlugs.add(item.slug);
  }

  for (const [id, item] of Object.entries(items)) {
    // Every icon type is single-texture ("texture"), a top/side cube ("top"
    // + "side"), or a "compound" (a list of elements, each with up to 6
    // faces, each carrying a texture path + uv crop rect) -- never more
    // than one of these shapes on the same object, so this narrows cleanly
    // without needing a per-type case.
    const texturePaths =
      "texture" in item.icon
        ? [item.icon.texture]
        : "top" in item.icon
          ? [item.icon.top, item.icon.side]
          : item.icon.elements.flatMap((el) => Object.values(el.faces).map((face) => face.texture));
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
  } else if (!fs.existsSync(VENDOR_TEXTURES_DIR)) {
    fail(
      `vendor/mcmeta-assets is not populated (run "npm run vendor:init"), and --offline was not passed.`,
    );
  } else if (!fs.existsSync(VENDOR_BEDROCK_ITEMS_DIR)) {
    fail(
      `vendor/bedrock-samples is not populated (run "npm run vendor:init"), and --offline was not passed.`,
    );
  } else {
    checkDrift(committed);
  }

  if (warnings.length > 0) {
    console.warn("");
    console.warn("=".repeat(72));
    console.warn(`Validation WARNINGS (${warnings.length}) -- non-blocking curation queue:`);
    for (const warning of warnings) console.warn(`  ! ${warning}`);
    console.warn("=".repeat(72));
    console.warn("");
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
  console.log(
    `  categories: ${Object.keys(committed.categories).length}, families: ${Object.keys(committed.families).length}`,
  );
  console.log(`  unresolved icons: ${committed.meta.audit.unresolvedIcons.length}`);
  console.log(`  warnings: ${warnings.length}`);
}

main();

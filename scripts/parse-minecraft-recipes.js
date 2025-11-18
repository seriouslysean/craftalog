#!/usr/bin/env node

/**
 * Minecraft Recipe Parser
 *
 * Parses recipes from bedrock-samples and converts them to app format.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PROJECT_ROOT = path.join(__dirname, '..');
const BEDROCK_SAMPLES_PATH = path.join(PROJECT_ROOT, 'bedrock-samples');
const RECIPES_PATH = path.join(BEDROCK_SAMPLES_PATH, 'behavior_pack/recipes');
const TEXTURES_PATH_BLOCKS = path.join(BEDROCK_SAMPLES_PATH, 'resource_pack/textures/blocks');
const TEXTURES_PATH_ITEMS = path.join(BEDROCK_SAMPLES_PATH, 'resource_pack/textures/items');
const OUTPUT_DIR = path.join(PROJECT_ROOT, 'src/data/generated');

const allItems = new Set();
const craftingTableRecipes = {};
const itemGroups = {};

// Minecraft wood types for texture matching
const WOOD_TYPES = [
  'acacia', 'birch', 'cherry', 'dark_oak', 'jungle', 'mangrove',
  'oak', 'spruce', 'bamboo', 'crimson', 'warped', 'pale_oak'
];

// Derivative blocks that should use their base block texture
const DERIVATIVE_SUFFIXES = {
  '_stairs': '',
  '_slab': '',
  '_wall': '',
  '_fence': '',
  '_fence_gate': '',
  '_button': '',
  '_pressure_plate': '',
  '_carpet': ''
};

// Items to exclude (non-craftable, debug, or test items)
const EXCLUDED_ITEMS = new Set([
  'camera', 'portfolio', 'element', 'compound', 'sparkler',
  'balloon', 'glow_stick', 'ice_bomb', 'super_fertilizer',
  'medicine', 'rapid_fertilizer', 'bleach', 'heat_block'
]);

function updateSubmodule() {
  console.log('Updating bedrock-samples submodule...\n');

  try {
    const gitDir = path.join(PROJECT_ROOT, '.git');
    if (!fs.existsSync(gitDir)) {
      console.log('Not in a git repository, skipping submodule update\n');
      return;
    }

    if (!fs.existsSync(BEDROCK_SAMPLES_PATH)) {
      console.log('Initializing submodule...\n');
    }

    execSync('git submodule update --init --recursive --depth 1 --progress', {
      cwd: PROJECT_ROOT,
      stdio: 'inherit',
      timeout: 120000
    });

    console.log('Submodule updated\n');
  } catch (error) {
    if (error.killed) {
      console.error('Warning: Submodule update timed out');
      console.error('Run manually: git submodule update --init --recursive\n');
    } else {
      console.error('Warning: Could not update submodule:', error.message);
      console.error('Continuing with existing data...\n');
    }
  }
}

function parseShapedRecipe(recipe, recipeId) {
  const { pattern, key, result } = recipe['minecraft:recipe_shaped'];

  if (!pattern || !key || !result) {
    return null;
  }

  const convertedKey = {};

  for (const [char, ingredient] of Object.entries(key)) {
    if (ingredient.tag) {
      convertedKey[char] = { tag: ingredient.tag.replace(/^minecraft:/, '') };
    } else if (ingredient.item) {
      const itemId = ingredient.item.replace(/^minecraft:/, '');
      allItems.add(itemId);
      convertedKey[char] = [itemId];
    }
  }

  const resultId = result.item.replace(/^minecraft:/, '');

  // Skip excluded items
  if (EXCLUDED_ITEMS.has(resultId)) {
    return null;
  }

  allItems.add(resultId);

  return {
    shaped: true,
    pattern,
    key: convertedKey,
    result: { item: resultId, count: result.count || 1 }
  };
}

function parseShapelessRecipe(recipe, recipeId) {
  const { ingredients, result } = recipe['minecraft:recipe_shapeless'];

  if (!ingredients || !result) {
    return null;
  }

  const uniqueIngredients = [];

  for (const ingredient of ingredients) {
    if (ingredient.tag) {
      uniqueIngredients.push({ type: 'tag', value: ingredient.tag.replace(/^minecraft:/, '') });
    } else if (ingredient.item) {
      const itemId = ingredient.item.replace(/^minecraft:/, '');
      allItems.add(itemId);
      uniqueIngredients.push({ type: 'item', value: itemId });
    }
  }

  const resultId = result.item.replace(/^minecraft:/, '');
  allItems.add(resultId);

  const chars = 'ABCDEFGHI';
  let pattern = [];
  let key = {};
  let charIndex = 0;

  for (const ingredient of uniqueIngredients) {
    const char = chars[charIndex++];
    if (ingredient.type === 'tag') {
      key[char] = { tag: ingredient.value };
    } else {
      key[char] = [ingredient.value];
    }
  }

  const numIngredients = uniqueIngredients.length;
  if (numIngredients <= 3) {
    pattern = [chars.slice(0, numIngredients)];
  } else if (numIngredients <= 6) {
    const mid = Math.ceil(numIngredients / 2);
    pattern = [chars.slice(0, mid), chars.slice(mid, numIngredients)];
  } else {
    const third = Math.ceil(numIngredients / 3);
    pattern = [chars.slice(0, third), chars.slice(third, third * 2), chars.slice(third * 2, numIngredients)];
  }

  // Skip excluded items
  if (EXCLUDED_ITEMS.has(resultId)) {
    return null;
  }

  return {
    shaped: false,
    pattern,
    key,
    result: { item: resultId, count: result.count || 1 }
  };
}

function copyTexture(sourcePath, destPath) {
  try {
    const destDir = path.dirname(destPath);
    if (!fs.existsSync(destDir)) {
      fs.mkdirSync(destDir, { recursive: true });
    }

    if (fs.existsSync(sourcePath)) {
      fs.copyFileSync(sourcePath, destPath);
      return true;
    }
  } catch (error) {
    // Silently fail
  }
  return false;
}

function findAndCopyTexture(itemId, isBlock = false) {
  const sourceDir = isBlock ? TEXTURES_PATH_BLOCKS : TEXTURES_PATH_ITEMS;
  const destDir = path.join(PROJECT_ROOT, 'public', 'textures', isBlock ? 'blocks' : 'items');

  const namingPatterns = [itemId];

  // Try reversed naming (e.g., acacia_planks → planks_acacia)
  if (itemId.includes('_')) {
    const parts = itemId.split('_');
    if (parts.length === 2) {
      namingPatterns.push(`${parts[1]}_${parts[0]}`);
    }
  }

  // Try wood-type prefixed variants (e.g., chest_boat → acacia_chest_boat, birch_chest_boat, etc.)
  const hasWoodType = WOOD_TYPES.some(wood => itemId.startsWith(wood + '_'));
  if (!hasWoodType && !itemId.startsWith('stripped_')) {
    // Try prefixing with each wood type
    for (const wood of WOOD_TYPES) {
      namingPatterns.push(`${wood}_${itemId}`);
      // Also try pattern like boat_acacia for items like "boat"
      namingPatterns.push(`${itemId}_${wood}`);
    }
  }

  // For derivative blocks (stairs, slabs, etc.), try the base block
  for (const [suffix, replacement] of Object.entries(DERIVATIVE_SUFFIXES)) {
    if (itemId.endsWith(suffix)) {
      const baseItem = itemId.replace(suffix, replacement);
      namingPatterns.push(baseItem);
      // Also try reversed base
      if (baseItem.includes('_')) {
        const parts = baseItem.split('_');
        if (parts.length === 2) {
          namingPatterns.push(`${parts[1]}_${parts[0]}`);
        }
      }
    }
  }

  // For doors and trapdoors, try _upper, _lower, _top variants
  if (itemId.includes('door') || itemId.includes('trapdoor')) {
    namingPatterns.push(`${itemId}_upper`);
    namingPatterns.push(`${itemId}_lower`);
    namingPatterns.push(`${itemId}_top`);
    // Also try door_{wood}_upper pattern
    if (itemId.includes('_')) {
      const parts = itemId.split('_');
      if (parts.length === 2) {
        namingPatterns.push(`door_${parts[0]}_upper`);
        namingPatterns.push(`door_${parts[0]}_lower`);
      }
    }
  }

  // Try each naming pattern
  for (const pattern of namingPatterns) {
    const sourcePath = path.join(sourceDir, `${pattern}.png`);
    const destPath = path.join(destDir, `${itemId}.png`);

    if (copyTexture(sourcePath, destPath)) {
      return `/textures/${isBlock ? 'blocks' : 'items'}/${itemId}.png`;
    }
  }

  return null;
}

function generateItemDetails() {
  console.log('Copying textures...\n');

  const itemDetails = {};
  let texturesCopied = 0;

  for (const itemId of allItems) {
    const name = itemId
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');

    const icons = [];

    // For items ending with _block, prioritize block textures
    if (itemId.endsWith('_block')) {
      let blockTopTexture = findAndCopyTexture(`${itemId}_top`, true);
      let blockSideTexture = findAndCopyTexture(`${itemId}_side`, true) || findAndCopyTexture(itemId, true);

      // Fallback: try without the _block suffix (e.g., melon_block uses melon_top.png)
      if (!blockTopTexture && !blockSideTexture) {
        const baseId = itemId.replace(/_block$/, '');
        blockTopTexture = findAndCopyTexture(`${baseId}_top`, true);
        blockSideTexture = findAndCopyTexture(`${baseId}_side`, true) || findAndCopyTexture(baseId, true);
      }

      if (blockTopTexture && blockSideTexture) {
        icons.push(blockTopTexture, blockSideTexture);
        texturesCopied += 2;
      } else if (blockSideTexture) {
        icons.push(blockSideTexture);
        texturesCopied++;
      } else if (blockTopTexture) {
        icons.push(blockTopTexture);
        texturesCopied++;
      }
    }

    // For non-block items, prioritize item textures
    if (icons.length === 0) {
      const itemTexture = findAndCopyTexture(itemId, false);
      if (itemTexture) {
        icons.push(itemTexture);
        texturesCopied++;
      } else {
        // Fallback to block textures if no item texture
        let blockTopTexture = findAndCopyTexture(`${itemId}_top`, true);
        let blockSideTexture = findAndCopyTexture(`${itemId}_side`, true) || findAndCopyTexture(itemId, true);

        if (blockTopTexture && blockSideTexture) {
          icons.push(blockTopTexture, blockSideTexture);
          texturesCopied += 2;
        } else if (blockSideTexture) {
          icons.push(blockSideTexture);
          texturesCopied++;
        } else if (blockTopTexture) {
          icons.push(blockTopTexture);
          texturesCopied++;
        }
      }
    }

    if (icons.length === 0) {
      const stickTexture = findAndCopyTexture('stick', false);
      icons.push(stickTexture || '/textures/items/stick.png');
    }

    itemDetails[itemId] = { id: itemId, name, icon: icons };
  }

  console.log(`Copied ${texturesCopied} textures\n`);
  return itemDetails;
}

function parseRecipes() {
  console.log('Parsing recipes...\n');

  const recipeFiles = fs.readdirSync(RECIPES_PATH).filter(f => f.endsWith('.json'));
  let parsedCount = 0;

  for (const file of recipeFiles) {
    const filePath = path.join(RECIPES_PATH, file);
    const recipeId = path.basename(file, '.json');

    try {
      const recipeData = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      const shaped = recipeData['minecraft:recipe_shaped'];
      const shapeless = recipeData['minecraft:recipe_shapeless'];

      if (shaped && shaped.tags && shaped.tags.includes('crafting_table')) {
        const parsed = parseShapedRecipe(recipeData, recipeId);
        if (parsed) {
          craftingTableRecipes[parsed.result.item] = {
            shaped: parsed.shaped,
            pattern: parsed.pattern,
            key: parsed.key
          };
          parsedCount++;
        }
      } else if (shapeless && shapeless.tags && shapeless.tags.includes('crafting_table')) {
        const parsed = parseShapelessRecipe(recipeData, recipeId);
        if (parsed) {
          craftingTableRecipes[parsed.result.item] = {
            shaped: parsed.shaped,
            pattern: parsed.pattern,
            key: parsed.key
          };
          parsedCount++;
        }
      }
    } catch (error) {
      // Skip malformed recipes
    }
  }

  console.log(`Parsed ${parsedCount} recipes from ${recipeFiles.length} files\n`);
}

function resolveTags() {
  const knownTags = { planks: [], logs: [] };

  for (const [resultItem, recipe] of Object.entries(craftingTableRecipes)) {
    if (resultItem.includes('planks')) {
      for (const ingredients of Object.values(recipe.key)) {
        if (Array.isArray(ingredients)) {
          for (const item of ingredients) {
            if (item.includes('log') || item.includes('stem')) {
              if (!knownTags.logs.includes(item)) {
                knownTags.logs.push(item);
              }
            }
          }
        }
      }
      if (!knownTags.planks.includes(resultItem)) {
        knownTags.planks.push(resultItem);
      }
    }
  }

  for (const [resultItem, recipe] of Object.entries(craftingTableRecipes)) {
    for (const [char, value] of Object.entries(recipe.key)) {
      if (value.tag) {
        const tagName = value.tag;
        if (knownTags[tagName] && knownTags[tagName].length > 0) {
          recipe.key[char] = knownTags[tagName];
        } else {
          recipe.key[char] = [tagName];
        }
      }
    }
  }

  for (const [tag, items] of Object.entries(knownTags)) {
    if (items && items.length > 0) {
      itemGroups[tag] = items;
    }
  }
}

function writeOutputFiles() {
  console.log('Writing output files...\n');

  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  const items = {};
  for (const itemId of allItems) {
    items[itemId] = itemId;
  }

  const itemsContent = `// Auto-generated from Minecraft bedrock-samples
// Generated: ${new Date().toISOString()}

export const items = ${JSON.stringify(items, null, 2)} as const;

export const itemGroups = ${JSON.stringify(itemGroups, null, 2)} as const;

export type ItemType = (typeof items)[keyof typeof items];
`;

  fs.writeFileSync(path.join(OUTPUT_DIR, 'items.ts'), itemsContent);
  console.log(`Generated items.ts (${allItems.size} items)`);

  const itemDetails = generateItemDetails();

  let itemDetailsStr = '{\n';
  const detailEntries = Object.entries(itemDetails);
  for (let i = 0; i < detailEntries.length; i++) {
    const [itemId, details] = detailEntries[i];
    const detailsJson = JSON.stringify(details, null, 2)
      .split('\n')
      .map(line => '  ' + line)
      .join('\n');
    itemDetailsStr += `  [items.${itemId}]: ${detailsJson}`;
    if (i < detailEntries.length - 1) {
      itemDetailsStr += ',';
    }
    itemDetailsStr += '\n';
  }
  itemDetailsStr += '}';

  const itemDetailsContent = `// Auto-generated from Minecraft bedrock-samples
// Generated: ${new Date().toISOString()}

import { items } from './items';

export interface ItemDetails {
  id: string;
  name: string;
  icon: string[];
}

export const itemDetails: Record<string, ItemDetails> = ${itemDetailsStr};
`;

  fs.writeFileSync(path.join(OUTPUT_DIR, 'item-details.ts'), itemDetailsContent);
  console.log(`Generated item-details.ts (${allItems.size} items)`);

  let recipesStr = '{\n';
  const recipeEntries = Object.entries(craftingTableRecipes);
  for (let i = 0; i < recipeEntries.length; i++) {
    const [itemId, recipe] = recipeEntries[i];
    const recipeJson = JSON.stringify(recipe, null, 2)
      .split('\n')
      .map(line => '  ' + line)
      .join('\n');
    recipesStr += `  [items.${itemId}]: ${recipeJson}`;
    if (i < recipeEntries.length - 1) {
      recipesStr += ',';
    }
    recipesStr += '\n';
  }
  recipesStr += '}';

  const recipesContent = `// Auto-generated from Minecraft bedrock-samples
// Generated: ${new Date().toISOString()}

import { items, itemGroups } from './items';

interface RecipeKey {
  [key: string]: string[] | { tag: string };
}

interface Recipe {
  shaped: boolean;
  pattern: string[];
  key: RecipeKey;
}

export const recipes: Record<string, Recipe> = ${recipesStr};
`;

  fs.writeFileSync(path.join(OUTPUT_DIR, 'item-recipes.ts'), recipesContent);
  console.log(`Generated item-recipes.ts (${Object.keys(craftingTableRecipes).length} recipes)\n`);
}

try {
  updateSubmodule();
  parseRecipes();
  resolveTags();
  writeOutputFiles();
  console.log('Done\n');
} catch (error) {
  console.error('Error:', error.message);
  process.exit(1);
}

import { getItemName } from "./lang.ts";
import { resolveIconCandidate } from "./model.ts";
import { collectRecipeItemIds, transformRecipe } from "./recipes.ts";
import type {
  Item,
  ItemsOutput,
  Meta,
  RawItemDefinitionsData,
  RawModelsData,
  RawRecipesData,
  RawTagsData,
  RecipesOutput,
} from "./types.ts";

export interface GenerateInput {
  version: string;
  recipesRaw: RawRecipesData;
  tagsRaw: RawTagsData;
  itemDefsRaw: RawItemDefinitionsData;
  modelsRaw: RawModelsData;
  enUs: Record<string, string>;
  /** Whether a texture ref (e.g. "block/oak_log_top") exists on disk. Injected so this stays I/O-free. */
  textureExists: (ref: string) => boolean;
}

export interface GenerateOutput {
  recipes: RecipesOutput;
  items: ItemsOutput;
  meta: Meta;
  /** Every texture ref that should be copied into public/textures/. */
  texturesToCopy: Set<string>;
}

/**
 * Runs the full parse pipeline in memory: transforms recipes, collects the
 * items they reference, and resolves each item's display name + icon. No
 * file I/O happens here — callers (scripts/parse.ts, scripts/validate.ts)
 * own reading input files and writing/copying output.
 */
export function generate(input: GenerateInput): GenerateOutput {
  const { version, recipesRaw, tagsRaw, itemDefsRaw, modelsRaw, enUs, textureExists } = input;

  const recipes: RecipesOutput = {};
  const counts = { shaped: 0, shapeless: 0, transmute: 0, special: 0 };

  for (const [id, raw] of Object.entries(recipesRaw)) {
    const recipe = transformRecipe(id, raw, tagsRaw);
    if (!recipe) continue;
    recipes[id] = recipe;
    counts[recipe.type] += 1;
  }

  const referencedIds = new Set<string>();
  for (const recipe of Object.values(recipes)) {
    for (const itemId of collectRecipeItemIds(recipe)) referencedIds.add(itemId);
  }

  const unresolvedIcons: string[] = [];
  const texturesToCopy = new Set<string>();
  const items: ItemsOutput = {};

  for (const itemId of Array.from(referencedIds).toSorted()) {
    const name = getItemName(itemId, enUs);
    const candidate = resolveIconCandidate(itemId, itemDefsRaw, modelsRaw);

    let icon: Item["icon"];
    if (candidate?.type === "flat" && textureExists(candidate.textureRef)) {
      icon = { type: "flat", texture: `/textures/${candidate.textureRef}.png` };
      texturesToCopy.add(candidate.textureRef);
    } else if (
      candidate?.type === "block" &&
      textureExists(candidate.topRef) &&
      textureExists(candidate.sideRef)
    ) {
      icon = {
        type: "block",
        top: `/textures/${candidate.topRef}.png`,
        side: `/textures/${candidate.sideRef}.png`,
      };
      texturesToCopy.add(candidate.topRef);
      texturesToCopy.add(candidate.sideRef);
    } else {
      icon = { type: "flat", texture: "/textures/placeholder.png" };
      unresolvedIcons.push(itemId);
    }

    items[itemId] = { id: itemId, name, icon };
  }

  const meta: Meta = {
    version,
    counts: {
      ...counts,
      items: Object.keys(items).length,
      texturesCopied: texturesToCopy.size,
    },
    unresolvedIcons: unresolvedIcons.toSorted(),
  };

  return { recipes, items, meta, texturesToCopy };
}

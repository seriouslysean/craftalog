import { resolveItemStat } from "./item-stats.ts";
import { getItemName } from "./lang.ts";
import { resolveIconCandidate } from "./model.ts";
import { collectRecipeItemIds, transformRecipe } from "./recipes.ts";
import type {
  Item,
  ItemsOutput,
  Meta,
  RawItemComponentsData,
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
  componentsRaw: RawItemComponentsData;
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
  /** Dye color id -> destination texture ref, for banner icons the caller must generate (see scripts/lib/banner-icon.ts). */
  bannerIconsToSynthesize: Map<string, string>;
}

/**
 * Runs the full parse pipeline in memory: transforms recipes, collects the
 * items they reference, and resolves each item's display name + icon. No
 * file I/O happens here — callers (scripts/parse.ts, scripts/validate.ts)
 * own reading input files and writing/copying output.
 */
export function generate(input: GenerateInput): GenerateOutput {
  const {
    version,
    recipesRaw,
    tagsRaw,
    itemDefsRaw,
    modelsRaw,
    componentsRaw,
    enUs,
    textureExists,
  } = input;

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
  const bannerIconsToSynthesize = new Map<string, string>();
  const items: ItemsOutput = {};

  for (const itemId of Array.from(referencedIds).toSorted()) {
    const name = getItemName(itemId, enUs);
    const candidate = resolveIconCandidate(itemId, itemDefsRaw, modelsRaw);

    let icon: Item["icon"];
    if (candidate?.type === "banner" && textureExists(`block/${candidate.colorId}_wool`)) {
      const ref = `item/${candidate.colorId}_banner`;
      icon = { type: "flat", texture: `/textures/${ref}.png` };
      bannerIconsToSynthesize.set(candidate.colorId, ref);
    } else if (candidate?.type === "flat" && textureExists(candidate.textureRef)) {
      icon = { type: "flat", texture: `/textures/${candidate.textureRef}.png` };
      texturesToCopy.add(candidate.textureRef);
    } else if (
      (candidate?.type === "block" || candidate?.type === "slab" || candidate?.type === "stairs") &&
      textureExists(candidate.topRef) &&
      textureExists(candidate.sideRef)
    ) {
      icon = {
        type: candidate.type,
        top: `/textures/${candidate.topRef}.png`,
        side: `/textures/${candidate.sideRef}.png`,
      };
      texturesToCopy.add(candidate.topRef);
      texturesToCopy.add(candidate.sideRef);
    } else {
      icon = { type: "flat", texture: "/textures/placeholder.png" };
      unresolvedIcons.push(itemId);
    }

    const stat = resolveItemStat(itemId, componentsRaw, tagsRaw);

    items[itemId] = stat ? { id: itemId, name, icon, stat } : { id: itemId, name, icon };
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

  return { recipes, items, meta, texturesToCopy, bannerIconsToSynthesize };
}

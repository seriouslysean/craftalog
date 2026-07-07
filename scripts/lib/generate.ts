import { toBedrockColorName } from "./bedrock-colors.ts";
import { buildItemTagIndex, deriveFamily } from "./family.ts";
import { resolveItemStat } from "./item-stats.ts";
import { getItemName } from "./lang.ts";
import { resolveIconCandidate } from "./model.ts";
import { deriveRecipeSlugSource } from "./recipe-slug.ts";
import { collectRecipeItemIds, transformRecipe } from "./recipes.ts";
import { slugify } from "../../src/utils/slugify.ts";
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
  /** Whether vendor/bedrock-samples has a bed icon PNG for this Bedrock color name (see scripts/lib/bedrock-colors.ts). Injected so this stays I/O-free. */
  bedrockBedIconExists: (bedrockColorName: string) => boolean;
}

export interface GenerateOutput {
  recipes: RecipesOutput;
  items: ItemsOutput;
  meta: Meta;
  /** Every texture ref that should be copied into public/textures/. */
  texturesToCopy: Set<string>;
  /** Dye color id -> destination texture ref, for banner icons the caller must generate (see scripts/lib/banner-icon.ts). */
  bannerIconsToSynthesize: Map<string, string>;
  /** Source atlas texture ref -> destination texture ref, for lightning rod icons the caller must generate (see scripts/lib/lightning-rod-icon.ts). Keyed by source so oxidation variants sharing one atlas only synthesize once. */
  lightningRodIconsToSynthesize: Map<string, string>;
  /** Java colorId -> Bedrock source filename suffix, for bed icons the caller must copy from vendor/bedrock-samples (see scripts/parse.ts). */
  bedIconsToCopy: Map<string, string>;
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
    bedrockBedIconExists,
  } = input;

  const recipes: RecipesOutput = {};
  const counts = { shaped: 0, shapeless: 0, transmute: 0, special: 0 };
  const itemTagIndex = buildItemTagIndex(tagsRaw);
  const fallbackFamilyItems: string[] = [];

  for (const [id, raw] of Object.entries(recipesRaw)) {
    const transformed = transformRecipe(id, raw, tagsRaw);
    if (!transformed) continue;
    const { family, usedFallback } = deriveFamily(
      { itemId: transformed.result?.id, group: transformed.group, category: transformed.category },
      itemTagIndex,
    );
    if (usedFallback) fallbackFamilyItems.push(transformed.result?.id ?? id);
    const resultId = transformed.result?.id ?? id;
    const slug = slugify(deriveRecipeSlugSource(id, resultId));
    const recipe = { ...transformed, family, slug };
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
  const lightningRodIconsToSynthesize = new Map<string, string>();
  const bedIconsToCopy = new Map<string, string>();
  const items: ItemsOutput = {};

  for (const itemId of Array.from(referencedIds).toSorted()) {
    const name = getItemName(itemId, enUs);
    const candidate = resolveIconCandidate(itemId, itemDefsRaw, modelsRaw);

    let icon: Item["icon"];
    if (candidate?.type === "banner" && textureExists(`block/${candidate.colorId}_wool`)) {
      const ref = `item/${candidate.colorId}_banner`;
      icon = { type: "flat", texture: `/textures/${ref}.png` };
      bannerIconsToSynthesize.set(candidate.colorId, ref);
    } else if (candidate?.type === "lightning_rod" && textureExists(candidate.textureRef)) {
      const baseName = candidate.textureRef.split("/").pop() ?? candidate.textureRef;
      const ref = `item/${baseName}`;
      icon = { type: "flat", texture: `/textures/${ref}.png` };
      lightningRodIconsToSynthesize.set(candidate.textureRef, ref);
    } else if (
      candidate?.type === "bed" &&
      bedrockBedIconExists(toBedrockColorName(candidate.colorId))
    ) {
      const ref = `item/bed_${candidate.colorId}`;
      icon = { type: "flat", texture: `/textures/${ref}.png` };
      bedIconsToCopy.set(candidate.colorId, toBedrockColorName(candidate.colorId));
    } else if (
      (candidate?.type === "pressure_plate" ||
        candidate?.type === "wall" ||
        candidate?.type === "button" ||
        candidate?.type === "fence" ||
        candidate?.type === "fence_gate") &&
      textureExists(candidate.textureRef)
    ) {
      icon = { type: candidate.type, texture: `/textures/${candidate.textureRef}.png` };
      texturesToCopy.add(candidate.textureRef);
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
    // Derived from `id`, not `name` -- several items share a display name
    // (every smithing template is just "Smithing Template"), so only the id
    // guarantees a unique URL segment.
    const slug = slugify(itemId);

    items[itemId] = stat
      ? { id: itemId, name, slug, icon, stat }
      : { id: itemId, name, slug, icon };
  }

  const meta: Meta = {
    version,
    counts: {
      ...counts,
      items: Object.keys(items).length,
      texturesCopied: texturesToCopy.size,
    },
    unresolvedIcons: unresolvedIcons.toSorted(),
    fallbackFamilyItems: fallbackFamilyItems.toSorted(),
  };

  return {
    recipes,
    items,
    meta,
    texturesToCopy,
    bannerIconsToSynthesize,
    lightningRodIconsToSynthesize,
    bedIconsToCopy,
  };
}

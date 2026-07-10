import {
  BANNER_BASE_ATLAS_REF,
  BANNER_TEMPLATE_TEXTURE_REF,
  bannerCompoundIcon,
} from "./banner-icon.ts";
import { toBedrockColorName } from "./bedrock-colors.ts";
import { CATEGORIES } from "./category.ts";
import { copperGolemCompoundIcon } from "./copper-golem-icon.ts";
import { buildItemTagIndex, deriveFamily, FAMILY_CATEGORY } from "./family.ts";
import { resolveItemStat } from "./item-stats.ts";
import { getItemName } from "./lang.ts";
import { resolveIconCandidate } from "./model.ts";
import type { IconCandidate } from "./model.ts";
import { derivePatternedBanners, PATTERNED_BANNER_GROUP } from "./patterned-banner.ts";
import { deriveRecipeSlugSource } from "./recipe-slug.ts";
import { collectRecipeItemIds, transformRecipe } from "./recipes.ts";
import {
  SHIELD_ATLAS_REF,
  SHIELD_TEMPLATE_TEXTURE_REF,
  shieldCompoundIcon,
} from "./shield-icon.ts";
import { slugify } from "../../src/utils/slugify.ts";
import type {
  CategoriesOutput,
  FamiliesOutput,
  Item,
  ItemsOutput,
  Meta,
  RawBannerPatternRegistry,
  RawBedrockGeometryFile,
  RawItemComponentsData,
  RawItemDefinitionsData,
  RawModelsData,
  RawRecipesData,
  RawTagsData,
  RecipesOutput,
} from "./types.ts";

// Ships as a grayscale base layer meant to be dye-tinted at runtime plus an
// untinted trim overlay (see scripts/lib/leather-armor-icon.ts) -- these are
// the only 5 items using that two-layer contract.
const LEATHER_ARMOR_ITEM_IDS = new Set([
  "leather_boots",
  "leather_chestplate",
  "leather_helmet",
  "leather_leggings",
  "leather_horse_armor",
]);

export interface GenerateInput {
  version: string;
  recipesRaw: RawRecipesData;
  tagsRaw: RawTagsData;
  itemDefsRaw: RawItemDefinitionsData;
  modelsRaw: RawModelsData;
  componentsRaw: RawItemComponentsData;
  enUs: Record<string, string>;
  /** data/banner_pattern/data.json -- see scripts/lib/patterned-banner.ts. */
  bannerPatternsRaw: RawBannerPatternRegistry;
  /** data/tag/banner_pattern/data.json -- see scripts/lib/patterned-banner.ts. */
  bannerPatternTagsRaw: RawTagsData;
  /** resource_pack/models/entity/copper_golem.geo.json -- see scripts/lib/copper-golem-icon.ts. */
  copperGolemGeoRaw: RawBedrockGeometryFile;
  /** Whether a texture ref (e.g. "block/oak_log_top") exists on disk. Injected so this stays I/O-free. */
  textureExists: (ref: string) => boolean;
  /** Whether vendor/bedrock-samples has a bed icon PNG for this Bedrock color name (see scripts/lib/bedrock-colors.ts). Injected so this stays I/O-free. */
  bedrockBedIconExists: (bedrockColorName: string) => boolean;
}

export interface GenerateOutput {
  recipes: RecipesOutput;
  items: ItemsOutput;
  categories: CategoriesOutput;
  families: FamiliesOutput;
  meta: Meta;
  /** Every texture ref that should be copied into public/textures/. */
  texturesToCopy: Set<string>;
  /** Dye color id -> destination texture ref, for the tinted banner atlas copies the caller must generate (plus the shared untinted BANNER_BASE_ATLAS_REF copy when non-empty -- see scripts/lib/banner-icon.ts). */
  bannerIconsToSynthesize: Map<string, string>;
  /** Source atlas texture ref -> destination texture ref, for lightning rod icons the caller must generate (see scripts/lib/lightning-rod-icon.ts). Keyed by source so oxidation variants sharing one atlas only synthesize once. */
  lightningRodIconsToSynthesize: Map<string, string>;
  /** Java colorId -> Bedrock source filename suffix, for bed icons the caller must copy from vendor/bedrock-samples (see scripts/parse.ts). */
  bedIconsToCopy: Map<string, string>;
  /** Item id -> flat texture ref (layer0), for leather armor icons the caller must generate (see scripts/lib/leather-armor-icon.ts). */
  leatherArmorIconsToSynthesize: Map<string, string>;
  /** Pattern id -> destination texture ref, for patterned banner icons the caller must generate (see scripts/lib/patterned-banner-icon.ts). */
  patternedBannerIconsToSynthesize: Map<string, string>;
  /** Whether the shared shield atlas (SHIELD_TEMPLATE_TEXTURE_REF) must be copied verbatim to SHIELD_ATLAS_REF (see scripts/lib/shield-icon.ts) -- no tinting, so just a boolean, not a per-item map. */
  shieldIconToCopy: boolean;
  /** Source Java texture ref -> destination texture ref, for copper golem statue icons the caller must copy verbatim (see scripts/lib/copper-golem-icon.ts -- geometry is extracted at generate() time, only the already-existing Java texture PNG needs copying). Keyed by source so waxed/un-waxed pairs sharing one texture only copy once. */
  copperGolemIconsToCopy: Map<string, string>;
}

/** One resolved face of a "compound" element: a concrete `/textures/...` path plus its texture-atlas crop rect. */
interface ResolvedCompoundFace {
  texture: string;
  uv: [number, number, number, number];
}

interface ResolvedCompoundElement {
  from: [number, number, number];
  to: [number, number, number];
  faces: {
    up?: ResolvedCompoundFace;
    down?: ResolvedCompoundFace;
    north?: ResolvedCompoundFace;
    south?: ResolvedCompoundFace;
    east?: ResolvedCompoundFace;
    west?: ResolvedCompoundFace;
  };
}

/**
 * Resolves a "compound" candidate's per-element faces to concrete
 * `/textures/...` paths (+ their uv crop rect, carried through unchanged
 * from scripts/lib/model.ts's extractCompoundElements), dropping any face
 * whose texture doesn't exist on disk and any element left with zero
 * remaining faces. Returns undefined when nothing resolves at all, so the
 * caller falls back to the placeholder icon — same "best effort, else
 * unresolved" contract every other icon type here already follows. All 6
 * cardinal faces are resolved (whichever the candidate's own element data
 * actually declares) -- see scripts/lib/model.ts's extractCompoundElements
 * and ItemIcon.astro's computeFaceStyle for why down/south/west matter
 * alongside up/north/east. No culling pass: an earlier version of this
 * function dropped faces on any partial footprint overlap between two
 * elements' touching boundary, on the theory that coplanar contact seams
 * cause CSS z-fighting -- that diagnosis was wrong (confirmed: rendering
 * every declared face with flat opaque debug colors, uncropped, produces a
 * pixel-perfect silhouette with zero visual conflicts) and the culling
 * itself was separately buggy (it deleted a face on ANY partial overlap,
 * even when the real overlap was a small fraction of that face's actual
 * area -- confirmed on grindstone's wheel, where it wrongly deleted the
 * entire east+west faces, including the prominent grindstone_side.png
 * surface, over a contact patch that was only a sliver of the wheel's true
 * footprint). The real bug was the now-fixed missing uv crop (see
 * ItemIcon.astro's computeUvCrop): un-cropped faces stretched a mostly-
 * transparent texture atlas over their whole footprint, letting interior
 * geometry show through and look like a conflict.
 */
function resolveCompoundElements(
  candidate: Extract<IconCandidate, { type: "compound" }>,
  textureExists: (ref: string) => boolean,
): { elements: ResolvedCompoundElement[]; textureRefs: string[] } | undefined {
  const elements: ResolvedCompoundElement[] = [];
  const textureRefs: string[] = [];

  for (const el of candidate.elements) {
    const faces: ResolvedCompoundElement["faces"] = {};
    for (const face of ["up", "down", "north", "south", "east", "west"] as const) {
      const faceCandidate = el.faces[face];
      if (faceCandidate && textureExists(faceCandidate.texture)) {
        faces[face] = { texture: `/textures/${faceCandidate.texture}.png`, uv: faceCandidate.uv };
        textureRefs.push(faceCandidate.texture);
      }
    }
    if (Object.keys(faces).length > 0) elements.push({ from: el.from, to: el.to, faces });
  }

  return elements.length > 0 ? { elements, textureRefs } : undefined;
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
    bannerPatternsRaw,
    bannerPatternTagsRaw,
    copperGolemGeoRaw,
    textureExists,
    bedrockBedIconExists,
  } = input;

  const recipes: RecipesOutput = {};
  const counts = { shaped: 0, shapeless: 0, transmute: 0, special: 0 };
  const itemTagIndex = buildItemTagIndex(tagsRaw);
  const fallbackFamilyItems: string[] = [];
  // Only families actually referenced by an emitted recipe end up in
  // families.json, same "only what's referenced" contract items.json/
  // texturesToCopy already follow.
  const familiesUsed: FamiliesOutput = {};

  for (const [id, raw] of Object.entries(recipesRaw)) {
    const transformed = transformRecipe(id, raw, tagsRaw);
    if (!transformed) continue;
    // repair_item is the only recipe with no result item -- exclude any
    // resultless recipe (not hardcoded to that id) so it never reaches the
    // rest of this pipeline, which assumes every emitted recipe has one.
    if (!transformed.result) continue;
    const resultId = transformed.result.id;
    const derivedFamily = deriveFamily(
      { itemId: resultId, group: transformed.group, category: transformed.category },
      itemTagIndex,
    );
    if (derivedFamily.usedFallback) fallbackFamilyItems.push(resultId);

    if (!(derivedFamily.id in familiesUsed)) {
      const categoryId = FAMILY_CATEGORY[derivedFamily.id];
      if (!categoryId) {
        // Every family scripts/lib/family.ts can produce is listed in
        // FAMILY_CATEGORY -- this can only fire if a future version bump
        // routes a genuinely new item through CATEGORY_FAMILY_FALLBACK into
        // a family name that was never added there. Fail immediately rather
        // than emit a families.json entry with no valid category.
        throw new Error(
          `Family "${derivedFamily.id}" (${derivedFamily.name}) has no entry in FAMILY_CATEGORY ` +
            `(scripts/lib/family.ts) -- every family must map to one of the 9 top-level categories.`,
        );
      }
      familiesUsed[derivedFamily.id] = {
        id: derivedFamily.id,
        name: derivedFamily.name,
        category: categoryId,
      };
    }

    const slug = slugify(deriveRecipeSlugSource(id, resultId));
    const recipe = { ...transformed, family: derivedFamily.id, slug };
    recipes[id] = recipe;
    counts[recipe.type] += 1;
  }

  // Patterned banners have no real vanilla recipe (applying a loom pattern
  // is component-driven, not representable by a fixed result item -- see
  // scripts/lib/patterned-banner.ts) -- injected as synthetic `special`
  // recipes here, after the vanilla loop, so they flow through the same
  // referencedIds -> icon resolution pass below as any real recipe's result.
  const patternedBanners = derivePatternedBanners(
    bannerPatternsRaw,
    bannerPatternTagsRaw,
    enUs,
    textureExists,
  );
  const patternedBannersByItemId = new Map(patternedBanners.map((entry) => [entry.itemId, entry]));

  if (patternedBanners.length > 0 && !("banners" in familiesUsed)) {
    // Always already true in practice (16 real banner recipes share this
    // family) -- kept so this doesn't silently depend on that.
    const categoryId = FAMILY_CATEGORY.banners;
    if (!categoryId) {
      throw new Error(`Family "banners" has no entry in FAMILY_CATEGORY (scripts/lib/family.ts).`);
    }
    familiesUsed.banners = { id: "banners", name: "Banners", category: categoryId };
  }

  for (const entry of patternedBanners) {
    recipes[entry.itemId] = {
      id: entry.itemId,
      type: "special",
      category: "misc",
      family: "banners",
      group: PATTERNED_BANNER_GROUP,
      slug: slugify(deriveRecipeSlugSource(entry.itemId, entry.itemId)),
      note: entry.note,
      result: { id: entry.itemId, count: 1 },
    };
    counts.special += 1;
  }

  const categories: CategoriesOutput = {};
  for (const category of CATEGORIES) categories[category.id] = category;

  const referencedIds = new Set<string>();
  for (const recipe of Object.values(recipes)) {
    for (const itemId of collectRecipeItemIds(recipe)) referencedIds.add(itemId);
  }

  const unresolvedIcons: string[] = [];
  const texturesToCopy = new Set<string>();
  const bannerIconsToSynthesize = new Map<string, string>();
  const lightningRodIconsToSynthesize = new Map<string, string>();
  const bedIconsToCopy = new Map<string, string>();
  const leatherArmorIconsToSynthesize = new Map<string, string>();
  const patternedBannerIconsToSynthesize = new Map<string, string>();
  let shieldIconToCopy = false;
  const copperGolemIconsToCopy = new Map<string, string>();
  const items: ItemsOutput = {};

  for (const itemId of Array.from(referencedIds).toSorted()) {
    const patternedBanner = patternedBannersByItemId.get(itemId);
    const name = patternedBanner?.name ?? getItemName(itemId, enUs);
    const candidate = resolveIconCandidate(itemId, itemDefsRaw, modelsRaw);
    const resolvedCompound =
      candidate?.type === "compound"
        ? resolveCompoundElements(candidate, textureExists)
        : undefined;

    if (patternedBanner && candidate) {
      // A real vendored item would mean this synthetic id collided with an
      // actual vanilla item -- fail loudly rather than silently misrender
      // either one.
      throw new Error(
        `synthetic patterned-banner id "${itemId}" collides with a real vanilla item`,
      );
    }

    let icon: Item["icon"];
    if (
      patternedBanner &&
      textureExists(BANNER_TEMPLATE_TEXTURE_REF) &&
      textureExists("block/white_wool") &&
      textureExists("block/black_wool")
    ) {
      icon = bannerCompoundIcon(
        `/textures/${patternedBanner.textureRef}.png`,
        `/textures/${BANNER_BASE_ATLAS_REF}.png`,
      );
      patternedBannerIconsToSynthesize.set(patternedBanner.patternId, patternedBanner.textureRef);
    } else if (
      candidate?.type === "banner" &&
      textureExists(BANNER_TEMPLATE_TEXTURE_REF) &&
      textureExists(`block/${candidate.colorId}_wool`)
    ) {
      // A hand-authored 3-element compound (pole + crossbar + hanging flag)
      // rather than vendored geometry -- banners have none (see
      // scripts/lib/banner-icon.ts for the full derivation and the
      // tinted/untinted atlas split its two texture paths encode).
      const ref = `item/${candidate.colorId}_banner`;
      icon = bannerCompoundIcon(`/textures/${ref}.png`, `/textures/${BANNER_BASE_ATLAS_REF}.png`);
      bannerIconsToSynthesize.set(candidate.colorId, ref);
    } else if (candidate?.type === "shield" && textureExists(SHIELD_TEMPLATE_TEXTURE_REF)) {
      // A hand-authored single-plate compound rather than vendored geometry
      // -- shields have none (see scripts/lib/shield-icon.ts).
      icon = shieldCompoundIcon(`/textures/${SHIELD_ATLAS_REF}.png`);
      shieldIconToCopy = true;
    } else if (candidate?.type === "copper_golem_statue" && textureExists(candidate.textureRef)) {
      // Real geometry extracted from vendored Bedrock entity data -- see
      // scripts/lib/copper-golem-icon.ts. Only the texture (already a real
      // Java asset) needs copying; the shape comes from copperGolemGeoRaw.
      const ref = `item/${candidate.textureRef.split("/").pop()}`;
      icon = copperGolemCompoundIcon(copperGolemGeoRaw, `/textures/${ref}.png`);
      copperGolemIconsToCopy.set(candidate.textureRef, ref);
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
    } else if (
      candidate?.type === "flat" &&
      LEATHER_ARMOR_ITEM_IDS.has(itemId) &&
      textureExists(candidate.textureRef) &&
      textureExists(`${candidate.textureRef}_overlay`)
    ) {
      icon = { type: "flat", texture: `/textures/${candidate.textureRef}.png` };
      leatherArmorIconsToSynthesize.set(itemId, candidate.textureRef);
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
    } else if (candidate?.type === "compound" && resolvedCompound) {
      icon = {
        type: "compound",
        elements: resolvedCompound.elements,
        yRotation: candidate.yRotation,
      };
      for (const ref of resolvedCompound.textureRefs) texturesToCopy.add(ref);
    } else if (
      candidate?.type === "compound" &&
      candidate.flatFallbackRef &&
      textureExists(candidate.flatFallbackRef)
    ) {
      // None of the compound's own element textures exist as files --
      // fall back to the same flat particle/layer0 guess the plain
      // "unknown" path would have used, so this never regresses below what
      // the old fallback already achieved.
      icon = { type: "flat", texture: `/textures/${candidate.flatFallbackRef}.png` };
      texturesToCopy.add(candidate.flatFallbackRef);
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
    categories,
    families: familiesUsed,
    meta,
    texturesToCopy,
    bannerIconsToSynthesize,
    lightningRodIconsToSynthesize,
    bedIconsToCopy,
    leatherArmorIconsToSynthesize,
    patternedBannerIconsToSynthesize,
    shieldIconToCopy,
    copperGolemIconsToCopy,
  };
}

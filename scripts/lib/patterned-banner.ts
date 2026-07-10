import { tagMembers } from "./item-stats.ts";
import { titleCaseFromId } from "./strings.ts";
import type { RawBannerPatternRegistry, RawTagsData } from "./types.ts";

/**
 * Applying a loom pattern to a banner isn't a recipe anywhere in the vanilla
 * data -- a patterned banner's result is component-driven (the pattern lives
 * in the result's item components, not a fixed item id), not representable
 * by this catalog's fixed-result-item recipe model (see GitHub issue #41).
 * Cataloged instead as one synthetic entry per loom-obtainable pattern,
 * rendered as a canonical black-pattern-on-white-banner example -- base/dye
 * color are parameters of the mechanic (10,752 pattern x pattern-dye x
 * base-color combinations), not part of a pattern's identity, so enumerating
 * every color would multiply this dataset for no real benefit; the pattern
 * itself is the only thing that varies the catalog is missing.
 *
 * "Loom-obtainable" = a member of the `no_item_required` banner_pattern tag
 * (patterns any loom can apply with just a banner + dye) or any
 * `pattern_item/*` tag (patterns that additionally need a specific banner
 * pattern item). The registry (data/banner_pattern/data.json) has one extra
 * entry, "base" ("Fully Black Field"), in neither tag -- it isn't obtainable
 * in a Java loom at all, so it's excluded by this same derivation, not a
 * hardcoded denylist.
 */
export const PATTERNED_BANNER_GROUP = "patterned_banner";

const PATTERN_ITEM_TAG_PREFIX = "pattern_item/";
const NO_ITEM_REQUIRED_TAG = "no_item_required";

export interface PatternedBannerEntry {
  /** Synthetic item/recipe id, e.g. "patterned_banner_creeper". */
  itemId: string;
  /** The pattern's own registry id, e.g. "creeper". */
  patternId: string;
  /** e.g. "Black Creeper Charge" -- vanilla's own layer-name lang string, verbatim. */
  name: string;
  note: string;
  /** Synthesis destination -- see scripts/lib/patterned-banner-icon.ts + scripts/parse.ts. */
  textureRef: string;
  /** Vendor source: entity/banner/<patternId>.png (same 64x64 atlas layout as banner_base.png). */
  patternTextureRef: string;
}

function noteFor(itemGated: boolean): string {
  return itemGated
    ? "Apply in a loom: any banner + any dye + this pattern's banner pattern item. Shown as black on a white banner."
    : "Apply in a loom: any banner + any dye. Shown as black on a white banner.";
}

/**
 * Derives every loom-obtainable banner pattern as a synthetic catalog entry.
 * Returns [] when the registry/tags are empty (e.g. missing test fixtures),
 * matching every other icon-synthesis branch's "best effort, else nothing"
 * contract -- see scripts/lib/generate.ts.
 */
export function derivePatternedBanners(
  bannerPatternsRaw: RawBannerPatternRegistry,
  bannerPatternTagsRaw: RawTagsData,
  enUs: Record<string, string>,
  textureExists: (ref: string) => boolean,
): PatternedBannerEntry[] {
  const itemGatedTags = Object.keys(bannerPatternTagsRaw).filter((tagName) =>
    tagName.startsWith(PATTERN_ITEM_TAG_PREFIX),
  );

  const itemGatedIds = new Set<string>();
  for (const tagName of itemGatedTags) {
    for (const id of tagMembers(bannerPatternTagsRaw, tagName)) itemGatedIds.add(id);
  }

  const loomObtainableIds = new Set(itemGatedIds);
  for (const id of tagMembers(bannerPatternTagsRaw, NO_ITEM_REQUIRED_TAG))
    loomObtainableIds.add(id);

  const entries: PatternedBannerEntry[] = [];

  for (const patternId of Array.from(loomObtainableIds).toSorted()) {
    const registryEntry = bannerPatternsRaw[patternId];
    if (!registryEntry) continue;

    const patternTextureRef = `entity/banner/${patternId}`;
    if (!textureExists(patternTextureRef)) continue;

    const name =
      enUs[`${registryEntry.translation_key}.black`] ?? `Black ${titleCaseFromId(patternId)}`;

    entries.push({
      itemId: `patterned_banner_${patternId}`,
      patternId,
      name,
      note: noteFor(itemGatedIds.has(patternId)),
      textureRef: `item/patterned_banner_${patternId}`,
      patternTextureRef,
    });
  }

  return entries;
}

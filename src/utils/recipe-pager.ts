import {
  canonicalRecipePath,
  groupDisplayName,
  groupItemSlug,
  type RecipeGroup,
} from "./recipe-groups";
import { withBase } from "./with-base";
import type { ItemData } from "../content.config";

export interface PagerEntry {
  canonicalId: string;
  displayName: string;
  item: ItemData | null;
  itemSlug: string;
}

/**
 * One entry per *item* (not per recipe), sorted by display name -- the
 * prev/next pager always lands on a different item's canonical recipe;
 * sibling recipes are reached via the chip row instead.
 */
export function buildPagerSequence(
  groups: RecipeGroup[],
  itemsMap: Map<string, ItemData>,
): PagerEntry[] {
  return groups
    .map((group) => {
      const resultItem = itemsMap.get(group.resultId);
      return {
        canonicalId: group.canonicalId,
        displayName: groupDisplayName(group, itemsMap),
        item: resultItem ?? null,
        itemSlug: groupItemSlug(group, itemsMap),
      };
    })
    .toSorted((a, b) => a.displayName.localeCompare(b.displayName));
}

export interface PagerNeighbors {
  prevHref: string;
  prevName: string;
  prevItem: ItemData | null;
  nextHref: string;
  nextName: string;
  nextItem: ItemData | null;
}

/**
 * The canonical recipe is always reachable at the bare /recipe/{item}/ path.
 *
 * Throws on an empty sequence or an unknown canonical id -- both mean the
 * caller's build-time static paths and the pager sequence have drifted, and
 * silently wrapping from index -1 would render wrong neighbors.
 */
export function pagerNeighbors(sequence: PagerEntry[], canonicalId: string): PagerNeighbors {
  if (sequence.length === 0) {
    throw new Error("pagerNeighbors: pager sequence is empty");
  }

  const index = sequence.findIndex((entry) => entry.canonicalId === canonicalId);
  if (index === -1) {
    throw new Error(`pagerNeighbors: canonical id "${canonicalId}" not found in pager sequence`);
  }

  const prev = sequence[(index - 1 + sequence.length) % sequence.length];
  const next = sequence[(index + 1) % sequence.length];

  return {
    prevHref: withBase(canonicalRecipePath(prev.itemSlug)),
    prevName: prev.displayName,
    prevItem: prev.item,
    nextHref: withBase(canonicalRecipePath(next.itemSlug)),
    nextName: next.displayName,
    nextItem: next.item,
  };
}

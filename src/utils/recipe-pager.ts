import { canonicalRecipePath, groupItemSlug, type RecipeGroup } from "./recipe-groups";
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
        displayName: resultItem?.name ?? group.canonicalId.replace(/_/g, " "),
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

/** The canonical recipe is always reachable at the bare /recipe/{item}/ path. */
export function pagerNeighbors(sequence: PagerEntry[], canonicalId: string): PagerNeighbors {
  const index = sequence.findIndex((entry) => entry.canonicalId === canonicalId);
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

import type { ItemDetails } from '@/data/generated/item-details';

/**
 * Generates HTML string for an item icon
 * Used for client-side dynamic updates
 */
export function generateItemIconHTML(item: ItemDetails | null): string {
  if (!item) {
    return '';
  }

  const isBlock = item.icon?.length === 2;

  if (isBlock) {
    return `<div class="item-icon item-icon--block">
      <ul class="block" title="${item.name}">
        <li class="top" style="background-image: url(${item.icon[0]})"></li>
        <li class="left" style="background-image: url(${item.icon[1]})"></li>
        <li class="right" style="background-image: url(${item.icon[1]})"></li>
      </ul>
    </div>`;
  }

  return `<div class="item-icon">
    <img class="icon" src="${item.icon[0]}" alt="${item.name}" title="${item.name}" />
  </div>`;
}

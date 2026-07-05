import { titleCaseFromId } from "./strings.ts";

/**
 * Resolves an item's display name from the en_us lang map, trying the item
 * key first, then the block key, then falling back to a title-cased id.
 */
export function getItemName(itemId: string, enUs: Record<string, string>): string {
  return (
    enUs[`item.minecraft.${itemId}`] ?? enUs[`block.minecraft.${itemId}`] ?? titleCaseFromId(itemId)
  );
}

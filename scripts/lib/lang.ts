import { titleCaseFromId } from "../../src/utils/strings.ts";

/**
 * Resolves a single lang key, preferring Mojang's `<key>.new` variant when
 * present. Mojang ships renamed display strings as a `<key>.new` entry
 * alongside the original `<key>` (kept for old resource-pack compatibility)
 * -- e.g. smithing templates ("Smithing Template" -> "Netherite Upgrade")
 * and some banner patterns ("Banner Pattern" -> "Creeper Charge Banner
 * Pattern") were renamed this way. This rule is generic over every lang key,
 * current or future: a data bump that adds more `.new` renames needs zero
 * code changes to pick them up.
 */
export function resolveLangKey(key: string, enUs: Record<string, string>): string | undefined {
  return enUs[`${key}.new`] ?? enUs[key];
}

/**
 * Resolves an item's display name from the en_us lang map, trying the item
 * key first, then the block key, then falling back to a title-cased id.
 */
export function getItemName(itemId: string, enUs: Record<string, string>): string {
  return (
    resolveLangKey(`item.minecraft.${itemId}`, enUs) ??
    resolveLangKey(`block.minecraft.${itemId}`, enUs) ??
    titleCaseFromId(itemId)
  );
}

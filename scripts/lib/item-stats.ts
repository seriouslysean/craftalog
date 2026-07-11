import { resolveTag } from "./tags.ts";
import type { ItemStat, RawItemComponents, RawItemComponentsData, RawTagsData } from "./types.ts";

interface RawAttributeModifier {
  type?: string;
  amount?: number;
  [key: string]: unknown;
}

const ARMOR_SLOT_TAGS = ["head_armor", "chest_armor", "leg_armor", "foot_armor"];
const TOOL_TAGS = ["axes", "pickaxes", "shovels", "hoes"];
// The two dedicated melee-weapon tags (1.21+ added spears alongside swords).
const WEAPON_TAGS = ["swords", "spears"];
// Vanilla has no single "melee weapons" tag covering these two alongside the tags above.
const EXTRA_WEAPON_ITEM_IDS = new Set(["trident", "mace"]);

/** Whether `itemId` is a member of any of the named tags (fully resolved via scripts/lib/tags.ts, including nested tag refs). */
function isInAnyTag(itemId: string, tagsRaw: RawTagsData, tagNames: string[]): boolean {
  return tagNames.some((tagName) => resolveTag(tagName, tagsRaw).includes(itemId));
}

function sumAttribute(components: RawItemComponents, attributeType: string): number {
  const modifiers = components["minecraft:attribute_modifiers"];
  if (!Array.isArray(modifiers)) return 0;
  return (modifiers as RawAttributeModifier[])
    .filter((modifier) => modifier?.type === attributeType)
    .reduce((sum, modifier) => sum + (modifier.amount ?? 0), 0);
}

/**
 * Resolves the single defining gameplay stat for an item, if it has one.
 * Priority: food > armor > weapon > tool — an item gets at most one stat,
 * picked in the order most relevant to a casual player (see docs/PLAN.md).
 */
export function resolveItemStat(
  itemId: string,
  componentsRaw: RawItemComponentsData,
  tagsRaw: RawTagsData,
): ItemStat | undefined {
  const components = componentsRaw[itemId];
  if (!components) return undefined;

  const food = components["minecraft:food"] as { nutrition?: number } | undefined;
  if (typeof food?.nutrition === "number" && food.nutrition > 0) {
    return { type: "food", nutrition: food.nutrition };
  }

  if (isInAnyTag(itemId, tagsRaw, ARMOR_SLOT_TAGS)) {
    const points = sumAttribute(components, "minecraft:armor");
    if (points > 0) return { type: "armor", points };
  }

  if (isInAnyTag(itemId, tagsRaw, WEAPON_TAGS) || EXTRA_WEAPON_ITEM_IDS.has(itemId)) {
    const damage = sumAttribute(components, "minecraft:attack_damage");
    if (damage > 0) return { type: "weapon", damage };
  }

  if (isInAnyTag(itemId, tagsRaw, TOOL_TAGS)) {
    const durability = components["minecraft:max_damage"];
    if (typeof durability === "number" && durability > 0) {
      return { type: "tool", durability };
    }
  }

  return undefined;
}

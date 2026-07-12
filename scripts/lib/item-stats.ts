import type { ItemStat, RawItemComponents, RawItemComponentsData } from "./types.ts";

interface RawAttributeModifier {
  type?: string;
  amount?: number;
  [key: string]: unknown;
}

function sumAttribute(components: RawItemComponents, attributeType: string): number {
  const modifiers = components["minecraft:attribute_modifiers"];
  if (!Array.isArray(modifiers)) return 0;
  return (modifiers as RawAttributeModifier[])
    .filter((modifier) => modifier?.type === attributeType)
    .reduce((sum, modifier) => sum + (modifier.amount ?? 0), 0);
}

/**
 * Whether an item is a DEDICATED weapon (sword/spear/trident/mace class),
 * as opposed to a tool that merely can attack (axe/pickaxe/shovel/hoe).
 *
 * Both classes carry the `minecraft:weapon` component, so its mere presence
 * can't separate them -- the deterministic signal is the component's own
 * `item_damage_per_attack` field: dedicated weapons take the default 1
 * durability per hit (the component ships empty, `{}`), while attack-capable
 * tools pay a 2x durability penalty (`{ "item_damage_per_attack": 2 }`).
 * Verified against the full vendored item_components data: the default-cost
 * partition is exactly the 7 swords + 7 spears + trident + mace, and the
 * non-default partition is exactly the 28 axes/pickaxes/shovels/hoes --
 * a future weapon with these components auto-classifies with no code change.
 */
function isDedicatedWeapon(components: RawItemComponents): boolean {
  const weapon = components["minecraft:weapon"] as { item_damage_per_attack?: number } | undefined;
  return weapon !== undefined && (weapon.item_damage_per_attack ?? 1) === 1;
}

/**
 * Resolves the single defining gameplay stat for an item, if it has one.
 * Priority: food > armor > weapon > tool — an item gets at most one stat,
 * picked in the order most relevant to a casual player (see docs/PLAN.md).
 *
 * All four gates are component-driven (no item-tag or item-id lists):
 * - food:   `minecraft:food` nutrition > 0
 * - armor:  summed `minecraft:armor` attribute points > 0 (covers body
 *   armor for non-player entities too -- wolf armor, horse armors)
 * - weapon: dedicated-weapon class (see isDedicatedWeapon) with summed
 *   attack damage > 0 (wooden/golden spears are correctly stat-less)
 * - tool:   has `minecraft:tool` and is NOT a dedicated weapon, with a
 *   positive `minecraft:max_damage` durability
 */
export function resolveItemStat(
  itemId: string,
  componentsRaw: RawItemComponentsData,
): ItemStat | undefined {
  const components = componentsRaw[itemId];
  if (!components) return undefined;

  const food = components["minecraft:food"] as { nutrition?: number } | undefined;
  if (typeof food?.nutrition === "number" && food.nutrition > 0) {
    return { type: "food", nutrition: food.nutrition };
  }

  const points = sumAttribute(components, "minecraft:armor");
  if (points > 0) return { type: "armor", points };

  if (isDedicatedWeapon(components)) {
    const damage = sumAttribute(components, "minecraft:attack_damage");
    if (damage > 0) return { type: "weapon", damage };
  }

  if ("minecraft:tool" in components && !isDedicatedWeapon(components)) {
    const durability = components["minecraft:max_damage"];
    if (typeof durability === "number" && durability > 0) {
      return { type: "tool", durability };
    }
  }

  return undefined;
}

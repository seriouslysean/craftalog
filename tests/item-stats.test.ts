import { describe, expect, it } from "vitest";
import { resolveItemStat } from "../scripts/lib/item-stats.ts";
import type { RawItemComponentsData } from "../scripts/lib/types.ts";

// Component shapes mirror the real vendored item_components data: dedicated
// weapons carry an EMPTY `minecraft:weapon` ({} -- default 1 durability per
// attack); attack-capable tools carry `{ item_damage_per_attack: 2 }` plus
// `minecraft:tool`; swords/trident/mace carry BOTH weapon and tool (a sword
// can mine cobwebs), which is why component presence alone can't separate
// the classes -- see scripts/lib/item-stats.ts's isDedicatedWeapon.
const componentsRaw: RawItemComponentsData = {
  bread: { "minecraft:food": { nutrition: 5, saturation: 6 } },
  stone: {},
  diamond_chestplate: {
    "minecraft:attribute_modifiers": [
      { type: "minecraft:armor", amount: 8 },
      { type: "minecraft:armor_toughness", amount: 2 },
    ],
    "minecraft:max_damage": 528,
  },
  // No armor-slot equipment tag exists for these two in vanilla -- the
  // armor gate is attribute-only, so they still classify (the wolf/horse
  // armor coverage the tag-gated version missed).
  wolf_armor: {
    "minecraft:attribute_modifiers": [{ type: "minecraft:armor", amount: 11 }],
    "minecraft:max_damage": 64,
  },
  diamond_sword: {
    "minecraft:attribute_modifiers": [
      { type: "minecraft:attack_damage", amount: 6 },
      { type: "minecraft:attack_speed", amount: -2.4 },
    ],
    "minecraft:max_damage": 1561,
    "minecraft:tool": { rules: [] },
    "minecraft:weapon": {},
  },
  diamond_axe: {
    "minecraft:attribute_modifiers": [
      { type: "minecraft:attack_damage", amount: 7 },
      { type: "minecraft:attack_speed", amount: -3.1 },
    ],
    "minecraft:max_damage": 1561,
    "minecraft:tool": { rules: [] },
    "minecraft:weapon": { disable_blocking_for_seconds: 5, item_damage_per_attack: 2 },
  },
  diamond_pickaxe: {
    "minecraft:attribute_modifiers": [{ type: "minecraft:attack_damage", amount: 4 }],
    "minecraft:max_damage": 1561,
    "minecraft:tool": { rules: [] },
    "minecraft:weapon": { item_damage_per_attack: 2 },
  },
  trident: {
    "minecraft:attribute_modifiers": [{ type: "minecraft:attack_damage", amount: 9 }],
    "minecraft:max_damage": 250,
    "minecraft:tool": { rules: [] },
    "minecraft:weapon": {},
  },
  iron_spear: {
    "minecraft:attribute_modifiers": [
      { type: "minecraft:attack_damage", amount: 2 },
      { type: "minecraft:attack_speed", amount: -2.8 },
    ],
    "minecraft:max_damage": 250,
    "minecraft:weapon": {},
  },
  // Real vendored shape: a dedicated weapon whose attack_damage sums to 0
  // (the attribute modifiers list carries only attack_speed) -- correctly
  // gets NO stat rather than "damage 0".
  wooden_spear: {
    "minecraft:attribute_modifiers": [{ type: "minecraft:attack_speed", amount: -2.8 }],
    "minecraft:max_damage": 59,
    "minecraft:weapon": {},
  },
  shears: {
    "minecraft:max_damage": 238,
    "minecraft:tool": { rules: [] },
  },
  // A hypothetical FUTURE weapon: no tag, no id list, just the components a
  // new dedicated weapon would ship with -- must classify with zero code
  // changes (the point of the component-driven gate).
  obsidian_glaive: {
    "minecraft:attribute_modifiers": [{ type: "minecraft:attack_damage", amount: 11 }],
    "minecraft:max_damage": 2031,
    "minecraft:tool": { rules: [] },
    "minecraft:weapon": {},
  },
};

describe("resolveItemStat", () => {
  it("returns undefined for an item with no components", () => {
    expect(resolveItemStat("unknown_item", componentsRaw)).toBeUndefined();
  });

  it("returns undefined for an item with components but no matching stat", () => {
    expect(resolveItemStat("stone", componentsRaw)).toBeUndefined();
  });

  it("picks food first", () => {
    expect(resolveItemStat("bread", componentsRaw)).toEqual({
      type: "food",
      nutrition: 5,
    });
  });

  it("picks armor from the armor attribute alone, summing amounts (no tag gate)", () => {
    expect(resolveItemStat("diamond_chestplate", componentsRaw)).toEqual({
      type: "armor",
      points: 8,
    });
  });

  it("picks armor for non-player-slot equipment (wolf armor) -- attribute-driven, no slot tag exists", () => {
    expect(resolveItemStat("wolf_armor", componentsRaw)).toEqual({
      type: "armor",
      points: 11,
    });
  });

  it("picks weapon (not tool) for a sword, despite it carrying minecraft:tool too", () => {
    expect(resolveItemStat("diamond_sword", componentsRaw)).toEqual({
      type: "weapon",
      damage: 6,
    });
  });

  it("picks weapon for the trident (empty weapon component = dedicated weapon)", () => {
    expect(resolveItemStat("trident", componentsRaw)).toEqual({
      type: "weapon",
      damage: 9,
    });
  });

  it("picks weapon for a spear (weapon component, no tool component)", () => {
    expect(resolveItemStat("iron_spear", componentsRaw)).toEqual({
      type: "weapon",
      damage: 2,
    });
  });

  it("gives a zero-damage dedicated weapon (wooden/golden spear) no stat at all", () => {
    expect(resolveItemStat("wooden_spear", componentsRaw)).toBeUndefined();
  });

  it("auto-admits a future component-only weapon with no tag or id list involved", () => {
    expect(resolveItemStat("obsidian_glaive", componentsRaw)).toEqual({
      type: "weapon",
      damage: 11,
    });
  });

  it("picks tool (durability), not weapon, for an axe despite it having attack damage (non-default item_damage_per_attack)", () => {
    expect(resolveItemStat("diamond_axe", componentsRaw)).toEqual({
      type: "tool",
      durability: 1561,
    });
  });

  it("picks tool for a pickaxe", () => {
    expect(resolveItemStat("diamond_pickaxe", componentsRaw)).toEqual({
      type: "tool",
      durability: 1561,
    });
  });

  it("picks tool for shears (tool component with no weapon component at all)", () => {
    expect(resolveItemStat("shears", componentsRaw)).toEqual({
      type: "tool",
      durability: 238,
    });
  });
});

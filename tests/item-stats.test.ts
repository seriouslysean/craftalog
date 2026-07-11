import { describe, expect, it } from "vitest";
import { resolveItemStat } from "../scripts/lib/item-stats.ts";
import type { RawItemComponentsData, RawTagsData } from "../scripts/lib/types.ts";

const tagsRaw: RawTagsData = {
  head_armor: { values: ["leather_helmet", "diamond_helmet"] },
  chest_armor: { values: ["diamond_chestplate"] },
  leg_armor: { values: [] },
  foot_armor: { values: [] },
  // Exercises resolveTag's full normalization within stat detection: a
  // minecraft:-prefixed value, an { id } object-form value, and a nested
  // tag reference -- the shallow tagMembers resolver this module used to
  // carry handled none of the nested case.
  swords: {
    values: ["minecraft:diamond_sword", { id: "minecraft:copper_sword" }, "#minecraft:odd_swords"],
  },
  odd_swords: { values: ["minecraft:wooden_sword"] },
  spears: { values: ["minecraft:iron_spear"] },
  axes: { values: ["diamond_axe"] },
  pickaxes: { values: ["diamond_pickaxe"] },
  shovels: { values: [] },
  hoes: { values: [] },
};

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
  diamond_sword: {
    "minecraft:attribute_modifiers": [
      { type: "minecraft:attack_damage", amount: 6 },
      { type: "minecraft:attack_speed", amount: -2.4 },
    ],
    "minecraft:max_damage": 1561,
  },
  diamond_axe: {
    "minecraft:attribute_modifiers": [
      { type: "minecraft:attack_damage", amount: 7 },
      { type: "minecraft:attack_speed", amount: -3.1 },
    ],
    "minecraft:max_damage": 1561,
  },
  diamond_pickaxe: {
    "minecraft:attribute_modifiers": [{ type: "minecraft:attack_damage", amount: 4 }],
    "minecraft:max_damage": 1561,
  },
  trident: {
    "minecraft:attribute_modifiers": [{ type: "minecraft:attack_damage", amount: 9 }],
    "minecraft:max_damage": 250,
  },
  iron_spear: {
    "minecraft:attribute_modifiers": [
      { type: "minecraft:attack_damage", amount: 2 },
      { type: "minecraft:attack_speed", amount: -2.8 },
    ],
    "minecraft:max_damage": 250,
  },
  copper_sword: {
    "minecraft:attribute_modifiers": [{ type: "minecraft:attack_damage", amount: 5 }],
    "minecraft:max_damage": 190,
  },
  wooden_sword: {
    "minecraft:attribute_modifiers": [{ type: "minecraft:attack_damage", amount: 3 }],
    "minecraft:max_damage": 59,
  },
};

describe("resolveItemStat", () => {
  it("returns undefined for an item with no components", () => {
    expect(resolveItemStat("unknown_item", componentsRaw, tagsRaw)).toBeUndefined();
  });

  it("returns undefined for an item with components but no matching stat", () => {
    expect(resolveItemStat("stone", componentsRaw, tagsRaw)).toBeUndefined();
  });

  it("picks food first", () => {
    expect(resolveItemStat("bread", componentsRaw, tagsRaw)).toEqual({
      type: "food",
      nutrition: 5,
    });
  });

  it("picks armor for an armor-tagged item, summing armor attribute amounts", () => {
    expect(resolveItemStat("diamond_chestplate", componentsRaw, tagsRaw)).toEqual({
      type: "armor",
      points: 8,
    });
  });

  it("picks weapon (not tool) for a sword", () => {
    expect(resolveItemStat("diamond_sword", componentsRaw, tagsRaw)).toEqual({
      type: "weapon",
      damage: 6,
    });
  });

  it("picks weapon for a trident via the extra weapon id list", () => {
    expect(resolveItemStat("trident", componentsRaw, tagsRaw)).toEqual({
      type: "weapon",
      damage: 9,
    });
  });

  it("picks weapon for a spear via the spears tag (1.21+ melee weapons outside the swords tag)", () => {
    expect(resolveItemStat("iron_spear", componentsRaw, tagsRaw)).toEqual({
      type: "weapon",
      damage: 2,
    });
  });

  it("resolves { id } object-form tag values (copper_sword) when detecting weapons", () => {
    expect(resolveItemStat("copper_sword", componentsRaw, tagsRaw)).toEqual({
      type: "weapon",
      damage: 5,
    });
  });

  it("resolves nested tag references (wooden_sword via #odd_swords) when detecting weapons", () => {
    expect(resolveItemStat("wooden_sword", componentsRaw, tagsRaw)).toEqual({
      type: "weapon",
      damage: 3,
    });
  });

  it("picks tool (durability), not weapon, for an axe despite it having attack damage", () => {
    expect(resolveItemStat("diamond_axe", componentsRaw, tagsRaw)).toEqual({
      type: "tool",
      durability: 1561,
    });
  });

  it("picks tool for a pickaxe", () => {
    expect(resolveItemStat("diamond_pickaxe", componentsRaw, tagsRaw)).toEqual({
      type: "tool",
      durability: 1561,
    });
  });
});

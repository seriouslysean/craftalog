import type { RawTagsData } from "./types.ts";
import { resolveTag } from "./tags.ts";

/**
 * Derives a human-facing taxonomy ("family") for each recipe's result item,
 * replacing the old browse-by-`category` grouping (building/equipment/
 * redstone/misc) whose "misc" bucket alone held ~40% of all recipes.
 *
 * Entirely rule-based against data already in the vendored mcmeta summary —
 * no per-item guessing. Priority order, first match wins:
 *   1. ITEM_FAMILY_OVERRIDES — exact item ids vanilla gives no group/tag for
 *      (workstations, redstone components, minecarts, smithing templates, …)
 *   2. GROUP_FAMILY — vanilla's own recipe-book `group` (e.g. "wooden_slab"),
 *      normalized to a family name
 *   3. TAG_FAMILY_PRIORITY — vanilla item tags (e.g. `#minecraft:slabs`),
 *      which already unify a shape across materials (wood + stone + copper
 *      slabs all land in "Slabs")
 *   4. ID_PATTERN_RULES — naming-convention fallbacks for stone/copper
 *      variants vanilla doesn't tag as a family (chiseled/cut/polished
 *      blocks, oxidation-state copper blocks, banner patterns, …)
 *   5. CATEGORY_FAMILY_FALLBACK — vanilla's coarse category, so every item
 *      still lands somewhere even if a future game update adds something
 *      none of the above rules recognize.
 */

const GROUP_FAMILY: Record<string, string> = {
  banner: "Banners",
  bark: "Logs & Wood",
  bed: "Beds",
  bed_dye: "Beds",
  black_dye: "Dyes",
  blue_dye: "Dyes",
  brown_dye: "Dyes",
  cyan_dye: "Dyes",
  gray_dye: "Dyes",
  light_blue_dye: "Dyes",
  light_gray_dye: "Dyes",
  magenta_dye: "Dyes",
  orange_dye: "Dyes",
  pink_dye: "Dyes",
  red_dye: "Dyes",
  white_dye: "Dyes",
  yellow_dye: "Dyes",
  boat: "Boats",
  chest_boat: "Boats",
  bonemeal: "Materials",
  bundle_dye: "Bundles",
  carpet: "Carpets",
  carpet_dye: "Carpets",
  concrete_powder: "Concrete",
  copper_bulb: "Copper Goods",
  copper_grate: "Copper Goods",
  copper_ingot: "Materials",
  exposed_copper_bulb: "Copper Goods",
  exposed_copper_grate: "Copper Goods",
  oxidized_copper_bulb: "Copper Goods",
  oxidized_copper_grate: "Copper Goods",
  weathered_copper_bulb: "Copper Goods",
  weathered_copper_grate: "Copper Goods",
  dry_ghast: "Decoration",
  dyed_armor: "Armor",
  dyed_candle: "Candles",
  gold_ingot: "Materials",
  iron_ingot: "Materials",
  netherite_ingot: "Materials",
  harness: "Harnesses",
  harness_dye: "Harnesses",
  map_cloning: "Tools & Utility",
  mossy_cobblestone: "Stone Variants",
  mossy_stone_bricks: "Stone Variants",
  planks: "Planks",
  rabbit_stew: "Food",
  shelf: "Shelves",
  shulker_box_dye: "Shulker Boxes",
  stained_glass: "Glass",
  stained_glass_pane: "Glass",
  stained_terracotta: "Terracotta",
  sticks: "Materials",
  sugar: "Materials",
  suspicious_stew: "Food",
  waxed_chiseled_copper: "Copper Goods",
  waxed_copper_bar: "Copper Goods",
  waxed_copper_block: "Copper Goods",
  waxed_copper_bulb: "Copper Goods",
  waxed_copper_chain: "Copper Goods",
  waxed_copper_chest: "Copper Goods",
  waxed_copper_door: "Copper Goods",
  waxed_copper_golem_statue: "Copper Goods",
  waxed_copper_grate: "Copper Goods",
  waxed_copper_lantern: "Copper Goods",
  waxed_copper_trapdoor: "Copper Goods",
  waxed_cut_copper: "Copper Goods",
  waxed_cut_copper_slab: "Copper Goods",
  waxed_cut_copper_stairs: "Copper Goods",
  waxed_exposed_chiseled_copper: "Copper Goods",
  waxed_exposed_copper_bulb: "Copper Goods",
  waxed_exposed_copper_grate: "Copper Goods",
  waxed_exposed_cut_copper: "Copper Goods",
  waxed_exposed_cut_copper_slab: "Copper Goods",
  waxed_exposed_cut_copper_stairs: "Copper Goods",
  waxed_lightning_rod: "Copper Goods",
  waxed_oxidized_chiseled_copper: "Copper Goods",
  waxed_oxidized_copper_bulb: "Copper Goods",
  waxed_oxidized_copper_grate: "Copper Goods",
  waxed_oxidized_cut_copper: "Copper Goods",
  waxed_oxidized_cut_copper_slab: "Copper Goods",
  waxed_oxidized_cut_copper_stairs: "Copper Goods",
  waxed_weathered_chiseled_copper: "Copper Goods",
  waxed_weathered_copper_bulb: "Copper Goods",
  waxed_weathered_copper_grate: "Copper Goods",
  waxed_weathered_cut_copper: "Copper Goods",
  waxed_weathered_cut_copper_slab: "Copper Goods",
  waxed_weathered_cut_copper_stairs: "Copper Goods",
  wooden_button: "Buttons",
  wooden_door: "Doors",
  wooden_fence: "Fences",
  wooden_fence_gate: "Fence Gates",
  wooden_hanging_sign: "Hanging Signs",
  wooden_pressure_plate: "Pressure Plates",
  wooden_sign: "Signs",
  wooden_slab: "Slabs",
  wooden_stairs: "Stairs",
  wooden_trapdoor: "Trapdoors",
  wool: "Wool",
};

/** First matching tag wins — ordered from most specific shape to broadest material. */
const TAG_FAMILY_PRIORITY: Array<[tag: string, family: string]> = [
  ["slabs", "Slabs"],
  ["stairs", "Stairs"],
  ["walls", "Walls"],
  ["doors", "Doors"],
  ["trapdoors", "Trapdoors"],
  ["buttons", "Buttons"],
  ["fences", "Fences"],
  ["fence_gates", "Fence Gates"],
  ["hanging_signs", "Hanging Signs"],
  ["signs", "Signs"],
  ["beds", "Beds"],
  ["banners", "Banners"],
  ["candles", "Candles"],
  ["wool_carpets", "Carpets"],
  ["wool", "Wool"],
  ["boats", "Boats"],
  ["shulker_boxes", "Shulker Boxes"],
  ["bundles", "Bundles"],
  ["harnesses", "Harnesses"],
  ["pickaxes", "Tools"],
  ["axes", "Tools"],
  ["shovels", "Tools"],
  ["hoes", "Tools"],
  ["swords", "Weapons"],
  ["spears", "Weapons"],
  ["arrows", "Weapons"],
  ["chest_armor", "Armor"],
  ["head_armor", "Armor"],
  ["leg_armor", "Armor"],
  ["foot_armor", "Armor"],
  ["bars", "Bars & Chains"],
  ["chains", "Bars & Chains"],
  ["rails", "Rails & Minecarts"],
  ["dyes", "Dyes"],
  ["logs", "Logs & Wood"],
  ["planks", "Planks"],
  ["stone_bricks", "Stone Variants"],
  ["concrete_powders", "Concrete"],
  ["terracotta", "Terracotta"],
  ["glazed_terracotta", "Terracotta"],
  ["copper", "Copper Goods"],
  ["copper_chests", "Copper Goods"],
  ["copper_golem_statues", "Copper Goods"],
  ["lanterns", "Decoration"],
  ["compasses", "Tools & Utility"],
];

/** Item ids vanilla gives no distinguishing group or family-shaped tag for. */
const ITEM_FAMILY_OVERRIDES: Record<string, string> = {
  ...Object.fromEntries(
    [
      "bolt_armor_trim_smithing_template",
      "coast_armor_trim_smithing_template",
      "dune_armor_trim_smithing_template",
      "eye_armor_trim_smithing_template",
      "flow_armor_trim_smithing_template",
      "host_armor_trim_smithing_template",
      "netherite_upgrade_smithing_template",
      "raiser_armor_trim_smithing_template",
      "rib_armor_trim_smithing_template",
      "sentry_armor_trim_smithing_template",
      "shaper_armor_trim_smithing_template",
      "silence_armor_trim_smithing_template",
      "snout_armor_trim_smithing_template",
      "spire_armor_trim_smithing_template",
      "tide_armor_trim_smithing_template",
      "vex_armor_trim_smithing_template",
      "ward_armor_trim_smithing_template",
      "wayfinder_armor_trim_smithing_template",
      "wild_armor_trim_smithing_template",
    ].map((id) => [id, "Smithing Templates"]),
  ),
  ...Object.fromEntries(["leather_horse_armor", "wolf_armor"].map((id) => [id, "Armor"])),
  ...Object.fromEntries(
    [
      "comparator",
      "repeater",
      "piston",
      "sticky_piston",
      "dispenser",
      "dropper",
      "hopper",
      "observer",
      "lever",
      "redstone_torch",
      "redstone_block",
      "target",
      "tripwire_hook",
      "daylight_detector",
      "calibrated_sculk_sensor",
      "crafter",
      "tnt",
      "redstone_lamp",
      "lightning_rod",
      "respawn_anchor",
      "creaking_heart",
      "redstone",
    ].map((id) => [id, "Redstone Components"]),
  ),
  ...Object.fromEntries(
    ["minecart", "chest_minecart", "furnace_minecart", "hopper_minecart", "tnt_minecart"].map(
      (id) => [id, "Rails & Minecarts"],
    ),
  ),
  ...Object.fromEntries(
    [
      "crafting_table",
      "furnace",
      "blast_furnace",
      "smoker",
      "brewing_stand",
      "enchanting_table",
      "anvil",
      "grindstone",
      "loom",
      "cartography_table",
      "fletching_table",
      "smithing_table",
      "stonecutter",
      "composter",
      "lectern",
      "cauldron",
      "beacon",
    ].map((id) => [id, "Workstations"]),
  ),
  ...Object.fromEntries(
    ["chest", "barrel", "ender_chest", "trapped_chest", "bookshelf", "chiseled_bookshelf"].map(
      (id) => [id, "Storage"],
    ),
  ),
  ...Object.fromEntries(
    [
      "beetroot_soup",
      "mushroom_stew",
      "pumpkin_pie",
      "dried_kelp",
      "honey_bottle",
      "bowl",
      "cookie",
      "bread",
      "cake",
      "golden_apple",
      "golden_carrot",
      "melon",
      "melon_seeds",
      "pumpkin_seeds",
      "wheat",
      "golden_dandelion",
    ].map((id) => [id, "Food"]),
  ),
  ...Object.fromEntries(
    [
      "armor_stand",
      "item_frame",
      "glow_item_frame",
      "painting",
      "flower_pot",
      "jukebox",
      "note_block",
      "decorated_pot",
      "decorated_pot_simple",
      "end_rod",
      "conduit",
      "beehive",
      "ladder",
      "scaffolding",
      "torch",
      "soul_torch",
      "campfire",
      "soul_campfire",
      "end_crystal",
      "candle",
      "copper_torch",
      "copper_lantern",
      "music_disc_5",
      "sea_lantern",
      "dripstone_block",
    ].map((id) => [id, "Decoration"]),
  ),
  ...Object.fromEntries(["glass_pane", "tinted_glass"].map((id) => [id, "Glass"])),
  ...Object.fromEntries(
    [
      "copper_bulb",
      "copper_grate",
      "copper_chest",
      "copper_golem_statue",
      "copper_door",
      "copper_trapdoor",
      "copper_chain",
      "copper_bars",
    ].map((id) => [id, "Copper Goods"]),
  ),
  ...Object.fromEntries(
    [
      "stone_pressure_plate",
      "polished_blackstone_pressure_plate",
      "heavy_weighted_pressure_plate",
      "light_weighted_pressure_plate",
    ].map((id) => [id, "Pressure Plates"]),
  ),
  ...Object.fromEntries(["bow", "crossbow", "shield", "mace"].map((id) => [id, "Weapons"])),
  ...Object.fromEntries(
    [
      "fishing_rod",
      "flint_and_steel",
      "shears",
      "spyglass",
      "brush",
      "carrot_on_a_stick",
      "warped_fungus_on_a_stick",
      "lead",
      "name_tag",
      "saddle",
      "clock",
      "map",
      "filled_map",
      "bucket",
      "glass_bottle",
      "book",
      "writable_book",
      "written_book",
      "paper",
      "lodestone",
    ].map((id) => [id, "Tools & Utility"]),
  ),
  ...Object.fromEntries(
    [
      "copper_nugget",
      "gold_nugget",
      "iron_nugget",
      "slime_ball",
      "resin_clump",
      "blaze_powder",
      "fermented_spider_eye",
      "magma_cream",
      "ender_eye",
      "glistering_melon_slice",
      "wind_charge",
      "fire_charge",
      "leather",
    ].map((id) => [id, "Materials"]),
  ),
  ...Object.fromEntries(
    [
      "coal",
      "coal_block",
      "iron_block",
      "gold_block",
      "diamond",
      "diamond_block",
      "emerald",
      "emerald_block",
      "lapis_lazuli",
      "lapis_block",
      "netherite_block",
      "raw_iron",
      "raw_iron_block",
      "raw_gold",
      "raw_gold_block",
      "raw_copper",
      "raw_copper_block",
      "glowstone",
    ].map((id) => [id, "Ores & Minerals"]),
  ),
};

const STONE_VARIANT_NAMES = new Set([
  "andesite",
  "diorite",
  "granite",
  "tuff",
  "deepslate",
  "blackstone",
  "cinnabar",
  "sulfur",
  "quartz_block",
  "quartz_pillar",
  "prismarine",
  "dark_prismarine",
  "purpur_block",
  "purpur_pillar",
  "sandstone",
  "red_sandstone",
]);
const STONE_VARIANT_PREFIXES = ["chiseled_", "cut_", "polished_", "smooth_", "cracked_"];

const CATEGORY_FAMILY_FALLBACK: Record<string, string> = {
  building: "Building Blocks",
  equipment: "Equipment",
  redstone: "Redstone Components",
  misc: "Miscellaneous",
};

/** Item id -> every vanilla tag name it belongs to, resolved once per parse run. */
export type ItemTagIndex = Map<string, Set<string>>;

export function buildItemTagIndex(tagsRaw: RawTagsData): ItemTagIndex {
  const index: ItemTagIndex = new Map();
  for (const tagName of Object.keys(tagsRaw)) {
    for (const itemId of resolveTag(tagName, tagsRaw)) {
      let tagsForItem = index.get(itemId);
      if (!tagsForItem) {
        tagsForItem = new Set();
        index.set(itemId, tagsForItem);
      }
      tagsForItem.add(tagName);
    }
  }
  return index;
}

export interface DeriveFamilyInput {
  /** The recipe's result item id, if it has one (crafting_special_repairitem has none). */
  itemId?: string;
  group?: string;
  category: string;
}

export interface DeriveFamilyResult {
  family: string;
  /** True when no override/group/tag/id-pattern rule matched and the category fallback (or "Miscellaneous") was used -- a signal the taxonomy rules haven't caught up to this item, worth surfacing on a version bump. */
  usedFallback: boolean;
}

export function deriveFamily(
  input: DeriveFamilyInput,
  itemTagIndex: ItemTagIndex,
): DeriveFamilyResult {
  const { itemId, group, category } = input;

  if (itemId) {
    const override = ITEM_FAMILY_OVERRIDES[itemId];
    if (override) return { family: override, usedFallback: false };
  }

  if (group) {
    const groupFamily = GROUP_FAMILY[group];
    if (groupFamily) return { family: groupFamily, usedFallback: false };
  }

  if (itemId) {
    const itemTags = itemTagIndex.get(itemId);
    if (itemTags) {
      for (const [tag, family] of TAG_FAMILY_PRIORITY) {
        if (itemTags.has(tag)) return { family, usedFallback: false };
      }
    }

    if (itemId.endsWith("_banner_pattern")) return { family: "Banners", usedFallback: false };
    if (
      itemId.endsWith("_bricks") ||
      STONE_VARIANT_NAMES.has(itemId) ||
      STONE_VARIANT_PREFIXES.some((prefix) => itemId.startsWith(prefix))
    ) {
      return { family: "Stone Variants", usedFallback: false };
    }
    if (itemId.includes("copper")) return { family: "Copper Goods", usedFallback: false };
  }

  return { family: CATEGORY_FAMILY_FALLBACK[category] ?? "Miscellaneous", usedFallback: true };
}

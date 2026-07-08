import { CATEGORIES } from "./category.ts";
import type { RawTagsData } from "./types.ts";
import { resolveTag } from "./tags.ts";
import { toSnakeId } from "./strings.ts";

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
 *
 * Every family this module can produce also has a stable, underscore-style
 * id (`toSnakeId` of its display name, e.g. "Copper Goods" -> "copper_goods")
 * and a mapped top-level category (FAMILY_CATEGORY, below) -- together these
 * back the `families`/`categories` content collections (see
 * src/content.config.ts) that `recipes.family` now references, instead of
 * embedding the display name directly on the recipe.
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
  map_cloning: "Utilities",
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
  ["compasses", "Utilities"],
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
      // jack_o_lantern: a light source, sits with lanterns/torches/etc.
      "jack_o_lantern",
      // iron_bars/iron_chain: dissolved out of the former 2-item "Bars &
      // Chains" family into Decoration (matches lanterns already being
      // here) -- waxed/oxidized copper bars and chains keep their own
      // Copper Goods override above and are unaffected.
      "iron_bars",
      "iron_chain",
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
      // In-game these live in Tools & Utilities too.
      "firework_rocket",
      "firework_star",
    ].map((id) => [id, "Utilities"]),
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
  // "Storage"/"compressed" blocks -- 9x the crafting material packed into one
  // block. honey_block and slime_block fit the same shape (4 honey bottles /
  // 9 slimeballs compacted) but have no group or family-shaped tag of their
  // own, so without this they'd fall through to the generic category
  // fallback (see CATEGORY_FAMILY_FALLBACK below).
  ...Object.fromEntries(
    [
      "hay_block",
      "bone_block",
      "dried_kelp_block",
      "nether_wart_block",
      "honeycomb_block",
      "bamboo_block",
      "bamboo_mosaic",
      "resin_block",
      "amethyst_block",
      "bricks",
      "clay",
      "potent_sulfur",
      "honey_block",
      "slime_block",
    ].map((id) => [id, "Compact Blocks"]),
  ),
  // Naturally-occurring terrain/decoration blocks with no group or
  // family-shaped tag of their own -- mirrors the creative inventory's
  // Natural Blocks tab.
  ...Object.fromEntries(
    [
      "packed_ice",
      "blue_ice",
      "snow",
      "snow_block",
      "coarse_dirt",
      "packed_mud",
      "muddy_mangrove_roots",
      "magma_block",
    ].map((id) => [id, "Natural Blocks"]),
  ),
  // repair_item is the one recipe with no result item (it repairs any
  // matching pair of damaged tools/armor), so it has no vanilla category to
  // fall back to in the usual sense -- generate.ts passes its own recipe id
  // as a stand-in itemId (see deriveFamily's call site) so this override
  // still matches instead of silently landing in the generic fallback.
  repair_item: "Other",
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

/**
 * Generic per-category landing zones for whatever none of the rules above
 * recognize -- kept deliberately bland ("Other …") rather than a real-
 * sounding family name, so a future version bump surfaces new items here
 * (via `usedFallback`/fallbackFamilyItems) instead of silently blending them
 * into an established family. "Building Blocks"/"Miscellaneous" (this
 * fallback's original names) are retired in favor of "Other Blocks"/"Other"
 * so they don't collide with the "Building Blocks" *category* name (see
 * scripts/lib/category.ts) -- "Equipment" and "Redstone Components" are
 * unaffected since neither collides with anything and the latter already
 * matches the real "Redstone Components" family produced by
 * ITEM_FAMILY_OVERRIDES for comparators/repeaters/etc.
 */
const CATEGORY_FAMILY_FALLBACK: Record<string, string> = {
  building: "Other Blocks",
  equipment: "Equipment",
  redstone: "Redstone Components",
  misc: "Other",
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
  /** The recipe's result item id, if it has one. Callers pass the recipe's own id as a stand-in for the one recipe with no result (repair_item) -- see generate.ts's call site -- so the ITEM_FAMILY_OVERRIDES lookup below still has something to match against. */
  itemId?: string;
  group?: string;
  category: string;
}

export interface DeriveFamilyResult {
  /** Stable underscore-style id (see toSnakeId) -- what recipes.family now stores and families.json is keyed by. */
  id: string;
  /** Human-facing display name, e.g. "Copper Goods" -- what families.json's `name` field stores. */
  name: string;
  /** True when no override/group/tag/id-pattern rule matched and the category fallback ("Other Blocks"/"Equipment"/"Redstone Components"/"Other") was used -- a signal the taxonomy rules haven't caught up to this item, worth surfacing on a version bump. */
  usedFallback: boolean;
}

function familyResult(name: string, usedFallback: boolean): DeriveFamilyResult {
  return { id: toSnakeId(name), name, usedFallback };
}

export function deriveFamily(
  input: DeriveFamilyInput,
  itemTagIndex: ItemTagIndex,
): DeriveFamilyResult {
  const { itemId, group, category } = input;

  if (itemId) {
    const override = ITEM_FAMILY_OVERRIDES[itemId];
    if (override) return familyResult(override, false);
  }

  if (group) {
    const groupFamily = GROUP_FAMILY[group];
    if (groupFamily) return familyResult(groupFamily, false);
  }

  if (itemId) {
    const itemTags = itemTagIndex.get(itemId);
    if (itemTags) {
      for (const [tag, family] of TAG_FAMILY_PRIORITY) {
        if (itemTags.has(tag)) return familyResult(family, false);
      }
    }

    if (itemId.endsWith("_banner_pattern")) return familyResult("Banners", false);
    if (
      itemId.endsWith("_bricks") ||
      itemId.endsWith("_tiles") ||
      STONE_VARIANT_NAMES.has(itemId) ||
      STONE_VARIANT_PREFIXES.some((prefix) => itemId.startsWith(prefix))
    ) {
      return familyResult("Stone Variants", false);
    }
    if (itemId.includes("copper")) return familyResult("Copper Goods", false);
  }

  return familyResult(CATEGORY_FAMILY_FALLBACK[category] ?? "Other", true);
}

/**
 * Every family id -> its owning top-level category id (see
 * scripts/lib/category.ts's CATEGORIES). Must stay total: generate.ts throws
 * if a derived family has no entry here, so a future version bump that
 * produces a genuinely new family (almost always via CATEGORY_FAMILY_FALLBACK
 * above -- an ID_PATTERN/GROUP/TAG/override rule always targets an existing,
 * already-mapped name) fails the build loudly instead of silently shipping
 * an uncategorized family. Order mirrors the taxonomy proposal's per-category
 * breakdown; category ids come from scripts/lib/category.ts.
 */
export const FAMILY_CATEGORY: Record<string, string> = {
  // Building Blocks (13)
  slabs: "building_blocks",
  stairs: "building_blocks",
  stone_variants: "building_blocks",
  walls: "building_blocks",
  logs_wood: "building_blocks",
  doors: "building_blocks",
  trapdoors: "building_blocks",
  fences: "building_blocks",
  fence_gates: "building_blocks",
  planks: "building_blocks",
  copper_goods: "building_blocks",
  compact_blocks: "building_blocks",
  natural_blocks: "building_blocks",
  // dormant safety net -- see CATEGORY_FAMILY_FALLBACK's "building" entry;
  // 0 items use this today (that's the point of the family fixes above).
  other_blocks: "building_blocks",

  // Colored Blocks (10)
  glass: "colored_blocks",
  banners: "colored_blocks",
  carpets: "colored_blocks",
  shulker_boxes: "colored_blocks",
  bundles: "colored_blocks",
  wool: "colored_blocks",
  beds: "colored_blocks",
  candles: "colored_blocks",
  concrete: "colored_blocks",
  terracotta: "colored_blocks",

  // Functional Blocks (6)
  decoration: "functional_blocks",
  workstations: "functional_blocks",
  shelves: "functional_blocks",
  signs: "functional_blocks",
  hanging_signs: "functional_blocks",
  storage: "functional_blocks",

  // Redstone (3)
  redstone_components: "redstone",
  pressure_plates: "redstone",
  buttons: "redstone",

  // Tools & Utilities (3 -- "other" is a judgment call: repair_item is the
  // sole occupant and isn't a block/item the proposal's category breakdown
  // explicitly placed, but every family must map somewhere; a tool-repair
  // action reads closest to "utility" of the 9 categories)
  tools: "tools_utilities",
  utilities: "tools_utilities",
  other: "tools_utilities",

  // Combat (3)
  armor: "combat",
  weapons: "combat",
  smithing_templates: "combat",

  // Transportation (3)
  boats: "transportation",
  harnesses: "transportation",
  rails_minecarts: "transportation",

  // Food (1)
  food: "food",

  // Materials (3)
  materials: "materials",
  ores_minerals: "materials",
  dyes: "materials",
};

// Self-audit: every FAMILY_CATEGORY value must be a real category id, so a
// typo here fails immediately at import time (test/parse/validate alike)
// instead of silently producing a families.json entry with a category
// reference nothing resolves.
const VALID_CATEGORY_IDS = new Set(CATEGORIES.map((category) => category.id));
for (const [familyId, categoryId] of Object.entries(FAMILY_CATEGORY)) {
  if (!VALID_CATEGORY_IDS.has(categoryId)) {
    throw new Error(
      `FAMILY_CATEGORY["${familyId}"] = "${categoryId}" is not a real category id -- see scripts/lib/category.ts's CATEGORIES.`,
    );
  }
}

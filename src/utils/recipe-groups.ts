import type { Ingredient, ItemData, RecipeData } from "../content.config";
import familiesData from "../data/generated/families.json";
import { slugify } from "./slugify";
import { humanizeTagLabel } from "./tag-label";

const NOTE_MAX_LENGTH = 40;

// Family id -> display name, read directly from the generated data (not via
// the `families` content collection) so this stays synchronous. `family` on
// a recipe is now a `families` collection reference (see
// src/content.config.ts) rather than a plain display-name string -- this is
// a minimal shim so every existing call site that read `recipe.family` as
// text (this file, RecipePage.astro) keeps working unchanged. Real UI
// consumption of the `families`/`categories` collections (category nav,
// grouped homepage sections, etc.) is tracked as follow-up work.
const FAMILY_NAME_BY_ID: Record<string, string> = Object.fromEntries(
  Object.values(familiesData).map((family) => [family.id, family.name]),
);

/** Resolves a recipe's `family` reference back to its display name, e.g. "Copper Goods" -- see FAMILY_NAME_BY_ID above. */
export function familyDisplayName(family: RecipeData["family"]): string {
  return FAMILY_NAME_BY_ID[family.id] ?? family.id;
}

/** Base path segment for every recipe page -- single source of truth for src/pages/recipe/, so a route restructure only touches one string. */
export const RECIPE_BASE_PATH = "/recipe";

function truncateNote(note: string): string {
  return note.length > NOTE_MAX_LENGTH ? `${note.slice(0, NOTE_MAX_LENGTH - 1)}…` : note;
}

function ingredientList(recipe: RecipeData): Ingredient[] {
  if (recipe.type === "shaped" && recipe.key) {
    return Object.values(recipe.key);
  }
  if ((recipe.type === "shapeless" || recipe.type === "transmute") && recipe.ingredients) {
    return recipe.ingredients;
  }
  return [];
}

function ingredientLabel(ingredient: Ingredient, getItemName: (id: string) => string): string {
  return ingredient.tag ? humanizeTagLabel(ingredient.tag) : getItemName(ingredient.items[0]);
}

/**
 * Derives every "re-dye an existing item" group alias from the recipe data
 * itself: a vanilla `X_dye` group normalizes to its base group `X` iff `X`
 * exists and every result item `X_dye` produces is also a result of `X` --
 * i.e. the dye group is purely an alternate way to obtain (a subset of) the
 * base group's own items, so both sides of the pair collapse into one
 * VariantGroup instead of two. Subset, not strict set equality: the base
 * group may legitimately hold extra non-redyeable members (vanilla's
 * `carpet` group is all 16 colors PLUS moss_carpet/pale_moss_carpet, which
 * have no re-dye recipe -- they must still land on the same card as the
 * colors). Against the current generated data this admits exactly
 * harness_dye->harness, bed_dye->bed, carpet_dye->carpet (asserted in
 * tests/recipe-groups.test.ts) and auto-admits any future X_dye/X pair a
 * version bump introduces. Every other dye-suffixed group (bundle_dye,
 * shulker_box_dye, the 12 `<color>_dye` dye-item groups, ...) has no base
 * group to alias to -- colors are its only recipes for that shape, so it's
 * already a complete collapse key on its own and stays unaliased.
 */
export function deriveRedyeGroupAliases(recipes: RecipeData[]): Map<string, string> {
  const resultIdsByGroup = new Map<string, Set<string>>();
  for (const recipe of recipes) {
    if (!recipe.group || !recipe.result) continue;
    let resultIds = resultIdsByGroup.get(recipe.group);
    if (!resultIds) {
      resultIds = new Set();
      resultIdsByGroup.set(recipe.group, resultIds);
    }
    resultIds.add(recipe.result.id);
  }

  const aliases = new Map<string, string>();
  for (const [group, dyeResultIds] of resultIdsByGroup) {
    if (!group.endsWith("_dye")) continue;
    const baseResultIds = resultIdsByGroup.get(group.slice(0, -"_dye".length));
    if (!baseResultIds) continue;
    if ([...dyeResultIds].every((id) => baseResultIds.has(id))) {
      aliases.set(group, group.slice(0, -"_dye".length));
    }
  }
  return aliases;
}

function normalizeVariantGroupKey(
  group: string | undefined,
  redyeAliases: Map<string, string>,
): string | undefined {
  if (!group) return undefined;
  return redyeAliases.get(group) ?? group;
}

/**
 * Strips copper's oxidation/waxing prefixes from a result item id, e.g.
 * "waxed_exposed_cut_copper_slab" -> "cut_copper_slab". Vanilla's own
 * `group` field doesn't reliably tie a copper shape's tiers together --
 * some shapes only group their 4 waxed tiers (leaving the un-waxed base and
 * un-waxed oxidized tiers stranded as singletons), others have no shared
 * group at all across any tier -- so `groupRecipes` below derives a
 * collapse key from the id itself for any result that has a sibling this
 * stripping would unify (see `oxidationBases`). The bare block's tier ids
 * ("waxed_exposed_copper", ...) strip to "copper", aliased to its own item
 * id "copper_block" so the family collapses under the same key as its
 * tiers. Every one of the ~78 ids this prefix set matches in the current
 * generated data is copper or lightning-rod-family -- no wood/wool/color
 * family id carries these prefixes, so this can't accidentally rope in an
 * unrelated shape. In particular this leaves the `dyed_armor` group (which
 * spans 6 *different* shapes -- leather boots/chestplate/helmet/leggings/
 * horse armor + wolf armor, not color variants of one shape) alone: none
 * of those ids match this prefix, so they still fall through to
 * `members[0].group`-based derivation below (undefined for all 6, since
 * their canonical recipes carry no group).
 */
const OXIDATION_TIER_PREFIX = /^(?:waxed_)?(?:exposed_|weathered_|oxidized_)?/;

function stripOxidationPrefixes(resultId: string): string {
  const base = resultId.replace(OXIDATION_TIER_PREFIX, "");
  return base === "copper" ? "copper_block" : base;
}

export interface SiblingRecipe {
  recipeId: string;
  type: RecipeData["type"];
  /**
   * True for a special recipe the data pipeline flagged as modifying an
   * EXISTING item of the same kind (banner duplicate, shield decoration,
   * leather re-dye, ...) rather than crafting a genuinely new one -- read
   * straight off `recipe.selfReferential` (see `selfReferential` in
   * src/data/generated-schema.ts for the deterministic upstream signal).
   * Fails open to `false` whenever the flag is absent: every non-special
   * recipe, and any special a future version bump introduces that the
   * pipeline doesn't flag -- i.e. the equal-tab behavior. Consumed by
   * RecipePage.astro to demote these siblings below the primary variant
   * tabs.
   */
  selfReferential: boolean;
  /** e.g. "from Bone", or a truncated note for special recipes. Null for singletons. */
  label: string | null;
  /** The distinguishing ingredient's item id. Null for singletons and special recipes. */
  iconItemId: string | null;
  /** Every ingredient item id this recipe accepts, for the catalog search index. */
  ingredientItemIds: string[];
  /** URL-safe /recipe/{item}/{slug}/ segment for this recipe, precomputed by the data pipeline (see scripts/lib/recipe-slug.ts) -- unique within the group. */
  slug: string;
}

export interface RecipeGroup {
  resultId: string;
  family: string;
  familyId: string;
  /** This result's collapse key, highest-precedence source wins: (1) the data-pipeline-derived shape-tag key (see scripts/lib/shape-tag.ts's deriveShapeTag, persisted as recipe.shapeTag) when the result belongs to an allow-listed vanilla shape tag -- the most complete signal, since it unifies every material of a shape (wood, stone, AND copper) in one pass; (2) an id-derived oxidation/waxing base (see stripOxidationPrefixes) for copper shapes no shape tag covers; (3) the normalized vanilla `group` field shared by this result's recipes (see normalizeVariantGroupKey); else undefined. Used to fold same-shape/different-material result items into one tabbed VariantGroup -- see collapseVariantGroups. Precedence example: cut_copper_slab is both in `#minecraft:slabs` (shapeTag) and oxidation-collapsible with its own tiers -- shapeTag wins, so it joins the single "Slabs" card (with oak_slab, stone_slab, ...) rather than a standalone "Cut Copper Slab" card of just its 8 tiers (see tests/recipe-groups.test.ts). */
  variantKey: string | undefined;
  /** Alphabetically-first recipe id — the group's default/linked-to recipe. */
  canonicalId: string;
  count: number;
  /** Sorted by recipeId; siblings[0].recipeId === canonicalId. */
  siblings: SiblingRecipe[];
}

/**
 * Recomputes labels within a colliding cluster (siblings that landed on the
 * same primary label) from an ingredient unique to each one *within that
 * cluster* -- e.g. magenta_dye's "blue + red + pink" vs "blue + red + white"
 * recipes both lead with blue dye once the group-wide common set is empty,
 * but differ from each other in their last ingredient.
 */
function resolveLabelCollisions(
  siblings: SiblingRecipe[],
  lists: Ingredient[][],
  getItemName: (id: string) => string,
): void {
  const byLabel = new Map<string, number[]>();
  siblings.forEach((sibling, index) => {
    if (sibling.label === null) return;
    const indices = byLabel.get(sibling.label);
    if (indices) {
      indices.push(index);
    } else {
      byLabel.set(sibling.label, [index]);
    }
  });

  for (const indices of byLabel.values()) {
    if (indices.length <= 1) continue;

    for (const index of indices) {
      const otherItemIds = new Set(
        indices
          .filter((other) => other !== index)
          .flatMap((other) => lists[other].map((ingredient) => ingredient.items[0])),
      );
      const distinguishing = lists[index].find(
        (ingredient) => !otherItemIds.has(ingredient.items[0]),
      );
      if (distinguishing) {
        siblings[index].label = `from ${ingredientLabel(distinguishing, getItemName)}`;
        siblings[index].iconItemId = distinguishing.items[0];
      }
    }
  }
}

/**
 * Groups recipes by result item (a recipe with no result becomes its own
 * singleton group keyed by its own id -- every emitted recipe has a result
 * today, see generate.ts's resultless-recipe exclusion, but `result` stays
 * optional on the schema so this stays defensive). For groups with more than
 * one recipe, derives a short "from X" label per sibling from whatever
 * ingredient actually differs between them -- not just the first ingredient,
 * which breaks when siblings share their first ingredient (all 17
 * Suspicious Stew recipes lead with a bowl).
 */
export function groupRecipes(
  recipes: RecipeData[],
  getItemName: (id: string) => string,
): RecipeGroup[] {
  const byResult = new Map<string, RecipeData[]>();
  for (const recipe of recipes) {
    const resultId = recipe.result?.id ?? recipe.id;
    const bucket = byResult.get(resultId);
    if (bucket) {
      bucket.push(recipe);
    } else {
      byResult.set(resultId, [recipe]);
    }
  }

  const redyeAliases = deriveRedyeGroupAliases(recipes);

  // Every base id that at least one oxidation/waxing tier strips down to
  // (i.e. a shape with a tier actually present in this dataset). Computed
  // as its own pass (not inline below) since a group needs to know whether
  // any *other* result id shares its stripped form before it can tell
  // whether this key would unify anything -- including its own un-prefixed
  // base, which never contributes to this set itself (stripping is a
  // no-op for it) but matches once a sibling tier has added it. A lone
  // stripped id with no sibling just becomes a 1-member bucket, which
  // collapseVariantGroups already demotes back to a plain singleton, so no
  // count threshold is needed here.
  const oxidationBases = new Set<string>();
  for (const resultId of byResult.keys()) {
    const stripped = stripOxidationPrefixes(resultId);
    if (stripped !== resultId) oxidationBases.add(stripped);
  }

  const groups: RecipeGroup[] = [];

  for (const [resultId, members] of byResult) {
    members.sort((a, b) => a.id.localeCompare(b.id));
    const count = members.length;
    const lists = members.map(ingredientList);

    let commonItemIds: Set<string> | null = null;
    if (count > 1) {
      commonItemIds = new Set(lists[0].map((ingredient) => ingredient.items[0]));
      for (const list of lists.slice(1)) {
        const itemIds = new Set(list.map((ingredient) => ingredient.items[0]));
        commonItemIds = new Set([...commonItemIds].filter((id) => itemIds.has(id)));
      }
    }

    const siblings: SiblingRecipe[] = members.map((recipe, index) => {
      const list = lists[index];
      const ingredientItemIds = [...new Set(list.flatMap((ingredient) => ingredient.items))];

      if (count === 1) {
        return {
          recipeId: recipe.id,
          type: recipe.type,
          selfReferential: recipe.selfReferential === true,
          label: null,
          iconItemId: null,
          ingredientItemIds,
          slug: recipe.slug,
        };
      }

      if (list.length === 0) {
        return {
          recipeId: recipe.id,
          type: recipe.type,
          selfReferential: recipe.selfReferential === true,
          label: recipe.note ? truncateNote(recipe.note) : null,
          iconItemId: null,
          ingredientItemIds,
          slug: recipe.slug,
        };
      }

      const distinguishing =
        list.find((ingredient) => !commonItemIds!.has(ingredient.items[0])) ?? list[0];

      return {
        recipeId: recipe.id,
        type: recipe.type,
        selfReferential: recipe.selfReferential === true,
        label: `from ${ingredientLabel(distinguishing, getItemName)}`,
        iconItemId: distinguishing.items[0],
        ingredientItemIds,
        slug: recipe.slug,
      };
    });

    if (count > 1) {
      resolveLabelCollisions(siblings, lists, getItemName);
    }

    const strippedResultId = stripOxidationPrefixes(resultId);
    // Precedence: shapeTag (data-pipeline, tag-derived) > oxidation-strip >
    // vanilla `group` -- see RecipeGroup.variantKey's doc comment above for
    // why and the cut_copper_slab example this order resolves.
    const variantKey =
      members[0].shapeTag ??
      (oxidationBases.has(strippedResultId) ? strippedResultId : undefined) ??
      normalizeVariantGroupKey(members[0].group, redyeAliases);

    groups.push({
      resultId,
      family: familyDisplayName(members[0].family),
      familyId: members[0].family.id,
      variantKey,
      canonicalId: members[0].id,
      count,
      siblings,
    });
  }

  return groups;
}

export interface VariantGroup {
  /** The shared, normalized vanilla `group` field every member's canonical recipe carries (see normalizeVariantGroupKey). */
  groupKey: string;
  /** Every member RecipeGroup (one per distinct result item), sorted by resultId. variants[0] is this card's default/linked-to variant, matching RecipeGroup.canonicalId's own "alphabetically first" convention. */
  variants: RecipeGroup[];
}

/**
 * Folds RecipeGroups that share a normalized vanilla `group` field (see
 * RecipeGroup.variantKey) into one tabbed VariantGroup -- e.g. all 16
 * harness colors collapse into one "Harnesses" card instead of 16 separate
 * catalog entries. A groupKey with only one member (most copper
 * oxidation-tier groups, since vanilla doesn't tag every tier under one
 * shared group the way it does for wood/color families) isn't worth a tab
 * UI, so it's returned as a plain singleton alongside every RecipeGroup
 * with no variantKey at all.
 */
export function collapseVariantGroups(groups: RecipeGroup[]): {
  variantGroups: VariantGroup[];
  singletons: RecipeGroup[];
} {
  const byKey = new Map<string, RecipeGroup[]>();
  const singletons: RecipeGroup[] = [];

  for (const group of groups) {
    if (!group.variantKey) {
      singletons.push(group);
      continue;
    }
    const bucket = byKey.get(group.variantKey);
    if (bucket) {
      bucket.push(group);
    } else {
      byKey.set(group.variantKey, [group]);
    }
  }

  const variantGroups: VariantGroup[] = [];
  for (const [groupKey, members] of byKey) {
    if (members.length === 1) {
      singletons.push(members[0]);
      continue;
    }
    variantGroups.push({
      groupKey,
      variants: members.toSorted((a, b) => a.resultId.localeCompare(b.resultId)),
    });
  }

  return { variantGroups, singletons };
}

export interface VariantGroupMeta {
  /** Generic display name for the collapsed card, e.g. "Boat" not "Acacia Boat". */
  name: string;
  /** The variant shown as the card's default/linked-to face, e.g. "oak_boat" not the alphabetically-first "acacia_boat". Falls back to variants[0] if unset or not found (shouldn't happen for a real groupKey -- the no-rot test in tests/recipe-groups.test.ts catches a stale/mistyped id). */
  defaultResultId?: string;
}

/**
 * Curated editorial overrides for a VariantGroup's identity, keyed by
 * groupKey. A group with no entry here is fully data-derived instead:
 * deriveVariantGroupName below names the card from what its member item
 * names share (e.g. "Slab" from "Oak Slab"/"Cut Copper Slab"/...), and
 * variantGroupDefault falls back to the alphabetically-first member -- so
 * a NEW vanilla variant group introduced by a version bump ships with a
 * sane derived identity and zero code changes (the automated weekly data
 * update must never be blocked on hand-curation). An entry here is purely
 * an additive quality upgrade over that fallback: a nicer generic name
 * ("Wood & Hyphae" where derivation can only offer a single member's name)
 * and/or a more iconic default face (oak over acacia, red bed over black).
 * Every key must still match a real groupKey collapseVariantGroups produces
 * from the current generated data -- tests/recipe-groups.test.ts asserts
 * there are no rotted entries, and separately proves the derived fallback
 * yields a non-empty sane name for EVERY real group when this map is
 * ignored.
 */
export const VARIANT_GROUP_META: Record<string, VariantGroupMeta> = {
  // Color families -- default to white except where vanilla's own
  // iconography favors a different color (bed: red is the classic
  // Minecraft bed color; shulker box: purple is the vanilla shulker's own
  // color).
  banner: { name: "Banner", defaultResultId: "white_banner" },
  bed: { name: "Bed", defaultResultId: "red_bed" },
  bundle_dye: { name: "Dyed Bundle", defaultResultId: "white_bundle" },
  carpet: { name: "Carpet", defaultResultId: "white_carpet" },
  concrete_powder: { name: "Concrete Powder", defaultResultId: "white_concrete_powder" },
  dyed_candle: { name: "Dyed Candle", defaultResultId: "white_candle" },
  harness: { name: "Harness", defaultResultId: "white_harness" },
  shulker_box_dye: { name: "Dyed Shulker Box", defaultResultId: "purple_shulker_box" },
  stained_glass: { name: "Stained Glass", defaultResultId: "white_stained_glass" },
  stained_glass_pane: { name: "Stained Glass Pane", defaultResultId: "white_stained_glass_pane" },
  stained_terracotta: { name: "Dyed Terracotta", defaultResultId: "white_terracotta" },
  wool: { name: "Wool", defaultResultId: "white_wool" },
  // Wood-only families -- default to oak, the wood type most players
  // picture first. Each of these stays keyed by vanilla's own `group`
  // field: no non-wood sibling exists in vanilla for any of them today
  // (see scripts/lib/shape-tag.ts's doc comment for the confirmed sweep),
  // so there's nothing for a shapeTag rule to unify beyond what `group`
  // already achieves.
  bark: { name: "Wood & Hyphae", defaultResultId: "oak_wood" },
  boat: { name: "Boat", defaultResultId: "oak_boat" },
  chest_boat: { name: "Boat with Chest", defaultResultId: "oak_chest_boat" },
  planks: { name: "Planks", defaultResultId: "oak_planks" },
  shelf: { name: "Shelf", defaultResultId: "oak_shelf" },
  wooden_fence_gate: { name: "Fence Gate", defaultResultId: "oak_fence_gate" },
  wooden_hanging_sign: { name: "Hanging Sign", defaultResultId: "oak_hanging_sign" },
  wooden_pressure_plate: { name: "Wooden Pressure Plate", defaultResultId: "oak_pressure_plate" },
  wooden_sign: { name: "Sign", defaultResultId: "oak_sign" },
  // Shape families collapsed via vanilla item tags (see
  // scripts/lib/shape-tag.ts) -- every material Mojang ships for the
  // shape lands in one card, wood included, so these default the same way
  // the wood-only families above do: oak, except walls (no vanilla wooden
  // wall exists -- cobblestone is the earliest-game, most iconic wall
  // material instead).
  buttons: { name: "Buttons", defaultResultId: "oak_button" },
  doors: { name: "Doors", defaultResultId: "oak_door" },
  fences: { name: "Fences", defaultResultId: "oak_fence" },
  slabs: { name: "Slabs", defaultResultId: "oak_slab" },
  stairs: { name: "Stairs", defaultResultId: "oak_stairs" },
  trapdoors: { name: "Trapdoors", defaultResultId: "oak_trapdoor" },
  walls: { name: "Walls", defaultResultId: "cobblestone_wall" },
  // Copper oxidation families -- default to the clean, un-oxidized base
  // tier (golem_statue has no base-tier recipe, so its earliest waxed
  // tier). Doesn't include cut_copper_slab/cut_copper_stairs/copper_door/
  // copper_trapdoor: those shapes now collapse under the "slabs"/"stairs"/
  // "doors"/"trapdoors" shapeTag keys above instead (see
  // src/utils/recipe-groups.ts's groupRecipes precedence), folding their
  // copper tiers in with every other material of the same shape rather
  // than keeping copper on its own separate card.
  chiseled_copper: { name: "Chiseled Copper", defaultResultId: "chiseled_copper" },
  copper_bars: { name: "Copper Bars", defaultResultId: "copper_bars" },
  copper_block: { name: "Block of Copper", defaultResultId: "copper_block" },
  copper_bulb: { name: "Copper Bulb", defaultResultId: "copper_bulb" },
  copper_chain: { name: "Copper Chain", defaultResultId: "copper_chain" },
  copper_chest: { name: "Copper Chest", defaultResultId: "copper_chest" },
  copper_golem_statue: {
    name: "Copper Golem Statue",
    defaultResultId: "waxed_copper_golem_statue",
  },
  copper_grate: { name: "Copper Grate", defaultResultId: "copper_grate" },
  copper_lantern: { name: "Copper Lantern", defaultResultId: "copper_lantern" },
  cut_copper: { name: "Cut Copper", defaultResultId: "cut_copper" },
  lightning_rod: { name: "Lightning Rod", defaultResultId: "lightning_rod" },
  // Synthetic entries (see scripts/lib/patterned-banner.ts) -- creeper is
  // the iconic pattern, the one most players picture first.
  patterned_banner: { name: "Patterned Banner", defaultResultId: "patterned_banner_creeper" },
};

/**
 * The longest sequence of consecutive words shared by every name, e.g.
 * ["Oak Slab", "Cut Copper Slab", "Petrified Oak Slab"] -> "Slab". Ties on
 * length prefer the latest-starting sequence -- in an English noun phrase
 * the head noun sits at the end ("Exposed Copper" -> "Copper", not
 * "Exposed"). Null when the names share no word at all (e.g. "Oak Wood" vs
 * "Crimson Hyphae").
 */
function containsWordSequence(words: string[], sequence: string[]): boolean {
  outer: for (let i = 0; i + sequence.length <= words.length; i++) {
    for (let j = 0; j < sequence.length; j++) {
      if (words[i + j] !== sequence[j]) continue outer;
    }
    return true;
  }
  return false;
}

function longestCommonWordSequence(names: string[]): string | null {
  const wordLists = names.map((name) => name.split(" "));
  const shortest = wordLists.reduce((a, b) => (b.length < a.length ? b : a));

  for (let length = shortest.length; length > 0; length--) {
    for (let start = shortest.length - length; start >= 0; start--) {
      const sequence = shortest.slice(start, start + length);
      if (wordLists.every((words) => containsWordSequence(words, sequence))) {
        return sequence.join(" ");
      }
    }
  }
  return null;
}

/**
 * Purely data-derived display name for a VariantGroup -- no VARIANT_GROUP_META
 * consulted, so an uncurated group a future version bump introduces still
 * gets a sane generic card name: the longest word sequence its member item
 * names share (which is exactly the part that ISN'T the per-variant
 * material/color token -- "White Wool"/"Red Wool"/... -> "Wool"). When the
 * members share no words at all (oak Wood vs crimson Hyphae), falls back to
 * the alphabetically-first member's own name, matching variantGroupDefault's
 * own uncurated fallback face.
 */
export function deriveVariantGroupName(
  variantGroup: VariantGroup,
  itemsMap: Map<string, ItemData>,
): string {
  const names = variantGroup.variants.map((variant) => groupDisplayName(variant, itemsMap));
  return longestCommonWordSequence(names) ?? names[0];
}

/** The VariantGroup's display name -- curated (see VARIANT_GROUP_META) where an override exists, else derived from the member item names (see deriveVariantGroupName). */
export function variantGroupDisplayName(
  variantGroup: VariantGroup,
  itemsMap: Map<string, ItemData>,
): string {
  const meta = VARIANT_GROUP_META[variantGroup.groupKey];
  return meta?.name ?? deriveVariantGroupName(variantGroup, itemsMap);
}

/** The VariantGroup's default/linked-to variant -- curated (see VARIANT_GROUP_META) where one exists and resolves to a real member, else variants[0] (alphabetically-first, matching RecipeGroup.canonicalId's own convention). */
export function variantGroupDefault(variantGroup: VariantGroup): RecipeGroup {
  const defaultResultId = VARIANT_GROUP_META[variantGroup.groupKey]?.defaultResultId;
  const curated = defaultResultId
    ? variantGroup.variants.find((variant) => variant.resultId === defaultResultId)
    : undefined;
  return curated ?? variantGroup.variants[0];
}

/**
 * Maps every craftable item's id to its group's canonical /recipe/{item}/
 * path -- only items that are some group's result are craftable, so an item
 * absent from this map has no recipe page. Bare, base-agnostic paths like
 * canonicalRecipePath/recipePath above; callers still apply withBase().
 * Powers the "link to its recipe" behavior on item-icon hover tooltips.
 */
export function buildRecipeHrefMap(
  groups: RecipeGroup[],
  itemsMap: Map<string, ItemData>,
): Map<string, string> {
  const map = new Map<string, string>();
  for (const group of groups) {
    map.set(group.resultId, canonicalRecipePath(groupItemSlug(group, itemsMap)));
  }
  return map;
}

/**
 * The /recipe/{item}/... URL segment for a group's result item. Reads the
 * item's precomputed slug (see scripts/lib/generate.ts); only falls back to
 * slugifying the group's own canonical recipe id for a resultless recipe
 * (so there's no item entry to read a slug from) -- see groupRecipes' doc
 * comment for why that stays a defensive case rather than a real one today.
 */
export function groupItemSlug(group: RecipeGroup, itemsMap: Map<string, ItemData>): string {
  return itemsMap.get(group.resultId)?.slug ?? slugify(group.canonicalId);
}

/**
 * The human-readable display name for a recipe group's result. Reads the
 * result item's name where one exists; otherwise falls back to a raw,
 * lowercase de-slugified canonicalId. Single source of truth for every
 * <title>, meta description, card label, and pager name derived from a
 * group, so this raw lowercase fallback never leaks into production HTML on
 * its own.
 */
export function groupDisplayName(group: RecipeGroup, itemsMap: Map<string, ItemData>): string {
  const resultItem = itemsMap.get(group.resultId);
  return resultItem?.name ?? group.canonicalId.replace(/_/g, " ");
}

/** The bare canonical URL path for an item's recipe group -- no slug segment. Callers still apply withBase(). */
export function canonicalRecipePath(itemSlug: string): string {
  return `${RECIPE_BASE_PATH}/${itemSlug}/`;
}

/**
 * The base-relative URL path for a specific recipe within a group. The
 * canonical recipe (whatever its own `slug` happens to be -- usually
 * "default", but not always, see recipeId === canonicalId below) is
 * reachable at the bare /recipe/{item}/ path with no slug segment; every
 * other sibling keeps /recipe/{item}/{slug}/. Callers still apply withBase().
 */
export function recipePath(
  itemSlug: string,
  canonicalId: string,
  recipeId: string,
  recipeSlug: string,
): string {
  return recipeId === canonicalId
    ? canonicalRecipePath(itemSlug)
    : `${RECIPE_BASE_PATH}/${itemSlug}/${recipeSlug}/`;
}

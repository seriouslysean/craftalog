/**
 * Vanilla `crafting_special_*` (and `crafting_dye`) recipe types that modify
 * an EXISTING item of the same kind rather than craft a genuinely new one --
 * e.g. duplicating a banner's pattern onto a second blank banner, or
 * re-dyeing a leather armor piece that's already craftable from raw
 * materials. Ground truth (vendor/mcmeta-summary/data/recipe/data.json, pin
 * 26.2): every id below has an ingredient field (`banner`, `target`, `map`,
 * `source`) whose value is the *same* item id as the recipe's own `result`
 * -- the deterministic signal that it modifies rather than creates. Recipe
 * types NOT in this set (`crafting_special_firework_rocket`,
 * `crafting_special_firework_star`, `crafting_decorated_pot`,
 * `crafting_imbue`) all produce a genuinely different item than any of
 * their own ingredients, so they stay in the primary tab row.
 *
 * Keyed on the vanilla type id (not per-recipe), so every color/material
 * instance of a type (16 banner colors, 6 leather-dye targets, ...)
 * classifies uniformly, and a future mcmeta version bump needs zero code
 * changes to keep classifying correctly.
 */
const SELF_REFERENTIAL_SPECIAL_TYPES: ReadonlySet<string> = new Set([
  // Duplicates a banner's pattern onto a second banner of the same color.
  "minecraft:crafting_special_bannerduplicate",
  // Copies a written book's contents onto another book and quill. Currently
  // has no visible effect (written_book has no other recipe to sit beside),
  // included for correctness should that ever change.
  "minecraft:crafting_special_bookcloning",
  // Adds a fade-to-color effect to an existing firework star.
  "minecraft:crafting_special_firework_star_fade",
  // Extends an existing filled map to the next zoom level.
  "minecraft:crafting_special_mapextending",
  // Repairs two damaged items of the same type. Excluded from generated
  // data entirely today -- it carries no `result` in vendored data, and
  // scripts/lib/generate.ts skips any resultless recipe -- included here so
  // this allowlist stays correct if a future data bump ever adds one.
  "minecraft:crafting_special_repairitem",
  // Applies a banner's pattern onto an existing shield.
  "minecraft:crafting_special_shielddecoration",
  // Re-dyes an existing leather armor piece or wolf armor with a new color.
  "minecraft:crafting_dye",
]);

/**
 * True when `vanillaType` names a self-referential special recipe (see
 * SELF_REFERENTIAL_SPECIAL_TYPES above). `undefined` -- every non-special
 * recipe, and any special recipe type this repo hasn't classified,
 * including ones a future version bump introduces -- fails open to `false`,
 * i.e. the current equal-tab behavior.
 */
export function isSelfReferentialSpecial(vanillaType: string | undefined): boolean {
  return vanillaType !== undefined && SELF_REFERENTIAL_SPECIAL_TYPES.has(vanillaType);
}

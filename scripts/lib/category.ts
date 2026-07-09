/**
 * The 9 top-level browse categories sitting above families (see
 * scripts/lib/family.ts's FAMILY_CATEGORY, which maps every family to one of
 * these). Curated, not derived from vendored data -- names, grouping, and
 * order deliberately mirror Minecraft's own 1.20+ creative-inventory tabs
 * (Building Blocks, Colored Blocks, Natural Blocks, Functional Blocks,
 * Redstone Blocks, Tools & Utilities, Combat, Food & Drinks, Ingredients),
 * the most modern player-tested taxonomy that exists, so they're instantly
 * familiar to any Minecraft player. See the taxonomy proposal for the full
 * research and rationale behind this specific set and ordering.
 */

export interface CategoryDefinition {
  id: string;
  name: string;
  /** Curated display order, 1-9 -- biggest/most-browsed first, matching creative-inventory tab order (not alphabetical). */
  order: number;
}

export const CATEGORIES: CategoryDefinition[] = [
  { id: "building_blocks", name: "Building Blocks", order: 1 },
  { id: "colored_blocks", name: "Colored Blocks", order: 2 },
  { id: "functional_blocks", name: "Functional Blocks", order: 3 },
  { id: "redstone", name: "Redstone", order: 4 },
  { id: "tools_utilities", name: "Tools & Utilities", order: 5 },
  { id: "combat", name: "Combat", order: 6 },
  { id: "transportation", name: "Transportation", order: 7 },
  { id: "food", name: "Food", order: 8 },
  { id: "materials", name: "Materials", order: 9 },
];

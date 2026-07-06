/**
 * Fixed HUD sprite icons (heart/armor/food) used to render the per-item stat
 * line on recipe pages. Unlike item/block textures, these aren't resolved
 * per-item — they're a small fixed set copied on every parse regardless of
 * which items reference them, from vendor/mcmeta-assets to public/textures/hud/
 * (mirroring this same relative path under both).
 */
export const HUD_ICON_VENDOR_BASE = "gui/sprites/hud";

export const HUD_ICON_RELATIVE_PATHS = [
  "heart/full.png",
  "heart/half.png",
  "armor_full.png",
  "armor_half.png",
  "food_full_hunger.png",
  "food_half_hunger.png",
] as const;

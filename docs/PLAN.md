# Craftalog Rework Plan

Goal: show every vanilla Minecraft crafting recipe with zero manual data upkeep.
Vanilla data is vendored via [misode/mcmeta](https://github.com/misode/mcmeta)
submodules, parsed into our own format by scripts in this repo, and kept fresh
by a scheduled workflow that bumps the pin and opens an auto-merge PR.

This document is the coordination contract for the work. If a session dies,
resume from here plus the task list in the PR description.

## Decisions (agreed with owner)

1. **Data source**: `misode/mcmeta` submodules, pinned to the latest **stable**
   release tag (snapshots/pre/rc excluded). Current pin: `26.2`. This is the
   sole source of truth for recipes, items, tags, and lang — nothing below
   changes that.
   - `vendor/mcmeta-summary` → tag `<version>-summary` (condensed JSON: all
     recipes, item tags, item definitions, models, lang, registries).
   - `vendor/mcmeta-assets` → tag `<version>-assets` (PNG textures).
   - `vendor/bedrock-samples` → [Mojang/bedrock-samples](https://github.com/Mojang/bedrock-samples),
     pinned to the latest stable tag (`v<major>.<minor>.<patch>.<build>`,
     `-preview` tags excluded). A second, narrowly-scoped vendor source used
     for exactly one thing: the 16 pre-baked bed icon PNGs
     (`resource_pack/textures/items/bed_<color>.png`), which Java has no
     equivalent for (beds are the only vanilla item rendered as two
     composited block models rather than a single flat/cube icon). Verified
     Bedrock does _not_ have bed's crafting recipe (checked both this repo
     and the actual Bedrock Dedicated Server package — absent from both, almost
     certainly hardcoded in the engine), so recipes/items stay Java-only.
2. **Scope**: all vanilla crafting recipes — `crafting_shaped`,
   `crafting_shapeless`, `crafting_transmute` rendered; `crafting_special_*` /
   `crafting_dye` / `crafting_decorated_pot` cataloged with a curated
   explanation (they are hardcoded in the game, not data-driven).
   Furnace/stonecutter/smithing types are out of scope for now.
3. **Toolchain**: Astro 5 + Content Layer collections, Vitest, oxlint, oxfmt.
   Prettier is kept only if oxfmt cannot format `.astro` files.
4. **Self-update**: scheduled workflow opens a PR and enables auto-merge; CI
   must pass before it lands. Validation failure opens an issue instead.

## Pipeline

```
vendor/mcmeta-summary (recipes, tags, item defs, models, lang, registries)
vendor/mcmeta-assets  (textures)
        │  npm run parse  (scripts/parse.ts)
        ▼
src/data/generated/items.json      ── committed, diffable
src/data/generated/recipes.json    ── committed, diffable
src/data/generated/meta.json       ── mc version, counts, parse stats
public/textures/{item,block}/*.png ── only textures actually referenced
        │  npm run validate  (scripts/validate.ts)
        ▼
Astro content collections (file loaders + zod schemas)
        ▼
Static pages: / (browse by family), /recipe/[id], 404
```

Generated data is **committed** so the site builds without submodules and the
self-update PR diff is reviewable. `npm run validate` re-derives everything and
fails CI if committed data drifts from the submodule pin.

## Generated data contract

`src/data/generated/recipes.json` — `Record<string, Recipe>` keyed by recipe id
(no `minecraft:` prefix):

```ts
type Ingredient = {
  items: string[]; // resolved item ids; >1 means "any of these works"
  tag?: string; // original tag name (e.g. "planks") for "Any Planks" labels
};

type Recipe = {
  id: string;
  type: "shaped" | "shapeless" | "transmute" | "special";
  category: string; // vanilla crafting book category, e.g. "building"
  family: string; // derived browse taxonomy, e.g. "Slabs" — see scripts/lib/family.ts
  slug: string; // URL-safe /recipe/{item}/{slug}/ segment, unique within its result-item group — see scripts/lib/recipe-slug.ts
  group?: string; // vanilla group, e.g. "planks", "wooden_door"
  result: { id: string; count: number };
  // shaped only — placement matters:
  pattern?: string[]; // e.g. ["X", "#"]; keys index into `key`
  key?: Record<string, Ingredient>;
  // shapeless + transmute — any placement:
  ingredients?: Ingredient[];
  // special only:
  note?: string; // curated human explanation
};
```

`src/data/generated/items.json` — `Record<string, Item>` keyed by item id:

```ts
type Item = {
  id: string;
  name: string; // from en_us lang (item.minecraft.* / block.minecraft.*)
  slug: string; // URL-safe /recipe/{slug}/... segment, derived from `id` (not `name` — several items share a display name, e.g. every smithing template)
  icon:
    | { type: "flat"; texture: string } // /textures/... path
    | { type: "block"; top: string; side: string } // pseudo-3D cube
    | { type: "slab"; top: string; side: string } // half-height pseudo-3D cube
    | { type: "stairs"; top: string; side: string } // stepped pseudo-3D cube
    // single-texture compound shapes (one material texture on every face
    // of a multi-element model) — see ItemIcon.astro for each shape's CSS
    | { type: "pressure_plate"; texture: string }
    | { type: "wall"; texture: string }
    | { type: "button"; texture: string }
    | { type: "fence"; texture: string }
    | { type: "fence_gate"; texture: string };
  stat?:
    | { type: "food"; nutrition: number }
    | { type: "armor"; points: number }
    | { type: "weapon"; damage: number }
    | { type: "tool"; durability: number };
};
```

Texture resolution: item definition → model → parent chain. Heuristics:
`item/generated`/`item/handheld` → flat `layer0`; `block/cube_all` → block with
top=side=`all`; `block/cube_column` → top=`end`, side=`side`;
`block/cube_bottom_top` → `top`/`side`; other block parents → best-effort
(`particle` or first texture) as flat. Unresolvable → flat placeholder texture
and a line in the validator report (never a broken build).

`block/template_lightning_rod` (shared by every oxidation variant) is a named
exception: its "texture" is a UV atlas for its two-element geometry (a 4x4x4
cap at the very top of the block's space + a thin 2x2xN pole beneath it)
rather than a paintable surface, so the best-effort fallback would show that
atlas unclipped — a sliver of content jammed in one corner instead of a
recognizable icon. `scripts/lib/lightning-rod-icon.ts` instead places that
atlas's two real UV crops onto a transparent canvas at the model's own
element offsets (block-space y flipped to image rows), reconstructing the
rod's actual silhouette — thin pole, wider cap — as a flat icon at parse time
(written under `public/textures/item/<name>.png`).

Beds (the only `minecraft:composite` items — a head + foot sub-model pair,
detected via `block/template_bed_head` appearing in the head model's parent
chain) are a second named exception, but not a texture-resolution one: no
Java texture reads well as a flat icon for a 2-block compound shape, and
Bedrock Edition ships an actual pre-baked isometric sprite for every color
(`vendor/bedrock-samples/resource_pack/textures/items/bed_<color>.png` —
verified as genuine shipped game art, not a wiki render). `resolveIconCandidate`
extracts just the color id from the head model's name (e.g.
`block/black_bed_head` → `black`); `scripts/parse.ts` copies the matching
Bedrock PNG straight to `public/textures/item/bed_<javaColorId>.png` (color
name remapped via `scripts/lib/bedrock-colors.ts` — Bedrock still calls
`light_gray` by its legacy name, `silver`) and the icon is a plain `flat`
type, no new rendering code needed.

Five more shapes — pressure plate, wall, button, fence, fence gate — also
fell through to the generic best-effort fallback (a flat crop of the block's
own `particle`/`texture` var, e.g. a fence showing as a flat plank square)
despite each having a distinct, shared, material-agnostic geometry template
(`block/pressure_plate_up`, `block/wall_inventory`, `block/button_inventory`,
`block/fence_inventory`, `block/template_fence_gate` respectively — same
"shared template + per-leaf texture override" pattern as slab/stairs).
Unlike bed, these are single-texture shapes (one material texture painted on
every face), so no new schema variant carries more than one texture ref; each
gets its own `IconData`/`ItemIcon.astro` rendering branch reconstructing the
real element geometry via CSS 3D transforms (the same per-face
`rotateX`/`rotateY`/`translate` toolkit proven out for `stairs`/bed). Stained
glass panes were investigated too and _not_ added to this list — Mojang's own
inventory icon for a pane genuinely is just a flat colored square, not the
pane cross-section, so the existing flat fallback is already correct there.

Items rendered via a bespoke Java renderer (`{ type: "minecraft:special", base,
model }` — chests, shulker boxes, shields, skulls, conduit, decorated pot,
banners, ...) have no plain model to walk. `base` is resolved through the same
heuristics above as a best-effort stand-in, **except** banners: dye-colored
banners all share one `base` (no per-color texture exists upstream), so
`scripts/lib/banner-icon.ts` instead crops the vanilla banner template
(`entity/banner/banner_base.png`) to its front-facing region and tints it with
the corresponding wool texture's average color, generating a per-color icon
at parse time (written under `public/textures/item/<color>_banner.png`).

**Patterned banners** (issue #41) are a related but distinct case: applying a
loom pattern has no recipe at all in the vanilla data (a patterned banner's
result is component/NBT-driven, not a fixed item id, unlike anything above).
`scripts/lib/patterned-banner.ts` derives the 42 loom-obtainable patterns
(union of the `no_item_required` and `pattern_item/*` tags in
`data/tag/banner_pattern/data.json`, against the `data/banner_pattern/`
registry — the registry's 43rd entry, `base`, is in neither tag and is
correctly excluded, since it isn't obtainable in a Java loom) and injects one
synthetic `special` recipe + item per pattern (`patterned_banner_<id>`,
`group: "patterned_banner"`) directly into `generate()`'s output, after the
real vanilla recipe loop. Each is rendered as a canonical black-pattern-on-
white-banner example (base/dye color are parameters of the mechanic, not part
of a pattern's identity — enumerating all 16×16 color combinations per
pattern would multiply the dataset for no benefit): `scripts/lib/
patterned-banner-icon.ts` tints the shared banner atlas white, tints the
pattern atlas (`entity/banner/<id>.png`, the same UV layout as
`banner_base.png`) black, and composites the two (reusing `tint()` from
`banner-icon.ts` and `compositeOver()` from `leather-armor-icon.ts`) before
`bannerCompoundIcon()` crops it exactly like any other banner.

`stat` is derived from `vendor/mcmeta-summary/item_components/data.json`
(scripts/lib/item-stats.ts) — at most one defining stat per item, by priority
food > armor > weapon > tool, classified via vanilla item tags
(`swords`/`axes`/`pickaxes`/`shovels`/`hoes`, `head_armor`/`chest_armor`/
`leg_armor`/`foot_armor`) rather than raw attribute presence, so e.g. an axe's
incidental attack-damage attribute doesn't make it show as a weapon. Most
items (building blocks, etc.) have no stat at all — deliberately, to avoid
turning the recipe page into a stat sheet. Rendered as HUD-style icon pips
(hearts/armor/food, from the fixed set in `public/textures/hud/`, sourced via
`scripts/lib/hud-icons.ts`) except `tool` durability, which is plain text
(no existing HUD asset fits it well).

## Shaped vs shapeless in the UI

- **Shaped**: pattern rendered in-place, centered in the 3×3 grid.
- **Shapeless**: ingredients filled into the grid in reading order; the grid
  itself signals "order doesn't matter" via a shuffle icon + dashed cell
  outlines, plus a one-line caption below the grid ("Place ingredients in any
  order") — not a badge above the grid, which is easy to skip past.
- **Transmute**: rendered like shapeless (input + material) with the same
  unordered signal, plus a note that the result keeps the input's data.
- Multi-option ingredients (tag or array): cycle through variants on a timer
  (like the Minecraft wiki), with the tag label shown (e.g. "Any Planks").
  Cycling is progressive enhancement; first variant renders statically.

## Workflows

- `ci.yml` (PRs + main): install → parse → validate (fails on drift) → lint →
  format check → type-check → test → build.
- `deploy.yml`: existing Pages deploy, unchanged behavior (build now includes
  generated data).
- `update-data.yml` (weekly cron + manual): resolve latest stable mcmeta tags →
  if newer than pin: bump submodules, `npm run parse`, `npm run validate`,
  commit, open PR, enable auto-merge. Validation failure → open an issue.

## Testing

Vitest units: tag resolution, texture/model resolution, pattern centering,
shaped/shapeless/transmute parsing, validator failure modes, grid-state logic.
Fixtures are small hand-copied samples from mcmeta so tests run without
submodules. CI also does a full build as a smoke test.

## Sequencing (one PR, atomic commits)

1. `docs: add rework plan` (this file)
2. `chore: vendor mcmeta summary+assets as submodules pinned to 26.2`
3. `chore: modernize toolchain (astro 5, vitest, oxlint, oxfmt)`
4. `feat: recipe parser + validator + generated data`
5. `feat: content collections + reworked UI (grid, shapeless, variants, static pages)`
6. `test: parser/validator/grid units + ci workflow`
7. `ci: weekly self-updating data workflow (auto-merge PR)`
8. `docs: agent harness (skills, settings, AGENTS.md rewrite)`

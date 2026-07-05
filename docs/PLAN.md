# Craftalog Rework Plan

Goal: show every vanilla Minecraft crafting recipe with zero manual data upkeep.
Vanilla data is vendored via [misode/mcmeta](https://github.com/misode/mcmeta)
submodules, parsed into our own format by scripts in this repo, and kept fresh
by a scheduled workflow that bumps the pin and opens an auto-merge PR.

This document is the coordination contract for the work. If a session dies,
resume from here plus the task list in the PR description.

## Decisions (agreed with owner)

1. **Data source**: `misode/mcmeta` submodules, pinned to the latest **stable**
   release tag (snapshots/pre/rc excluded). Current pin: `26.2`.
   - `vendor/mcmeta-summary` → tag `<version>-summary` (condensed JSON: all
     recipes, item tags, item definitions, models, lang, registries).
   - `vendor/mcmeta-assets` → tag `<version>-assets` (PNG textures).
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
Static pages: / (browse by category), /recipe/[id], /about
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
  icon:
    | { type: "flat"; texture: string } // /textures/... path
    | { type: "block"; top: string; side: string }; // pseudo-3D cube
};
```

Texture resolution: item definition → model → parent chain. Heuristics:
`item/generated`/`item/handheld` → flat `layer0`; `block/cube_all` → block with
top=side=`all`; `block/cube_column` → top=`end`, side=`side`;
`block/cube_bottom_top` → `top`/`side`; other block parents → best-effort
(`particle` or first texture) as flat. Unresolvable → flat placeholder texture
and a line in the validator report (never a broken build).

## Shaped vs shapeless in the UI

- **Shaped**: pattern rendered in-place, centered in the 3×3 grid.
- **Shapeless**: badge ("Shapeless — any arrangement") + ingredients filled
  into the grid in reading order, visually distinguished.
- **Transmute**: rendered like shapeless (input + material), note that the
  result keeps the input's data.
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

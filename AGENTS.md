# AGENTS

This file contains goals, guidelines, and common patterns for AI agents working on this project.

**For all AI agents**: This is your primary reference. Read this file completely before making changes.

## Quick Reference

- **Framework**: Astro 7 (Static Site Generator, Content Layer collections)
- **Language**: TypeScript (strict mode)
- **Styling**: BEM methodology + CSS custom properties
- **Linting/Formatting**: oxlint + oxfmt (prettier + prettier-plugin-astro for `.astro` files only)
- **Testing**: Vitest
- **Data**: vendored `misode/mcmeta` (+ `Mojang/bedrock-samples`) submodules → `scripts/parse.ts` → committed generated JSON — see [Data Pipeline](#data-pipeline)
- **Commands**: `npm run lint`, `npm run format` / `format:check`, `npm run type-check`, `npm test`, `npm run parse`, `npm run validate`, `npm run build`

---

## Table of Contents

1. [Project Goals](#project-goals)
2. [Code Standards](#code-standards)
3. [Data Pipeline](#data-pipeline)
4. [Common Pitfalls](#common-pitfalls-and-anti-patterns)
5. [Pre-Commit Checklist](#pre-commit-checklist-for-agents)
6. [Development Workflow](#development-workflow)
7. [Architecture Decisions](#architecture-decisions)
8. [Common Tasks](#common-tasks)

---

## Project Goals

### Primary Goals

1. **Performance First**: Maintain optimal performance with minimal JavaScript
   - Zero JavaScript by default (Astro's islands architecture)
   - Progressive enhancement only where needed
   - Bundle size matters - track and minimize it

2. **Type Safety**: Ensure complete TypeScript coverage with no type errors
   - No `any` types unless absolutely necessary
   - Define interfaces for all props and data structures
   - Use type inference where appropriate

3. **Clean Code**: Follow KISS, DRY, and SOLID principles
   - **DRY**: If you're writing the same code twice, extract it
   - **KISS**: Simple solutions over complex ones
   - **SOLID**: Single responsibility, proper abstractions

4. **Modern Standards**: Use latest ECMAScript features and best practices
   - ES6+ syntax (const, let, arrow functions, destructuring)
   - Template literals for string interpolation
   - Async/await over callbacks

5. **Accessibility**: Ensure the site is accessible to all users
   - Semantic HTML
   - Proper ARIA labels where needed
   - Keyboard navigation support
   - Color contrast compliance

6. **Mobile First**: Design and develop with mobile devices as the primary target
   - Start with mobile layout
   - Progressive enhancement for larger screens
   - Touch-friendly interactions

---

## Code Standards

### CSS Methodology: BEM (Block Element Modifier)

**Strictly follow BEM naming conventions:**

```css
/* Block */
.crafting {
}

/* Element */
.crafting__grid {
}
.crafting__cell {
}
.crafting__result {
}

/* Modifier */
.crafting--loading {
}
.crafting__cell--active {
}
```

**Rules:**

- Use double underscores `__` for elements
- Use double dashes `--` for modifiers
- Keep CSS organized by block/component
- Use CSS custom properties (variables) for theming
- Mobile-first responsive design with `min-width` media queries

**Example:**

```css
/* ✅ Good */
.recipes__list {
}
.recipes__item {
}
.recipes__link {
}
.recipes__link--active {
}

/* ❌ Bad */
.recipesList {
}
.recipe-item {
}
.recipes .link {
}
```

### TypeScript/JavaScript

**Modern JavaScript:**

```typescript
// ✅ Good
const items = getCraftingTableState(recipe);
const result = getResultItemDetails(recipe);
const isBlock = item?.icon?.length === 2;

// ❌ Bad
var items = getCraftingTableState(recipe);
let result;
result = getResultItemDetails(recipe);
if (item && item.icon && item.icon.length === 2) {
}
```

**Type Everything:**

```typescript
// ✅ Good
interface ItemDetails {
  id: string;
  name: string;
  icon: string[];
}

export function generateItemIconHTML(item: ItemDetails | null): string {
  // ...
}

// ❌ Bad
export function generateItemIconHTML(item: any) {
  // ...
}
```

### File Organization

```
/
├── vendor/
│   ├── mcmeta-summary/    # submodule: recipes, tags, item defs, models, lang (pinned tag)
│   ├── mcmeta-assets/     # submodule: textures (pinned tag)
│   └── bedrock-samples/   # submodule: bed icon PNGs + copper golem statue/shulker box entity geometry (pinned tag) — Java remains authoritative for every texture
├── scripts/
│   ├── parse.ts         # vendor/ → src/data/generated/* + public/textures/*
│   ├── validate.ts      # re-derives + checks committed generated data for drift
│   ├── generate-favicon.ts  # renders public/favicon.png/.ico (run by hand, not part of parse)
│   └── lib/             # pipeline modules shared by parse/validate (~30 files)
├── src/
│   ├── components/      # Reusable Astro components (.astro)
│   ├── data/
│   │   └── generated/   # committed, machine-generated — NEVER hand-edit (see Data Pipeline)
│   ├── layouts/         # Page layouts (.astro)
│   ├── pages/           # File-based routing (.astro)
│   └── utils/           # Utility functions (.ts)
├── tests/               # Vitest unit tests + fixtures
└── public/
    └── textures/        # generated PNGs, only textures actually referenced by a recipe
```

**Naming Conventions:**

- Components: PascalCase (e.g., `ItemIcon.astro`, `SiteHeader.astro`)
- Utilities: kebab-case (e.g., `crafting-grid.ts`, `recipe-pager.ts`)
- Data files: kebab-case (e.g., `generated-schema.ts`, `generated/items.json`)

---

## Data Pipeline

Vanilla Minecraft recipe/item data is never hand-authored. It flows:

```
vendor/mcmeta-summary + vendor/mcmeta-assets + vendor/bedrock-samples   (git submodules, pinned to a stable release tag)
        │  npm run parse
        ▼
src/data/generated/{recipes,items,categories,families,meta}.json + public/textures/**
        │  npm run validate
        ▼
Astro content collections consume the generated JSON
```

- **Submodules** are pinned to the latest **stable** release tag (snapshot/
  pre/rc/preview tags are excluded). `misode/mcmeta`'s pin is readable at
  `vendor/mcmeta-summary/version.txt`; `bedrock-samples` has no equivalent
  file (and its shallow submodule clone carries no tags), so its pin is
  resolved by matching the submodule's HEAD commit against the remote's
  tags (`git ls-remote --tags https://github.com/Mojang/bedrock-samples`).
- `bedrock-samples` is a narrowly-scoped second source used for exactly
  three things Java's data has no equivalent for: the 16 pre-baked bed icon
  PNGs (beds are the only item rendered as two composited block models),
  and the copper golem statue's and shulker box's entity geometry (Mojang
  hardcodes those meshes in Java renderer code, not data). `misode/mcmeta`
  remains the sole source of truth for recipes, items, tags, and lang — and
  for every texture.
- **Generated data is committed** so the site builds without submodules and
  data bumps are reviewable as a normal diff. `npm run validate` re-derives
  everything in memory and fails if committed data has drifted from the
  pin, plus internal-consistency guards (unresolved icons, URL-slug
  collisions, missing texture files, empty ingredients). CI separately runs
  `npm run parse` and fails if `git diff` shows drift in the committed
  output — both run on every PR.
- **Never hand-edit anything under `src/data/generated/` or
  `public/textures/`.** Edit `scripts/parse.ts` / `scripts/validate.ts`
  instead and regenerate.
- A weekly scheduled workflow (`update-data.yml`) checks for a newer stable
  tag, bumps the pin, regenerates, and opens a PR automatically. The PR
  waits for manual review and merge — there is no auto-merge.
- Full details, the generated-data type contract, and the update workflow's
  exact behavior: `docs/PLAN.md` and `.claude/skills/vanilla-data/SKILL.md`.

---

## Common Pitfalls and Anti-Patterns

### 🚫 DRY Violations (Don't Repeat Yourself)

**Problem**: Duplicating HTML generation logic across multiple locations.

```typescript
// ❌ Bad - Duplicated in 3 places
cells.forEach((cell, index) => {
  const item = items[index];
  if (item) {
    const isBlock = item.icon?.length === 2;
    const iconHtml = isBlock
      ? `<div class="item-icon item-icon--block">...</div>`
      : `<div class="item-icon">...</div>`;
    cell.innerHTML = iconHtml;
  }
});
```

**Solution**: Extract to a reusable function.

```typescript
// ✅ Good - Single source of truth
export function generateItemIconHTML(item: ItemDetails | null): string {
  if (!item) return "";
  const isBlock = item.icon?.length === 2;
  return isBlock
    ? `<div class="item-icon item-icon--block">...</div>`
    : `<div class="item-icon">...</div>`;
}

// Usage
cells.forEach((cell, index) => {
  cell.innerHTML = generateItemIconHTML(items[index]);
});
```

**When to extract:**

- Code appears in 2+ locations
- Same logic with minor variations
- HTML/string generation that's reused

### 🚫 Debug Code in Production

**Problem**: Leaving debug styles or console.logs in production code.

```css
/* ❌ Bad - Debug colors left in production */
.left {
  background: green; /* Debug color! */
  transform: rotateY(-90deg) translateX(50%) rotateY(90deg);
}

.right {
  background: red; /* Debug color! */
  transform: translateX(50%) rotateY(90deg);
}
```

**Solution**: Remove all debug code before committing.

```css
/* ✅ Good - Production ready */
.left {
  transform: rotateY(-90deg) translateX(50%) rotateY(90deg);
}

.right {
  transform: translateX(50%) rotateY(90deg);
}
```

**Common debug code to remove:**

- `console.log()`, `console.warn()`, `console.error()`
- Debug background colors (green, red, blue, etc.)
- Test data or mock values
- Commented-out code blocks
- Temporary "TODO" or "FIXME" that aren't tracked

### 🚫 Poor Comment Documentation

**Problem**: Comments that don't add value or are misleading.

```yaml
# ❌ Bad - Comment doesn't reflect best practice
- name: Install dependencies
  run: npm ci # Actually using npm ci for reproducible builds
```

**Solution**: Comments should reflect what's actually happening.

```yaml
# ✅ Good - Clear and accurate
- name: Install dependencies from lockfile
  run: npm ci
```

### 🚫 Ignoring Bundle Size

**Problem**: Not tracking JavaScript bundle size as you make changes.

**Solution**:

- Check bundle size after build: Look for `dist/_astro/*.js` sizes
- Goal: Keep total JS under 10 kB (gzipped)
- Recent improvement: Reduced from 5.43 kB to 4.80 kB by fixing DRY violation

**To check:**

```bash
npm run build
# Look for: dist/_astro/*.js  X.XX kB │ gzip: X.XX kB
```

### 🚫 Not Following BEM

**Problem**: Mixing naming conventions or nesting too deep.

```css
/* ❌ Bad */
.page .header .title {
}
.pageTitle {
}
.page-header__title {
}
```

**Solution**: Consistent BEM throughout.

```css
/* ✅ Good */
.page__header {
}
.page__title {
}
.page__subtitle {
}
```

---

## Pre-Commit Checklist for Agents

**Before committing ANY code, verify:**

### Code Quality

- [ ] **DRY Check**: Is any code duplicated? Extract to functions/utilities
- [ ] **Debug Code**: Remove all console.logs, debug colors, test data
- [ ] **Comments**: Ensure comments are accurate and add value
- [ ] **Bundle Size**: Check if JS bundle size increased (it shouldn't!)
- [ ] **Type Safety**: Run `npm run type-check` - must be 0 errors
- [ ] **Linting**: Run `npm run lint` - must be 0 errors/warnings
- [ ] **Formatting**: Run `npm run format` - auto-fix all formatting (oxfmt + prettier for `.astro`)
- [ ] **Data untouched by hand**: If `src/data/generated/**` changed, it must be the output of `npm run parse` — never edited directly

### Architecture

- [ ] **BEM**: All CSS classes follow BEM naming
- [ ] **Mobile First**: Styles work on mobile, then enhance for desktop
- [ ] **Accessibility**: Semantic HTML, proper ARIA labels, keyboard nav
- [ ] **Performance**: Minimal JavaScript, optimized assets

### Testing

- [ ] **Unit tests**: Run `npm test` - all Vitest suites pass
- [ ] **Data pipeline**: If `scripts/`, `vendor/`, or generated data changed, run `npm run parse` then `npm run validate` (or `npm run validate -- --offline`) and commit the regenerated output
- [ ] **Build**: Run `npm run build` - must complete successfully
- [ ] **Preview**: Run `npm run preview` - manually test key functionality
- [ ] **No Console Errors**: Check browser console - must be clean

### Git

- [ ] **Clear Message**: Commit message clearly describes what and why
- [ ] **Atomic Commits**: Each commit does one thing
- [ ] **No Secrets**: No API keys, tokens, or sensitive data committed

---

## Development Workflow

### 1. Before Starting

```bash
# Ensure dependencies are current
npm install

# First time only: fetch the vendored mcmeta submodules (not needed to build —
# only needed if you're touching the data pipeline)
npm run vendor:init

# Start dev server
npm run dev
```

**Check existing patterns:**

- Look at similar components for patterns
- Follow existing naming conventions
- Match the code style you see

### 2. During Development

```bash
# Development server with hot reload
npm run dev

# Type checking (run frequently) — covers src (astro check) + scripts + tests (tsc)
npm run type-check

# Linting (fix issues as you go)
npm run lint

# Unit tests in watch mode
npm run test:watch
```

**Keep these running:**

- Dev server for instant feedback
- Type-check on save (if your editor supports it)

### 3. Before Committing

```bash
# Format all code (oxfmt + prettier for .astro)
npm run format

# Type check (src + scripts + tests)
npm run type-check

# Lint
npm run lint

# Unit tests
npm test

# If vendor/, scripts/, or generated data changed: regenerate + validate
npm run parse
npm run validate

# Production build
npm run build

# Test production build
npm run preview
```

**All must pass with 0 errors before committing!** This is the same sequence
`.github/workflows/ci.yml` runs on every PR — see `.claude/skills/verify/SKILL.md`
for the full rundown of what "green" looks like and common failure modes.

---

## Architecture Decisions

### Why Astro?

- **Performance**: Ships zero JavaScript by default
- **Flexibility**: Can use components from any framework
- **DX**: Great developer experience with TypeScript support
- **SEO**: Static site generation for better SEO
- **Islands**: Progressive enhancement with client-side JS only where needed

### Why BEM?

- **Clarity**: Clear naming conventions prevent confusion
- **Scalability**: Easy to maintain and scale
- **No Conflicts**: Avoids CSS specificity issues
- **Readability**: Easy to understand component structure
- **Predictability**: Know exactly what a class does by its name

### Why TypeScript?

- **Type Safety**: Catch errors at compile time, not runtime
- **IntelliSense**: Better IDE support and autocomplete
- **Documentation**: Types serve as inline documentation
- **Refactoring**: Easier and safer refactoring
- **Team Collaboration**: Clear contracts between code

### Key Patterns in This Codebase

**1. Component Reusability**: Server-rendered Astro components backed by pure, tested utilities

```typescript
// src/utils/crafting-grid.ts — pure grid logic, unit-tested in tests/crafting-grid.test.ts
export function buildShapedGrid(pattern: string[], key: Record<string, Ingredient>): GridCell[] {
  // Centers the pattern in the 3x3 grid the way vanilla's recipe book does
}

export function buildShapelessGrid(ingredients: Ingredient[]): GridCell[] {
  // Fills ingredients in reading order; throws on more than 9
}
```

```astro
<!-- src/components/CraftingGrid.astro — renders the GridCell[] server-side -->
<div class="crafting__grid">
  {cells.map((cell, index) => <div class="crafting__cell" data-index={index}>{/* ... */}</div>)}
</div>
```

**2. Progressive Enhancement**: HTML first, enhance with JavaScript

```astro
<!-- src/components/ItemVariants.astro — first variant renders statically -->
<span class="item-variants" data-variant-cycle={items.length > 1 ? items.length : undefined}>
  {/* every variant server-rendered; all but the first `hidden` */}
</span>

<script>
  // Only runs after page load: cycles multi-option ingredient icons on a
  // timer. Without JS the first variant is still visible and correct.
</script>
```

**3. Type-Safe Data Layer**: zod schemas as the single source of truth

```typescript
// src/data/generated-schema.ts — the generated-data contract as zod schemas
export const itemSchema = z.object({
  id: z.string(),
  name: z.string(),
  slug: z.string(),
  icon: iconSchema,
  stat: itemStatSchema.optional(),
});

// src/content.config.ts validates the generated JSON against these at build
// time (Astro content collections); scripts/lib/types.ts derives the same
// shapes for the parser/validator via `import type` + `z.infer` — no
// hand-mirrored types anywhere.
```

---

## Common Tasks

### Adding a New Page

1. Create file in `src/pages/` (e.g., `new-page.astro`)
2. Use the `MainLayout` layout
3. Follow BEM for CSS classes
4. Ensure mobile responsiveness
5. Test with `npm run build` and `npm run preview`

**Example:**

```astro
---
import MainLayout from '../layouts/MainLayout.astro';
---

<MainLayout title="New Page - Craftalog">
  <div class="new-page">
    <h1 class="new-page__title">New Page</h1>
    <p class="new-page__description">Content here</p>
  </div>
</MainLayout>

<style>
  .new-page {
    /* Mobile first */
  }

  .new-page__title {
    font-size: 2rem;
  }

  @media (min-width: 640px) {
    .new-page__title {
      font-size: 3rem;
    }
  }
</style>
```

### Adding a New Component

1. Create file in `src/components/` (e.g., `NewComponent.astro`)
2. Use TypeScript for props interface
3. Follow BEM for CSS classes
4. Keep components simple and reusable
5. Export types if needed by other components

**Example:**

```astro
---
interface Props {
  title: string;
  description?: string;
}

const { title, description } = Astro.props;
---

<div class="card">
  <h2 class="card__title">{title}</h2>
  {description && <p class="card__description">{description}</p>}
</div>

<style>
  .card {
    border: 1px solid var(--color-border);
    border-radius: 0.5rem;
    padding: var(--space-4);
  }

  .card__title {
    font-size: 1.5rem;
    font-weight: 600;
  }

  .card__description {
    margin-top: var(--space-2);
    color: var(--color-muted);
  }
</style>
```

### Adding a Utility Function

1. Create file in `src/utils/` (e.g., `new-utility.ts`)
2. Export typed functions
3. Add JSDoc comments for complex functions
4. Write tests if it's critical logic

**Example** (real utility — `src/utils/with-base.ts`):

```typescript
/**
 * Joins a root-absolute path (e.g. a generated texture URL or an internal
 * link) with the site's base path, so links and asset URLs keep working when
 * the site is deployed under a non-root base (BASE_PATH env var, see
 * astro.config.mjs).
 *
 * `base` defaults to `import.meta.env.BASE_URL` in real usage; tests pass it
 * explicitly to keep this pure and Vite-free.
 */
export function withBase(path: string, base: string = import.meta.env.BASE_URL): string {
  const normalizedBase = base.endsWith("/") ? base.slice(0, -1) : base;
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${normalizedBase}${normalizedPath}` || "/";
}
```

### Updating Styles

1. Use CSS custom properties from `:root` (defined in `src/layouts/Layout.astro`)
2. Follow BEM naming strictly
3. Test mobile-first, then desktop
4. Ensure accessibility (contrast, focus states, etc.)

**Available CSS Variables** (see `src/layouts/Layout.astro` for the full
definitions and the design rationale in the comments there):

```css
/* Minecraft colors */
--color-gray: #8b8b8b;
--color-gray-light: #c6c6c6;
--color-gray-dark: #373737;

/* Colors */
--color-bg: var(--color-gray-light); /* the game's own GUI gray, not white */
--color-fg: #09090b;
--color-border: #e4e4e7;
--color-muted: #3f3f46;
--color-heading: #404040;
--color-panel: var(--color-gray-light);
--color-panel-fg: var(--color-gray-dark);
--color-slot: var(--color-gray);
--color-panel-shade: /* color-mix() tied to --color-panel */;

/* Bevels (the chunky pixel-border system) */
--bevel-width: 0.3125rem;
--bevel-slot: /* recessed slot look */;
--bevel-button: /* raised clickable look */;
--bevel-button-pressed: /* pressed = recessed */;
--bevel-panel: /* raised look for large panels */;
--panel-border-width: var(--bevel-width);
--panel-border-outer-width: 0.125rem;
--panel-border-outer: /* thin dark-gray outer ring */;

/* Shadows and dividers */
--shadow-sharp: 0.5rem 0.5rem 0 0 rgba(0, 0, 0, 0.5);
--divider-border: 0.0625rem solid var(--color-gray-dark);
--divider-shadow-top: /* pairs with border-top */;
--divider-shadow-bottom: /* pairs with border-bottom */;

/* Shape */
--radius-sm: 0.125rem;
--radius-md: 0.125rem;

/* Spacing */
--space-1: 0.25rem;
--space-2: 0.5rem;
--space-3: 0.75rem;
--space-4: 1rem;
--space-6: 1.5rem;
--space-8: 2rem;
--space-12: 3rem;

/* Typography */
--font-sans: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, ...;
--font-mono: ui-monospace, SFMono-Regular, ...;
--font-display: "Pixelify Sans", var(--font-mono); /* headings/wordmark only */
```

---

## Resources

- [Astro Documentation](https://docs.astro.build) - Official Astro docs
- [BEM Methodology](http://getbem.com/) - BEM naming conventions
- [TypeScript Handbook](https://www.typescriptlang.org/docs/) - TypeScript guide
- [MDN Web Docs](https://developer.mozilla.org/) - Web standards reference

---

## Version History

**v3.0** - 2026-07-05

- Toolchain: replaced ESLint/Prettier with oxlint/oxfmt (+ prettier-plugin-astro
  for `.astro` files only), added Vitest, added the vanilla-data pipeline
  (`npm run parse` / `npm run validate`)
- Added the "Data Pipeline" section: `misode/mcmeta` submodules → generated
  JSON → content collections, and the never-hand-edit rule for
  `src/data/generated/**`
- Updated file organization tree to include `scripts/`, `tests/`, `vendor/`
- Updated Pre-Commit Checklist and Development Workflow commands for the new
  toolchain
- Added `.github/workflows/ci.yml` and `.github/workflows/update-data.yml`,
  plus `.claude/` agent harness (settings, `verify` and `vanilla-data` skills)

**v2.0** - 2025-11-14

- Added comprehensive anti-patterns section
- Added pre-commit checklist for agents
- Enhanced with specific code examples
- Added bundle size tracking guidelines
- Documented key patterns in this codebase

**v1.0** - 2025-11-14

- Initial version with basic guidelines
- Code standards and architecture decisions

---

**For AI Agents**: If you find yourself violating any of these guidelines, stop and reconsider your approach. These patterns exist for good reasons - performance, maintainability, and code quality.

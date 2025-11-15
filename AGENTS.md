# AGENTS

This file contains goals, guidelines, and common patterns for AI agents working on this project.

**For all AI agents**: This is your primary reference. Read this file completely before making changes.

## Quick Reference

- **Framework**: Astro (Static Site Generator)
- **Language**: TypeScript (strict mode)
- **Styling**: BEM methodology + CSS custom properties
- **Linting**: ESLint + Prettier
- **Testing**: `npm run type-check`, `npm run lint`, `npm run build`

---

## Table of Contents

1. [Project Goals](#project-goals)
2. [Code Standards](#code-standards)
3. [Common Pitfalls](#common-pitfalls-and-anti-patterns)
4. [Pre-Commit Checklist](#pre-commit-checklist-for-agents)
5. [Development Workflow](#development-workflow)
6. [Architecture Decisions](#architecture-decisions)
7. [Common Tasks](#common-tasks)

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
src/
├── components/     # Reusable Astro components (.astro)
├── data/          # Data files and constants (.ts)
├── layouts/       # Page layouts (.astro)
├── pages/         # File-based routing (.astro)
└── utils/         # Utility functions (.ts)
```

**Naming Conventions:**

- Components: PascalCase (e.g., `ItemIcon.astro`, `SiteHeader.astro`)
- Utilities: kebab-case (e.g., `item-utils.ts`, `item-icon-html.ts`)
- Data files: kebab-case (e.g., `item-details.ts`, `item-recipes.ts`)

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
  if (!item) return '';
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
# Look for: dist/_astro/hoisted.*.js  X.XX kB │ gzip: X.XX kB
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
- [ ] **Formatting**: Run `npm run format` - auto-fix all formatting

### Architecture

- [ ] **BEM**: All CSS classes follow BEM naming
- [ ] **Mobile First**: Styles work on mobile, then enhance for desktop
- [ ] **Accessibility**: Semantic HTML, proper ARIA labels, keyboard nav
- [ ] **Performance**: Minimal JavaScript, optimized assets

### Testing

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

# Type checking (run frequently)
npm run type-check

# Linting (fix issues as you go)
npm run lint
```

**Keep these running:**

- Dev server for instant feedback
- Type-check on save (if your editor supports it)

### 3. Before Committing

```bash
# Format all code
npm run format

# Type check
npm run type-check

# Lint
npm run lint

# Production build
npm run build

# Test production build
npm run preview
```

**All must pass with 0 errors before committing!**

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

**1. Component Reusability**: Server-rendered Astro components with client-side utilities

```astro
<!-- ItemIcon.astro - Server rendered -->
<div class="item-icon">
  {/* ... */}
</div>
```

```typescript
// item-icon-html.ts - Client-side utility
export function generateItemIconHTML(item: ItemDetails | null): string {
  // Same HTML structure for client-side updates
}
```

**2. Progressive Enhancement**: HTML first, enhance with JavaScript

```astro
<!-- Server-rendered initial state -->
<div class="crafting" id="crafting-area">
  {initialItems.map((cell) => <div class="crafting__cell">{cell && <ItemIcon item={cell} />}</div>)}
</div>

<!-- Client-side enhancement for SPA-like navigation -->
<script>
  // Only runs after page load
  // Enhances with client-side routing
</script>
```

**3. Type-Safe Data Layer**:

```typescript
// Define types
export const items = {
  arrow: 'arrow',
  coal: 'coal',
  // ...
} as const;

export type ItemType = (typeof items)[keyof typeof items];

// Use in interfaces
export interface ItemDetails {
  id: string;
  name: string;
  icon: string[];
}
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

**Example:**

```typescript
import type { ItemDetails } from '@/data/item-details';

/**
 * Generates HTML string for an item icon
 * Used for client-side dynamic updates
 *
 * @param item - The item details or null
 * @returns HTML string ready to be set as innerHTML
 */
export function generateItemIconHTML(item: ItemDetails | null): string {
  if (!item) return '';

  const isBlock = item.icon?.length === 2;

  if (isBlock) {
    return `<div class="item-icon item-icon--block">
      <ul class="block" title="${item.name}">
        <li class="top" style="background-image: url(${item.icon[0]})"></li>
        <li class="left" style="background-image: url(${item.icon[1]})"></li>
        <li class="right" style="background-image: url(${item.icon[1]})"></li>
      </ul>
    </div>`;
  }

  return `<div class="item-icon">
    <img class="icon" src="${item.icon[0]}" alt="${item.name}" title="${item.name}" />
  </div>`;
}
```

### Updating Styles

1. Use CSS custom properties from `:root` (defined in `src/layouts/Layout.astro`)
2. Follow BEM naming strictly
3. Test mobile-first, then desktop
4. Ensure accessibility (contrast, focus states, etc.)

**Available CSS Variables:**

```css
/* Colors */
--color-bg: #fafafa;
--color-fg: #09090b;
--color-border: #e4e4e7;
--color-muted: #71717a;

/* Minecraft colors */
--color-gray: #8b8b8b;
--color-gray-light: #c6c6c6;
--color-gray-dark: #373737;

/* Spacing */
--space-1: 0.25rem;
--space-2: 0.5rem;
--space-3: 0.75rem;
--space-4: 1rem;
--space-6: 1.5rem;
--space-8: 2rem;
--space-12: 3rem;

/* Typography */
--font-sans: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, ...;
--font-mono: ui-monospace, SFMono-Regular, ...;
```

---

## Resources

- [Astro Documentation](https://docs.astro.build) - Official Astro docs
- [BEM Methodology](http://getbem.com/) - BEM naming conventions
- [TypeScript Handbook](https://www.typescriptlang.org/docs/) - TypeScript guide
- [MDN Web Docs](https://developer.mozilla.org/) - Web standards reference

---

## Version History

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

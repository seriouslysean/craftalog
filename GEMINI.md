# GEMINI.md

Instructions for Google Gemini AI when working on this project.

## Primary Reference

**Read @AGENTS.md completely before making any changes.**

The AGENTS.md file is your comprehensive guide containing:

- Project goals and architecture
- Complete code standards (BEM, TypeScript, etc.)
- Common pitfalls and anti-patterns with examples
- Pre-commit checklist
- Development workflow
- Key patterns in this codebase
- Common tasks with full examples

## Gemini-Specific Notes

### Your Strengths

- Multi-modal understanding (code + images + context)
- Fast iteration and suggestions
- Code generation from descriptions
- Pattern recognition

### Use Them Here

1. **Pattern matching**: Study the patterns in @AGENTS.md before generating code
2. **Code generation**: Follow the examples exactly as shown
3. **Quick fixes**: But always verify against @AGENTS.md standards

### Critical Rules

**DRY (Don't Repeat Yourself)**

- If generating code that appears elsewhere, extract it to a utility
- See @AGENTS.md "Common Pitfalls" section for examples
- Recent example: `generateItemIconHTML()` utility instead of 3x duplication

**No Debug Code**

- Remove ALL console.logs before committing
- Remove debug colors (green, red, blue backgrounds)
- Remove test/mock data
- See @AGENTS.md for complete list

**BEM CSS Naming**

```css
/* Correct */
.block {
}
.block__element {
}
.block--modifier {
}

/* Wrong */
.blockElement {
}
.block-element {
}
.block .element {
}
```

**TypeScript Strictness**

```typescript
// Correct
export function generateItemIconHTML(item: ItemDetails | null): string;

// Wrong
export function generateItemIconHTML(item: any);
```

### Pre-Commit Checklist

From @AGENTS.md - verify ALL before committing:

#### Code Quality ✓

- [ ] **DRY**: No duplicated code
- [ ] **Debug**: No console.logs or debug colors
- [ ] **Comments**: Accurate and valuable
- [ ] **Bundle**: Size hasn't increased
- [ ] **Types**: `npm run type-check` → 0 errors
- [ ] **Lint**: `npm run lint` → 0 errors
- [ ] **Format**: `npm run format` applied

#### Architecture ✓

- [ ] **BEM**: All CSS follows BEM naming
- [ ] **Mobile**: Mobile-first responsive design
- [ ] **A11y**: Semantic HTML + accessibility
- [ ] **Perf**: Minimal JavaScript

#### Testing ✓

- [ ] **Build**: `npm run build` succeeds
- [ ] **Preview**: `npm run preview` works
- [ ] **Console**: No browser errors

### Bundle Size Awareness

After any JavaScript changes:

```bash
npm run build
# Check: dist/_astro/hoisted.*.js  X.XX kB │ gzip: X.XX kB
# Goal: Under 10 kB total (gzipped)
```

Recent win: Reduced from 5.43 kB to 4.80 kB by fixing DRY violation.

### Code Generation Guidelines

When generating new code:

1. **Check @AGENTS.md first** for similar examples
2. **Follow existing patterns** exactly
3. **Use BEM naming** for all CSS classes
4. **Type everything** with TypeScript
5. **Mobile-first** for all styles
6. **Test immediately** with `npm run dev`

### Common Patterns (from @AGENTS.md)

**Component Structure:**

```astro
---
interface Props {
  title: string;
  description?: string;
}

const { title, description } = Astro.props;
---

<div class="component">
  <h2 class="component__title">{title}</h2>
  {description && <p class="component__description">{description}</p>}
</div>

<style>
  .component {
    /* Mobile first */
  }

  @media (min-width: 640px) {
    .component {
      /* Desktop enhancement */
    }
  }
</style>
```

**Utility Function:**

```typescript
import type { ItemDetails } from '@/data/item-details';

/**
 * Clear JSDoc comment explaining function
 */
export function utilityName(param: Type): ReturnType {
  // Implementation
}
```

### When to Extract to Utilities

From @AGENTS.md:

- Code appears 2+ times
- Same logic with minor variations
- HTML/string generation that's reused

Example: HTML generation for ItemIcon was in 3 places → extracted to `generateItemIconHTML()`

### Testing Commands

```bash
# Development with hot reload
npm run dev

# Full check before commit
npm run format && npm run type-check && npm run lint && npm run build

# Preview production
npm run preview
```

### If Uncertain

1. Search @AGENTS.md for similar examples
2. Check existing code in the project
3. Follow the patterns you find
4. When truly stuck, ask the user

## Quick Reference

- **Framework**: Astro (SSG)
- **Language**: TypeScript (strict)
- **CSS**: BEM methodology
- **Goal**: Performance (minimal JS)
- **Testing**: Must pass type-check, lint, build

---

**Key Point**: @AGENTS.md is comprehensive. Use it as your primary reference for all decisions.

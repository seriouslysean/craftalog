# .github/copilot-instructions.md

GitHub Copilot instructions for this project.

## Essential Reading

**Read [@AGENTS.md](./AGENTS.md) before making suggestions** - It contains:
- Complete code standards
- Common pitfalls to avoid (DRY violations, debug code, etc.)
- Pre-commit checklist
- Architecture patterns for this codebase

## Key Patterns

### DRY Principle
- If code appears 2+ times, suggest extracting to a utility function
- Watch for: HTML generation, complex logic, string formatting
- Example: `generateItemIconHTML()` utility for reusable HTML

### BEM CSS Naming
```css
/* Always suggest BEM format */
.block { }
.block__element { }
.block--modifier { }
```

### Debug Code
- Flag any `console.log()` statements
- Flag hardcoded test colors (green, red, blue backgrounds)
- Flag "TODO" or "FIXME" comments without issue tracking

### Bundle Size
- Check if suggestions increase JavaScript bundle size
- Goal: Keep total gzipped JS under 10 kB
- Prefer CSS solutions over JavaScript when possible

### TypeScript
- Always provide full type annotations
- No `any` types unless absolutely necessary
- Use proper interfaces for all props and data

## Review Focus Areas

When reviewing PRs, check:
1. DRY violations (duplicated code)
2. Debug code left in production
3. BEM naming convention compliance
4. Bundle size impact
5. TypeScript type coverage
6. Missing accessibility features

## Quick Reference

- Build: `npm run build`
- Type check: `npm run type-check`
- Lint: `npm run lint`
- Format: `npm run format`

All must pass with 0 errors before merge.

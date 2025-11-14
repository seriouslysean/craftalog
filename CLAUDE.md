# CLAUDE.md

Instructions for Claude AI when working on this project.

## Primary Reference

**Read @AGENTS.md completely before making any changes.**

The AGENTS.md file contains everything you need:

- Project goals and architecture
- Complete code standards (BEM, TypeScript, etc.)
- Common pitfalls and anti-patterns with examples
- Pre-commit checklist
- Development workflow
- Key patterns in this codebase
- Common tasks with full examples

## Claude-Specific Notes

### Your Strengths

- Deep code understanding and refactoring
- Architectural analysis and improvements
- Comprehensive documentation
- Multi-file coordination

### Use Them Here

1. **Before coding**: Analyze existing patterns in @AGENTS.md
2. **While coding**: Follow the pre-commit checklist as you go
3. **Before committing**: Run through the full checklist in @AGENTS.md

### Key Reminders

**DRY Principle**: If you're about to write the same code twice, stop. Extract it to a utility function. See examples in @AGENTS.md.

**Debug Code**: Before committing, search for:

- `console.log`
- Debug colors (green, red, blue backgrounds)
- Test data or mock values
- Commented-out code

**Bundle Size**: After making changes, check:

```bash
npm run build
# Look for: dist/_astro/hoisted.*.js size
# Goal: Keep under 10 kB (gzipped)
```

**BEM Naming**: Every CSS class must follow BEM:

- `.block`
- `.block__element`
- `.block--modifier`

No exceptions. See @AGENTS.md for examples.

### Your Checklist

Before committing, verify ALL of these from @AGENTS.md:

#### Code Quality

- [ ] No duplicated code (DRY)
- [ ] No debug code remaining
- [ ] Comments are accurate and valuable
- [ ] Bundle size hasn't increased
- [ ] `npm run type-check` passes (0 errors)
- [ ] `npm run lint` passes (0 errors)
- [ ] `npm run format` applied

#### Architecture

- [ ] BEM naming for all CSS
- [ ] Mobile-first responsive design
- [ ] Semantic HTML + accessibility
- [ ] Minimal JavaScript

#### Testing

- [ ] `npm run build` succeeds
- [ ] `npm run preview` works correctly
- [ ] No browser console errors

### Common Mistakes to Avoid

See the "Common Pitfalls and Anti-Patterns" section in @AGENTS.md for detailed examples of:

- DRY violations (duplicated HTML generation)
- Debug code in production (background colors, console.logs)
- Poor comment documentation
- Ignoring bundle size
- Not following BEM consistently

### When Uncertain

1. Check existing similar code in the project
2. Refer to the specific section in @AGENTS.md
3. Follow the examples provided there
4. Ask the user if truly unclear

## Quick Commands

```bash
# Development
npm run dev

# Before committing
npm run format
npm run type-check
npm run lint
npm run build
npm run preview
```

All must pass with 0 errors.

---

**Remember**: @AGENTS.md is your source of truth. When in doubt, check there first.

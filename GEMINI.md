# GEMINI.md

Instructions for Google Gemini AI when working on this project.

## Primary Reference

**Read @AGENTS.md completely before making any changes.**

That file contains everything you need - don't skip it.

## Your Role

Use your strengths (pattern recognition, code generation, fast iteration) to follow the standards in @AGENTS.md.

### Before Committing

Run through the **"Pre-Commit Checklist for Agents"** in @AGENTS.md.

Every. Single. Time.

## Common Issues to Catch

From the "Common Pitfalls and Anti-Patterns" section in @AGENTS.md:

1. **DRY violations** - Code duplicated 2+ times? Extract it.
2. **Debug code** - console.logs, debug colors (green/red/blue), test data
3. **Bundle size** - Check after build: `dist/_astro/*.js` should stay under 10kB
4. **BEM naming** - Every CSS class must follow `.block__element--modifier`

## Quick Commands

```bash
npm run format && npm run type-check && npm run lint && npm run build
```

All must pass with 0 errors.

---

**Remember**: @AGENTS.md is your source of truth. When in doubt, check there first.

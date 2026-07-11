---
name: verify
description: Project verify skill for Craftalog. Use before considering any change done — runs the exact format/lint/type-check/test/parse/validate/build sequence this repo's CI enforces, and explains what "green" looks like and the common failure modes (oxfmt vs prettier scope, drift check meaning).
---

# Craftalog verify

Run this sequence after making changes, before telling the user something is
done. It mirrors `.github/workflows/ci.yml` so a green local run means CI will
pass too (submodule drift aside — see below).

## Sequence

```bash
npm run format          # oxfmt for .ts/.astro-adjacent files + prettier for .astro files
npm run type-check      # astro check (src) + tsc --noEmit -p tsconfig.node.json (scripts + tests)
npm run lint            # oxlint .
npm test                # vitest run
npm run build           # astro build — full production build
```

If you touched anything under `vendor/`, `src/data/generated/`, or
`public/textures/` (i.e. the vanilla data pipeline), also run:

```bash
npm run parse            # regenerate src/data/generated/* and public/textures/* from vendor/
npm run validate -- --offline   # re-derive and check without needing a fresh submodule fetch
```

Do this even if you didn't intend to touch generated data — if scripts/parse
or scripts/validate changed, or the submodule pins changed, regenerate and
commit the result so CI's drift check (below) doesn't fail.

## What "green" looks like

- `npm run format` exits 0 and reports no files needed changes (or only the
  files you expected to change).
- `npm run type-check` prints `0 errors`.
- `npm run lint` prints no errors or warnings.
- `npm test` — all suites pass, no `.only`/`.skip` left in test files.
- `npm run build` completes and prints the `dist/_astro/*.js` bundle sizes —
  confirm total JS is still small (see AGENTS.md bundle-size guidance).
- If you ran parse/validate: `npm run validate` prints no unresolved
  items/errors, and `git status` shows either no changes under
  `src/data/generated`/`public/textures`, or changes you intentionally
  committed.

## Common failure modes

- **oxfmt vs prettier scope confusion**: `npm run format` runs oxfmt over the
  whole repo, then prettier _only_ over `**/*.astro` (oxfmt cannot format
  `.astro` files yet). If `.astro` files look unformatted after `npm run
format`, check that prettier-plugin-astro is picking them up — don't try to
  make oxfmt handle them.
- **`format:check` fails but `format` reports nothing to do**: the two
  commands must use the same globs (oxfmt over `.` + prettier over
  `**/*.astro`) — if you edit the scripts, keep them in sync.
- **Drift check meaning** (CI step `git diff --exit-code -- src/data/generated
public/textures`): this fails when the committed generated data/textures no
  longer match what `npm run parse` produces from the currently pinned
  submodules. It means someone edited `src/data/generated/**` by hand, changed
  `scripts/parse.ts` without regenerating, or bumped a submodule pin without
  running `npm run parse` and committing the result. Fix: run `npm run
parse`, review the diff, commit it.
- **`npm run validate` fails but `npm run parse` succeeded**: validate
  re-derives data independently and checks invariants (unresolved icons,
  URL-slug collisions, missing texture files, empty ingredients, drift from
  the pinned submodules). A failure here is a real data problem, not a
  stale-cache issue — read the validator's report before re-running.
- **Never hand-edit anything under `src/data/generated/`**: it is fully
  generated from `vendor/mcmeta-*` by `npm run parse`. Manual edits will be
  silently overwritten and will fail the CI drift check the next time parse
  runs.
- **`--offline` on validate**: skips checks that require comparing against a
  freshly fetched submodule (useful when you don't want to touch
  `vendor/mcmeta-*` locally, e.g. quick iteration on the parser). Full
  validation (as CI runs it) does not pass `--offline`.

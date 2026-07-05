# Staged workflows

These workflow files belong in `.github/workflows/` but every credential
available to the automation that authored this PR lacks the GitHub
`workflow` scope, so they could not be pushed to that path.

**Do this on the PR branch before merging**, from a normally-credentialed
checkout.

Simplest path — the branch already contains the complete activation as a
reverted commit; reverting the revert re-applies it (moves both files,
deletes this README, bumps deploy.yml to Node 24):

```bash
git revert --no-edit 5d97ddc   # Revert "Revert 'ci: activate workflows...'"
git push
```

Manual equivalent:

```bash
git mv docs/workflows/ci.yml docs/workflows/update-data.yml .github/workflows/
git rm docs/workflows/README.md
# This project targets Node 24 (Astro 7 needs >= 22.12); the deploy
# workflow still pins Node 20 and its build will fail until bumped.
sed -i 's/node-version: 20/node-version: 24/' .github/workflows/deploy.yml
git commit -am "ci: activate staged workflows, bump deploy to Node 24"
```

- `ci.yml` — PR/main verification: parse, drift check against the mcmeta
  pin, validate, lint, format check, type check, test, build.
- `update-data.yml` — weekly self-update: bump mcmeta submodule pins to the
  latest stable release, regenerate data, open an auto-merge PR (or an
  issue if validation fails).

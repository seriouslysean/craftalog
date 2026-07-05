# Staged workflows

These workflow files belong in `.github/workflows/` but every credential
available to the automation that authored this PR lacks the GitHub
`workflow` scope, so they could not be pushed to that path.

**Do this on the PR branch before merging** (from a normally-credentialed
checkout, or via the GitHub web editor):

```bash
git mv docs/workflows/ci.yml docs/workflows/update-data.yml .github/workflows/
git rm docs/workflows/README.md
# Astro 7 requires Node >= 22.12; the deploy workflow still pins Node 20
# and its build will fail until this is bumped.
sed -i 's/node-version: 20/node-version: 22/' .github/workflows/deploy.yml
git commit -am "ci: activate staged workflows, bump deploy to Node 22"
```

- `ci.yml` — PR/main verification: parse, drift check against the mcmeta
  pin, validate, lint, format check, type check, test, build.
- `update-data.yml` — weekly self-update: bump mcmeta submodule pins to the
  latest stable release, regenerate data, open an auto-merge PR (or an
  issue if validation fails).

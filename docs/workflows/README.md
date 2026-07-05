# Staged workflows

These workflow files belong in `.github/workflows/` but every credential
available to the automation that authored this PR lacks the GitHub
`workflow` scope, so they could not be pushed to that path.

After merging (or on this branch, from a normally-credentialed checkout):

```bash
git mv docs/workflows/ci.yml docs/workflows/update-data.yml .github/workflows/
git rm docs/workflows/README.md
git commit -m "ci: activate staged workflows"
```

- `ci.yml` — PR/main verification: parse, drift check against the mcmeta
  pin, validate, lint, format check, type check, test, build.
- `update-data.yml` — weekly self-update: bump mcmeta submodule pins to the
  latest stable release, regenerate data, open an auto-merge PR (or an
  issue if validation fails).

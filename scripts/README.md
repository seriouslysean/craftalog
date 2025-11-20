# Scripts

## parse-minecraft-recipes.js

Parses recipes from the Mojang bedrock-samples repository and generates TypeScript data files for the app.

### What it does

1. Updates the bedrock-samples git submodule to ensure we have the latest data
2. Parses all crafting table recipes from `bedrock-samples/behavior_pack/recipes/`
3. Copies item textures from `bedrock-samples/resource_pack/textures/` to `public/textures/`
4. Generates TypeScript files in `src/data/generated/`:
   - `items.ts` - Item IDs and groups
   - `item-details.ts` - Item metadata (names, icons)
   - `item-recipes.ts` - Recipe data (patterns, ingredients)

### Usage

```bash
# Run the parser manually
npm run tool:update

# The parser also runs automatically during build
npm run build

# For development with fresh data
npm run dev:prepare
```

### Output

Generated files are excluded from git (see `.gitignore`) and created at build time from the submodule data.

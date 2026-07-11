# Craftalog

A modern Minecraft recipe catalog built with Astro and TypeScript.

> **For Contributors & AI Agents**: Please read [@AGENTS.md](./AGENTS.md) before making changes. It contains comprehensive guidelines, common pitfalls, and code standards.

## Features

- 🚀 Built with [Astro](https://astro.build) for optimal performance
- 📦 TypeScript for type safety
- 🎨 Modern CSS with CSS custom properties
- 📱 Responsive design
- ⚡ Zero JavaScript by default, enhanced with progressive JavaScript where needed

## Project Setup

```sh
npm install
```

Vanilla Minecraft recipe/item data is generated from vendored
[misode/mcmeta](https://github.com/misode/mcmeta) submodules and is committed
to the repo, so `npm install` + `npm run build` work without fetching them.
Only run the following if you need to regenerate that data:

```sh
npm run vendor:init   # fetch the pinned submodules
npm run parse         # regenerate src/data/generated/* and public/textures/*
npm run validate      # check the regenerated data for consistency
```

See [AGENTS.md](./AGENTS.md#data-pipeline) for details.

### Development

Run the development server with hot reload:

```sh
npm run dev
```

### Production Build

Build for production:

```sh
npm run build
```

To deploy the production build under a subdirectory (such as GitHub Pages),
set the `BASE_PATH` environment variable before building. For example:

```sh
BASE_PATH=/craftalog/ npm run build
```

When using the provided GitHub Pages workflow, set a repository variable named
`BASE_PATH` so the build automatically uses the correct subdirectory.

### Preview Production Build

Preview the production build locally:

```sh
npm run preview
```

### Testing, Linting, and Formatting

```sh
npm test              # Vitest unit tests
npm run lint           # oxlint
npm run format          # oxfmt + prettier (for .astro files)
npm run format:check    # check formatting without writing
npm run type-check      # astro check (src) + tsc (scripts, tests)
```

## GitHub Pages Deployment

This project is configured to deploy to GitHub Pages automatically via GitHub Actions.
The deploy workflow runs after the CI workflow completes successfully on the `main` branch.

### Configuration

1. Enable GitHub Pages in your repository settings
2. Set the source to "GitHub Actions"
3. (Optional) Set a repository variable named `BASE_PATH` if deploying to a subdirectory

## Project Structure

```
/
├── vendor/             # Vendored mcmeta + bedrock-samples submodules (recipes, textures)
├── scripts/            # The data pipeline — parse.ts / validate.ts / lib/
├── public/             # Static assets (favicon, generated textures, etc.)
├── src/
│   ├── components/     # Astro components
│   ├── data/
│   │   └── generated/  # Committed, machine-generated item/recipe JSON
│   ├── layouts/        # Page layouts
│   ├── pages/          # File-based routing
│   └── utils/          # Utility functions
├── tests/              # Vitest unit tests
├── astro.config.mjs    # Astro configuration
└── tsconfig.json       # TypeScript configuration
```

## Tech Stack

- **Framework**: [Astro](https://astro.build)
- **Language**: TypeScript
- **Styling**: CSS with modern features
- **Linting/Formatting**: oxlint, oxfmt, prettier (for `.astro` files)
- **Testing**: Vitest
- **Deployment**: GitHub Pages
- **CI/CD**: GitHub Actions (`ci.yml` on every PR, `update-data.yml` weekly)

## License

MIT

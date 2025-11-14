# Craftalog

A modern Minecraft recipe catalog built with Astro and TypeScript.

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

### Development

Run the development server with hot reload:

```sh
npm run dev
```

### Production Build

Type-check and build for production:

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

## GitHub Pages Deployment

This project is configured to deploy to GitHub Pages automatically via GitHub Actions.
The workflow runs on pushes to the `main` branch.

### Configuration

1. Enable GitHub Pages in your repository settings
2. Set the source to "GitHub Actions"
3. (Optional) Set a repository variable named `BASE_PATH` if deploying to a subdirectory

## Project Structure

```
/
├── public/             # Static assets (favicon, textures, etc.)
├── src/
│   ├── components/     # Astro components
│   ├── data/          # Data files (items, recipes, etc.)
│   ├── layouts/       # Page layouts
│   ├── pages/         # File-based routing
│   └── utils/         # Utility functions
├── astro.config.mjs   # Astro configuration
└── tsconfig.json      # TypeScript configuration
```

## Tech Stack

- **Framework**: [Astro](https://astro.build)
- **Language**: TypeScript
- **Styling**: CSS with modern features
- **Deployment**: GitHub Pages
- **CI/CD**: GitHub Actions

## License

MIT

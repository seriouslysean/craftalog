# Contributing to Craftalog

Thank you for your interest in contributing to Craftalog! This document provides guidelines and instructions for contributing.

> **Important**: Please read [@AGENTS.md](./AGENTS.md) first for comprehensive code standards, common pitfalls, and project patterns.

## Development Setup

### Prerequisites

- Node.js 24 or higher (see `.nvmrc`)
- npm (comes with Node.js)

### Getting Started

1. Clone the repository

```bash
git clone https://github.com/seriouslysean/craftalog.git
cd craftalog
```

2. Install dependencies

```bash
npm install
```

3. Start the development server

```bash
npm run dev
```

4. Open your browser to `http://localhost:4321`

## Development Workflow

### Making Changes

1. Create a new branch for your feature or fix

```bash
git checkout -b feature/your-feature-name
```

2. Make your changes following our code standards (see AGENTS.md)

3. Test your changes thoroughly

```bash
npm run type-check  # astro check + tsc (src, scripts, tests)
npm run lint        # oxlint
npm test            # Vitest unit tests
npm run build       # Production build
npm run preview     # Preview production build
```

If you changed `vendor/`, `scripts/`, or `src/data/generated/**`, also
regenerate and check the data pipeline output:

```bash
npm run parse       # regenerate src/data/generated/* and public/textures/*
npm run validate    # re-derive and check the committed output
```

4. Format your code

```bash
npm run format
```

5. Commit your changes with a clear message

```bash
git add .
git commit -m "feat: add new feature"
```

## Code Standards

See [@AGENTS.md](./AGENTS.md) for complete code standards. Key points:

### TypeScript

- Use strict typing - no `any` types
- Define interfaces for all props and data structures
- Use type inference where appropriate

### CSS

- Follow BEM methodology strictly
- Use CSS custom properties for theming
- Mobile-first responsive design
- Test on various screen sizes

### Code Style

- Use oxlint and oxfmt (prettier formats `.astro` files only)
- Follow KISS, DRY, and SOLID principles
- Keep functions small and focused
- Write self-documenting code with clear names

## Testing

Before submitting a pull request:

1. Ensure all checks pass:
   - [ ] `npm run format:check` - No formatting issues
   - [ ] `npm run type-check` - No TypeScript errors
   - [ ] `npm run lint` - No linting errors
   - [ ] `npm test` - All Vitest suites pass
   - [ ] `npm run build` - Build completes successfully

2. Test manually:
   - [ ] Test on mobile viewport
   - [ ] Test on desktop viewport
   - [ ] Test in multiple browsers (Chrome, Firefox, Safari)
   - [ ] Verify no console errors

## Pull Request Process

1. Update the README.md if you've added new features
2. Ensure all tests and checks pass
3. Update documentation if needed
4. Create a pull request with:
   - Clear title describing the change
   - Detailed description of what and why
   - Screenshots for UI changes
   - Reference to any related issues

## Project Structure

```
craftalog/
├── vendor/             # Vendored mcmeta + bedrock-samples submodules
├── scripts/            # Data pipeline (parse.ts, validate.ts, lib/)
├── public/             # Static assets (favicon, generated textures, etc.)
├── src/
│   ├── components/     # Astro components
│   ├── data/
│   │   └── generated/  # Committed, machine-generated JSON — never hand-edit
│   ├── layouts/        # Page layouts
│   ├── pages/          # File-based routing
│   └── utils/          # Utility functions
├── tests/              # Vitest unit tests
├── .github/            # GitHub workflows
└── ...config files
```

## Need Help?

- Check the [AGENTS.md](./AGENTS.md) file for project goals and standards
- Review existing code for patterns and examples
- Open an issue for discussion before making large changes

## License

By contributing, you agree that your contributions will be licensed under the MIT License.

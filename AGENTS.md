# AGENTS

This file contains goals and guidelines for AI agents working on this project.

## Project Goals

### Primary Goals

1. **Performance First**: Maintain optimal performance with minimal JavaScript
2. **Type Safety**: Ensure complete TypeScript coverage with no type errors
3. **Clean Code**: Follow KISS, DRY, and SOLID principles
4. **Modern Standards**: Use latest ECMAScript features and best practices
5. **Accessibility**: Ensure the site is accessible to all users
6. **Mobile First**: Design and develop with mobile devices as the primary target

### Code Standards

#### CSS Methodology
- **BEM (Block Element Modifier)**: Strictly follow BEM naming conventions
  - Block: `.block`
  - Element: `.block__element`
  - Modifier: `.block--modifier` or `.block__element--modifier`
- Keep CSS organized by component/block
- Use CSS custom properties (variables) for theming
- Mobile-first responsive design

#### TypeScript/JavaScript
- Use ES6+ syntax and modern features
- Prefer `const` over `let`, avoid `var`
- Use arrow functions and destructuring
- Type everything - no `any` types unless absolutely necessary
- Use template literals for string interpolation

#### File Organization
```
src/
├── components/     # Reusable Astro components
├── data/          # Data files and constants
├── layouts/       # Page layouts
├── pages/         # File-based routing
└── utils/         # Utility functions
```

#### Git Workflow
- Write clear, descriptive commit messages
- Use conventional commits format when appropriate
- Keep commits atomic and focused
- Test before committing

### Development Workflow

1. **Before Starting**
   - Run `npm install` to ensure dependencies are up to date
   - Check existing code patterns and follow them

2. **During Development**
   - Run `npm run dev` for development server
   - Use `npm run type-check` frequently
   - Keep the build passing at all times

3. **Before Committing**
   - Run `npm run lint` and fix all errors
   - Run `npm run format` to format code
   - Run `npm run type-check` to ensure no type errors
   - Run `npm run build` to verify production build works
   - Test the production build with `npm run preview`

### Quality Checklist

- [ ] No TypeScript errors
- [ ] No ESLint errors or warnings
- [ ] Code is formatted with Prettier
- [ ] BEM naming convention followed
- [ ] Mobile responsive design verified
- [ ] No console errors in browser
- [ ] Build completes successfully
- [ ] All functionality works as expected

## Architecture Decisions

### Why Astro?
- **Performance**: Ships zero JavaScript by default
- **Flexibility**: Use components from any framework
- **DX**: Great developer experience with TypeScript support
- **SEO**: Static site generation for better SEO

### Why BEM?
- **Clarity**: Clear naming conventions prevent confusion
- **Scalability**: Easy to maintain and scale
- **No Conflicts**: Avoids CSS specificity issues
- **Readability**: Easy to understand component structure

### Why TypeScript?
- **Type Safety**: Catch errors at compile time
- **IntelliSense**: Better IDE support and autocomplete
- **Documentation**: Types serve as inline documentation
- **Refactoring**: Easier and safer refactoring

## Common Tasks

### Adding a New Page
1. Create file in `src/pages/` (e.g., `new-page.astro`)
2. Use the `MainLayout` layout
3. Follow BEM for CSS classes
4. Ensure mobile responsiveness

### Adding a New Component
1. Create file in `src/components/` (e.g., `NewComponent.astro`)
2. Use TypeScript for props interface
3. Follow BEM for CSS classes
4. Keep components simple and reusable

### Updating Styles
1. Use CSS custom properties from `:root`
2. Follow BEM naming
3. Test mobile-first, then desktop
4. Ensure accessibility (contrast, focus states, etc.)

## Resources

- [Astro Documentation](https://docs.astro.build)
- [BEM Methodology](http://getbem.com/)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)
- [MDN Web Docs](https://developer.mozilla.org/)

---

Last updated: 2025-11-14

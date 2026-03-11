# FourSG — Agent Guidelines

## Project Overview

FourSG is an Obsidian plugin that converts an Obsidian vault into a minimal static website. It is TypeScript-only, has no UI framework, and targets both desktop and mobile Obsidian (which means no Node.js APIs).

---

## Build & Tooling Commands

```bash
npm run dev          # Watch mode — rebuild on changes, inline sourcemaps
npm run build        # Type-check (tsc --noEmit) then bundle via esbuild
```

- **No linter** is configured (no ESLint, no Prettier).
- **No test framework** exists — there are no unit or integration tests. Manual testing is done using `FourSG_Test_Vault/` as a live Obsidian vault.
- The build produces `main.js` (CJS bundle) via `esbuild.config.mjs`.
- Type-checking only — `tsc` is run with `--noEmit --skipLibCheck`; no `.js` files are emitted from `src/`.

### Release Zip Contents

The following files and directories must be included in the release zip:

```
main.js
manifest.json
README.md
assets/
css/
templates/
```

---

## Key Source Files

```
main.ts                  # Plugin entry point; registers commands, delegates to SiteGenerator
src/SiteGenerator.ts     # Core engine (~988 lines); all site-generation logic
src/SeoManager.ts        # Generates meta/OG/Twitter/JSON-LD tags
src/SitemapGenerator.ts  # Generates sitemap.xml
src/settings.ts          # Settings interface, defaults, and top-level constants
templates/default.html   # Default Mustache HTML template
css/default.css          # Default stylesheet
assets/                  # Fritz Scale SVG icons
FourSG_Test_Vault/       # Manual test vault (DO NOT MODIFY — see below)
.windsurf/rules/         # AI agent rules for Windsurf IDE
```

---

## Architecture & Design Principles

- **Simplicity is paramount.** Users must never touch HTML, JavaScript, or templating.
- **Vault structure mirrors site structure.** Path layout in the vault becomes the URL structure of the site.
- **Manual over automatic.** Prefer explicit developer intent over automatic generation or indexing.
- **Late-1990s web aesthetic.** Simple construction and presentation; limited feature scope is intentional.
- **Mobile-first I/O.** All file I/O must use the Obsidian Plugin API (`app.vault`, `app.vault.adapter`). Never use the Node.js `fs`, `path`, or other Node APIs — they break on Obsidian mobile. Use `pathe` (already a dependency) in place of `node:path`.
- **Plugin dir vs. vault dir:** The plugin directory provides initial defaults (copied on first run). During site generation, always read templates and CSS from `obsidian-foursg/` inside the user's vault — never from the plugin directory directly.

---

## Code Style

### Language & Modules

- All source in **TypeScript** with `"strict": true` (see `tsconfig.json`).
- Use **ESM syntax** (`import`/`export`) in `.ts` source files.
- All imports use **relative paths** — no path aliases.
- Build scripts use `.mjs` (plain ESM, no TypeScript).

### Formatting (editor-enforced, no tooling)

- **4-space indentation** in all `.ts` files.
- **Single quotes** for all string literals.
- Opening braces on the **same line** for functions and classes; `catch`/`else` bodies also use same-line braces.
- No trailing commas.

### Naming Conventions

| Element | Convention | Example |
|---|---|---|
| Source files (class) | PascalCase | `SiteGenerator.ts` |
| Source files (module) | camelCase | `settings.ts` |
| Classes | PascalCase | `SiteGenerator`, `SeoManager` |
| Interfaces | PascalCase, no `I` prefix | `NavNode`, `FrontmatterData` |
| Exported constants | SCREAMING_SNAKE_CASE | `FOURSG_OUTPUT_DIR`, `DEFAULT_SETTINGS` |
| Static private class constants | `private static readonly` SCREAMING_SNAKE_CASE | `IMAGE_EXTENSIONS` |
| Methods & functions | camelCase, verb-first | `generateSite()`, `buildNavigationTree()` |
| Private fields | camelCase, no underscore prefix | `this.sitePath`, `this.templateCache` |
| Local variables | camelCase | `markdownFiles`, `batchSize` |
| Boolean flags | camelCase, descriptive | `enableDebugLogging`, `isIndex` |

### Types

- Prefer **interfaces** for data shapes (`NavNode`, `FrontmatterData`, `SeoConfig`).
- Use **type aliases** sparingly — mainly for union types.
- Avoid `any`; use `unknown` and narrow with `instanceof` checks.
- Use optional chaining (`?.`) and nullish coalescing (`??`) throughout.

---

## Error Handling

1. **Top-level functions use `try/catch/finally`**; inner helpers let errors bubble up.
2. **Typed error extraction pattern:**
   ```ts
   catch (error) {
       const errorMessage = error instanceof Error ? error.message : 'Unknown error';
       new Notice(`FourSG error: ${errorMessage}`);
   }
   ```
3. **User-facing errors** are always surfaced via Obsidian's `Notice` API (in-app toast).
4. **`finally` for cleanup** — `cacheClearAll()` runs in the `finally` block of `generateSite()`.
5. Per-file errors in batch processing are caught individually so one failure doesn't abort the entire run.

---

## Logging

Three private logging methods on `SiteGenerator`:

```ts
this.log('...')        // Debug only — gated by enableDebugLogging setting
this.alwaysLog('...')  // Always logs via console.log
this.error('...')      // Always logs via console.error
```

Never use `console.log` or `console.error` directly in `SiteGenerator` — go through these methods.

---

## State & Caching

- No external state management. All runtime state is private fields on `SiteGenerator`.
- File lists (`cachedMarkdownFiles`, `cachedImageFiles`, etc.) are lazily loaded and `null`-invalidated.
- Templates are memoized in `templateCache: Map<string, string>`.
- Frontmatter is bulk-pre-loaded into `frontmatterCache: Map<string, FrontmatterData>` before processing begins.
- All caches are cleared via `cacheClearAll()` at the start **and** in the `finally` block of each generation run.

---

## Adding New Features

- Before writing new functionality, **check npm for an existing package** that already performs the task and ask the developer whether to import it.
- New collaborator concerns (e.g., a new generator) should be encapsulated in a dedicated class (like `SeoManager` or `SitemapGenerator`) and instantiated per-run inside `SiteGenerator`.
- Batch async file operations with `Promise.all` in chunks of 5 (the established pattern in `SiteGenerator`).
- All output filenames and URL path segments must be run through `slugify` (lowercase, strict mode).
- All internal links must be resolved to **relative** paths — never absolute — to keep the generated site portable.

---

## Comments & Documentation

- **Do not add inline comments** to TypeScript files unless the developer explicitly requests them.
- Section boundaries inside `SiteGenerator.ts` use banner comments:
  ```ts
  // ==================== Section Name ====================
  ```
  Follow this convention when adding new logical sections.
- **Do not update `README.md`** or any other full-project documentation automatically. Only update docs when explicitly asked.

---

## Test Vault

- `FourSG_Test_Vault/` is a real Obsidian vault used for manual interactive testing.
- **Never modify files inside `FourSG_Test_Vault/`** programmatically. If a file in that directory needs updating, inform the developer so they can do it manually.

---

## Obsidian Plugin Guidelines

- Follow the official Obsidian Plugin best practices: https://docs.obsidian.md/Plugins/Releasing/Plugin+guidelines
- Register all commands, event listeners, and intervals via the plugin lifecycle (`this.addCommand`, `this.registerEvent`, `this.registerInterval`) so they are properly cleaned up on plugin unload.
- Never use `window.setInterval` or `window.addEventListener` directly.
- Plugin settings are persisted via `loadData()`/`saveData()` on the plugin instance.

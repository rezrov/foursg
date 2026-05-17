<!-- Generated: 2026-05-17 | Updated: 2026-05-17 -->

# FourSG — Agent Guidelines

## Project Overview

FourSG is an Obsidian plugin that converts an Obsidian vault into a minimal static website. It is TypeScript-only, has no UI framework, and targets both desktop and mobile Obsidian (which means no Node.js APIs).

---

## Subdirectories

| Directory | Purpose |
|-----------|---------|
| `src/` | TypeScript source: SiteGenerator orchestrator plus FileResolver, NavigationBuilder, MarkdownRenderer, SeoManager, SitemapGenerator, paths (see `src/AGENTS.md`) |
| `assets/` | Plugin-shipped Fritz Scale SVG icons (see `assets/AGENTS.md`) |
| `css/` | Default stylesheet shipped with the plugin (see `css/AGENTS.md`) |
| `templates/` | Default Mustache HTML template (see `templates/AGENTS.md`) |
| `.github/` | GitHub Actions release workflow (see `.github/AGENTS.md`) |
| `FourSG_Test_Vault/` | Live Obsidian vault used for manual testing. **Do not modify programmatically — no AGENTS.md generated.** |

---

## Build & Tooling Commands

```bash
npm run dev          # Watch mode — rebuild on changes, inline sourcemaps
npm run build        # Type-check (tsc --noEmit) then bundle via esbuild
```

- **No linter** is configured (no ESLint, no Prettier).
- **No test framework** exists. Manual testing is done using `FourSG_Test_Vault/` as a live Obsidian vault.
- The build produces `main.js` (CJS bundle) via `esbuild.config.mjs`.
- `tsconfig.json` targets ES2018 (matching the esbuild target); strict mode is on.
- `package-lock.json` is committed; CI uses `npm ci`.

### Release Zip Contents

The release zip (built by `.github/workflows/release.yml`) contains:

```
main.js
manifest.json
README.md
assets/
css/
templates/
```

---

## Architecture & Design Principles

- **Simplicity is paramount.** Users must never touch HTML, JavaScript, or templating.
- **Vault structure mirrors site structure.** Path layout in the vault becomes the URL structure of the site.
- **Manual over automatic.** Prefer explicit developer intent over automatic generation or indexing.
- **Late-1990s web aesthetic.** Simple construction and presentation; limited feature scope is intentional.
- **Mobile-first I/O.** All file I/O must use the Obsidian Plugin API (`app.vault`, `app.vault.adapter`). Never use the Node.js `fs`, `path`, or other Node APIs — they break on Obsidian mobile. Use `pathe` (already a dependency) in place of `node:path`.
- **Plugin dir vs. vault dir:** The plugin directory provides initial defaults (copied on first run via `copyUnlessExists`, which uses binary read/write). During site generation, always read templates and CSS from `obsidian-foursg/` inside the user's vault — never from the plugin directory directly.
- **No settings tab.** All user-tunable settings are exposed via the command palette (`addCommand`), not via `addSettingTab`. The existing `enable-debug-logging` / `disable-debug-logging` commands are the pattern.

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
| Source files (module) | camelCase | `settings.ts`, `paths.ts` |
| Classes | PascalCase | `SiteGenerator`, `FileResolver` |
| Interfaces | PascalCase, no `I` prefix | `NavNode`, `SeoConfig` |
| Exported constants | SCREAMING_SNAKE_CASE | `FOURSG_OUTPUT_DIR`, `IMAGE_EXTENSIONS` |
| `private static readonly` class constants | SCREAMING_SNAKE_CASE | `FRITZ_SCALE_FILES` |
| Methods & functions | camelCase, verb-first | `generateSite()`, `buildOutputPathMap()` |
| Private fields | camelCase, no underscore prefix | `this.sitePath`, `this.outputPathMap` |
| Local variables | camelCase | `markdownFiles`, `outputPath` |
| Boolean flags | camelCase, descriptive | `enableDebugLogging`, `isIndex` |

### Types

- Prefer **interfaces** for data shapes (`NavNode`, `SeoConfig`, `MetaTag`, `SitemapUrl`).
- Use **type aliases** sparingly — mainly for union types.
- Avoid `any`; use `unknown` and narrow with `instanceof` checks. The renderer-override `html(token: any)` in `MarkdownRenderer.ts` is the one exception (marked's renderer types are loose).
- Use optional chaining (`?.`), nullish coalescing (`??`), and `??=` throughout.

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
3. **User-facing errors and warnings** surface via Obsidian's `Notice` API (in-app toast).
4. **`finally` for cleanup** — `cacheClearAll()` runs in the `finally` block of `generateSite()`.
5. Per-file errors in batch processing are caught individually and tracked in `failedFiles`; a final `Notice` reports the count so partial failures don't read as success.

---

## Logging

Three private logging methods on `SiteGenerator`:

```ts
this.log('...')        // Debug-gated by enableDebugLogging setting
this.warn('...')       // Always logs via console.warn (yellow in DevTools)
this.error('...')      // Always logs via console.error
```

Never use `console.log` or `console.error` directly in `SiteGenerator` — go through these methods. Warnings should also surface via `Notice` when user-actionable.

---

## State & Caching

- No external state management. All runtime state is private fields on `SiteGenerator`.
- `FileResolver` builds Map-based indices (`byPath` / `byName` / `byBasename`) for markdown, image, and video files in one `build()` call — lookups are O(1).
- `NavigationBuilder` builds the nav tree once via `build()`; per-page rendering only re-runs the tree-to-HTML walk via `render(currentPath, omit)`.
- `frontmatterCache: Map<string, Record<string, any>>` is bulk-pre-loaded before processing begins.
- `outputPathMap: Map<string, string>` precomputes per-file output paths with collision detection (renames to `name-2.html` on conflict, fires Notice).
- `templateCache: Map<string, string>` memoizes template reads.
- All caches are cleared via `cacheClearAll()` at the start **and** in the `finally` block of each generation run.

---

## Adding New Features

- Before writing new functionality, **check npm for an existing package** that already performs the task and ask the developer whether to import it.
- The codebase splits responsibilities across `SiteGenerator` (orchestrator), `FileResolver` (file lookup), `NavigationBuilder` (nav tree), `MarkdownRenderer` (markdown conversion), `SeoManager` / `SitemapGenerator` (output helpers). Add new responsibilities as dedicated modules in `src/`, instantiated per-run in `SiteGenerator`.
- Batch async file operations with `Promise.all` over a `.map(...)`. The old `batchSize = 5` chunking has been removed — the adapter handles parallelism fine.
- All output filenames and URL path segments must be run through `sanitizeFilename` / `sanitizeDirectoryPath` (lowercase, strict slugify) from `paths.ts`.
- All internal links must be resolved to **relative** paths — never absolute — to keep the generated site portable. Use `relative()` from pathe; do **not** use string `.replace()` for path stripping.
- Any system-generated HTML emitted into the markdown stream (e.g., `<video>` tags) must use the PUA-placeholder mechanism in `MarkdownRenderer.render` so marked's renderer override (which escapes all HTML for security) doesn't escape it.

---

## Security Posture

- `marked`'s `renderer.html` is overridden to HTML-escape all HTML tokens — user-authored `<script>`, `<img onerror>`, etc. in markdown cannot reach the published site.
- JSON-LD output escapes `</script>` and `<!--` sequences to prevent script-tag breakout.
- All user-controlled strings flowing into HTML attributes or text content (nav `displayName`, fritz URL, `og_image`) are HTML-escaped via `escapeHtml` from `SeoManager`.
- Wiki-link display text is markdown-escaped (`\`, `[`, `]`, `(`, `)`, `` ` ``) to prevent markdown-syntax breakout.
- `fritzScaleUrl1..5` are validated against a scheme allowlist (`/^(https?:\/\/|\/|\.|#)/i`) before insertion.
- `removeDirectoryRecursive` asserts the target path is under `outputPath` (via `pathe.normalize` + prefix check) before any side effects.

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
- Plugin settings are persisted via `loadData()`/`saveData()` on the plugin instance. There is no settings tab — user-facing tunables are exposed via the command palette.

<!-- MANUAL: -->

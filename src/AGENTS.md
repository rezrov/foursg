<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-05-17 | Updated: 2026-05-17 -->

# src

## Purpose
TypeScript source for the FourSG Obsidian plugin. After a recent refactor, the site-generation engine is split across an orchestrator (`SiteGenerator`) and four dedicated helper modules (`FileResolver`, `NavigationBuilder`, `MarkdownRenderer`, `paths`) plus two pre-existing output helpers (`SeoManager`, `SitemapGenerator`). Settings live in `settings.ts`.

## Key Files

| File | Description |
|------|-------------|
| `SiteGenerator.ts` | Orchestrator (~633 lines). Owns init/teardown, asset copy, template rendering, SEO data assembly, fritz scale, sitemap, robots.txt, and pipeline sequencing. Instantiates `FileResolver`, `NavigationBuilder`, and `MarkdownRenderer` per run. |
| `FileResolver.ts` | Builds Map indices (`byPath` / `byName` / `byBasename`) for markdown, image, and video files in one `build()` call. Exposes O(1) `findTarget` / `findImage` / `findVideo`. Exports `IMAGE_EXTENSIONS` and `VIDEO_EXTENSIONS`. |
| `NavigationBuilder.ts` | Builds the nav tree once via `build()`; renders per-page via `render(currentPath, omitCurrent)`. Includes sort, prune-empty, HTML escape, and injective folder-id encoding. Exports the `NavNode` interface. |
| `MarkdownRenderer.ts` | Markdown rendering pipeline: wiki-link conversion (with `#heading` / `^block` anchor support and slugified fragments), image-embed conversion (with `\|alt` / `\|size` modifier handling), video-embed via PUA-placeholder system that survives the marked renderer's HTML-escape override. Configures `marked` at module scope. |
| `SeoManager.ts` | Builds `<meta>`, Open Graph, Twitter Card, and JSON-LD structured-data tags per page. Exports the standalone `escapeHtml` utility used by callers. JSON-LD output escapes `</script>` and `<!--` to prevent script-tag breakout. |
| `SitemapGenerator.ts` | Accumulates `SitemapUrl` entries during a generation run and serializes them to `sitemap.xml`. Used only when `site_url` is configured. |
| `paths.ts` | Pure path-manipulation utilities: `sanitizeFilename`, `sanitizeDirectoryPath`, `computeOutputPath`, `getImageOutputPath`, `getRelativeLinkPath`, `getRelativePathToRoot`. All stateless; site-bound state is passed in as args. |
| `settings.ts` | `FourSGPluginSettings` interface, `DEFAULT_SETTINGS`, and the `FOURSG_OUTPUT_DIR` constant (`"obsidian-foursg"`). Includes `fritzScaleUrl1..5` (currently all pointing at a single placeholder URL pending per-level docs split). |

## Subdirectories
None.

## For AI Agents

### Working In This Directory
- **No Node.js APIs.** Use Obsidian's `app.vault` / `app.vault.adapter` for all file I/O. Use `pathe` (already a dep) instead of `node:path`. Plugin must run on Obsidian mobile.
- New collaborators go in a **dedicated module file** alongside the existing helpers and are instantiated per-run inside `SiteGenerator.generateSite()`. Don't grow `SiteGenerator` back into a god object.
- Path utilities go in `paths.ts` as pure functions taking `sitePath` as an arg — not as methods on a class with site state.
- All output paths/segments are run through `sanitizeFilename` (lowercase, strict slugify). Internal links resolve via `pathe.relative()`, **never** by `string.replace(sitePath + '/', '')`.
- System-generated HTML in markdown (e.g., the `<video>` tag) must use the PUA-placeholder mechanism in `MarkdownRenderer.render` — directly emitting raw HTML will be escaped by the marked renderer override.
- Never log via `console.*` directly inside `SiteGenerator`. Route through `this.log()` (gated by `enableDebugLogging`), `this.warn()` (unconditional `console.warn`), or `this.error()`.
- Add no inline comments unless the developer asks. Section dividers in `SiteGenerator.ts` use the banner form `// ==================== Section Name ====================` — follow it when adding a new logical section.

### Architecture Notes (`SiteGenerator.ts` section banners)
Logging → Constructor & Setup → Public API → Initialization → Cache Management → File System Operations → Markdown Processing → Template & Asset Handling → Misc File Copying → Fritz Scale → SEO Methods.

### `SiteGenerator.generateSite()` pipeline
1. `initializeSite()` — ensure working dirs, clear site dir, seed defaults.
2. `loadSiteName()` — read `index.md` frontmatter for `site_name` / `site_url`. Missing `site_url` triggers a warn + Notice and omits sitemap / canonical / og:url from output.
3. `sitemapGenerator = siteUrl ? new SitemapGenerator(...) : null`.
4. `fileResolver.build()` — scan vault, populate lookup maps.
5. `buildFrontmatterCache()` — preload frontmatter for all markdown files.
6. `buildOutputPathMap()` — compute output paths, detect collisions (rename `name-2.html` and Notice).
7. `navBuilder = new NavigationBuilder(...)` then `navBuilder.build()` — build the tree once.
8. `mdRenderer = new MarkdownRenderer(...)`.
9. `await Promise.all(markdownFiles.map(processMarkdownFile))` — concurrent per-file rendering.
10. Copy images, videos, misc files, fritz assets.
11. `generateSitemap()` and `generateRobotsTxt()` — both gated on `siteUrl`.

### Testing Requirements
- No test framework. Validate by running `npm run build` (which runs `tsc --noEmit --skipLibCheck` then esbuild production) and exercising the plugin against `../FourSG_Test_Vault/` in Obsidian.
- Do **not** modify files inside `../FourSG_Test_Vault/` programmatically — inform the developer if changes there are needed.

### Common Patterns
- **Strict TypeScript**, ESM imports, relative paths only, 4-space indent, single quotes, no trailing commas, same-line opening braces.
- Interfaces (no `I` prefix) for data shapes — `NavNode`, `SeoConfig`, `MetaTag`, `SitemapUrl`.
- Class names PascalCase; methods camelCase verb-first; exported constants SCREAMING_SNAKE_CASE; `private static readonly` for class-level constants.
- Error handling: top-level methods use `try/catch/finally`; inner helpers bubble errors. Surface user errors via `new Notice(...)`. Use the typed extraction pattern `error instanceof Error ? error.message : 'Unknown error'`.
- Per-file errors during batch processing are caught individually and pushed to `this.failedFiles`; a final Notice reports the count.

## Dependencies

### Internal
- `../main.ts` — instantiates `SiteGenerator` for the `generate-static-site` and `clear-output-directory` commands; injects the plugin handle.
- `../templates/`, `../css/`, `../assets/` — initial defaults copied into the vault on first run.

### External
- `obsidian` — `Plugin`, `Notice`, `TFile`, `App`, `normalizePath`, `DataAdapter`, `Stat`.
- `marked` (^17) — Markdown → HTML. Configured with `breaks: true, gfm: true`; renderer overridden to HTML-escape all HTML tokens.
- `mustache` — HTML templating.
- `slugify` — URL/file-name normalization (strict, lowercase).
- `pathe` — POSIX path joins/dirname/basename/extname/relative/normalize (Node-free).

<!-- MANUAL: -->

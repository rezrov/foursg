<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-05-17 | Updated: 2026-05-17 -->

# templates

## Purpose
Default Mustache HTML template shipped with the plugin. Copied into `obsidian-foursg/templates/` inside the user's vault on first run; the runtime renders from the in-vault copy. Defines the page skeleton (head, header, collapsible sidebar nav, main content, footer) and bootstraps client-side nav-state persistence.

## Key Files

| File | Description |
|------|-------------|
| `default.html` | Mustache page template. Variables: `{{title}}`, `{{siteName}}`, `{{canonicalUrl}}`, `{{rootPath}}`, `{{styleSheet}}`, `{{dates}}`, `{{{content}}}`, `{{{navigation}}}`, `{{{seoMetaTags}}}`, `{{{seoStructuredData}}}`, `{{{fritzScaleHtml}}}`. Embeds a small inline script that persists `.nav-folder` open/closed state in `sessionStorage` (key `foursg-nav-state`) and closes the mobile sidebar on outside-click. |

## Subdirectories
None.

## For AI Agents

### Working In This Directory
- This is the **default** shipped with the plugin. Runtime reads from the vault copy under `obsidian-foursg/templates/` — edits here only affect first-run defaults.
- Mustache convention: `{{var}}` is HTML-escaped, `{{{var}}}` is raw. Anything that holds HTML fragments (navigation, content, SEO blocks, Fritz Scale) must use the triple-brace form.
- The variables consumed by this template are produced by `../src/SiteGenerator.ts` `wrapInTemplate`. Adding a new placeholder requires a matching producer in `SiteGenerator`.
- File is shipped in the release zip (see `../.github/workflows/release.yml`).
- The inline script uses `sessionStorage` deliberately (see commit `84d8cee` "Changed navigation status to use session storage"). Don't switch to `localStorage` without a deliberate reason.
- `<link rel="canonical" href="{{canonicalUrl}}">` is intentional — when `site_url` is unset, the empty `href` is treated by search engines as "self-canonical," which is the safe default.

### Testing Requirements
- Generate the test vault site (`../FourSG_Test_Vault/`) and verify in a browser: nav expand/collapse persists across navigations within a tab, mobile hamburger toggle works, SEO `<meta>` tags render, video embeds (e.g., `articles/Stuff about work` references `open_the_claw.mp4`) play.

### Common Patterns
- Single template; no partials or layouts.
- CSS reached via `{{rootPath}}css/{{styleSheet}}` — `rootPath` is the per-page relative path back to the site root.

## Dependencies

### Internal
- `../css/default.css` — linked via `{{styleSheet}}`.
- `../src/SiteGenerator.ts` — populates all Mustache variables; `NavigationBuilder` supplies `navigation`; `SeoManager` supplies `seoMetaTags` and `seoStructuredData`; `MarkdownRenderer` supplies `content`.

### External
- `mustache` (npm) — renders the template at generation time.

<!-- MANUAL: -->

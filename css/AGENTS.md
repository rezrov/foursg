<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-05-17 | Updated: 2026-05-17 -->

# css

## Purpose
Default stylesheet shipped with the plugin. Copied into `obsidian-foursg/css/` inside the user's vault on first run; users edit the in-vault copy, not this one. Style aesthetic is intentionally late-1990s-web with CSS custom properties for a four-color palette.

## Key Files

| File | Description |
|------|-------------|
| `default.css` | Default site stylesheet. Imports the Inter web font, defines a four-base-color palette via CSS `:root` custom properties, derives header/nav/content colors with `color-mix(...)`, and sets the responsive sidebar/main layout. Includes `.fritz-scale` / `.fritz-scale a` / `.fritz-scale-icon` rules for the Fritz Scale icon block. |

## Subdirectories
None.

## For AI Agents

### Working In This Directory
- This is the **default** that ships with the plugin. The runtime always reads from the vault copy under `obsidian-foursg/css/` — edits here only affect new installs / first-run defaults.
- Keep the four base colors (`--base-bg`, `--base-highlight`, `--base-accent`, `--base-fg`) as the only hand-picked values; derived colors should use `color-mix(in srgb, ...)` so palette swaps cascade cleanly.
- Reachable from templates via `{{rootPath}}css/{{styleSheet}}` — see `../templates/default.html`.
- File is shipped in the release zip (see `../.github/workflows/release.yml`).

### Testing Requirements
- Generate the test vault site (`../FourSG_Test_Vault/`) and visually verify in a browser at desktop and mobile widths after style changes.

### Common Patterns
- CSS custom properties on `:root`; derived colors via `color-mix`.
- Mobile-friendly: sidebar collapses via the `#nav-toggle` checkbox hack defined in `../templates/default.html`.

## Dependencies

### Internal
- `../templates/default.html` — links this stylesheet via the Mustache `{{styleSheet}}` variable.
- `../src/SiteGenerator.ts` — `copyCSS` copies this file into the vault working dir on first run, then mirrors all vault `*.css` into `site/css/`.

### External
- Google Fonts (Inter family) — loaded via `@import url(...)`.

<!-- MANUAL: -->

<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-05-17 | Updated: 2026-05-17 -->

# assets

## Purpose
Plugin-shipped static assets. Currently holds the five "Fritz Scale" SVG icons used by `SiteGenerator`'s Fritz Scale rendering pass. These files are copied into the user's vault output (`obsidian-foursg/assets/`) on first run and bundled in the release zip.

## Key Files

| File | Description |
|------|-------------|
| `fritz-1.svg` | Fritz Scale icon — level 1. |
| `fritz-2.svg` | Fritz Scale icon — level 2. |
| `fritz-3.svg` | Fritz Scale icon — level 3. |
| `fritz-4.svg` | Fritz Scale icon — level 4. |
| `fritz-5.svg` | Fritz Scale icon — level 5. |

## Subdirectories
None.

## For AI Agents

### Working In This Directory
- The exact filenames `fritz-1.svg` … `fritz-5.svg` are hard-coded in `../src/SiteGenerator.ts` (`FRITZ_SCALE_FILES`). Do not rename without updating that constant.
- These five files are part of the release zip — see `../.github/workflows/release.yml`. Any addition here must also be added to the release zip step if it needs to ship.
- Keep SVGs static and self-contained (no external font/image refs); they are served from the generated site.
- Copy uses `copyUnlessExists` in `SiteGenerator`, which now reads/writes binary — adding a non-SVG asset here is safe.

### Testing Requirements
- Visually verify in the test vault output after a `Generate static site` run when icons change.

### Common Patterns
- All five files share filename pattern `fritz-N.svg`.

## Dependencies

### Internal
- `../src/SiteGenerator.ts` — Fritz Scale section references these filenames via `SiteGenerator.FRITZ_SCALE_FILES`; copies them via `copyFritzScaleAssets` only if any page uses `fritz_scale` frontmatter.
- `../src/settings.ts` — `fritzScaleUrl1` … `fritzScaleUrl5` settings drive click-through targets for the icons (currently all set to the same placeholder URL).

### External
None.

<!-- MANUAL: -->

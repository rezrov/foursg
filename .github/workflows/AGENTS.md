<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-05-17 | Updated: 2026-05-17 -->

# workflows

## Purpose
GitHub Actions workflow definitions. Currently a single release pipeline that triggers on tag pushes to `master`, builds the plugin via `npm ci && npm run build`, packages the Obsidian release zip, and uploads `main.js`, `manifest.json`, and the versioned zip as release assets via a single modern action.

## Key Files

| File | Description |
|------|-------------|
| `release.yml` | "Release Obsidian plugin" workflow. Triggers on `push.tags: "*"` and only runs when the tag points at a commit on `refs/heads/master`. All actions are pinned to commit SHAs (immutable). Steps: checkout → setup Node 18 (with npm cache) → `npm ci` → `npm run build` → assemble `foursg-plugin/` (main.js, manifest.json, README.md, assets/, css/, templates/) → zip → upload all three assets via `softprops/action-gh-release`. `permissions: contents: write` is declared per least-privilege. |

## Subdirectories
None.

## For AI Agents

### Working In This Directory
- The release zip's file/dir list (`main.js manifest.json README.md assets css templates`) is the canonical "what ships" list. Mirror any additions here in the project's root `../../AGENTS.md` "Release Zip Contents" section and vice versa.
- All `uses:` references are pinned to **full commit SHAs** with a version comment (e.g., `actions/checkout@de0fac2e4500dabe0009e67214ff5f5447ce83dd  # v6.0.2`). If you bump a version, update both the SHA and the comment. Never switch back to a mutable tag-only ref (`@v6`) — that's the supply-chain hole the pins exist to close.
- `npm ci` requires `../../package-lock.json` to exist in the repo (it's committed). If anyone re-gitignores the lockfile, `npm ci` will fail at install.
- Asset name format: `foursg-plugin-<tag>.zip` — Obsidian users expect this filename pattern.
- Branch gate: `contains(github.event.base_ref, 'refs/heads/master')`. Tags on other branches are intentionally ignored.

### Testing Requirements
- Push a throwaway tag from a fork or a non-master branch to confirm the gate. Validate the produced zip extracts to a folder Obsidian's plugin loader can install (manifest.json + main.js at the root of the folder).

### Common Patterns
- `permissions:` declared at job/workflow level for least-privilege.
- Node version pinned to `18.x` in `setup-node`. (Node 18 reached EOL in April 2025 — bump deliberately when convenient.)

## Dependencies

### Internal
- Top-level `main.js` (built artifact), `manifest.json`, `README.md`, `package-lock.json`.
- `../../assets/`, `../../css/`, `../../templates/`.
- `npm run build` from `../../package.json` — runs `tsc --noEmit --skipLibCheck` then `node esbuild.config.mjs production`.

### External
- `actions/checkout@de0fac2e4500dabe0009e67214ff5f5447ce83dd` (v6.0.2).
- `actions/setup-node@48b55a011bda9f5d6aeb4c2d9c7362e8dae4041e` (v6.4.0).
- `softprops/action-gh-release@b4309332981a82ec1c5618f44dd2e27cc8bfbfda` (v3.0.0).
- `GITHUB_TOKEN` (default workflow secret).

<!-- MANUAL: -->

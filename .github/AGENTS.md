<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-05-17 | Updated: 2026-05-17 -->

# .github

## Purpose
GitHub-specific configuration. Currently houses only the CI workflow that builds and publishes the Obsidian plugin release when a git tag is pushed to `master`.

## Key Files
None at this level.

## Subdirectories

| Directory | Purpose |
|-----------|---------|
| `workflows/` | GitHub Actions workflow definitions (see `workflows/AGENTS.md`). |

## For AI Agents

### Working In This Directory
- No issue templates, PR templates, or CODEOWNERS configured. Add them at this level if introduced; keep workflow YAML under `workflows/`.

### Testing Requirements
- Workflow changes are exercised by pushing a tag from `master`. Validate YAML locally with `yamllint` or `act` before pushing.

### Common Patterns
- One workflow file per pipeline.

## Dependencies

### Internal
- The release workflow consumes top-level `main.js`, `manifest.json`, `README.md`, `../assets/`, `../css/`, `../templates/` to build the release zip.
- Workflow runs `npm ci` against the committed `../package-lock.json`.

### External
- GitHub Actions runners (`ubuntu-latest`).

<!-- MANUAL: -->

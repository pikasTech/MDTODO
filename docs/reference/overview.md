# MDTODO Overview

## Scope

MDTODO is a Markdown-first task system centered on TODO files that use hierarchical `R` identifiers such as `R1`, `R1.1`, and `R54.9.4.1`.

The repository currently contains three persistent deliverables:

- a VS Code extension for viewing and editing TODO files
- a standalone CLI under `cli/`
- a skill-oriented workflow document for using MDTODO outside the extension UI

## Current repository shape

- extension entry: `src/extension.ts`
- webview provider: `src/providers/webviewProvider.ts`
- parser: `src/parser/index.ts`
- shared task types: `src/types/index.ts`
- task file mutation layer: `src/providers/managers/taskFileManager.ts`
- execution routing: `src/services/claudeService.ts`
- settings persistence: `src/services/settingsService.ts`
- logging: `src/services/logService.ts`
- CLI package: `cli/`

## Long-term stable goals

- keep source-of-truth planning in Markdown
- preserve direct editability of the original `.md` files
- render TODO files as a structured interactive view
- support execution handoff to external coding CLIs
- preserve implementation history through task reports instead of rewriting history

## Distilled development outline

The original MDTODO work split into two long extension tracks and two secondary tracks:

- `docs/20260120_MDTODO.md`: early extension foundation and interaction work
- `docs/20260120_MDTODO2.md`: later extension refinement, settings, logging, and execution routing
- `docs/MDTODO_CLI.md`: CLI implementation track
- `docs/MDTODO_SKILL.md`: skill packaging track

Use `docs/reference/process-distillation.md` for the distilled map of those process docs.

# Process Distillation

## Purpose

This document is the distilled map from process documents to long-term project knowledge.

It exists so future maintenance can start from stable reference docs instead of replaying the full historical archive.

## Source ordering

The original process documents should be read from old to new:

1. `docs/20260120_MDTODO.md`
2. `docs/20260120_MDTODO2.md`
3. `docs/MDTODO_CLI.md`
4. `docs/MDTODO_SKILL.md`

Detailed task reports remain under:

- `docs/details/20260120_MDTODO/`
- `docs/details/20260120_MDTODO2/`
- `docs/details/MDTODO_CLI/`
- `docs/details/mdtodo-edit/`

## Distilled development outline

### Phase 1: Extension foundation

The first major MDTODO process document established the baseline system:

- parser and tree rendering
- task editing and CRUD
- report-link generation
- webview-based interaction
- packaging and install flow

This phase is now distilled into:

- `docs/reference/overview.md`
- `docs/reference/extension-entrypoints.md`
- `docs/reference/task-markdown-format.md`
- `docs/reference/build-and-release.md`

### Phase 2: Interaction and integration refinement

The second major MDTODO process document focused on:

- UI refinement
- filtering and navigation behavior
- markdown rendering corrections
- settings persistence
- unified logging
- execution-mode routing

This phase is now distilled into:

- `docs/reference/extension-entrypoints.md`
- `docs/reference/execution-modes.md`
- `docs/reference/build-and-release.md`

### Phase 3: CLI extraction

The CLI process track extracted MDTODO operations into a scriptable terminal interface.

That long-term knowledge is distilled into:

- `docs/reference/cli-and-skill.md`
- `docs/MDTODO_CLI_USAGE.md`

### Phase 4: Skill packaging

The skill process track packaged MDTODO workflows for agent use on top of the CLI track.

That long-term knowledge is distilled into:

- `docs/reference/cli-and-skill.md`

## Distillation rules applied here

- older process docs were used for baseline structure
- newer process docs override older behavior when they conflict
- process history is summarized as short outline, not as a changelog replay
- process docs themselves remain untouched as primary historical sources

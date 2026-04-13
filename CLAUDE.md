# CLAUDE.md

Top-level index for the MDTODO repository.

## Dev Commands

- `npm.cmd install`: install workspace dependencies on Windows; see `docs/reference/build-and-release.md`.
- `npm.cmd run watch`: rebuild extension and webview bundles during local development; see `docs/reference/build-and-release.md`.
- `npm.cmd run compile`: run the full TypeScript and webpack build; see `docs/reference/build-and-release.md`.
- `npm.cmd run test`: run the Jest test suite; see `docs/reference/build-and-release.md`.
- `npm.cmd run package`: create the VSIX package for distribution; see `docs/reference/build-and-release.md`.
- `install.bat`: install the extension into VS Code through the local packaging flow; see `docs/reference/build-and-release.md`.

## VS Code Commands

- `mdtodo.openView`: open the preferred TODO file in the MDTODO view; see `docs/reference/extension-entrypoints.md`.
- `mdtodo.openFile`: choose and open a TODO file manually; see `docs/reference/extension-entrypoints.md`.
- `mdtodo.refresh`: refresh the current MDTODO panel from Markdown source; see `docs/reference/extension-entrypoints.md`.
- `mdtodo.executeTask`: run the selected task through the configured executor; see `docs/reference/execution-modes.md`.
- `mdtodo.openFromPreview`: open MDTODO from a Markdown preview context; see `docs/reference/extension-entrypoints.md`.

## Code Entrypoints

- `src/extension.ts`: extension activation, command registration, provider registry, and file watching; see `docs/reference/extension-entrypoints.md`.
- `src/providers/webviewProvider.ts`: webview lifecycle, message routing, and manager orchestration; see `docs/reference/extension-entrypoints.md`.
- `src/providers/managers/taskFileManager.ts`: Markdown task CRUD and report-link creation; see `docs/reference/task-markdown-format.md`.
- `src/providers/managers/commandGenerator.ts`: copyable execution command generation for each executor; see `docs/reference/execution-modes.md`.
- `src/services/claudeService.ts`: terminal launch path for Claude, Codex, and OpenCode execution; see `docs/reference/execution-modes.md`.
- `cli/`: standalone MDTODO command-line workflow; see `docs/reference/cli-and-skill.md`.

## Reference Docs

- `docs/reference/overview.md`: project scope, deliverables, repository shape, and long-term goals.
- `docs/reference/extension-entrypoints.md`: stable extension commands, runtime entrypoints, and architecture constraints.
- `docs/reference/task-markdown-format.md`: `R` task format, parsed data model, status markers, and report-link rules.
- `docs/reference/execution-modes.md`: executor selection, generated command shapes, and launch behavior.
- `docs/reference/cli-and-skill.md`: project-specific CLI and skill relationship without duplicating generic skill docs.
- `docs/reference/build-and-release.md`: build, test, package, and installation flow.
- `docs/reference/process-distillation.md`: distilled map from historical process documents to current reference docs.
- `docs/README.md`: reading order for the documentation set.

## Historical Sources

- `docs/20260120_MDTODO.md`: early extension foundation and interaction track.
- `docs/20260120_MDTODO2.md`: later extension refinement, settings, logging, and execution routing track.
- `docs/MDTODO_CLI.md`: CLI implementation history.
- `docs/MDTODO_CLI_USAGE.md`: user-facing CLI usage source.
- `docs/MDTODO_SKILL.md`: skill packaging history.
- `docs/details/`: immutable detailed reports kept as primary process records.

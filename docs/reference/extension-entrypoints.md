# Extension Entrypoints

## Extension commands

The extension contributes these stable commands:

- `mdtodo.openView`: open the preferred TODO file in the MDTODO webview
- `mdtodo.openFile`: choose and open a TODO file
- `mdtodo.refresh`: refresh the current TODO view
- `mdtodo.executeTask`: execute the selected task with the configured external CLI
- `mdtodo.openFromPreview`: open MDTODO from a Markdown preview context

## Main runtime entrypoints

### `src/extension.ts`

Responsible for:

- extension activation and deactivation
- command registration
- tracking multiple webview instances by file path
- file-watcher setup for `**/*TODO*.md`
- initial log-directory setup

### `src/providers/webviewProvider.ts`

Responsible for:

- loading and refreshing TODO files into the webview
- routing messages between frontend and extension
- delegating editing, links, command generation, and settings

### `src/providers/managers/`

The provider depends on long-lived manager roles:

- `PanelManager`: panel lifecycle and HTML bootstrap
- `TaskFileManager`: task CRUD against Markdown files
- `CommandGenerator`: copyable command generation for task execution

Other important collaborators:

- `ScrollSyncManager`
- `LinkHandler`
- `FileRefreshManager`
- `TaskStatusManager`

## Stable architecture constraints

- file paths are treated as plain strings in parser and service layers
- provider instances are keyed by normalized file path
- source Markdown remains authoritative even when the webview edits content
- task editing and process-history documents must remain linkable from the source file

## Historical source trail

The core of this architecture was established in the first extension track and later refactored in the second:

- source process docs: `docs/20260120_MDTODO.md`, `docs/20260120_MDTODO2.md`
- detailed historical reports: `docs/details/20260120_MDTODO/`, `docs/details/20260120_MDTODO2/`

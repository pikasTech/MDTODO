# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

VSCode extension that renders Markdown TODO files as an interactive tree view with Claude Code integration. Tasks use the `## R1`, `### R1.1` format (R = Requirement/Task, with optional dot notation for subtasks).

## Commands

```bash
npm install              # Install dependencies
npm run watch            # Development: watch mode with hot reload (F5 to debug)
npm run compile          # Full build: TypeScript compilation + webpack bundling
npm run package          # Package as .vsix for distribution
npm run test             # Run Jest tests
```

## Architecture

### Extension Core (`src/extension.ts`)
- Entry point for VSCode activation/deactivation
- Registers commands: `mdtodo.openView`, `mdtodo.openFile`, `mdtodo.refresh`, `mdtodo.executeTask`
- Manages a `Map<string, TodoWebviewProvider>` for multiple file support
- Sets up file system watcher for `**/*TODO*.md` files

### Webview Provider (`src/providers/webviewProvider.ts`)
- Main orchestrator for each webview panel
- Initializes manager instances: `PanelManager`, `TaskFileManager`, `CommandGenerator`, `ScrollSyncManager`, `LinkHandler`, `FileRefreshManager`, `TaskStatusManager`
- Handles message routing from webview (70+ message types)
- Key methods: `loadFile()`, `refresh()`, `handleMessage()`

### Manager Pattern (`src/providers/managers/`)
- **PanelManager**: Webview panel lifecycle and HTML content
- **TaskFileManager**: Task CRUD operations on markdown files
- **CommandGenerator**: Claude CLI command generation

### Parser (`src/parser/index.ts`)
- Tokenizes markdown into: `heading`, `task`, `text`, `empty`
- Builds hierarchical tree from flat markdown using indentation-based stacking
- Calculates link statistics for tasks
- Auto-converts legacy `[Processing]`/`[Finished]` to `[in_progress]`/`[completed]`

### Task Data Model (`src/types/index.ts`)
```typescript
interface TodoTask {
  id: string;           // "R1", "R2.1"
  title: string;        // Formatted for display
  rawContent: string;   // Preserved for editing
  completed: boolean;   // [completed] mark
  processing: boolean;  // [in_progress] mark
  children: TodoTask[]; // Nested subtasks
  lineNumber: number;   // Source file line
  linkCount: number;    // Link statistics
  linkExists: number;   // Existing links count
}
```

### Webview (`src/webview/`)
- React 18 application bundle separately via webpack (`resources/bundle.js`)
- Built with `tsconfig.webview.json` (transpileOnly: true)
- Components: `TaskList`, `TaskItem`, `TaskBlock`, `Toolbar`, `TaskContextMenu`
- Hooks pattern: `useTaskListState`, `useTaskOperations`, `useLinkOperations`, `useScrollHandler`
- Communicates with extension via `vscode.postMessage` (types: `updateTasks`, `taskSelected`, `executeTask`, etc.)

### Services (`src/services/`)
- **fileService**: Find/read TODO files (`*TODO*.md` pattern)
- **claudeService**: Execute Claude Code CLI commands

## Build System

Two separate webpack bundles:
1. **Extension** (`out/extension.js`): CommonJS, excludes React/vscode
2. **Webview** (`resources/bundle.js`): ESM bundle with React, Katex inline

TypeScript configurations:
- `tsconfig.json`: Extension code (strict mode, commonjs)
- `tsconfig.webview.json`: React webview (transpileOnly, react-jsx)

## Key Conventions

- File paths use `filePath: string` (not URI) in parser/services
- Webview providers keyed by lowercase-normalized file path
- Console logging uses `[MDTODO]` prefix for filtering
- Message types are snake_case strings (`taskSelected`, `markComplete`)

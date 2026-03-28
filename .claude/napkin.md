# Napkin - Per-repo Runbook

## Project: vscode-mdtodo

VSCode extension that renders Markdown TODO files as an interactive tree view with Claude Code integration.

---

## Key Conventions

- **npm on Windows**: Use `npm.cmd` instead of `npm`
- **Config persistence**: Settings stored in `<workspace>/.vscode/mdtodo/settings.json`
- **Message types**: snake_case strings (e.g., `taskSelected`, `markComplete`)
- **Console logging**: Use `[MDTODO]` prefix for filtering

---

## Settings Config

**Location**: `.vscode/mdtodo/settings.json`

```typescript
interface SettingsConfig {
  executionMode: 'claude' | 'opencode';  // default: 'opencode'
  model?: string;                          // e.g., 'minimax/MiniMax-M2.5'
}
```

---

## CLI Commands (cli/)

**Build**: `npm.cmd run build --prefix cli`

**Debug commands**:
```bash
# List models
node cli/dist/cli.js debug model-list

# Get config
node cli/dist/cli.js debug config-get -w "<workspace>"

# Set config
node cli/dist/cli.js debug config-set executionMode opencode -w "<workspace>"
node cli/dist/cli.js debug config-set model "minimax/MiniMax-M2.5" -w "<workspace>"

# Generate execute command (for testing)
node cli/dist/cli.js debug execute-command <taskId> -f "<file>"
```

---

## Model Selection Feature (R54.9.6)

### Backend Flow
1. `webviewProvider.handleFetchModels()` → calls `ModelService.listModels()`
2. `ModelService` spawns `opencode models` CLI command
3. Response sent to webview via `modelsUpdated` message
4. `modelChanged` message → `handleModelChanged()` → `settingsService.updateModel()`

### Frontend Flow
1. `useTaskListMessages` handles `modelsUpdated` message
2. `setModels()` updates state (must be in useEffect dependencies!)
3. `SettingsPanel` renders dropdown when `executionMode === 'opencode'`

### Common Issues
- **Models not showing**: Check if `setModels` is in useEffect dependency array
- **Message not received**: Check webview console for `[Webview] Received modelsUpdated:`
- **State not persisting**: Ensure `useTaskListState` uses real `useState` for `model/models`, not empty placeholders

---

## Debugging Context Menu Copy Command (R1.5.3)

### Issue
Copying "R1.5.3" copies "R1" instead.

### Debug Steps
1. Check webview console logs:
   - `[Webview] handleTaskContentContextMenu called` - shows taskId on right-click
   - `[Webview] handleCopyExecuteCommand called` - shows taskId on copy
   - `[MDTODO] Received generateExecuteCommand message with taskId:` - shows extension input
2. Add logging to `webviewProvider.handleGenerateExecuteCommand()` and `commandGenerator.generateExecuteCommand()`

### Known Risk
- Tasks with same heading level as parent (e.g., `### R1.5.3` alongside `### R1.5`) may have parsing issues
- Task with no content may cause click target to resolve to parent

---

## OpenCode Execution Fix

### Problem
`executeTaskWithOpenCode` hardcoded model `minimax/MiniMax-M2.5` instead of reading from settings.

### Fix Location
`src/services/claudeService.ts:182`

```typescript
const model = workspacePath
  ? (await this.settingsService.getModel(workspacePath) || 'minimax/MiniMax-M2.5')
  : 'minimax/MiniMax-M2.5';
```

---

## Compilation

```bash
npm.cmd run compile  # Full build (tsc + webpack)
```

---

## Architecture Notes

- **Webview**: React 18, bundled separately via webpack (`resources/bundle.js`)
- **Extension**: CommonJS, bundled via webpack (`out/extension.js`)
- **Two TSConfigs**: `tsconfig.json` (extension), `tsconfig.webview.json` (React)
- **WebviewProvider**: Central message handler, routes 30+ message types to handlers

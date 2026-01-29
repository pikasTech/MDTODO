import * as vscode from 'vscode';
import * as path from 'path';

// ============================================
// 日志文件单例模式 - R54.6.5
// 一次插件生命周期共享一个 .jsonl 文件
// ============================================

let _sessionLogFilename: string | null = null;
let _sessionTodoFilePath: string | null = null;

/**
 * 初始化会话日志文件名（在插件 activate 时调用）
 * 使用启动时的时间戳，生命周期内只生成一个文件
 * @param todoFilePath TODO文件路径（用于生成文件名）
 */
export function initializeSessionLogFilename(todoFilePath: string): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const seconds = String(now.getSeconds()).padStart(2, '0');
  const timestamp = `${year}${month}${day}T${hours}${minutes}${seconds}`;

  // Extract filename without extension
  const filename = path.basename(todoFilePath, path.extname(todoFilePath));
  _sessionLogFilename = `${timestamp}_${filename}.jsonl`;
  _sessionTodoFilePath = todoFilePath;

  console.log(`[LogService] Session log filename initialized: ${_sessionLogFilename}`);
  return _sessionLogFilename;
}

/**
 * 获取当前会话的日志文件名
 * @returns 当前会话的日志文件名，如果未初始化则返回 null
 */
export function getSessionLogFilename(): string | null {
  return _sessionLogFilename;
}

/**
 * 获取当前会话的TODO文件路径
 * @returns 当前会话的TODO文件路径，如果未初始化则返回 null
 */
export function getSessionTodoFilePath(): string | null {
  return _sessionTodoFilePath;
}

/**
 * 重置会话日志状态（用于测试）
 */
export function resetSessionLogState(): void {
  _sessionLogFilename = null;
  _sessionTodoFilePath = null;
}

/**
 * Get the logs directory path (.vscode/mdtodo/logs/)
 * @param workspacePath The workspace root path
 * @returns The absolute path to the logs directory
 */
export function getLogsDirectoryPath(workspacePath: string): string {
  return path.join(workspacePath, '.vscode', 'mdtodo', 'logs');
}

/**
 * Generate a log filename with timestamp and task ID
 * Format: yyyyMMdd_HHmmss_MDTODO_R54.5.jsonl
 * @param taskId The MDTODO task ID (e.g., R54.5)
 * @returns The generated log filename
 */
export function generateLogFilename(taskId: string): string {
  const now = new Date();
  const timestamp = now
    .toISOString()
    .replace(/[-:T]/g, '')
    .split('.')[0];
  const cleanTaskId = taskId.replace(/\./g, '_');
  return `${timestamp}_MDTODO_${cleanTaskId}.jsonl`;
}

/**
 * Generate a TODO-based log filename (kept for backward compatibility and testing)
 * Format: YYYYMMDDTHHMMss_{TODO文件名}.jsonl (e.g., 20260129T105500_软著数据仿真.jsonl)
 * Note: R54.6.5 now uses session-based filename instead of generating new one each time
 * @param todoFilePath The full path to the TODO file
 * @returns The generated log filename with TODO-based naming
 */
export function generateTodoBasedFilename(todoFilePath: string): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const seconds = String(now.getSeconds()).padStart(2, '0');
  const timestamp = `${year}${month}${day}T${hours}${minutes}${seconds}`;

  // Extract filename without extension
  const filename = path.basename(todoFilePath, path.extname(todoFilePath));
  return `${timestamp}_${filename}.jsonl`;
}

/**
 * Ensure the logs directory exists, creating it if necessary
 * @param logsDir The logs directory path
 * @returns Promise that resolves when directory is created
 */
export async function ensureLogsDirectory(logsDir: string): Promise<void> {
  try {
    await vscode.workspace.fs.createDirectory(vscode.Uri.file(logsDir));
    console.log(`[LogService] Created logs directory: ${logsDir}`);
  } catch (error: unknown) {
    // Ignore error if directory already exists (EEXIST error code may vary)
    const err = error as Error & { code?: string };
    if (err.code !== 'EEXIST') {
      console.error(`[LogService] Failed to create logs directory: ${logsDir}`, error);
      // Try to continue anyway - maybe directory exists
    }
  }
}

/**
 * Log entry structure for task-based logging (backward compatible)
 */
export interface LogEntry {
  timestamp: string;
  taskId: string;
  filePath: string;
  action: string;
  details: Record<string, unknown>;
}

/**
 * Unified log entry structure for TODO-based logging
 */
export interface UnifiedLogEntry {
  timestamp: string;
  eventType: 'lifecycle' | 'task' | 'error' | 'file';
  event: string;
  details: Record<string, unknown>;
}

/**
 * Write a log entry to the JSONL log file (task-based, APPEND mode)
 * @param logsDir The logs directory path
 * @param taskId The MDTODO task ID (e.g., R54.5)
 * @param entry The log entry object to write
 * @returns Promise that resolves when the entry is written
 */
export async function writeLogEntry(
  logsDir: string,
  taskId: string,
  entry: Omit<LogEntry, 'timestamp' | 'taskId'>
): Promise<void> {
  const filename = generateLogFilename(taskId);
  const filePath = path.join(logsDir, filename);

  const fullEntry: LogEntry = {
    timestamp: new Date().toISOString(),
    taskId,
    filePath: entry.filePath,
    action: entry.action,
    details: entry.details,
  };

  const line = JSON.stringify(fullEntry) + '\n';

  try {
    // Read existing content first, then append
    const uri = vscode.Uri.file(filePath);
    let existingContent: Uint8Array = new Uint8Array(0);
    try {
      existingContent = await vscode.workspace.fs.readFile(uri);
    } catch (readError: unknown) {
      // File doesn't exist yet, ignore
    }

    // Combine existing content with new line
    const encoder = new TextEncoder();
    const newLineBytes = encoder.encode(line);
    const newContent = new Uint8Array(existingContent.length + newLineBytes.length);
    newContent.set(existingContent, 0);
    newContent.set(newLineBytes, existingContent.length);

    await vscode.workspace.fs.writeFile(uri, newContent as Uint8Array);
    console.log(`[LogService] Written log entry to: ${filePath}`);
  } catch (error) {
    console.error(`[LogService] Failed to write log entry: ${filePath}`, error);
    throw error;
  }
}

/**
 * Write a unified log entry to a TODO-based log file (APPEND mode)
 * R54.6.5: 使用会话单例文件名，一次生命周期共享一个 .jsonl
 * @param logsDir The logs directory path
 * @param todoFilePath The full path to the TODO file (used for filename generation, now uses session filename)
 * @param entry The unified log entry to write
 * @returns Promise that resolves when the entry is written
 */
export async function writeUnifiedLogEntry(
  logsDir: string,
  todoFilePath: string,
  entry: Omit<UnifiedLogEntry, 'timestamp'>
): Promise<void> {
  // R54.6.5: 使用会话单例文件名
  const filename = _sessionLogFilename || generateTodoBasedFilename(todoFilePath);
  const filePath = path.join(logsDir, filename);

  // 如果尚未初始化会话文件名，则初始化（向后兼容）
  if (!_sessionLogFilename) {
    initializeSessionLogFilename(todoFilePath);
  }

  const fullEntry: UnifiedLogEntry = {
    timestamp: new Date().toISOString(),
    eventType: entry.eventType,
    event: entry.event,
    details: entry.details,
  };

  const line = JSON.stringify(fullEntry) + '\n';

  try {
    // Read existing content first, then append
    const uri = vscode.Uri.file(filePath);
    let existingContent: Uint8Array = new Uint8Array(0);
    try {
      existingContent = await vscode.workspace.fs.readFile(uri);
    } catch (readError: unknown) {
      // File doesn't exist yet, ignore
    }

    // Combine existing content with new line
    const encoder = new TextEncoder();
    const newLineBytes = encoder.encode(line);
    const newContent = new Uint8Array(existingContent.length + newLineBytes.length);
    newContent.set(existingContent, 0);
    newContent.set(newLineBytes, existingContent.length);

    await vscode.workspace.fs.writeFile(uri, newContent as Uint8Array);
    console.log(`[LogService] Written unified log entry to: ${filePath}`);
  } catch (error) {
    console.error(`[LogService] Failed to write unified log entry: ${filePath}`, error);
    throw error;
  }
}

/**
 * Helper function to create and write a log entry in one call (backward compatible)
 * @param workspacePath The workspace root path
 * @param taskId The MDTODO task ID
 * @param filePath Path to the TODO file
 * @param action Action type (execute, complete, etc.)
 * @param details Additional details object
 */
export async function logAction(
  workspacePath: string,
  taskId: string,
  filePath: string,
  action: string,
  details: Record<string, unknown> = {}
): Promise<void> {
  const logsDir = getLogsDirectoryPath(workspacePath);
  await ensureLogsDirectory(logsDir);
  await writeLogEntry(logsDir, taskId, { filePath, action, details });
}

/**
 * Log a plugin lifecycle event
 * @param logsDir The logs directory path
 * @param todoFilePath The full path to the TODO file (used for filename generation)
 * @param event Event name (activate, deactivate, fileLoaded, panelOpened, panelClosed)
 * @param details Additional details object
 */
export async function logPluginLifecycle(
  logsDir: string,
  todoFilePath: string,
  event: string,
  details: Record<string, unknown> = {}
): Promise<void> {
  await writeUnifiedLogEntry(logsDir, todoFilePath, {
    eventType: 'lifecycle',
    event,
    details: {
      source: 'plugin',
      ...details,
    },
  });
}

/**
 * Log an error event
 * @param logsDir The logs directory path
 * @param todoFilePath The full path to the TODO file (used for filename generation)
 * @param error The error object to log
 * @param context Context information where the error occurred
 */
export async function logError(
  logsDir: string,
  todoFilePath: string,
  error: Error,
  context: string
): Promise<void> {
  await writeUnifiedLogEntry(logsDir, todoFilePath, {
    eventType: 'error',
    event: 'errorOccurred',
    details: {
      source: 'plugin',
      context,
      errorMessage: error.message,
      errorStack: error.stack,
    },
  });
}

/**
 * Log a task event
 * @param logsDir The logs directory path
 * @param todoFilePath The full path to the TODO file (used for filename generation)
 * @param taskId The task ID (e.g., R54.6.1)
 * @param event Event name (taskExecute, taskComplete, taskSelect, taskCreate, taskDelete)
 * @param details Additional details object
 */
export async function logTaskEvent(
  logsDir: string,
  todoFilePath: string,
  taskId: string,
  event: string,
  details: Record<string, unknown> = {}
): Promise<void> {
  await writeUnifiedLogEntry(logsDir, todoFilePath, {
    eventType: 'task',
    event,
    details: {
      taskId,
      ...details,
    },
  });
}

/**
 * Log a file operation event
 * @param logsDir The logs directory path
 * @param todoFilePath The full path to the TODO file (used for filename generation)
 * @param event Event name (fileParse, fileRefresh, fileWatch, fileChange)
 * @param details Additional details object
 */
export async function logFileEvent(
  logsDir: string,
  todoFilePath: string,
  event: string,
  details: Record<string, unknown> = {}
): Promise<void> {
  await writeUnifiedLogEntry(logsDir, todoFilePath, {
    eventType: 'file',
    event,
    details: {
      filePath: todoFilePath,
      ...details,
    },
  });
}

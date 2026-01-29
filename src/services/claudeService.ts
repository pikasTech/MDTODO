import * as vscode from 'vscode';
import * as path from 'path';
import { spawn, ChildProcess } from 'child_process';
import { platform } from 'os';
import { logTaskEvent, getSessionTodoFilePath, getLogsDirectoryPath, ensureLogsDirectory } from './logService';

export interface ExecutionResult {
  success: boolean;
  output: string;
  error?: string;
}

/**
 * 获取当前工作区的根路径
 */
function getWorkspaceFolderPath(): string | undefined {
  const workspaceFolders = vscode.workspace.workspaceFolders;
  if (workspaceFolders && workspaceFolders.length > 0) {
    // 返回第一个工作区的 URI 路径
    return workspaceFolders[0].uri.fsPath;
  }
  return undefined;
}

/**
 * 将绝对路径转换为相对于工作区的相对路径
 */
function toRelativePath(absolutePath: string, workspacePath: string): string {
  // 尝试使用 path.relative
  let relativePath = path.relative(workspacePath, absolutePath);

  // 确保使用正斜杠，统一路径格式
  relativePath = relativePath.replace(/\\/g, '/');

  return relativePath;
}

/**
 * 【R54.3】生成 Claude 执行命令的参数字符串
 * 返回格式化的任务描述字符串，用于 --dangerously-skip-permissions 参数
 */
export function generateClaudeExecuteArgs(todoFilePath: string, taskId: string): string {
  const workspacePath = getWorkspaceFolderPath();
  let relativePath = todoFilePath;

  if (workspacePath) {
    relativePath = toRelativePath(todoFilePath, workspacePath);
  }

  // 返回 execute 命令的参数部分（不包含 claude 和 --dangerously-skip-permissions）
  return `execute "${relativePath} 中的 ${taskId} 任务"`;
}

export class ClaudeService {
  private outputChannel: vscode.OutputChannel;
  private currentProcess: ChildProcess | undefined;

  constructor() {
    this.outputChannel = vscode.window.createOutputChannel('MDTODO Claude');
  }

  async executeTask(todoFilePath: string, taskId: string): Promise<ExecutionResult> {
    const os = platform();

    this.outputChannel.show();
    this.outputChannel.appendLine(`开始执行任务: ${taskId}`);
    this.outputChannel.appendLine(`文件: ${todoFilePath}`);
    this.outputChannel.appendLine('---');

    try {
      // 获取工作区路径作为工作目录
      const workspacePath = getWorkspaceFolderPath();

      if (workspacePath) {
        this.outputChannel.appendLine(`工作区: ${workspacePath}`);
      } else {
        this.outputChannel.appendLine(`警告: 未找到工作区，使用绝对路径`);
      }

      // 【R54.3】使用命令生成函数获取参数字符串
      const taskDescription = generateClaudeExecuteArgs(todoFilePath, taskId);

      // 【R54.5.2】【R54.6.6】记录任务执行开始日志（使用统一日志系统）
      const fullCommand = `claude --dangerously-skip-permissions ${taskDescription}`;
      if (workspacePath) {
        const logsDir = getLogsDirectoryPath(workspacePath);
        await ensureLogsDirectory(logsDir);
        await logTaskEvent(logsDir, todoFilePath, taskId, 'taskExecute', {
          command: fullCommand,
          mode: 'new_terminal',
          platform: os
        });
      }

      // 设置 spawn 选项，使用工作区路径作为工作目录
      const spawnOptions: any = {
        detached: true,
        stdio: 'ignore',
        windowsHide: true
      };

      // 如果有工作区路径，设置工作目录
      if (workspacePath) {
        spawnOptions.cwd = workspacePath;
      }

      if (os === 'win32') {
        spawn('cmd.exe', ['/c', 'start', 'cmd.exe', '/k', 'claude', '--dangerously-skip-permissions', taskDescription], spawnOptions);
      } else if (os === 'darwin') {
        spawn('open', ['-a', 'Terminal', '--args', 'claude', '--dangerously-skip-permissions', taskDescription], spawnOptions);
      } else {
        spawn('xterm', ['-e', 'claude', '--dangerously-skip-permissions', taskDescription], spawnOptions);
      }

      return {
        success: true,
        output: `任务 ${taskId} 已提交执行，请查看新打开的终端窗口`
      };
    } catch (error: any) {
      return {
        success: false,
        output: '',
        error: error.message
      };
    }
  }

  async executeTaskInTerminal(todoFilePath: string, taskId: string): Promise<void> {
    // 【R54.3】使用命令生成函数获取参数字符串
    const taskDescription = generateClaudeExecuteArgs(todoFilePath, taskId);

    // 组合完整的命令
    const command = `claude --dangerously-skip-permissions ${taskDescription}`;

    // 【R54.5.2】【R54.6.6】记录任务执行开始日志（使用统一日志系统）
    const workspacePath = getWorkspaceFolderPath();
    if (workspacePath) {
      const logsDir = getLogsDirectoryPath(workspacePath);
      await ensureLogsDirectory(logsDir);
      await logTaskEvent(logsDir, todoFilePath, taskId, 'taskExecute', {
        command,
        mode: 'terminal'
      });
    }

    const terminal = vscode.window.createTerminal('Claude Code');
    terminal.show();
    terminal.sendText(command);
  }

  terminate(): void {
    if (this.currentProcess) {
      this.currentProcess.kill();
      this.currentProcess = undefined;
    }
  }

  showOutput(): void {
    this.outputChannel.show();
  }
}

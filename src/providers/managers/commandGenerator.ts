import { generateClaudeExecuteArgs } from '../../services/claudeService';

export interface CommandGeneratorOptions {
  currentFilePath: string;
}

export class CommandGenerator {
  private currentFilePath: string;

  constructor(options: CommandGeneratorOptions) {
    this.currentFilePath = options.currentFilePath;
  }

  /**
   * 更新内部状态
   */
  updateState(filePath: string): void {
    this.currentFilePath = filePath;
  }

  /**
   * 生成执行命令并发送回 webview
   */
  generateExecuteCommand(taskId: string): { command: string; taskId: string } | null {
    if (!this.currentFilePath) {
      console.error('[MDTODO] 无法生成命令：currentFilePath 为空');
      return null;
    }

    const taskDescription = generateClaudeExecuteArgs(this.currentFilePath, taskId);
    const command = `claude --dangerously-skip-permissions ${taskDescription}`;

    return {
      command,
      taskId
    };
  }
}

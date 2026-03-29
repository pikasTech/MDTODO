import * as path from 'path';
import { generateClaudeExecuteArgs } from '../../services/claudeService';

export interface CommandGeneratorOptions {
  currentFilePath: string;
}

export interface GenerateCommandOptions {
  executionMode: 'claude' | 'opencode';
  model?: string;
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
   * 生成 OpenCode 格式的 prompt
   */
  private generateOpenCodePrompt(taskId: string): string {
    const relativePath = this.currentFilePath.replace(/\\/g, '/');
    return `${relativePath} 中的 ${taskId} 任务`;
  }

  /**
   * 生成执行命令并发送回 webview
   */
  generateExecuteCommand(taskId: string, options?: GenerateCommandOptions): { command: string; taskId: string } | null {
    if (!this.currentFilePath) {
      console.error('[MDTODO] 无法生成命令：currentFilePath 为空');
      return null;
    }

    const executionMode = options?.executionMode || 'claude';
    const model = options?.model;

    let command: string;
    if (executionMode === 'opencode') {
      const modelArg = model ? ` --model ${model}` : '';
      const prompt = this.generateOpenCodePrompt(taskId);
      command = `opencode${modelArg} --prompt "${prompt}"`;
    } else {
      const taskDescription = generateClaudeExecuteArgs(this.currentFilePath, taskId);
      command = `claude --dangerously-skip-permissions ${taskDescription}`;
    }

    return {
      command,
      taskId
    };
  }
}

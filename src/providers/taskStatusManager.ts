import * as vscode from 'vscode';
import * as fs from 'fs';
import { TodoTask } from '../types';
import { FileService } from '../services/fileService';

/**
 * 任务状态管理器 - 处理任务的完成状态和进行中状态的设置
 * 【R56.4】从 webviewProvider.ts 的状态相关方法提取
 */
export class TaskStatusManager {
  private currentFilePath: string;
  private currentTasks: TodoTask[];

  constructor() {
    this.currentFilePath = '';
    this.currentTasks = [];
  }

  /**
   * 更新内部状态
   */
  updateState(currentFilePath: string, currentTasks: TodoTask[]): void {
    this.currentFilePath = currentFilePath;
    this.currentTasks = currentTasks;
  }

  /**
   * 设置任务的 [in_progress] 状态
   */
  async markTaskAsProcessing(taskId: string, isProcessing: boolean): Promise<void> {
    const fileService = new FileService();
    const content = await fileService.readFile(vscode.Uri.file(this.currentFilePath));
    const lines = content.split('\n');

    // 找到任务所在的行（必须是 ## 或 ### 开头的任务标题行）
    let taskLineIndex = this.findTaskLineIndex(lines, taskId);

    if (taskLineIndex === -1) {
      console.warn(`[MDTODO] 未找到任务 ${taskId}，无法设置 in_progress 状态`);
      return;
    }

    const line = lines[taskLineIndex];
    const hasCompleted = line.includes('[completed]');
    const hasInProgress = line.includes('[in_progress]');

    // 如果已经有 [completed]，不添加 [in_progress]
    if (hasCompleted) {
      console.warn(`[MDTODO] 任务 ${taskId} 已完成，不添加 in_progress 标记`);
      return;
    }

    // 如果状态已经是我们要设置的状态，不做修改
    if (isProcessing && hasInProgress) return;
    if (!isProcessing && !hasInProgress) return;

    // 添加或移除 [in_progress] 标记
    if (isProcessing) {
      const taskIdPattern = new RegExp(`(${taskId.replace(/\./g, '\\.')})(\\s*\\[)`);
      if (taskIdPattern.test(line)) {
        lines[taskLineIndex] = line.replace(taskIdPattern, '$1 [in_progress]$2');
      } else {
        const simplePattern = new RegExp(`(${taskId.replace(/\./g, '\\.')})(\\s*)$`);
        lines[taskLineIndex] = line.replace(simplePattern, '$1 [in_progress]$2');
      }
    } else {
      // 移除 [in_progress] 标记
      lines[taskLineIndex] = line.replace(/\s*\[in_progress\]/, '');
    }

    const newContent = lines.join('\n');
    await fileService.writeFile(vscode.Uri.file(this.currentFilePath), newContent);
    console.log(`[MDTODO] 任务 ${taskId} in_progress状态设置为: ${isProcessing}`);
  }

  /**
   * 设置任务的 [completed] 状态
   * 添加或移除 [completed] 标记，支持处理 [in_progress] 标记
   */
  async markTaskAsFinished(taskId: string, isFinished: boolean): Promise<void> {
    const fileService = new FileService();
    const content = await fileService.readFile(vscode.Uri.file(this.currentFilePath));
    const lines = content.split('\n');

    // 找到任务所在的行
    let taskLineIndex = this.findTaskLineIndex(lines, taskId);

    if (taskLineIndex === -1) {
      console.warn(`[MDTODO] 未找到任务 ${taskId}，无法设置 completed 状态`);
      return;
    }

    const line = lines[taskLineIndex];
    const hasCompleted = line.includes('[completed]');
    const hasInProgress = line.includes('[in_progress]');

    // 如果状态已经是我们要设置的状态，不做修改
    if (isFinished && hasCompleted) return;
    if (!isFinished && !hasCompleted) return;

    // 添加或移除 [completed] 标记
    if (isFinished) {
      let newLine = line;

      // 如果有 [in_progress] 标记，先移除它
      if (hasInProgress) {
        newLine = newLine.replace(/\s*\[in_progress\]/, '');
      }

      // 然后添加 [completed] 标记
      const taskIdPattern = new RegExp(`(${taskId.replace(/\./g, '\\.')})(\\s*)$`);
      newLine = newLine.replace(taskIdPattern, '$1 [completed]');

      lines[taskLineIndex] = newLine;
    } else {
      // 移除 [completed] 标记
      lines[taskLineIndex] = line.replace(/\s*\[completed\]/, '');
    }

    const newContent = lines.join('\n');
    await fileService.writeFile(vscode.Uri.file(this.currentFilePath), newContent);
    console.log(`[MDTODO] 任务 ${taskId} completed状态设置为: ${isFinished}`);
  }

  /**
   * 查找任务所在的行索引
   */
  private findTaskLineIndex(lines: string[], taskId: string): number {
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      // 必须匹配 ## 或 ### 或 #### 开头的任务标题行
      // 格式如: ## R17, ### R17.1, #### R17.1.1, ## R17 [completed]
      const taskHeaderPattern = new RegExp(`^#{2,6}\\s+[^\\n]*\\b${taskId.replace(/\./g, '\\.')}(?:[)\\s]|$)`);
      if (taskHeaderPattern.test(line)) {
        return i;
      }
    }
    return -1;
  }
}

import * as vscode from 'vscode';
import * as path from 'path';
import { TodoTask, TextBlock } from '../../types';
import { FileService } from '../../services/fileService';

export interface TaskFileManagerOptions {
  currentFilePath: string;
  currentTasks: TodoTask[];
  currentTextBlocks: TextBlock[];
  onTasksChanged: (tasks: TodoTask[], textBlocks: TextBlock[], filePath: string) => void;
  onWebviewRefresh: () => void;
}

export class TaskFileManager {
  private currentFilePath: string;
  private currentTasks: TodoTask[];
  private currentTextBlocks: TextBlock[];
  private onTasksChanged: (tasks: TodoTask[], textBlocks: TextBlock[], filePath: string) => void;
  private onWebviewRefresh: () => void;

  constructor(options: TaskFileManagerOptions) {
    this.currentFilePath = options.currentFilePath;
    this.currentTasks = options.currentTasks;
    this.currentTextBlocks = options.currentTextBlocks;
    this.onTasksChanged = options.onTasksChanged;
    this.onWebviewRefresh = options.onWebviewRefresh;
  }

  /**
   * 更新内部状态
   */
  updateState(filePath: string, tasks: TodoTask[], textBlocks: TextBlock[]): void {
    this.currentFilePath = filePath;
    this.currentTasks = tasks;
    this.currentTextBlocks = textBlocks;
  }

  /**
   * 生成新任务的内容模板
   */
  generateNewTaskContent(taskId: string, parentTaskId?: string): string {
    const fileName = path.basename(this.currentFilePath, '.md');
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const timestamp = `${year}${month}${day}_${hours}${minutes}`;
    const reportPath = `./details/${fileName}/${timestamp}_Task_Report.md`;

    const headerLevel = parentTaskId ? '###' : '##';
    return `${headerLevel} ${taskId}\n\n, 完成任务后将详细报告写入[${taskId}](${reportPath})。`;
  }

  /**
   * 获取所有任务ID
   */
  getAllTaskIds(tasks: TodoTask[]): string[] {
    const ids: string[] = [];
    const collectIds = (taskList: TodoTask[]) => {
      for (const task of taskList) {
        ids.push(task.id);
        if (task.children && task.children.length > 0) {
          collectIds(task.children);
        }
      }
    };
    collectIds(tasks);
    return ids;
  }

  /**
   * 生成新的任务ID
   */
  generateNewTaskId(existingIds: string[], parentId?: string): string {
    if (parentId) {
      const childIds = existingIds
        .filter(id => id.startsWith(parentId + '.'))
        .map(id => {
          const match = id.match(new RegExp(`^${parentId}\\.(\\d+)$`));
          return match ? parseInt(match[1]) : 0;
        })
        .filter(n => n > 0);
      const maxChild = childIds.length > 0 ? Math.max(...childIds) : 0;
      return `${parentId}.${maxChild + 1}`;
    } else {
      const mainIds = existingIds
        .filter(id => /^[Rr]\d+$/.test(id))
        .map(id => {
          const match = id.match(/^R(\d+)$/i);
          return match ? parseInt(match[1]) : 0;
        });
      const maxMain = mainIds.length > 0 ? Math.max(...mainIds) : 0;
      return `R${maxMain + 1}`;
    }
  }

  /**
   * 查找任务
   */
  findTask(tasks: TodoTask[], taskId: string): TodoTask | undefined {
    for (const task of tasks) {
      if (task.id === taskId) {
        return task;
      }
      if (task.children.length > 0) {
        const found = this.findTask(task.children, taskId);
        if (found) return found;
      }
    }
    return undefined;
  }

  /**
   * 处理添加任务
   */
  async handleAddTask(): Promise<string | null> {
    if (!this.currentFilePath) {
      vscode.window.showWarningMessage('请先打开一个TODO文件');
      return null;
    }

    const allTaskIds = this.getAllTaskIds(this.currentTasks);
    const newId = this.generateNewTaskId(allTaskIds);
    const newTaskContent = this.generateNewTaskContent(newId);

    try {
      const fileService = new FileService();
      const content = await fileService.readFile(vscode.Uri.file(this.currentFilePath));
      const lines = content.split('\n');

      let lastTaskEnd = lines.length;
      for (let i = lines.length - 1; i >= 0; i--) {
        const line = lines[i].trim();
        if (line.match(/^##+\s+/) && line.match(/R\d+(?:\.\d+)*/)) {
          lastTaskEnd = i;
          for (let j = i + 1; j < lines.length; j++) {
            const nextLine = lines[j].trim();
            if (nextLine.match(/^##+\s+/) && nextLine.match(/R\d+(?:\.\d+)*/)) {
              lastTaskEnd = j;
              break;
            }
            if (j === lines.length - 1) {
              lastTaskEnd = lines.length;
            }
          }
          break;
        }
      }

      lines.splice(lastTaskEnd, 0, newTaskContent);
      const newContent = lines.join('\n');
      await fileService.writeFile(vscode.Uri.file(this.currentFilePath), newContent);

      return newId;
    } catch (error: any) {
      console.error('[MDTODO] Error adding task:', error);
      vscode.window.showErrorMessage(`添加任务失败: ${error.message}`);
      return null;
    }
  }

  /**
   * 处理删除任务
   */
  async handleDeleteTask(taskId: string): Promise<boolean> {
    if (!this.currentFilePath) {
      vscode.window.showWarningMessage('请先打开一个TODO文件');
      return false;
    }

    try {
      const fileService = new FileService();
      const content = await fileService.readFile(vscode.Uri.file(this.currentFilePath));
      const lines = content.split('\n');

      let startLine = -1;
      let endLine = -1;
      let taskLevel = 0;

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        const taskPattern = new RegExp(`^##+\\s+[^\\n]*\\b${taskId.replace(/\./g, '\\.')}(?:[)\\s]|$)`);
        if (taskPattern.test(line)) {
          startLine = i;
          const match = line.match(/^(#+)/);
          taskLevel = match ? match[1].length : 2;
          for (let j = i + 1; j < lines.length; j++) {
            const nextLine = lines[j].trim();
            if (nextLine.match(/^##+\s+/) && nextLine.match(/R\d+(?:\.\d+)*/)) {
              const nextMatch = nextLine.match(/^(#+)/);
              const nextLevel = nextMatch ? nextMatch[1].length : 2;
              if (nextLevel <= taskLevel) {
                endLine = j;
                break;
              }
            }
          }
          if (endLine === -1) {
            endLine = lines.length;
          }
          break;
        }
      }

      if (startLine === -1) {
        vscode.window.showWarningMessage(`未找到任务 ${taskId}`);
        return false;
      }

      lines.splice(startLine, endLine - startLine);
      const newContent = lines.join('\n');
      await fileService.writeFile(vscode.Uri.file(this.currentFilePath), newContent);

      vscode.window.showInformationMessage(`任务 ${taskId} 已删除`);
      return true;
    } catch (error: any) {
      console.error('[MDTODO] Error deleting task:', error);
      vscode.window.showErrorMessage(`删除任务失败: ${error.message}`);
      return false;
    }
  }

  /**
   * 处理添加子任务
   */
  async handleAddSubTask(parentTaskId: string): Promise<string | null> {
    if (!this.currentFilePath) {
      vscode.window.showWarningMessage('请先打开一个TODO文件');
      return null;
    }

    const allTaskIds = this.getAllTaskIds(this.currentTasks);
    const newId = this.generateNewTaskId(allTaskIds, parentTaskId);
    const newTaskContent = this.generateNewTaskContent(newId, parentTaskId);

    try {
      const fileService = new FileService();
      const content = await fileService.readFile(vscode.Uri.file(this.currentFilePath));
      const lines = content.split('\n');

      let parentLine = -1;
      let parentLevel = 0;
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (line.includes(parentTaskId)) {
          parentLine = i;
          const match = line.match(/^(#+)/);
          parentLevel = match ? match[1].length : 2;
          break;
        }
      }

      if (parentLine === -1) {
        vscode.window.showWarningMessage(`未找到父任务 ${parentTaskId}`);
        return null;
      }

      let insertPos = -1;
      for (let j = parentLine + 1; j < lines.length; j++) {
        const line = lines[j].trim();
        if (line.match(/^##+\s+/)) {
          const match = line.match(/^(#+)/);
          const level = match ? match[1].length : 2;
          if (level <= parentLevel) {
            insertPos = j;
            break;
          }
        }
      }
      if (insertPos === -1) {
        insertPos = lines.length;
      }

      lines.splice(insertPos, 0, newTaskContent);
      const newContent = lines.join('\n');
      await fileService.writeFile(vscode.Uri.file(this.currentFilePath), newContent);

      return newId;
    } catch (error: any) {
      console.error('[MDTODO] Error adding subtask:', error);
      vscode.window.showErrorMessage(`添加子任务失败: ${error.message}`);
      return null;
    }
  }

  /**
   * 处理延续任务
   */
  async handleContinueTask(currentTaskId: string): Promise<string | null> {
    if (!this.currentFilePath) {
      vscode.window.showWarningMessage('请先打开一个TODO文件');
      return null;
    }

    const allTaskIds = this.getAllTaskIds(this.currentTasks);
    const parts = currentTaskId.split('.');
    if (parts.length < 2) {
      vscode.window.showWarningMessage('延续任务只能在子任务上使用');
      return null;
    }

    const parentId = parts.slice(0, -1).join('.');
    const newId = this.generateNewTaskId(allTaskIds, parentId);
    const newTaskContent = this.generateNewTaskContent(newId, parentId);

    try {
      const fileService = new FileService();
      const content = await fileService.readFile(vscode.Uri.file(this.currentFilePath));
      const lines = content.split('\n');

      let currentLine = -1;
      let currentLevel = 0;
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        const taskPattern = new RegExp(`^#{2,6}\\s+[^\\n]*\\b${currentTaskId.replace(/\./g, '\\.')}(?:[)\\s]|$)`);
        if (taskPattern.test(line)) {
          currentLine = i;
          const match = line.match(/^(#+)/);
          currentLevel = match ? match[1].length : 2;
          break;
        }
      }

      if (currentLine === -1) {
        vscode.window.showWarningMessage(`未找到任务 ${currentTaskId}`);
        return null;
      }

      let insertPos = -1;
      for (let j = currentLine + 1; j < lines.length; j++) {
        const line = lines[j].trim();
        if (line.match(/^##+\s+/)) {
          const match = line.match(/^(#+)/);
          const level = match ? match[1].length : 2;
          if (level <= currentLevel) {
            insertPos = j;
            break;
          }
        }
      }
      if (insertPos === -1) {
        insertPos = lines.length;
      }

      lines.splice(insertPos, 0, newTaskContent);
      const newContent = lines.join('\n');
      await fileService.writeFile(vscode.Uri.file(this.currentFilePath), newContent);

      return newId;
    } catch (error: any) {
      console.error('[MDTODO] Error continuing task:', error);
      vscode.window.showErrorMessage(`延续任务失败: ${error.message}`);
      return null;
    }
  }

  /**
   * 处理保存标题
   */
  async handleSaveTitle(taskId: string, newTitle: string): Promise<boolean> {
    if (!this.currentFilePath) {
      vscode.window.showWarningMessage('请先打开一个TODO文件');
      return false;
    }

    try {
      const fileService = new FileService();
      const content = await fileService.readFile(vscode.Uri.file(this.currentFilePath));
      const lines = content.split('\n');

      let taskLineIndex = -1;
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        const taskPattern = new RegExp(`^##+\\s+[^\\n]*\\b${taskId.replace(/\./g, '\\.')}(?:[)\\s]|$)`);
        if (taskPattern.test(line)) {
          taskLineIndex = i;
          break;
        }
      }

      if (taskLineIndex === -1) {
        vscode.window.showWarningMessage(`未找到任务 ${taskId}`);
        return false;
      }

      let contentEndIndex = lines.length;
      let subtaskStartIndex = -1;
      for (let i = taskLineIndex + 1; i < lines.length; i++) {
        const line = lines[i].trim();
        const taskHeaderMatch = line.match(/^##+\s+([^R]*R\d+(?:\.\d+)*)/);
        if (taskHeaderMatch) {
          const nextTaskId = taskHeaderMatch[1];
          if (subtaskStartIndex === -1 && nextTaskId.startsWith(taskId + '.')) {
            subtaskStartIndex = i;
          }
          if (!nextTaskId.startsWith(taskId + '.')) {
            contentEndIndex = i;
            break;
          }
        }
      }

      const newLines: string[] = [];
      for (let i = 0; i <= taskLineIndex; i++) {
        newLines.push(lines[i]);
      }

      if (newTitle.trim()) {
        const taskLineEndsWithNewline = lines[taskLineIndex].endsWith('\n');
        if (!taskLineEndsWithNewline && newLines[newLines.length - 1] === lines[taskLineIndex]) {
          newLines.push('');
        } else if (taskLineEndsWithNewline && newLines.length > 0 && newLines[newLines.length - 1] === '') {
        } else {
          newLines.push('');
        }

        newLines.push(newTitle);
        newLines.push('');

        if (subtaskStartIndex !== -1 && subtaskStartIndex < contentEndIndex) {
          for (let i = subtaskStartIndex; i < contentEndIndex; i++) {
            newLines.push(lines[i]);
          }
        }
      }

      for (let i = contentEndIndex; i < lines.length; i++) {
        newLines.push(lines[i]);
      }

      const newContent = newLines.join('\n');
      await fileService.writeFile(vscode.Uri.file(this.currentFilePath), newContent);

      return true;
    } catch (error: any) {
      console.error('[MDTODO] Error saving title:', error);
      vscode.window.showErrorMessage(`保存标题失败: ${error.message}`);
      return false;
    }
  }

  /**
   * 处理保存文本块
   */
  async handleSaveTextBlock(blockId: string, newContent: string): Promise<boolean> {
    if (!this.currentFilePath) {
      vscode.window.showWarningMessage('请先打开一个TODO文件');
      return false;
    }

    try {
      const fileService = new FileService();
      const content = await fileService.readFile(vscode.Uri.file(this.currentFilePath));
      const lines = content.split('\n');

      const lineNumber = parseInt(blockId.replace('text-', ''));
      if (isNaN(lineNumber)) {
        vscode.window.showWarningMessage(`无效的文本块ID: ${blockId}`);
        return false;
      }

      let firstTaskLine = -1;
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        const isHeading = line.match(/^#{2,}\s/);
        const hasRxx = /#{1,6}\s+.*R\d+(?:\.\d+)*/.test(line);
        if (isHeading && hasRxx) {
          firstTaskLine = i;
          break;
        }
      }

      const blockStartIndex = lineNumber;
      const blockEndIndex = firstTaskLine > 0 ? firstTaskLine : lines.length;

      const newLines: string[] = [];
      for (let i = 0; i < blockStartIndex; i++) {
        newLines.push(lines[i]);
      }

      const newContentLines = newContent.split('\n');
      for (const line of newContentLines) {
        newLines.push(line);
      }

      for (let i = blockEndIndex; i < lines.length; i++) {
        newLines.push(lines[i]);
      }

      const newFileContent = newLines.join('\n');
      await fileService.writeFile(vscode.Uri.file(this.currentFilePath), newFileContent);

      return true;
    } catch (error: any) {
      console.error('[MDTODO] Error saving text block:', error);
      vscode.window.showErrorMessage(`保存文本块失败: ${error.message}`);
      return false;
    }
  }
}

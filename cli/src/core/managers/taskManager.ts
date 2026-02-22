import * as path from 'path';
import { TodoTask, TextBlock } from '../types';
import { FileService } from '../services/fileService';
import { TodoParser } from '../parser';

export interface TaskManagerOptions {
  filePath: string;
  tasks: TodoTask[];
  textBlocks: TextBlock[];
}

export interface TaskOperationResult {
  success: boolean;
  message: string;
  taskId?: string;
}

export class TaskManager {
  private filePath: string;
  private tasks: TodoTask[];
  private textBlocks: TextBlock[];
  private fileService: FileService;
  private parser: TodoParser;

  constructor(options: TaskManagerOptions) {
    this.filePath = options.filePath;
    this.tasks = options.tasks;
    this.textBlocks = options.textBlocks;
    this.fileService = new FileService();
    this.parser = new TodoParser();
  }

  /**
   * Reload tasks from file
   */
  reload(): void {
    const result = this.parser.parseFile(this.filePath);
    this.tasks = result.tasks;
    this.textBlocks = result.textBlocks || [];
  }

  /**
   * Get all tasks
   */
  getTasks(): TodoTask[] {
    return this.tasks;
  }

  /**
   * Get task by ID
   */
  getTask(taskId: string): TodoTask | undefined {
    return this.findTask(this.tasks, taskId);
  }

  /**
   * Get all task IDs
   */
  getAllTaskIds(): string[] {
    const ids: string[] = [];
    const collectIds = (taskList: TodoTask[]) => {
      for (const task of taskList) {
        ids.push(task.id);
        if (task.children && task.children.length > 0) {
          collectIds(task.children);
        }
      }
    };
    collectIds(this.tasks);
    return ids;
  }

  /**
   * Generate new task ID
   */
  generateNewTaskId(parentId?: string): string {
    const allIds = this.getAllTaskIds();

    if (parentId) {
      const childIds = allIds
        .filter(id => id.startsWith(parentId + '.'))
        .map(id => {
          const match = id.match(new RegExp(`^${parentId}\\.(\\d+)$`));
          return match ? parseInt(match[1]) : 0;
        })
        .filter(n => n > 0);
      const maxChild = childIds.length > 0 ? Math.max(...childIds) : 0;
      return `${parentId}.${maxChild + 1}`;
    } else {
      const mainIds = allIds
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
   * Generate new task content template
   */
  generateNewTaskContent(taskId: string, parentTaskId?: string): string {
    const fileName = path.basename(this.filePath, '.md');
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
   * Find task recursively
   */
  private findTask(tasks: TodoTask[], taskId: string): TodoTask | undefined {
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
   * Add a new task
   */
  addTask(): TaskOperationResult {
    try {
      const newId = this.generateNewTaskId();
      const newTaskContent = this.generateNewTaskContent(newId);

      const content = this.fileService.readFile(this.filePath);
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
      this.fileService.writeFile(this.filePath, newContent);

      // Reload tasks
      this.reload();

      return {
        success: true,
        message: `任务 ${newId} 添加成功`,
        taskId: newId
      };
    } catch (error: any) {
      return {
        success: false,
        message: `添加任务失败: ${error.message}`
      };
    }
  }

  /**
   * Add a subtask
   */
  addSubTask(parentTaskId: string): TaskOperationResult {
    try {
      const newId = this.generateNewTaskId(parentTaskId);
      const newTaskContent = this.generateNewTaskContent(newId, parentTaskId);

      const content = this.fileService.readFile(this.filePath);
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
        return {
          success: false,
          message: `未找到父任务 ${parentTaskId}`
        };
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
      this.fileService.writeFile(this.filePath, newContent);

      this.reload();

      return {
        success: true,
        message: `子任务 ${newId} 添加成功`,
        taskId: newId
      };
    } catch (error: any) {
      return {
        success: false,
        message: `添加子任务失败: ${error.message}`
      };
    }
  }

  /**
   * Delete a task
   */
  deleteTask(taskId: string): TaskOperationResult {
    try {
      const content = this.fileService.readFile(this.filePath);
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
        return {
          success: false,
          message: `未找到任务 ${taskId}`
        };
      }

      lines.splice(startLine, endLine - startLine);
      const newContent = lines.join('\n');
      this.fileService.writeFile(this.filePath, newContent);

      this.reload();

      return {
        success: true,
        message: `任务 ${taskId} 已删除`
      };
    } catch (error: any) {
      return {
        success: false,
        message: `删除任务失败: ${error.message}`
      };
    }
  }

  /**
   * Update task title
   */
  updateTaskTitle(taskId: string, newTitle: string): TaskOperationResult {
    try {
      const content = this.fileService.readFile(this.filePath);
      const lines = content.split('\n');

      let taskLineIndex = -1;
      let taskLevel = 0;

      // Find the task line
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        // Match task header: ## or ### followed by space and task ID
        const taskPattern = new RegExp(`^#+\\s+${taskId.replace(/\./g, '\\.')}(?:\\s|$)`);
        if (taskPattern.test(line)) {
          taskLineIndex = i;
          const match = line.match(/^(#+)/);
          taskLevel = match ? match[1].length : 2;
          break;
        }
      }

      if (taskLineIndex === -1) {
        return {
          success: false,
          message: `未找到任务 ${taskId}`
        };
      }

      // Build the new task line
      const hashes = '#'.repeat(taskLevel);
      const newTaskLine = `${hashes} ${taskId} ${newTitle}`;

      // Update the line
      lines[taskLineIndex] = newTaskLine;

      const newContent = lines.join('\n');
      this.fileService.writeFile(this.filePath, newContent);

      this.reload();

      return {
        success: true,
        message: `任务 ${taskId} 已更新`
      };
    } catch (error: any) {
      return {
        success: false,
        message: `更新任务失败: ${error.message}`
      };
    }
  }

  /**
   * Mark task as completed
   */
  markComplete(taskId: string): TaskOperationResult {
    return this.updateTaskStatus(taskId, true, false);
  }

  /**
   * Mark task as in progress
   */
  markInProgress(taskId: string): TaskOperationResult {
    return this.updateTaskStatus(taskId, false, true);
  }

  /**
   * Mark task as not started (remove completed/in_progress status)
   */
  markNotStarted(taskId: string): TaskOperationResult {
    return this.updateTaskStatus(taskId, false, false);
  }

  private updateTaskStatus(taskId: string, completed: boolean, processing: boolean): TaskOperationResult {
    try {
      const content = this.fileService.readFile(this.filePath);
      const lines = content.split('\n');

      let taskLineIndex = -1;
      let taskLevel = 0;

      // Find the task line
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        // Match task header: ## or ### followed by space and task ID
        // Task ID should be followed by space, end of line, or non-dot/non-alphanumeric
        const taskPattern = new RegExp(`^#+\\s+${taskId.replace(/\./g, '\\.')}(?:\\s|$)`);
        if (taskPattern.test(line)) {
          taskLineIndex = i;
          const match = line.match(/^(#+)/);
          taskLevel = match ? match[1].length : 2;
          break;
        }
      }

      if (taskLineIndex === -1) {
        return {
          success: false,
          message: `未找到任务 ${taskId}`
        };
      }

      // Remove existing status markers from this line
      let newLine = lines[taskLineIndex]
        .replace(/\s*\[completed\]/, '')
        .replace(/\s*\[in_progress\]/, '')
        .trim();

      // Add new status marker
      const statusMarker = completed ? '[completed]' : processing ? '[in_progress]' : '';
      if (statusMarker) {
        newLine = `${newLine} ${statusMarker}`;
      }

      lines[taskLineIndex] = newLine;

      const newContent = lines.join('\n');
      this.fileService.writeFile(this.filePath, newContent);
      this.reload();

      const statusText = completed ? '已完成' : processing ? '进行中' : '未开始';
      return {
        success: true,
        message: `任务 ${taskId} 状态已更新为: ${statusText}`
      };
    } catch (error: any) {
      return {
        success: false,
        message: `更新任务状态失败: ${error.message}`
      };
    }
  }

  /**
   * Get task count statistics
   */
  getStats(): { total: number; completed: number; inProgress: number; pending: number } {
    let total = 0;
    let completed = 0;
    let inProgress = 0;

    const count = (tasks: TodoTask[]) => {
      for (const task of tasks) {
        total++;
        if (task.completed) completed++;
        else if (task.processing) inProgress++;
        if (task.children.length > 0) {
          count(task.children);
        }
      }
    };

    count(this.tasks);

    return {
      total,
      completed,
      inProgress,
      pending: total - completed - inProgress
    };
  }
}

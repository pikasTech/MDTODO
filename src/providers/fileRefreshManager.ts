import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import { TodoTask, TextBlock } from '../types';

/**
 * 文件刷新管理器 - 处理文件的定期刷新和链接状态检查
 * 【R56.4】从 webviewProvider.ts 的刷新相关方法提取
 */
export class FileRefreshManager {
  private currentFilePath: string;
  private currentTasks: TodoTask[];
  private currentTextBlocks: TextBlock[];
  private refreshTimer: ReturnType<typeof setInterval> | undefined;
  private lastFileContent: string;
  private loadFileCallback: ((filePath: string) => Promise<boolean>) | undefined;
  private sendToWebviewCallback: (() => void) | undefined;

  constructor() {
    this.currentFilePath = '';
    this.currentTasks = [];
    this.currentTextBlocks = [];
    this.lastFileContent = '';
  }

  /**
   * 设置回调函数
   */
  setCallbacks(
    loadFileCallback: (filePath: string) => Promise<boolean>,
    sendToWebviewCallback: () => void
  ): void {
    this.loadFileCallback = loadFileCallback;
    this.sendToWebviewCallback = sendToWebviewCallback;
  }

  /**
   * 更新内部状态
   */
  updateState(currentFilePath: string, currentTasks: TodoTask[], currentTextBlocks: TextBlock[]): void {
    this.currentFilePath = currentFilePath;
    this.currentTasks = currentTasks;
    this.currentTextBlocks = currentTextBlocks;
  }

  /**
   * 启动定期刷新定时器（1秒周期）
   */
  startPeriodicRefresh(): void {
    this.stopPeriodicRefresh();
    this.recordCurrentFileContent();

    if (!this.currentFilePath) {
      return;
    }

    this.refreshTimer = setInterval(async () => {
      await this.checkAndRefresh();
    }, 1000);
  }

  /**
   * 停止定期刷新定时器
   */
  stopPeriodicRefresh(): void {
    if (this.refreshTimer) {
      clearInterval(this.refreshTimer);
      this.refreshTimer = undefined;
    }
  }

  /**
   * 记录当前文件内容
   */
  async recordCurrentFileContent(): Promise<void> {
    if (!this.currentFilePath) {
      return;
    }

    if (fs.existsSync(this.currentFilePath)) {
      try {
        this.lastFileContent = fs.readFileSync(this.currentFilePath, 'utf-8');
      } catch (error) {
        console.error('[MDTODO] 读取文件内容失败:', error);
      }
    }
  }

  /**
   * 检查文件是否有变化，并定期更新链接状态
   */
  async checkAndRefresh(): Promise<void> {
    if (!this.currentFilePath) {
      return;
    }

    if (!fs.existsSync(this.currentFilePath)) {
      return;
    }

    try {
      const currentContent = fs.readFileSync(this.currentFilePath, 'utf-8');
      const hasChanges = currentContent !== this.lastFileContent;

      if (hasChanges) {
        await this.loadFileCallback?.(this.currentFilePath);
        this.lastFileContent = currentContent;
      } else {
        // 文件无变化时检查链接状态
        await this.checkAndUpdateLinkStatus();
      }
    } catch (error) {
      console.error('[MDTODO] 检查文件变化失败:', error);
    }
  }

  /**
   * 检查并更新所有任务的链接状态
   */
  async checkAndUpdateLinkStatus(): Promise<void> {
    if (!this.currentFilePath || this.currentTasks.length === 0) {
      return;
    }

    // 重新解析文件以获取最新的链接状态
    const { TodoParser } = await import('../parser');
    const parser = new TodoParser();

    // 读取文件内容
    const content = fs.readFileSync(this.currentFilePath, 'utf-8');

    // 更新每个任务的 linkCount 和 linkExists
    let hasLinkStatusChanges = false;

    const updateLinkStatusInTasks = async (tasks: any[]) => {
      for (const task of tasks) {
        const linkStats = await this.calculateLinkStatsForTask(task.rawContent || task.description, content);

        if (task.linkCount !== linkStats.linkCount || task.linkExists !== linkStats.linkExists) {
          task.linkCount = linkStats.linkCount;
          task.linkExists = linkStats.linkExists;
          hasLinkStatusChanges = true;
        }

        // 递归处理子任务
        if (task.children && task.children.length > 0) {
          await updateLinkStatusInTasks(task.children);
        }
      }
    };

    await updateLinkStatusInTasks(this.currentTasks);

    if (hasLinkStatusChanges) {
      this.sendToWebviewCallback?.();
    }
  }

  /**
   * 计算任务的链接统计信息
   */
  private async calculateLinkStatsForTask(content: string, fullContent: string): Promise<{ linkCount: number; linkExists: number }> {
    const linkRegex = /\[([^\]]*)\]\(([^)]+)\)/g;
    const links: string[] = [];
    let match;

    while ((match = linkRegex.exec(content)) !== null) {
      const url = match[2].trim();
      // 排除锚点链接和 mailto 链接
      if (url && !url.startsWith('#') && !url.startsWith('mailto:')) {
        links.push(url);
      }
    }

    // 检查每个链接是否存在
    let existsCount = 0;
    for (const link of links) {
      const absolutePath = this.resolveLinkPath(link);
      if (fs.existsSync(absolutePath)) {
        existsCount++;
      }
    }

    return {
      linkCount: links.length,
      linkExists: existsCount
    };
  }

  /**
   * 解析链接为绝对路径
   */
  private resolveLinkPath(link: string): string {
    // 处理 file:// URL 协议
    if (link.startsWith('file://')) {
      link = link.slice(7);
    }

    // 处理 URL 编码
    let decodedLink = decodeURIComponent(link);
    if (decodedLink !== decodedLink.toLowerCase() || decodedLink.includes('%25')) {
      decodedLink = decodeURIComponent(decodedLink);
    }

    // 判断是否为相对路径
    const isRelativePath = !decodedLink.startsWith('/') && !decodedLink.match(/^[A-Za-z]:/);

    if (isRelativePath && this.currentFilePath) {
      const currentDir = path.dirname(this.currentFilePath);
      return path.resolve(currentDir, decodedLink);
    }

    return decodedLink;
  }

  /**
   * 检查定时器是否正在运行
   */
  isRefreshTimerRunning(): boolean {
    return this.refreshTimer !== undefined;
  }
}

import * as vscode from 'vscode';
import { TodoTask } from '../types';

/**
 * 滚动同步管理器 - 处理 VSCode 编辑器和 Webview 之间的双向滚动同步
 * 【R56.2】从 webviewProvider.ts 的滚动相关方法提取
 */
export class ScrollSyncManager {
  private scrollSyncActiveView: 'editor' | 'webview' = 'editor';
  private context: vscode.ExtensionContext;
  private currentTasks: TodoTask[];
  private currentFilePath: string;
  private panel: vscode.WebviewPanel | undefined;

  constructor(
    context: vscode.ExtensionContext,
    currentTasks: TodoTask[],
    currentFilePath: string,
    panel: vscode.WebviewPanel | undefined
  ) {
    this.context = context;
    this.currentTasks = currentTasks;
    this.currentFilePath = currentFilePath;
    this.panel = panel;
  }

  /**
   * 更新内部状态
   */
  updateState(currentTasks: TodoTask[], currentFilePath: string, panel: vscode.WebviewPanel | undefined): void {
    this.currentTasks = currentTasks;
    this.currentFilePath = currentFilePath;
    this.panel = panel;
  }

  /**
   * 设置滚动同步 - 监听VSCode编辑器的滚动事件并同步到webview
   */
  setupScrollSync(): void {
    // 监听编辑器可见范围变化（滚动事件）
    vscode.window.onDidChangeTextEditorVisibleRanges((event) => {
      const editor = event.textEditor;

      if (this.scrollSyncActiveView !== 'editor') {
        return;
      }

      if (!this.currentFilePath || !editor) {
        return;
      }

      if (editor.document.uri.fsPath !== this.currentFilePath) {
        return;
      }

      const visibleRanges = editor.visibleRanges;
      if (visibleRanges.length > 0) {
        const firstVisibleLine = visibleRanges[0].start.line;
        const nearestTask = this.findNearestTask(firstVisibleLine);

        if (nearestTask && this.panel) {
          this.panel.webview.postMessage({
            type: 'scrollToTask',
            taskId: nearestTask.id,
            lineNumber: nearestTask.lineNumber
          });
        }
      }
    }, undefined, this.context.subscriptions);

    // 监听编辑器焦点变化
    vscode.window.onDidChangeActiveTextEditor((editor) => {
      if (editor && this.currentFilePath && editor.document.uri.fsPath === this.currentFilePath) {
        this.scrollSyncActiveView = 'editor';
        console.log('[MDTODO] 滚动同步：编辑器成为主动视图');
      }
    });

    // 监听webview面板焦点变化
    if (this.panel) {
      this.panel.onDidChangeViewState((event) => {
        if (event.webviewPanel.active) {
          this.scrollSyncActiveView = 'webview';
          console.log('[MDTODO] 滚动同步：webview成为主动视图');
        }
      });
    }
  }

  /**
   * 设置webview为滚动同步的主动视图
   */
  setWebviewAsActive(): void {
    this.scrollSyncActiveView = 'webview';
    console.log('[MDTODO] 滚动同步：webview成为主动视图（用户交互）');
  }

  /**
   * 获取当前主动视图
   */
  getActiveView(): 'editor' | 'webview' {
    return this.scrollSyncActiveView;
  }

  /**
   * 查找最接近指定行号的任务
   */
  private findNearestTask(lineNumber: number): TodoTask | undefined {
    let nearestTask: TodoTask | undefined;
    let minDistance = Infinity;

    const findInTasks = (taskList: TodoTask[]) => {
      for (const task of taskList) {
        const distance = Math.abs(task.lineNumber - lineNumber);
        if (distance < minDistance) {
          minDistance = distance;
          nearestTask = task;
        }
        if (task.children && task.children.length > 0) {
          findInTasks(task.children);
        }
      }
    };

    findInTasks(this.currentTasks);
    return nearestTask;
  }
}

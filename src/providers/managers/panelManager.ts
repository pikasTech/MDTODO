import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { TodoTask, TextBlock } from '../../types';

export interface PanelManagerOptions {
  context: vscode.ExtensionContext;
  getHtmlContent: () => string;
  sendToWebview: (customMessage?: any) => void;
}

export class PanelManager {
  private panel: vscode.WebviewPanel | undefined;
  private context: vscode.ExtensionContext;
  private getHtmlContent: () => string;
  private sendToWebview: (customMessage?: any) => void;

  constructor(options: PanelManagerOptions) {
    this.context = options.context;
    this.getHtmlContent = options.getHtmlContent;
    this.sendToWebview = options.sendToWebview;
  }

  /**
   * 从文件路径提取文件名（不带.md后缀）
   */
  getFileNameFromPath(filePath: string): string {
    if (!filePath) return 'MDTODO 任务管理';
    const baseName = path.basename(filePath);
    return baseName.replace(/\.md$/i, '');
  }

  /**
   * 显示或创建Webview面板
   */
  showPanel(filePath?: string, tasks?: TodoTask[]): void {
    if (tasks) {
      // Tasks are managed by the main provider
    }

    const panelTitle = this.getFileNameFromPath(filePath || '');

    if (this.panel) {
      this.panel.title = panelTitle;
      this.panel.reveal(vscode.ViewColumn.Beside);
      this.sendToWebview();
    } else {
      const activeEditor = vscode.window.activeTextEditor;
      const viewColumn = activeEditor ? vscode.ViewColumn.Beside : vscode.ViewColumn.Two;

      this.panel = vscode.window.createWebviewPanel(
        'mdtodoPanel',
        panelTitle,
        viewColumn,
        {
          enableScripts: true,
          retainContextWhenHidden: true,
          localResourceRoots: [
            vscode.Uri.joinPath(this.context.extensionUri, 'resources')
          ]
        }
      );

      this.panel.webview.html = this.getHtmlContent();

      this.panel.onDidDispose(
        () => {
          this.panel = undefined;
        },
        undefined,
        this.context.subscriptions
      );
    }
  }

  /**
   * 更新面板标题
   */
  updatePanelTitle(filePath: string): void {
    if (this.panel && filePath) {
      const panelTitle = this.getFileNameFromPath(filePath);
      this.panel.title = panelTitle;
    }
  }

  /**
   * 检查面板是否已打开
   */
  isVisible(): boolean {
    return this.panel !== undefined;
  }

  /**
   * 获取面板
   */
  getPanel(): vscode.WebviewPanel | undefined {
    return this.panel;
  }

  /**
   * 关闭面板
   */
  dispose(): void {
    if (this.panel) {
      this.panel.dispose();
      this.panel = undefined;
    }
  }
}

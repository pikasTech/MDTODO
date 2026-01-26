import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import { TyporaService } from './services/typoraService';

/**
 * 链接处理器 - 处理各种链接的打开和删除操作
 * 【R56.4】从 webviewProvider.ts 的链接相关方法提取
 */
export class LinkHandler {
  private currentFilePath: string;
  private panel: vscode.WebviewPanel | undefined;

  constructor(currentFilePath: string, panel: vscode.WebviewPanel | undefined) {
    this.currentFilePath = currentFilePath;
    this.panel = panel;
  }

  /**
   * 更新内部状态
   */
  updateState(currentFilePath: string, panel: vscode.WebviewPanel | undefined): void {
    this.currentFilePath = currentFilePath;
    this.panel = panel;
  }

  /**
   * 处理打开链接
   * 支持相对路径（如 ./docs/file.md、../file.md）和绝对路径/URL
   * .md 文件默认使用 Typora 打开
   */
  async handleOpenLink(url: string): Promise<void> {
    try {
      console.log('[MDTODO] handleOpenLink 收到 URL:', url);

      if (url.startsWith('http://') || url.startsWith('https://')) {
        // 网页链接：在外部浏览器中打开
        await vscode.env.openExternal(vscode.Uri.parse(url));
        console.log('[MDTODO] 已打开网页链接:', url);
      } else {
        // 处理 file:// URL 协议
        let decodedUrl = this.decodeUrl(url);

        // 判断是否为相对路径
        const isRelativePath = !decodedUrl.startsWith('/') && !decodedUrl.match(/^[A-Za-z]:/);

        let absolutePath: string;

        if (isRelativePath) {
          absolutePath = this.resolveRelativePath(decodedUrl);
        } else {
          absolutePath = decodedUrl;
        }

        // 判断是否为 .md 文件
        const isMarkdownFile = absolutePath.toLowerCase().endsWith('.md');

        if (isMarkdownFile) {
          // 使用 Typora 打开 md 文件
          const typoraService = new TyporaService();
          await typoraService.openWithTypora(absolutePath);
        } else {
          // 其他文件使用 VSCode 打开
          const uri = vscode.Uri.file(absolutePath);
          await vscode.window.showTextDocument(uri);
          console.log('[MDTODO] 已打开文档:', absolutePath);
        }
      }
    } catch (error) {
      console.error('[MDTODO] 打开链接失败:', error);
      vscode.window.showErrorMessage(`无法打开链接: ${error}`);
    }
  }

  /**
   * 删除链接文件
   * 支持相对路径（如 ./docs/file.md、../file.md）和绝对路径/URL
   * 只删除本地文件，不删除 HTTP/HTTPS 链接
   */
  async handleDeleteLinkFile(url: string): Promise<void> {
    try {
      console.log('[MDTODO] handleDeleteLinkFile 收到 URL:', url);

      // HTTP/HTTPS 链接不删除
      if (url.startsWith('http://') || url.startsWith('https://')) {
        vscode.window.showWarningMessage('无法删除网页链接');
        return;
      }

      let decodedUrl = this.decodeUrl(url);
      const isRelativePath = !decodedUrl.startsWith('/') && !decodedUrl.match(/^[A-Za-z]:/);

      let absolutePath: string;

      if (isRelativePath) {
        absolutePath = this.resolveRelativePath(decodedUrl);
      } else {
        absolutePath = decodedUrl;
      }

      // 检查文件是否存在
      if (!fs.existsSync(absolutePath)) {
        vscode.window.showWarningMessage(`文件不存在: ${absolutePath}`);
        return;
      }

      // 检查是否为目录
      const stat = fs.statSync(absolutePath);
      if (stat.isDirectory()) {
        vscode.window.showWarningMessage('无法删除目录，请手动处理');
        return;
      }

      // 确认删除
      const fileName = path.basename(absolutePath);
      const choice = await vscode.window.showWarningMessage(
        `确定要删除文件 "${fileName}" 吗？此操作不可恢复。`,
        { modal: true },
        '删除',
        '取消'
      );

      if (choice === '删除') {
        // 执行删除
        fs.unlinkSync(absolutePath);
        console.log('[MDTODO] 已删除文件:', absolutePath);
        vscode.window.showInformationMessage(`已删除文件: ${fileName}`);

        // 刷新 webview 以更新链接状态
        this.refreshWebview();
      } else {
        console.log('[MDTODO] 用户取消删除文件');
      }
    } catch (error) {
      console.error('[MDTODO] 删除文件失败:', error);
      vscode.window.showErrorMessage(`删除文件失败: ${error}`);
    }
  }

  /**
   * 解析链接为绝对路径
   */
  resolveLinkPath(link: string): string {
    // 处理 file:// URL 协议
    if (link.startsWith('file://')) {
      link = link.slice(7);
    }

    // 处理 URL 编码
    let decodedLink = decodeURIComponent(link);
    if (decodedLink !== decodedLink.toLowerCase() || decodedLink.includes('%25')) {
      decodedLink = decodeURIComponent(decodedLink);
    }

    return this.resolveRelativePath(decodedLink);
  }

  /**
   * 解码 URL（处理双重编码）
   */
  private decodeUrl(url: string): string {
    // 处理 file:// URL 协议
    if (url.startsWith('file://')) {
      url = url.slice(7);
    }

    // 处理可能的双重 URL 编码
    let decodedUrl = decodeURIComponent(url);
    if (decodedUrl !== decodedUrl.toLowerCase() || decodedUrl.includes('%25')) {
      decodedUrl = decodeURIComponent(decodedUrl);
    }

    return decodedUrl;
  }

  /**
   * 解析相对路径为绝对路径
   */
  private resolveRelativePath(decodedUrl: string): string {
    const isRelativePath = !decodedUrl.startsWith('/') && !decodedUrl.match(/^[A-Za-z]:/);

    if (isRelativePath && this.currentFilePath) {
      const currentDir = path.dirname(this.currentFilePath);
      return path.resolve(currentDir, decodedUrl);
    }

    return decodedUrl;
  }

  /**
   * 刷新 webview
   */
  private refreshWebview(): void {
    if (this.panel) {
      this.panel.webview.postMessage({
        type: 'refresh'
      });
    }
  }
}

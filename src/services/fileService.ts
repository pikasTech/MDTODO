import * as vscode from 'vscode';

export class FileService {
  async readFile(uri: vscode.Uri): Promise<string> {
    console.log(`[R55.6-FileService] readFile: ${uri.fsPath}`);
    try {
      const data = await vscode.workspace.fs.readFile(uri);
      const decoder = new TextDecoder('utf-8');
      const content = decoder.decode(data);
      console.log(`[R55.6-FileService] readFile 成功: ${uri.fsPath}, 内容长度: ${content.length}`);
      return content;
    } catch (error) {
      console.error(`[R55.6-FileService] readFile 失败: ${uri.fsPath}`, error);
      throw error;
    }
  }

  async writeFile(uri: vscode.Uri, content: string): Promise<void> {
    console.log(`[R55.6-FileService] writeFile 开始: ${uri.fsPath}, 内容长度: ${content.length}`);
    try {
      const encoder = new TextEncoder();
      const data = encoder.encode(content);
      await vscode.workspace.fs.writeFile(uri, data);
      console.log(`[R55.6-FileService] writeFile 成功: ${uri.fsPath}`);
    } catch (error) {
      console.error(`[R55.6-FileService] writeFile 失败: ${uri.fsPath}`, error);
      throw error;
    }
  }

  watchFile(
    uri: vscode.Uri,
    callback: (e: vscode.Uri) => void
  ): vscode.Disposable {
    const watcher = vscode.workspace.createFileSystemWatcher(
      uri.fsPath,
      false,
      false,
      false
    );
    watcher.onDidChange(callback);
    return new vscode.Disposable(() => {
      watcher.dispose();
    });
  }

  async findTodoFiles(): Promise<vscode.Uri[]> {
    const files = await vscode.workspace.findFiles('**/*TODO*.md', '**/node_modules/**');
    return files;
  }
}

import * as vscode from 'vscode';

export class FileService {
  async readFile(uri: vscode.Uri): Promise<string> {
    try {
      const data = await vscode.workspace.fs.readFile(uri);
      const decoder = new TextDecoder('utf-8');
      return decoder.decode(data);
    } catch (error) {
      console.error('读取文件失败:', error);
      throw error;
    }
  }

  async writeFile(uri: vscode.Uri, content: string): Promise<void> {
    try {
      const encoder = new TextEncoder();
      const data = encoder.encode(content);
      await vscode.workspace.fs.writeFile(uri, data);
    } catch (error) {
      console.error('写入文件失败:', error);
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

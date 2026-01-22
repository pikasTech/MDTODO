import * as vscode from 'vscode';
import { TodoTask } from '../types';

export class TodoTreeDataProvider implements vscode.TreeDataProvider<TodoTask> {
  private _onDidChangeTreeData = new vscode.EventEmitter<TodoTask | undefined>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  private tasks: TodoTask[] = [];
  private filePath: string = '';

  constructor(private context: vscode.ExtensionContext) {}

  refresh(tasks: TodoTask[], filePath: string): void {
    this.tasks = tasks;
    this.filePath = filePath;
    this._onDidChangeTreeData.fire(undefined);
  }

  getTreeItem(element: TodoTask): vscode.TreeItem {
    const treeItem = new vscode.TreeItem(
      element.title,
      element.children.length > 0
        ? vscode.TreeItemCollapsibleState.Collapsed
        : vscode.TreeItemCollapsibleState.None
    );

    treeItem.id = element.id;
    treeItem.description = element.completed ? '✓ 已完成' : undefined;
    treeItem.contextValue = element.children.length > 0 ? 'parentTask' : 'task';

    treeItem.command = {
      command: 'mdtodo.selectTask',
      title: '选择',
      arguments: [element]
    };

    return treeItem;
  }

  getChildren(element?: TodoTask): vscode.ProviderResult<TodoTask[]> {
    if (!element) {
      return this.tasks;
    }
    return element.children;
  }

  getParent(element: TodoTask): vscode.ProviderResult<TodoTask> {
    return element.parent;
  }
}

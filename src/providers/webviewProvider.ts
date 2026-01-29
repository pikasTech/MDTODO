import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import { spawn } from 'child_process';
import { TodoTask, TodoFile, TextBlock } from '../types';
import { FileService } from '../services/fileService';
import { generateClaudeExecuteArgs } from '../services/claudeService';
import { TyporaService } from './services/typoraService';
import { ScrollSyncManager } from './scrollSyncManager';
import { LinkHandler } from './linkHandler';
import { FileRefreshManager } from './fileRefreshManager';
import { TaskStatusManager } from './taskStatusManager';
import { PanelManager, TaskFileManager, CommandGenerator } from './managers';

export class TodoWebviewProvider {
  private panel: vscode.WebviewPanel | undefined;
  private context: vscode.ExtensionContext;
  private currentTasks: TodoTask[] = [];
  private currentTextBlocks: TextBlock[] = [];
  private currentFilePath: string = '';
  private resolveCallback: ((task: TodoTask) => void) | undefined;
  private messageListenerRegistered = false;

  // 管理器实例
  private scrollSyncManager!: ScrollSyncManager;
  private linkHandler!: LinkHandler;
  private fileRefreshManager!: FileRefreshManager;
  private taskStatusManager!: TaskStatusManager;
  private panelManager!: PanelManager;
  private taskFileManager!: TaskFileManager;
  private commandGenerator!: CommandGenerator;

  constructor(context: vscode.ExtensionContext) {
    this.context = context;
    // 初始化管理器
    this.scrollSyncManager = new ScrollSyncManager(context, [], '', undefined);
    this.linkHandler = new LinkHandler('', undefined);
    this.fileRefreshManager = new FileRefreshManager();
    this.taskStatusManager = new TaskStatusManager();

    // 初始化新管理器
    this.panelManager = new PanelManager({
      context,
      getHtmlContent: () => this.getHtmlContent(),
      sendToWebview: (customMessage?: any) => this.sendToWebview(customMessage),
    });

    this.taskFileManager = new TaskFileManager({
      currentFilePath: this.currentFilePath,
      currentTasks: this.currentTasks,
      currentTextBlocks: this.currentTextBlocks,
      onTasksChanged: (tasks, textBlocks, filePath) => {
        this.currentTasks = tasks;
        this.currentTextBlocks = textBlocks;
        this.currentFilePath = filePath;
      },
      onWebviewRefresh: () => this.updateWebview(),
    });

    this.commandGenerator = new CommandGenerator({
      currentFilePath: this.currentFilePath,
    });
  }

  /**
   * 显示或创建Webview面板
   */
  showPanel(filePath?: string, tasks?: TodoTask[]): void {
    if (tasks) {
      this.currentTasks = tasks;
      this.currentFilePath = filePath || '';
    }

    this.panelManager.showPanel(this.currentFilePath, tasks);

    // 只注册一次消息监听器，避免重复触发
    if (!this.messageListenerRegistered) {
      this.panelManager.getPanel()?.webview.onDidReceiveMessage(
        this.handleMessage.bind(this),
        undefined,
        this.context.subscriptions
      );
      this.messageListenerRegistered = true;
    }

    // 启动定期刷新
    this.fileRefreshManager.startPeriodicRefresh();
  }

  /**
   * 发送数据到 webview
   */
  private sendToWebview(customMessage?: any): void {
    const panel = this.panelManager.getPanel();
    if (panel) {
      if (customMessage) {
        panel.webview.postMessage(customMessage);
      } else {
        const workspacePath = this.getWorkspaceFolderPath();
        panel.webview.postMessage({
          type: 'updateTasks',
          tasks: this.serializeTasks(this.currentTasks),
          textBlocks: this.currentTextBlocks,
          filePath: this.currentFilePath,
          workspacePath: workspacePath
        });
      }
    }
  }

  /**
   * 获取工作区路径
   */
  private getWorkspaceFolderPath(): string {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (workspaceFolders && workspaceFolders.length > 0) {
      return workspaceFolders[0].uri.fsPath;
    }
    return '';
  }

  /**
   * 更新Webview内容
   */
  updateWebview(): void {
    this.sendToWebview();
  }

  /**
   * 设置任务选择回调
   */
  onTaskSelected(callback: (task: TodoTask) => void): void {
    this.resolveCallback = callback;
  }

  /**
   * 序列化任务用于传递到Webview
   */
  private serializeTasks(tasks: TodoTask[]): any[] {
    return tasks.map(task => ({
      id: task.id,
      title: task.title,
      description: task.description,
      rawContent: task.rawContent,
      completed: task.completed,
      processing: task.processing,
      children: task.children.length > 0 ? this.serializeTasks(task.children) : [],
      lineNumber: task.lineNumber,
      hasChildren: task.children.length > 0,
      level: this.getTaskLevel(task.id),
      linkCount: task.linkCount,
      linkExists: task.linkExists
    }));
  }

  /**
   * 获取任务层级
   */
  private getTaskLevel(id: string): number {
    return id.split('.').length;
  }

  /**
   * 处理来自Webview的消息
   */
  private async handleMessage(message: any): Promise<void> {
    console.log('[MDTODO] Received message:', message.type);

    switch (message.type) {
      case 'ready':
        console.log('[MDTODO] Webview ready, sending data');
        this.sendToWebview();
        break;
      case 'taskSelected':
        await this.handleTaskSelected(message.taskId);
        break;
      case 'executeTask':
        await this.handleExecuteTask(message.taskId);
        break;
      case 'markComplete':
        await this.handleMarkComplete(message.taskId);
        break;
      case 'refresh':
        await this.handleRefresh();
        break;
      case 'openFile':
        await this.handleOpenFile();
        break;
      case 'openPreview':
        await this.handleOpenPreview();
        break;
      case 'openSourceFile':
        await this.handleOpenSourceFile();
        break;
      case 'saveTitle':
        await this.handleSaveTitle(message.taskId, message.title);
        break;
      case 'claudeExecute':
        await this.handleClaudeExecute(message.taskId);
        break;
      case 'openLink':
        await this.handleOpenLink(message.url);
        break;
      case 'addTask':
        await this.handleAddTask();
        break;
      case 'deleteTask':
        await this.handleDeleteTask(message.taskId);
        break;
      case 'addSubTask':
        await this.handleAddSubTask(message.taskId);
        break;
      case 'continueTask':
        await this.handleContinueTask(message.taskId);
        break;
      case 'webviewScrolled':
        await this.handleWebviewScrolled(message.taskId, message.lineNumber);
        break;
      case 'webviewActive':
        this.setWebviewAsActive();
        break;
      case 'saveTextBlock':
        await this.handleSaveTextBlock(message.blockId, message.content);
        break;
      case 'deleteLinkFile':
        await this.handleDeleteLinkFile(message.url);
        break;
      case 'generateExecuteCommand':
        this.handleGenerateExecuteCommand(message.taskId);
        break;
    }
  }

  /**
   * 处理来自Webview的滚动事件
   */
  private async handleWebviewScrolled(taskId: string, lineNumber: number): Promise<void> {
    if (this.scrollSyncManager.getActiveView() !== 'webview') {
      return;
    }

    console.log(`[MDTODO] Webview scrolled to task: ${taskId}, line: ${lineNumber}`);

    if (!this.currentFilePath || lineNumber < 0) {
      return;
    }

    const activeEditor = vscode.window.activeTextEditor;

    if (activeEditor && activeEditor.document.uri.fsPath === this.currentFilePath) {
      const position = new vscode.Position(lineNumber, 0);
      activeEditor.revealRange(
        new vscode.Range(position, position),
        vscode.TextEditorRevealType.InCenter
      );
    }
  }

  /**
   * 设置滚动同步
   */
  public setupScrollSync(): void {
    this.scrollSyncManager.setupScrollSync();
  }

  /**
   * 设置webview为滚动同步的主动视图
   */
  public setWebviewAsActive(): void {
    this.scrollSyncManager.setWebviewAsActive();
  }

  /**
   * 处理打开预览
   */
  private async handleOpenPreview(): Promise<void> {
    if (this.currentFilePath) {
      const uri = vscode.Uri.file(this.currentFilePath);
      await vscode.commands.executeCommand('markdown.showPreview', uri);
    }
  }

  /**
   * 打开原MDTODO文件
   */
  private async handleOpenSourceFile(): Promise<void> {
    if (!this.currentFilePath) {
      vscode.window.showWarningMessage('未加载任何文件');
      return;
    }

    if (!fs.existsSync(this.currentFilePath)) {
      vscode.window.showErrorMessage(`文件不存在: ${this.currentFilePath}`);
      return;
    }

    console.log('[MDTODO] 打开原文件:', this.currentFilePath);
    const uri = vscode.Uri.file(this.currentFilePath);
    await vscode.window.showTextDocument(uri);
  }

  /**
   * 处理保存标题
   */
  private async handleSaveTitle(taskId: string, newTitle: string): Promise<void> {
    const success = await this.taskFileManager.handleSaveTitle(taskId, newTitle);
    if (success) {
      vscode.window.showInformationMessage(`任务 ${taskId} 内容已更新`);
      await this.loadFile(this.currentFilePath);
    }
  }

  /**
   * 处理保存文本块
   */
  private async handleSaveTextBlock(blockId: string, newContent: string): Promise<void> {
    const success = await this.taskFileManager.handleSaveTextBlock(blockId, newContent);
    if (success) {
      await this.loadFile(this.currentFilePath);
      vscode.window.showInformationMessage(`文本块已更新`);
    }
  }

  /**
   * 处理打开链接
   */
  private async handleOpenLink(url: string): Promise<void> {
    await this.linkHandler.handleOpenLink(url);
  }

  /**
   * 删除链接文件
   */
  private async handleDeleteLinkFile(url: string): Promise<void> {
    await this.linkHandler.handleDeleteLinkFile(url);
  }

  /**
   * 生成执行命令
   */
  private handleGenerateExecuteCommand(taskId: string): void {
    const result = this.commandGenerator.generateExecuteCommand(taskId);
    if (result) {
      this.sendToWebview({
        type: 'executeCommandGenerated',
        command: result.command,
        taskId: result.taskId
      });
      console.log('[MDTODO] 已生成并发送执行命令:', result.command);
    }
  }

  /**
   * 处理打开文件
   */
  public async handleOpenFile(): Promise<void> {
    const { FileService } = await import('../services/fileService');
    const fileService = new FileService();
    const files = await fileService.findTodoFiles();
    console.log('[MDTODO] findTodoFiles found:', files.length, 'files');
    files.forEach((f, i) => console.log(`[MDTODO] File ${i}:`, f.fsPath));

    if (files.length === 0) {
      vscode.window.showInformationMessage('未找到TODO文件 (*TODO*.md)');
      return;
    }

    if (files.length === 1) {
      await this.loadFile(files[0].fsPath);
    } else {
      const selected = await vscode.window.showQuickPick(
        files.map(f => ({
          label: vscode.workspace.asRelativePath(f),
          uri: f
        })),
        { placeHolder: '选择TODO文件' }
      );

      if (selected) {
        await this.loadFile(selected.uri.fsPath);
      }
    }
  }

  /**
   * 尝试加载文件到webview
   */
  public async tryLoadFile(filePath: string): Promise<boolean> {
    const { FileService } = await import('../services/fileService');
    const { TodoParser } = await import('../parser');
    const fileService = new FileService();
    const parser = new TodoParser();

    try {
      const content = await fileService.readFile(vscode.Uri.file(filePath));
      const hasTodoFormat = /##+\s.*R\d+/.test(content);

      if (hasTodoFormat) {
        console.log('[MDTODO] Format matched for:', filePath);
        const tasks = parser.parse(content, filePath);
        const textBlocks = parser.parseTextBlocks(content);
        console.log('[MDTODO] Parsed tasks count:', tasks.length, 'textBlocks:', textBlocks.length);
        this.currentTasks = tasks;
        this.currentTextBlocks = textBlocks;
        this.currentFilePath = filePath;
        this.updateManagersState();
        this.updateWebview();
        return true;
      } else {
        console.log('[MDTODO] Format NOT matched for:', filePath);
        return false;
      }
    } catch (error: any) {
      console.error('[MDTODO] Error loading file:', error);
      return false;
    }
  }

  /**
   * 更新所有管理器的内部状态
   */
  private updateManagersState(): void {
    const panel = this.panelManager.getPanel();
    this.scrollSyncManager.updateState(this.currentTasks, this.currentFilePath, panel);
    this.linkHandler.updateState(this.currentFilePath, panel);
    this.fileRefreshManager.updateState(this.currentFilePath, this.currentTasks, this.currentTextBlocks);
    this.taskStatusManager.updateState(this.currentFilePath, this.currentTasks);

    this.fileRefreshManager.setCallbacks(
      (filePath: string) => this.loadFile(filePath),
      () => this.sendToWebview()
    );

    // 更新新管理器状态
    this.taskFileManager.updateState(this.currentFilePath, this.currentTasks, this.currentTextBlocks);
    this.commandGenerator.updateState(this.currentFilePath);
  }

  /**
   * 加载文件到webview
   */
  public async loadFile(filePath: string): Promise<boolean> {
    console.log('[MDTODO] loadFile called:', filePath);

    const { FileService } = await import('../services/fileService');
    const { TodoParser } = await import('../parser');
    const fileService = new FileService();
    const parser = new TodoParser();

    try {
      const content = await fileService.readFile(vscode.Uri.file(filePath));
      const hasTodoFormat = /##+\s.*R\d+/.test(content);
      console.log('[MDTODO] hasTodoFormat:', hasTodoFormat);

      if (hasTodoFormat) {
        const tasks = parser.parse(content, filePath);
        const textBlocks = parser.parseTextBlocks(content);
        console.log('[MDTODO] Parsed tasks count:', tasks.length, 'textBlocks:', textBlocks.length);
        this.currentTasks = tasks;
        this.currentTextBlocks = textBlocks;
        this.currentFilePath = filePath;
        this.updateManagersState();
        this.panelManager.updatePanelTitle(filePath);
        this.updateWebview();
        await this.fileRefreshManager.recordCurrentFileContent();
        this.fileRefreshManager.startPeriodicRefresh();
        return true;
      } else {
        console.log('[MDTODO] Format not matched, setting empty state');
        this.currentTasks = [];
        this.currentFilePath = filePath;
        this.updateManagersState();
        this.panelManager.updatePanelTitle(filePath);
        this.updateWebview();
        await this.fileRefreshManager.recordCurrentFileContent();
        this.fileRefreshManager.startPeriodicRefresh();
        return false;
      }
    } catch (error: any) {
      console.error('[MDTODO] Error loading file:', error);
      return false;
    }
  }

  /**
   * 处理任务选择
   */
  private async handleTaskSelected(taskId: string): Promise<void> {
    const task = this.taskFileManager.findTask(this.currentTasks, taskId);
    if (task && this.resolveCallback) {
      this.resolveCallback(task);
    }
  }

  /**
   * 处理任务执行
   */
  private async handleExecuteTask(taskId: string): Promise<void> {
    const claudeService = await this.getClaudeService();
    const result = await claudeService.executeTask(this.currentFilePath, taskId);
    vscode.window.showInformationMessage(result.output);
  }

  /**
   * 处理Claude执行
   */
  private async handleClaudeExecute(taskId: string): Promise<void> {
    if (!this.currentFilePath) {
      vscode.window.showWarningMessage('请先打开一个TODO文件');
      return;
    }

    try {
      await this.taskStatusManager.markTaskAsProcessing(taskId, true);
      await this.loadFile(this.currentFilePath);
      await this.handleExecuteTask(taskId);
    } catch (error: any) {
      await this.taskStatusManager.markTaskAsProcessing(taskId, false);
      await this.loadFile(this.currentFilePath);
      console.error('[MDTODO] Error in Claude execute:', error);
      vscode.window.showErrorMessage(`执行失败: ${error.message}`);
    }
  }

  /**
   * 处理标记完成
   */
  private async handleMarkComplete(taskId: string): Promise<void> {
    console.log(`[R55.6] handleMarkComplete 开始: taskId=${taskId}, currentFilePath=${this.currentFilePath}`);
    if (!this.currentFilePath) {
      console.log(`[R55.6] handleMarkComplete 失败: currentFilePath 为空`);
      vscode.window.showWarningMessage('请先打开一个TODO文件');
      return;
    }

    const task = this.taskFileManager.findTask(this.currentTasks, taskId);
    if (!task) {
      console.log(`[R55.6] handleMarkComplete 失败: 未找到任务 ${taskId}`);
      vscode.window.showWarningMessage(`未找到任务 ${taskId}`);
      return;
    }

    const isComplete = !task.completed;
    console.log(`[R55.6] handleMarkComplete: 调用 markTaskAsFinished, isComplete=${isComplete}`);
    await this.taskStatusManager.markTaskAsFinished(taskId, isComplete);
    console.log(`[R55.6] handleMarkComplete: markTaskAsFinished 完成，调用 loadFile`);
    await this.loadFile(this.currentFilePath);
    console.log(`[R55.6] handleMarkComplete: loadFile 完成`);

    vscode.window.showInformationMessage(`任务 ${taskId} 已${isComplete ? '标记完成' : '取消完成'}`);
  }

  /**
   * 处理添加任务
   */
  private async handleAddTask(): Promise<void> {
    const newId = await this.taskFileManager.handleAddTask();
    if (newId) {
      await this.loadFile(this.currentFilePath);
      this.notifyNewTask(newId);
    }
  }

  /**
   * 通知webview新添加的任务
   */
  private notifyNewTask(taskId: string): void {
    this.sendToWebview({
      type: 'newTaskAdded',
      taskId: taskId
    });
  }

  /**
   * 处理删除任务
   */
  private async handleDeleteTask(taskId: string): Promise<void> {
    const success = await this.taskFileManager.handleDeleteTask(taskId);
    if (success) {
      await this.loadFile(this.currentFilePath);
    }
  }

  /**
   * 处理添加子任务
   */
  private async handleAddSubTask(parentTaskId: string): Promise<void> {
    const newId = await this.taskFileManager.handleAddSubTask(parentTaskId);
    if (newId) {
      await this.loadFile(this.currentFilePath);
      this.notifyNewTask(newId);
    }
  }

  /**
   * 处理延续任务
   */
  private async handleContinueTask(currentTaskId: string): Promise<void> {
    const newId = await this.taskFileManager.handleContinueTask(currentTaskId);
    if (newId) {
      await this.loadFile(this.currentFilePath);
      this.notifyNewTask(newId);
      console.log(`[MDTODO] 延续任务: ${currentTaskId} -> ${newId}`);
    }
  }

  /**
   * 处理刷新
   */
  private async handleRefresh(): Promise<void> {
    if (!this.currentFilePath) {
      vscode.window.showWarningMessage('未加载任何文件');
      return;
    }
    console.log('[MDTODO] 刷新当前文件:', this.currentFilePath);
    await this.loadFile(this.currentFilePath);
  }

  /**
   * 获取Claude服务
   */
  private async getClaudeService(): Promise<any> {
    const { ClaudeService } = await import('../services/claudeService');
    return new ClaudeService();
  }

  /**
   * 获取Webview HTML内容
   */
  private getHtmlContent(): string {
    const templatePath = path.join(this.context.extensionPath, 'resources', 'template.html');
    const bundleUri = this.panelManager.getPanel()!.webview.asWebviewUri(
      vscode.Uri.joinPath(this.context.extensionUri, 'resources', 'bundle.js')
    );

    try {
      let html = fs.readFileSync(templatePath, 'utf-8');
      html = html.replace('{{STYLE_CSS_URI}}', '');
      html = html.replace('{{BUNDLE_JS_URI}}', bundleUri.toString());
      return html;
    } catch (error) {
      console.error('Failed to load template:', error);
      return '<html><body><h1>Error loading template</h1></body></html>';
    }
  }

  /**
   * 刷新面板
   */
  refresh(tasks: TodoTask[], filePath: string): void {
    this.currentTasks = tasks;
    this.currentFilePath = filePath;
    this.updateManagersState();
    this.updateWebview();
  }

  /**
   * 关闭面板
   */
  dispose(): void {
    this.fileRefreshManager.stopPeriodicRefresh();
    this.panelManager.dispose();
  }

  /**
   * 检查面板是否已打开
   */
  isVisible(): boolean {
    return this.panelManager.isVisible();
  }
}

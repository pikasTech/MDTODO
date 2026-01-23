import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import { spawn } from 'child_process';
import { TodoTask, TodoFile, TextBlock } from '../types';
import { FileService } from '../services/fileService';

export class TodoWebviewProvider {
  private panel: vscode.WebviewPanel | undefined;
  private context: vscode.ExtensionContext;
  private currentTasks: TodoTask[] = [];
  private currentTextBlocks: TextBlock[] = [];
  private currentFilePath: string = '';
  private resolveCallback: ((task: TodoTask) => void) | undefined;
  // 【实现R29.1】滚动同步焦点状态：'editor' = VSCode编辑器主动，'webview' = webview主动
  private scrollSyncActiveView: 'editor' | 'webview' = 'editor';
  // 【实现R47】定期刷新定时器
  private refreshTimer: ReturnType<typeof setInterval> | undefined;
  private lastFileContent: string = '';

  constructor(context: vscode.ExtensionContext) {
    this.context = context;
  }

  /**
   * 从文件路径提取文件名（不带.md后缀）
   */
  private getFileNameFromPath(filePath: string): string {
    if (!filePath) return 'MDTODO 任务管理';
    const baseName = path.basename(filePath);
    // 移除 .md 后缀
    return baseName.replace(/\.md$/i, '');
  }

  /**
   * 显示或创建Webview面板
   * 【实现R34.1】支持多webview：如果文件未加载则创建新面板
   */
  showPanel(filePath?: string, tasks?: TodoTask[]): void {
    console.log('[MDTODO-R47.1] showPanel() 被调用');
    console.log('[MDTODO-R47.1] 传入的 filePath:', filePath);
    console.log('[MDTODO-R47.1] 现有的 currentFilePath:', this.currentFilePath);

    if (tasks) {
      this.currentTasks = tasks;
      this.currentFilePath = filePath || '';
      console.log('[MDTODO-R47.1] 更新后的 currentFilePath:', this.currentFilePath);
    }

    // 获取文件名作为标题
    const panelTitle = this.getFileNameFromPath(this.currentFilePath);

    if (this.panel) {
      console.log('[MDTODO-R47.1] panel 已存在，更新标题和数据');
      // 更新面板标题为当前文件名
      this.panel.title = panelTitle;
      // 在旁边打开（尝试创建新列）
      this.panel.reveal(vscode.ViewColumn.Beside);
      // panel 已存在，直接发送数据
      this.sendToWebview();
      // 【R47.1】panel已存在时也要确保定时器监测正确的文件
      this.startPeriodicRefresh();
    } else {
      console.log('[MDTODO-R47.1] 创建新的 panel');
      // 【R51.2】使用 Beside 代替 Two，以实现对半分宽度
      // 当使用 Beside 时，VSCode 会自动分配相等的空间给两个列
      const activeEditor = vscode.window.activeTextEditor;
      const viewColumn = activeEditor ? vscode.ViewColumn.Beside : vscode.ViewColumn.Two;

      // 在右侧新列打开，使用文件名作为标题
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

      // 【实现R29】设置滚动同步监听
      this.setupScrollSync();

      this.panel.webview.onDidReceiveMessage(
        this.handleMessage.bind(this),
        undefined,
        this.context.subscriptions
      );

      this.panel.onDidDispose(
        () => {
          this.panel = undefined;
          // 【实现R47】停止定期刷新定时器
          this.stopPeriodicRefresh();
        },
        undefined,
        this.context.subscriptions
      );

      // 【实现R47】启动定期刷新定时器（5秒周期）
      this.startPeriodicRefresh();

      // 不再这里调用 updateWebview，改为等待 webview ready 消息
    }
  }

  /**
   * 【实现R47.1】启动定期刷新定时器（添加详细调试日志）
   * 每5秒检查一次文件是否有变化，如果有变化则自动刷新
   */
  private startPeriodicRefresh(): void {
    console.log('[MDTODO-R47.1] startPeriodicRefresh() 被调用');
    console.log('[MDTODO-R47.1] currentFilePath:', this.currentFilePath);
    console.log('[MDTODO-R47.1] panel 是否存在:', !!this.panel);
    console.log('[MDTODO-R47.1] refreshTimer 当前状态:', this.refreshTimer ? '已存在' : '不存在');

    // 先停止已有的定时器
    this.stopPeriodicRefresh();

    // 记录当前文件内容用于比较
    this.recordCurrentFileContent();

    // 【R47.1】只有在有文件路径时才启动定时器
    if (!this.currentFilePath) {
      console.log('[MDTODO-R47.1] 警告: currentFilePath 为空，不启动定时器');
      return;
    }

    // 启动5秒周期的定时器
    this.refreshTimer = setInterval(async () => {
      await this.checkAndRefresh();
    }, 5000);

    console.log('[MDTODO-R47.1] 已启动定期刷新定时器（5秒周期），监测文件:', this.currentFilePath);
  }

  /**
   * 【实现R47.1】停止定期刷新定时器（添加调试日志）
   */
  private stopPeriodicRefresh(): void {
    console.log('[MDTODO-R47.1] stopPeriodicRefresh() 被调用');
    console.log('[MDTODO-R47.1] refreshTimer 当前状态:', this.refreshTimer ? '运行中' : '不存在');

    if (this.refreshTimer) {
      clearInterval(this.refreshTimer);
      this.refreshTimer = undefined;
      console.log('[MDTODO-R47.1] 已停止定期刷新定时器');
    }
  }

  /**
   * 【实现R47.1】记录当前文件内容（添加详细调试日志）
   */
  private async recordCurrentFileContent(): Promise<void> {
    console.log('[MDTODO-R47.1] recordCurrentFileContent() 被调用');
    console.log('[MDTODO-R47.1] currentFilePath:', this.currentFilePath);

    if (!this.currentFilePath) {
      console.log('[MDTODO-R47.1] currentFilePath 为空，跳过记录');
      return;
    }

    const fileExists = fs.existsSync(this.currentFilePath);
    console.log('[MDTODO-R47.1] 文件是否存在:', fileExists);

    if (fileExists) {
      try {
        this.lastFileContent = fs.readFileSync(this.currentFilePath, 'utf-8');
        console.log('[MDTODO-R47.1] 文件内容已记录，内容长度:', this.lastFileContent.length, '字符');
      } catch (error) {
        console.error('[MDTODO-R47.1] 读取文件内容失败:', error);
      }
    } else {
      console.log('[MDTODO-R47.1] 文件不存在，无法记录内容');
    }
  }

  /**
   * 【实现R47.1】检查文件是否有变化，并定期更新链接状态
   */
  private async checkAndRefresh(): Promise<void> {
    console.log('[MDTODO-R47.1] checkAndRefresh() 定时器触发执行');
    console.log('[MDTODO-R47.1] currentFilePath:', this.currentFilePath);
    console.log('[MDTODO-R47.1] panel 是否存在:', !!this.panel);

    // 【R47.1】检查必要条件
    if (!this.currentFilePath) {
      console.log('[MDTODO-R47.1] currentFilePath 为空，跳过刷新检查');
      return;
    }

    if (!this.panel) {
      console.log('[MDTODO-R47.1] panel 不存在，跳过刷新检查');
      return;
    }

    const fileExists = fs.existsSync(this.currentFilePath);
    console.log('[MDTODO-R47.1] 监测文件是否存在:', fileExists);

    if (!fileExists) {
      console.log('[MDTODO-R47.1] 监测文件不存在，跳过刷新检查');
      return;
    }

    try {
      const currentContent = fs.readFileSync(this.currentFilePath, 'utf-8');
      console.log('[MDTODO-R47.1] 读取到文件内容，长度:', currentContent.length, '字符');
      console.log('[MDTODO-R47.1] 记录的文件内容长度:', this.lastFileContent.length, '字符');

      // 比较文件内容是否有变化
      const hasChanges = currentContent !== this.lastFileContent;
      console.log('[MDTODO-R47.1] 文件是否有变化:', hasChanges);

      if (hasChanges) {
        console.log('[MDTODO-R47.1] 检测到文件变化，自动刷新...');
        await this.loadFile(this.currentFilePath);
        this.lastFileContent = currentContent;
        console.log('[MDTODO-R47.1] 刷新完成，已更新记录');
      } else {
        console.log('[MDTODO-R47.1] 文件无变化，但定期检查链接状态...');
        // 【R47.1】文件无变化时也要定期检查链接状态
        await this.checkAndUpdateLinkStatus();
      }
    } catch (error) {
      console.error('[MDTODO-R47.1] 检查文件变化失败:', error);
    }
  }

  /**
   * 【实现R47.1】检查并更新所有任务的链接状态
   * 用于定期刷新时检测新创建的链接文件
   */
  private async checkAndUpdateLinkStatus(): Promise<void> {
    if (!this.currentFilePath || this.currentTasks.length === 0) {
      return;
    }

    console.log('[MDTODO-R47.1] 开始检查链接状态...');

    // 重新解析文件以获取最新的链接状态
    const { TodoParser } = await import('../parser');
    const parser = new TodoParser();

    // 读取文件内容
    const content = fs.readFileSync(this.currentFilePath, 'utf-8');

    // 使用 parser 重新解析任务（只保留任务结构，不重新加载）
    // 我们需要更新每个任务的 linkCount 和 linkExists
    let hasLinkStatusChanges = false;

    // 遍历当前任务，更新链接状态
    const updateLinkStatusInTasks = async (tasks: any[]) => {
      for (const task of tasks) {
        // 从原始内容计算链接状态
        const linkStats = await this.calculateLinkStatsForTask(task.rawContent || task.description, content);

        // 检查是否有变化
        if (task.linkCount !== linkStats.linkCount || task.linkExists !== linkStats.linkExists) {
          console.log(`[MDTODO-R47.1] 任务 ${task.id} 链接状态变化: ${task.linkExists}/${task.linkCount} -> ${linkStats.linkExists}/${linkStats.linkCount}`);
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
      console.log('[MDTODO-R47.1] 链接状态有变化，刷新 webview...');
      this.sendToWebview();
    } else {
      console.log('[MDTODO-R47.1] 链接状态无变化');
    }
  }

  /**
   * 【实现R47.1】计算任务的链接统计信息
   * 从原始内容中提取链接并检查是否存在
   */
  private async calculateLinkStatsForTask(content: string, fullContent: string): Promise<{ linkCount: number; linkExists: number }> {
    // 从任务内容中提取链接
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
   * 【实现R47.1】解析链接为绝对路径
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
   * 发送数据到 webview（用于已有 panel 的情况）
   */
  private sendToWebview(): void {
    if (this.panel) {
      // console.log('[MDTODO] Sending updateTasks, tasks:', this.currentTasks.length, 'textBlocks:', this.currentTextBlocks.length);
      this.panel.webview.postMessage({
        type: 'updateTasks',
        tasks: this.serializeTasks(this.currentTasks),
        textBlocks: this.currentTextBlocks,
        filePath: this.currentFilePath
      });
    }
  }

  /**
   * 更新Webview内容
   */
  updateWebview(): void {
    if (this.panel) {
      this.sendToWebview();
    }
  }

  /**
   * 设置任务选择回调
   */
  onTaskSelected(callback: (task: TodoTask) => void): void {
    this.resolveCallback = callback;
  }

  /**
   * 序列化任务用于传递到Webview
   * 【修复R23.1】添加 rawContent 字段用于编辑时保留原始格式
   * 【修复R39.1】添加 linkCount 和 linkExists 字段用于显示链接状态
   */
  private serializeTasks(tasks: TodoTask[]): any[] {
    return tasks.map(task => ({
      id: task.id,
      title: task.title,
      description: task.description,
      rawContent: task.rawContent,  // 【修复R23.1】传递原始内容用于编辑
      completed: task.completed,
      processing: task.processing,
      children: task.children.length > 0 ? this.serializeTasks(task.children) : [],
      lineNumber: task.lineNumber,
      hasChildren: task.children.length > 0,
      level: this.getTaskLevel(task.id),
      // 【修复R39.1】传递链接统计信息
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
        // Webview 已准备好，发送数据
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
        // 【实现R37】打开原MDTODO文件
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
        // 【实现R46】延续任务：在最后一个子任务上添加延续按钮，创建下一个同级子任务
        await this.handleContinueTask(message.taskId);
        break;
      case 'webviewScrolled':
        await this.handleWebviewScrolled(message.taskId, message.lineNumber);
        break;
      case 'webviewActive':
        // 【实现R29.1】webview通知它成为焦点
        this.setWebviewAsActive();
        break;
      case 'saveTextBlock':
        // 【R13.5】保存普通文本块内容
        await this.handleSaveTextBlock(message.blockId, message.content);
        break;
    }
  }

  /**
   * 处理来自Webview的滚动事件 - 双向滚动同步
   * 当用户在webview中滚动时，找到对应的任务并滚动VSCode编辑器到该行
   * 【实现R29.1】只当webview是主动视图时才同步
   */
  private async handleWebviewScrolled(taskId: string, lineNumber: number): Promise<void> {
    // 【实现R29.1】检查webview是否是当前主动视图
    if (this.scrollSyncActiveView !== 'webview') {
      return;
    }

    console.log(`[MDTODO] Webview scrolled to task: ${taskId}, line: ${lineNumber}`);

    if (!this.currentFilePath || lineNumber < 0) {
      return;
    }

    // 获取当前活动的文本编辑器
    const activeEditor = vscode.window.activeTextEditor;

    // 检查活动编辑器是否打开的是同一个文件
    if (activeEditor && activeEditor.document.uri.fsPath === this.currentFilePath) {
      // 滚动编辑器到指定行
      const position = new vscode.Position(lineNumber, 0);
      activeEditor.revealRange(
        new vscode.Range(position, position),
        vscode.TextEditorRevealType.InCenter
      );
    }
  }

  /**
   * 设置滚动同步 - 监听VSCode编辑器的滚动事件并同步到webview
   * 供外部调用，用于启用滚动同步功能
   * 【实现R29.1】根据焦点状态决定是否同步：只有当editor是主动视图时才同步
   */
  public setupScrollSync(): void {
    // 监听编辑器可见范围变化（滚动事件）
    vscode.window.onDidChangeTextEditorVisibleRanges((event) => {
      const editor = event.textEditor;

      // 【实现R29.1】检查editor是否是当前主动视图
      if (this.scrollSyncActiveView !== 'editor') {
        return;
      }

      // 检查是否是当前打开的TODO文件
      if (!this.currentFilePath || !editor) {
        return;
      }

      if (editor.document.uri.fsPath !== this.currentFilePath) {
        return;
      }

      // 获取可见范围的第一行
      const visibleRanges = editor.visibleRanges;
      if (visibleRanges.length > 0) {
        const firstVisibleLine = visibleRanges[0].start.line;

        // 查找最接近当前可见行的任务
        const nearestTask = this.findNearestTask(firstVisibleLine);

        if (nearestTask && this.panel) {
          // 发送滚动位置到webview
          this.panel.webview.postMessage({
            type: 'scrollToTask',
            taskId: nearestTask.id,
            lineNumber: nearestTask.lineNumber
          });
        }
      }
    }, undefined, this.context.subscriptions);

    // 【实现R29.1】监听编辑器焦点变化
    vscode.window.onDidChangeActiveTextEditor((editor) => {
      // 当用户切换到编辑器时，editor成为主动视图
      if (editor && this.currentFilePath && editor.document.uri.fsPath === this.currentFilePath) {
        this.scrollSyncActiveView = 'editor';
        console.log('[MDTODO] 滚动同步：编辑器成为主动视图');
      }
    });

    // 【实现R29.1】监听webview面板焦点变化
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
   * 【实现R29.1】设置webview为滚动同步的主动视图
   * 由webview调用，当用户点击或滚动webview时触发
   */
  public setWebviewAsActive(): void {
    this.scrollSyncActiveView = 'webview';
    console.log('[MDTODO] 滚动同步：webview成为主动视图（用户交互）');
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
   * 【实现R37】【修改R37.1】打开原MDTODO文件（使用 VSCode）
   * 说明：md原文用VSCode打开，其他链接（如details里的文件）仍用Typora打开
   */
  private async handleOpenSourceFile(): Promise<void> {
    if (!this.currentFilePath) {
      vscode.window.showWarningMessage('未加载任何文件');
      return;
    }

    // 检查文件是否存在
    if (!fs.existsSync(this.currentFilePath)) {
      vscode.window.showErrorMessage(`文件不存在: ${this.currentFilePath}`);
      return;
    }

    console.log('[MDTODO] 打开原文件:', this.currentFilePath);

    // 【R37.1】使用 VSCode 打开 md 原文
    const uri = vscode.Uri.file(this.currentFilePath);
    await vscode.window.showTextDocument(uri);
  }

  /**
   * 处理保存标题
   * 完整实现：读取文件、查找任务行、更新任务内容、写入文件
   * 注意：编辑的是 RXX 换行后的任务内容，而不是 RXX 同行的标题
   * 【修复R22.10】正确处理多行内容，替换整个内容块而不是只替换第一行
   */
  private async handleSaveTitle(taskId: string, newTitle: string): Promise<void> {
    if (!this.currentFilePath) {
      vscode.window.showWarningMessage('请先打开一个TODO文件');
      return;
    }

    console.log(`保存标题: ${taskId} -> ${newTitle}`);

    try {
      const fileService = new FileService();
      const content = await fileService.readFile(vscode.Uri.file(this.currentFilePath));
      const lines = content.split('\n');

      // 找到任务所在的行
      let taskLineIndex = -1;
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        // 使用精确匹配避免部分ID匹配
        const taskPattern = new RegExp(`^##+\\s+[^\\n]*\\b${taskId.replace(/\./g, '\\.')}(?:[)\\s]|$)`);
        if (taskPattern.test(line)) {
          taskLineIndex = i;
          break;
        }
      }

      if (taskLineIndex === -1) {
        vscode.window.showWarningMessage(`未找到任务 ${taskId}`);
        return;
      }

      // 【修复R22.10】找到任务内容的结束位置
      // 规则：如果下一个任务是同级任务（ID不以当前任务ID为前缀），则内容结束
      // 子任务（如 R1.1）以 R1. 开头，被视为 R1 内容的一部分，但编辑时只替换直接描述
      let contentEndIndex = lines.length;
      let subtaskStartIndex = -1; // 子任务开始的行号
      for (let i = taskLineIndex + 1; i < lines.length; i++) {
        const line = lines[i].trim();
        // 检查是否是任务标题行（## 或 ### 开头，且包含 RXX）
        const taskHeaderMatch = line.match(/^##+\s+([^R]*R\d+(?:\.\d+)*)/);
        if (taskHeaderMatch) {
          const nextTaskId = taskHeaderMatch[1];
          // 第一个子任务开始的位置
          if (subtaskStartIndex === -1 && nextTaskId.startsWith(taskId + '.')) {
            subtaskStartIndex = i;
          }
          // 检查下一个任务是否是同级任务（不以当前任务ID为前缀）
          if (!nextTaskId.startsWith(taskId + '.')) {
            // 同级任务，内容结束
            contentEndIndex = i;
            break;
          }
        }
      }

      // 替换整个内容块：删除从 taskLineIndex+1 到 contentEndIndex 的所有行
      // 然后插入新内容（如果 newTitle 非空）
      const newLines: string[] = [];

      // 复制任务标题行之前的行
      for (let i = 0; i <= taskLineIndex; i++) {
        newLines.push(lines[i]);
      }

      // 添加新内容（如果 newTitle 非空）
      if (newTitle.trim()) {
        // 确保任务标题和内容之间有一个空行
        // 检查任务标题行末尾是否已有换行
        const taskLineEndsWithNewline = lines[taskLineIndex].endsWith('\n');
        if (!taskLineEndsWithNewline && newLines[newLines.length - 1] === lines[taskLineIndex]) {
          // 需要在任务标题后添加换行
          newLines.push('');
        } else if (taskLineEndsWithNewline && newLines.length > 0 && newLines[newLines.length - 1] === '') {
          // 已经有空行
        } else {
          // 需要添加一个空行
          newLines.push('');
        }

        // 添加新内容行
        newLines.push(newTitle);

        // 【修复R22.11】在内容后添加一个空行，确保内容块和下一个任务标题之间有两个换行符
        // 结构：任务内容后跟一个空行，然后下一个任务
        // join('\n') 会产生：...内容\n\n下一个任务...
        newLines.push('');

        // 如果有子任务，复制子任务内容
        if (subtaskStartIndex !== -1 && subtaskStartIndex < contentEndIndex) {
          // 复制子任务内容（从子任务开始到同级任务之前）
          for (let i = subtaskStartIndex; i < contentEndIndex; i++) {
            newLines.push(lines[i]);
          }
        }
      }

      // 复制同级任务及之后的内容
      for (let i = contentEndIndex; i < lines.length; i++) {
        newLines.push(lines[i]);
      }

      const newContent = newLines.join('\n');
      await fileService.writeFile(vscode.Uri.file(this.currentFilePath), newContent);

      // 调用 webview 的 refreshTaskTitle 方法来更新单个任务
      if (this.panel) {
        this.panel.webview.postMessage({
          type: 'refreshTaskTitle',
          taskId: taskId,
          newTitle: newTitle
        });
      }

      vscode.window.showInformationMessage(`任务 ${taskId} 内容已更新`);
    } catch (error: any) {
      console.error('[MDTODO] Error saving title:', error);
      vscode.window.showErrorMessage(`保存标题失败: ${error.message}`);
    }
  }

  /**
   * 【R13.5】处理保存普通文本块内容
   * 普通文本块是从文件开头到第一个任务之前的非任务内容
   */
  private async handleSaveTextBlock(blockId: string, newContent: string): Promise<void> {
    if (!this.currentFilePath) {
      vscode.window.showWarningMessage('请先打开一个TODO文件');
      return;
    }

    console.log(`[MDTODO] 保存文本块: ${blockId} -> ${newContent}`);

    try {
      const fileService = new FileService();
      const content = await fileService.readFile(vscode.Uri.file(this.currentFilePath));
      const lines = content.split('\n');

      // 从 blockId 中提取起始行号（格式：text-{lineNumber}）
      const lineNumber = parseInt(blockId.replace('text-', ''));
      if (isNaN(lineNumber)) {
        vscode.window.showWarningMessage(`无效的文本块ID: ${blockId}`);
        return;
      }

      // 找到第一个任务标题的位置（用于确定文本块结束位置）
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

      // 确定文本块的范围：从 lineNumber 到第一个任务标题之前
      const blockStartIndex = lineNumber;
      const blockEndIndex = firstTaskLine > 0 ? firstTaskLine : lines.length;

      // 替换文本块内容
      const newLines: string[] = [];

      // 复制文本块之前的行
      for (let i = 0; i < blockStartIndex; i++) {
        newLines.push(lines[i]);
      }

      // 添加新的文本块内容（按行分割，保持格式）
      const newContentLines = newContent.split('\n');
      for (const line of newContentLines) {
        newLines.push(line);
      }

      // 复制第一个任务及之后的内容
      for (let i = blockEndIndex; i < lines.length; i++) {
        newLines.push(lines[i]);
      }

      const newFileContent = newLines.join('\n');
      await fileService.writeFile(vscode.Uri.file(this.currentFilePath), newFileContent);

      // 重新加载文件
      await this.loadFile(this.currentFilePath);

      vscode.window.showInformationMessage(`文本块已更新`);
    } catch (error: any) {
      console.error('[MDTODO] Error saving text block:', error);
      vscode.window.showErrorMessage(`保存文本块失败: ${error.message}`);
    }
  }

  /**
   * 处理打开链接
   * 支持相对路径（如 ./docs/file.md、../file.md）和绝对路径/URL
   * .md 文件默认使用 Typora 打开
   */
  private async handleOpenLink(url: string): Promise<void> {
    try {
      console.log('[MDTODO] handleOpenLink 收到 URL:', url);

      if (url.startsWith('http://') || url.startsWith('https://')) {
        // 网页链接：在外部浏览器中打开
        await vscode.env.openExternal(vscode.Uri.parse(url));
        console.log('[MDTODO] 已打开网页链接:', url);
      } else {
        // 处理 file:// URL 协议
        if (url.startsWith('file://')) {
          // 移除 file:// 前缀
          url = url.slice(7);
        }

        // 处理可能的双重 URL 编码
        // 如果包含 %25（编码的 %），说明被编码了两次
        let decodedUrl = decodeURIComponent(url);
        if (decodedUrl !== decodedUrl.toLowerCase() || decodedUrl.includes('%25')) {
          // 尝试再次解码
          decodedUrl = decodeURIComponent(decodedUrl);
        }
        console.log('[MDTODO] 解码后的 URL:', decodedUrl);

        // 【修复R31.4】支持不带 ./ 前缀的相对路径，如 (xxx/) 或 (docs/file.md)
        // 相对路径不以 / 开头（Unix绝对路径），也不包含盘符（Windows绝对路径）
        const isRelativePath = !decodedUrl.startsWith('/') && !decodedUrl.match(/^[A-Za-z]:/);

        let absolutePath: string;

        if (isRelativePath) {
          // 相对路径：基于当前文件路径解析
          if (!this.currentFilePath) {
            vscode.window.showWarningMessage('无法确定当前文件路径');
            return;
          }

          // 获取当前文件的目录
          const currentDir = path.dirname(this.currentFilePath);
          // 解析相对路径为绝对路径
          absolutePath = path.resolve(currentDir, decodedUrl);
          console.log('[MDTODO] 相对路径解析:', decodedUrl, '->', absolutePath);
        } else {
          absolutePath = decodedUrl;
        }

        // 【实现R31.5】判断是否为 .md 文件
        const isMarkdownFile = absolutePath.toLowerCase().endsWith('.md');

        if (isMarkdownFile) {
          // 使用 Typora 打开 md 文件
          await this.openWithTypora(absolutePath);
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
   * 使用 Typora 打开 md 文件
   * 【实现R42】如果文件不存在，弹出对话框询问是否创建
   */
  private async openWithTypora(filePath: string): Promise<void> {
    try {
      // 【实现R42】检查文件是否存在，如果不存在则询问是否创建
      if (!fs.existsSync(filePath)) {
        // 弹出对话框询问是否创建文件
        const choice = await vscode.window.showWarningMessage(
          `文件不存在: ${filePath}`,
          { modal: true },
          '创建文件并打开',
          '取消'
        );

        if (choice === '创建文件并打开') {
          try {
            // 创建空文件
            const dir = path.dirname(filePath);
            if (!fs.existsSync(dir)) {
              fs.mkdirSync(dir, { recursive: true });
            }
            fs.writeFileSync(filePath, '', 'utf-8');
            console.log('[MDTODO] 已创建文件:', filePath);
          } catch (createError) {
            vscode.window.showErrorMessage(`创建文件失败: ${createError}`);
            return;
          }
        } else {
          // 用户选择取消，不执行任何操作
          console.log('[MDTODO] 用户取消创建文件');
          return;
        }
      }

      // 获取平台信息
      const platform = process.platform;
      let typoraPath: string | null = null;

      if (platform === 'win32') {
        // Windows: 查找常见的 Typora 安装路径
        const possiblePaths = [
          'C:\\Program Files\\Typora\\Typora.exe',
          'C:\\Program Files (x86)\\Typora\\Typora.exe',
          path.join(process.env.LOCALAPPDATA || '', 'Programs\\Typora\\Typora.exe'),
        ];

        for (const p of possiblePaths) {
          if (fs.existsSync(p)) {
            typoraPath = p;
            break;
          }
        }

        if (typoraPath) {
          // Windows 直接启动 Typora，避免黑窗
          spawn(typoraPath, [filePath], {
            detached: true,
            stdio: 'ignore',
            windowsHide: true
          });
          console.log('[MDTODO] 已使用 Typora 打开:', filePath);
        } else {
          // 如果找不到 Typora，回退到 VSCode
          vscode.window.showWarningMessage('未找到 Typora，使用 VSCode 打开');
          const uri = vscode.Uri.file(filePath);
          await vscode.window.showTextDocument(uri);
        }
      } else if (platform === 'darwin') {
        // macOS
        spawn('open', ['-a', 'Typora', filePath], {
          detached: true,
          stdio: 'ignore'
        });
        console.log('[MDTODO] 已使用 Typora 打开:', filePath);
      } else {
        // Linux
        spawn('typora', [filePath], {
          detached: true,
          stdio: 'ignore'
        });
        console.log('[MDTODO] 已使用 Typora 打开:', filePath);
      }
    } catch (error) {
      console.error('[MDTODO] 使用 Typora 打开失败:', error);
      // 回退到 VSCode
      const uri = vscode.Uri.file(filePath);
      await vscode.window.showTextDocument(uri);
    }
  }

  /**
   * 处理打开文件（公开方法，供外部调用）
   */
  public async handleOpenFile(): Promise<void> {
    // 获取FileService并显示文件选择器
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
   * 尝试加载文件到webview，如果格式不匹配返回false
   */
  public async tryLoadFile(filePath: string): Promise<boolean> {
    const { FileService } = await import('../services/fileService');
    const { TodoParser } = await import('../parser');
    const fileService = new FileService();
    const parser = new TodoParser();

    try {
      const content = await fileService.readFile(vscode.Uri.file(filePath));

      // 检查格式：## 或 ### 开头的任务行，并且有 R 开头的ID
      const hasTodoFormat = /##+\s.*R\d+/.test(content);

      if (hasTodoFormat) {
        console.log('[MDTODO] Format matched for:', filePath);
        const tasks = parser.parse(content, filePath);
        const textBlocks = parser.parseTextBlocks(content);
        console.log('[MDTODO] Parsed tasks count:', tasks.length, 'textBlocks:', textBlocks.length);
        this.currentTasks = tasks;
        this.currentTextBlocks = textBlocks;
        this.currentFilePath = filePath;
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
   * 加载文件到webview（公开方法）
   * 【R34.2】修复：加载文件后更新面板标题为当前文件名
   */
  public async loadFile(filePath: string): Promise<boolean> {
    console.log('[MDTODO] loadFile called:', filePath);

    const { FileService } = await import('../services/fileService');
    const { TodoParser } = await import('../parser');
    const fileService = new FileService();
    const parser = new TodoParser();

    try {
      const content = await fileService.readFile(vscode.Uri.file(filePath));

      // 检查格式：## 或 ### 开头的任务行，并且有 R 开头的ID
      const hasTodoFormat = /##+\s.*R\d+/.test(content);
      console.log('[MDTODO] hasTodoFormat:', hasTodoFormat);

      if (hasTodoFormat) {
        const tasks = parser.parse(content, filePath);
        const textBlocks = parser.parseTextBlocks(content);
        console.log('[MDTODO] Parsed tasks count:', tasks.length, 'textBlocks:', textBlocks.length);
        this.currentTasks = tasks;
        this.currentTextBlocks = textBlocks;
        this.currentFilePath = filePath;
        // 【R34.2】加载文件后更新面板标题
        this.updatePanelTitle();
        this.updateWebview();
        // 【实现R47】记录文件内容用于后续比较
        await this.recordCurrentFileContent();
        return true;
      } else {
        console.log('[MDTODO] Format not matched, setting empty state');
        // 格式不匹配时，仍显示文件名但任务列表为空
        this.currentTasks = [];
        this.currentFilePath = filePath;
        // 【R34.2】加载文件后更新面板标题
        this.updatePanelTitle();
        this.updateWebview();
        // 【实现R47】记录文件内容用于后续比较
        await this.recordCurrentFileContent();
        return false;
      }
    } catch (error: any) {
      console.error('[MDTODO] Error loading file:', error);
      return false;
    }
  }

  /**
   * 【R34.2】更新面板标题为当前文件名
   */
  private updatePanelTitle(): void {
    if (this.panel && this.currentFilePath) {
      const panelTitle = this.getFileNameFromPath(this.currentFilePath);
      this.panel.title = panelTitle;
    }
  }

  /**
   * 处理任务选择
   */
  private async handleTaskSelected(taskId: string): Promise<void> {
    const task = this.findTask(this.currentTasks, taskId);
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
   * 处理Claude执行（来自Webview）
   * 添加 [Processing] 标记到任务，并在执行完成后移除
   */
  private async handleClaudeExecute(taskId: string): Promise<void> {
    if (!this.currentFilePath) {
      vscode.window.showWarningMessage('请先打开一个TODO文件');
      return;
    }

    try {
      // 1. 添加 [Processing] 标记
      await this.markTaskAsProcessing(taskId, true);
      // 刷新显示
      await this.loadFile(this.currentFilePath);

      // 2. 执行 Claude 任务
      await this.handleExecuteTask(taskId);

      // 3. 执行完成后移除 [Processing] 标记
      // 注意：由于 Claude 是异步执行的，这里不等待，直接返回
      // 用户可以手动点击完成来标记任务完成
      // 或者实现一个机制来检测 Claude 执行完成
    } catch (error: any) {
      // 如果执行失败，也移除 [Processing] 标记
      await this.markTaskAsProcessing(taskId, false);
      await this.loadFile(this.currentFilePath);
      console.error('[MDTODO] Error in Claude execute:', error);
      vscode.window.showErrorMessage(`执行失败: ${error.message}`);
    }
  }

  /**
   * 设置任务的 [Processing] 状态
   */
  private async markTaskAsProcessing(taskId: string, isProcessing: boolean): Promise<void> {
    const fileService = new FileService();
    const content = await fileService.readFile(vscode.Uri.file(this.currentFilePath));
    const lines = content.split('\n');

    // 找到任务所在的行（必须是 ## 或 ### 开头的任务标题行）
    let taskLineIndex = -1;
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      // 必须匹配 ## 或 ### 或 #### 开头的任务标题行，使用精确匹配避免匹配到描述行
      // 格式如: ## R17, ### R17.1, #### R17.1.1, ## R17 [Finished]
      // 【修复R43】支持更多级别的标题（2-6个#），以匹配多级任务如 R1.1.1
      const taskHeaderPattern = new RegExp(`^#{2,6}\\s+[^\\n]*\\b${taskId.replace(/\./g, '\\.')}(?:[)\\s]|$)`);
      if (taskHeaderPattern.test(line)) {
        taskLineIndex = i;
        break;
      }
    }

    if (taskLineIndex === -1) {
      console.warn(`[MDTODO] 未找到任务 ${taskId}，无法设置 Processing 状态`);
      return;
    }

    const line = lines[taskLineIndex];
    const hasFinished = line.includes('[Finished]');
    const hasProcessing = line.includes('[Processing]');

    // 如果已经有 [Finished]，不添加 [Processing]
    if (hasFinished) {
      console.warn(`[MDTODO] 任务 ${taskId} 已完成，不添加 Processing 标记`);
      return;
    }

    // 如果状态已经是我们要设置的状态，不做修改
    if (isProcessing && hasProcessing) return;
    if (!isProcessing && !hasProcessing) return;

    // 添加或移除 [Processing] 标记
    // 任务行格式如: ## R17, ### R17.1, ## R17 [Finished]
    // [Processing] 应该添加在任务ID之后，其他标记之前
    if (isProcessing) {
      // 在任务ID后添加 [Processing]，在可能存在的 [Finished] 之前
      const taskIdPattern = new RegExp(`(${taskId.replace(/\./g, '\\.')})(\\s*\\[)`);
      if (taskIdPattern.test(line)) {
        // 有其他标记（如 [Finished]），在ID和标记之间插入
        lines[taskLineIndex] = line.replace(taskIdPattern, '$1 [Processing]$2');
      } else {
        // 没有其他标记，直接在ID后添加
        lines[taskLineIndex] = line.replace(taskIdPattern, '$1 [Processing]$2');
        // 如果上面的替换没生效（可能ID不在最后），尝试简单替换
        if (lines[taskLineIndex] === line) {
          const simplePattern = new RegExp(`(${taskId.replace(/\./g, '\\.')})(\\s*)$`);
          lines[taskLineIndex] = line.replace(simplePattern, '$1 [Processing]$2');
        }
      }
    } else {
      // 移除 [Processing] 标记
      lines[taskLineIndex] = line.replace(/\s*\[Processing\]/, '');
    }

    const newContent = lines.join('\n');
    await fileService.writeFile(vscode.Uri.file(this.currentFilePath), newContent);
    console.log(`[MDTODO] 任务 ${taskId} Processing状态设置为: ${isProcessing}`);
  }

  /**
   * 处理标记完成
   * 切换任务的完成状态：已完成的点击后取消完成，未完成的点击后标记完成
   */
  private async handleMarkComplete(taskId: string): Promise<void> {
    if (!this.currentFilePath) {
      vscode.window.showWarningMessage('请先打开一个TODO文件');
      return;
    }

    // 获取当前任务状态
    const task = this.findTask(this.currentTasks, taskId);
    if (!task) {
      vscode.window.showWarningMessage(`未找到任务 ${taskId}`);
      return;
    }

    // 切换完成状态：如果已完成则移除标记，否则添加标记
    const isComplete = !task.completed;
    await this.markTaskAsFinished(taskId, isComplete);

    // 重新加载文件并刷新显示
    await this.loadFile(this.currentFilePath);

    vscode.window.showInformationMessage(`任务 ${taskId} 已${isComplete ? '标记完成' : '取消完成'}`);
  }

  /**
   * 设置任务的 [Finished] 状态
   * 添加或移除 [Finished] 标记，支持处理 [Processing] 标记
   * 【R26.2】允许在 Processing 状态下标记完成，同时移除 Processing 标记
   */
  private async markTaskAsFinished(taskId: string, isFinished: boolean): Promise<void> {
    const fileService = new FileService();
    const content = await fileService.readFile(vscode.Uri.file(this.currentFilePath));
    const lines = content.split('\n');

    // 找到任务所在的行（必须是 ## 或 ### 或 #### 开头的任务标题行）
    let taskLineIndex = -1;
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      // 必须匹配 ## 或 ### 或 #### 开头的任务标题行，使用精确匹配避免匹配到描述行
      // 格式如: ## R26, ### R26.1, #### R26.1.1, ## R26 [Finished], ## R26 [Processing]
      // 【修复R43】支持更多级别的标题（2-6个#），以匹配多级任务如 R1.1.1
      const taskHeaderPattern = new RegExp(`^#{2,6}\\s+[^\\n]*\\b${taskId.replace(/\./g, '\\.')}(?:[)\\s]|$)`);
      if (taskHeaderPattern.test(line)) {
        taskLineIndex = i;
        break;
      }
    }

    if (taskLineIndex === -1) {
      console.warn(`[MDTODO] 未找到任务 ${taskId}，无法设置 Finished 状态`);
      return;
    }

    const line = lines[taskLineIndex];
    const hasFinished = line.includes('[Finished]');
    const hasProcessing = line.includes('[Processing]');

    // 如果状态已经是我们要设置的状态，不做修改
    if (isFinished && hasFinished) return;
    if (!isFinished && !hasFinished) return;

    // 【R26.2】允许在 Processing 状态下标记完成，同时移除 Processing 标记
    // 不再检查 hasProcessing，允许用户直接完成任务

    // 添加或移除 [Finished] 标记
    // 任务行格式如: ## R26, ### R26.1, ## R26 [Processing]
    // 【R26.2】[Finished] 应该添加在任务ID之后，同时移除 [Processing] 标记
    if (isFinished) {
      // 在任务ID后添加 [Finished]，并移除 [Processing] 标记
      let newLine = line;

      // 如果有 [Processing] 标记，先移除它
      if (hasProcessing) {
        newLine = newLine.replace(/\s*\[Processing\]/, '');
      }

      // 然后添加 [Finished] 标记
      const taskIdPattern = new RegExp(`(${taskId.replace(/\./g, '\\.')})(\\s*)$`);
      newLine = newLine.replace(taskIdPattern, '$1 [Finished]');

      lines[taskLineIndex] = newLine;
    } else {
      // 移除 [Finished] 标记
      lines[taskLineIndex] = line.replace(/\s*\[Finished\]/, '');
    }

    const newContent = lines.join('\n');
    await fileService.writeFile(vscode.Uri.file(this.currentFilePath), newContent);
    console.log(`[MDTODO] 任务 ${taskId} Finished状态设置为: ${isFinished}`);
  }

  /**
   * 生成新任务的内容模板
   * 【R36.1】统一主任务和子任务的添加逻辑
   * 【R49】修改报告文件命名方式：使用时间戳命名，如 20260123_1050_Task_Report.md
   * @param taskId 新任务ID
   * @param parentTaskId 父任务ID（如果有则为子任务）
   * @returns 新任务的内容模板字符串
   */
  private generateNewTaskContent(taskId: string, parentTaskId?: string): string {
    // 构建报告文件路径
    const fileName = path.basename(this.currentFilePath, '.md');
    // 【R49】使用时间戳格式命名：YYYYMMDD_HHmm_Task_Report.md
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const timestamp = `${year}${month}${day}_${hours}${minutes}`;
    const reportPath = `./details/${fileName}/${timestamp}_Task_Report.md`;

    // 确定标题级别：主任务用 ##，子任务用 ###
    const headerLevel = parentTaskId ? '###' : '##';

    // 生成内容模板（带逗号）
    return `${headerLevel} ${taskId}\n\n, 完成任务后将详细报告写入[${taskId}](${reportPath})。`;
  }

  /**
   * 处理添加任务
   * 【R36】添加报告模板：完成任务后将详细报告写入[Rxx](path_to_rxx)
   * 【R36.1】使用公共函数 generateNewTaskContent
   */
  private async handleAddTask(): Promise<void> {
    if (!this.currentFilePath) {
      vscode.window.showWarningMessage('请先打开一个TODO文件');
      return;
    }

    // 获取当前所有任务的ID，生成新的任务编号
    const allTaskIds = this.getAllTaskIds(this.currentTasks);
    const newId = this.generateNewTaskId(allTaskIds);

    // 【R36.1】使用公共函数生成任务内容
    const newTaskContent = this.generateNewTaskContent(newId);

    try {
      const fileService = new FileService();
      const content = await fileService.readFile(vscode.Uri.file(this.currentFilePath));
      const lines = content.split('\n');

      // 找到最后一个任务的位置，在其后添加新任务
      // 注意：不再跳过 [Finished] 的任务，因为已完成的任务也是文件中的最后一个任务
      let lastTaskEnd = lines.length;
      for (let i = lines.length - 1; i >= 0; i--) {
        const line = lines[i].trim();
        if (line.match(/^##+\s+/) && line.match(/R\d+(?:\.\d+)*/)) {
          // 找到最后一个任务标题，往后找到其内容结束位置
          lastTaskEnd = i;
          for (let j = i + 1; j < lines.length; j++) {
            const nextLine = lines[j].trim();
            // 检查是否是任务标题行（包含 [Finished] 的也算）
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

      // 在最后一个任务后插入新任务
      lines.splice(lastTaskEnd, 0, newTaskContent);
      const newContent = lines.join('\n');
      await fileService.writeFile(vscode.Uri.file(this.currentFilePath), newContent);

      // 重新加载文件并通知webview新任务的ID用于滚动和聚焦
      await this.loadFile(this.currentFilePath);
      this.notifyNewTask(newId);
    } catch (error: any) {
      console.error('[MDTODO] Error adding task:', error);
      vscode.window.showErrorMessage(`添加任务失败: ${error.message}`);
    }
  }

  /**
   * 通知webview新添加的任务ID，用于滚动和聚焦
   */
  private notifyNewTask(taskId: string): void {
    if (this.panel) {
      this.panel.webview.postMessage({
        type: 'newTaskAdded',
        taskId: taskId
      });
    }
  }

  /**
   * 处理删除任务
   * 修复：
   * 1. 使用精确的任务ID匹配（避免 R1 误匹配 R10 或 R4.1）
   * 2. 基于层级判断边界，不再跳过 [Finished] 状态的任务
   */
  private async handleDeleteTask(taskId: string): Promise<void> {
    if (!this.currentFilePath) {
      vscode.window.showWarningMessage('请先打开一个TODO文件');
      return;
    }

    try {
      const fileService = new FileService();
      const content = await fileService.readFile(vscode.Uri.file(this.currentFilePath));

      // 找到任务所在的行
      const lines = content.split('\n');
      let startLine = -1;
      let endLine = -1;
      let taskLevel = 0;

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        // 检查是否是任务标题行，使用精确匹配避免部分ID匹配
        // 例如 R1 不会匹配 R10 或 R4.1
        const taskPattern = new RegExp(`^##+\\s+[^\\n]*\\b${taskId.replace(/\./g, '\\.')}(?:[)\\s]|$)`);
        if (taskPattern.test(line)) {
          startLine = i;
          // 计算任务层级（#的数量）
          const match = line.match(/^(#+)/);
          taskLevel = match ? match[1].length : 2;
          // 查找下一个同级或更高级别任务标题或文件结束
          for (let j = i + 1; j < lines.length; j++) {
            const nextLine = lines[j].trim();
            // 检查是否是任务标题行（不再跳过 [Finished] 状态的任务）
            if (nextLine.match(/^##+\s+/) && nextLine.match(/R\d+(?:\.\d+)*/)) {
              const nextMatch = nextLine.match(/^(#+)/);
              const nextLevel = nextMatch ? nextMatch[1].length : 2;
              // 如果是同级或更高级别任务，说明当前任务内容结束
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
        return;
      }

      // 删除任务及其内容
      lines.splice(startLine, endLine - startLine);
      const newContent = lines.join('\n');

      await fileService.writeFile(vscode.Uri.file(this.currentFilePath), newContent);

      vscode.window.showInformationMessage(`任务 ${taskId} 已删除`);

      // 重新加载文件
      await this.loadFile(this.currentFilePath);
    } catch (error: any) {
      console.error('[MDTODO] Error deleting task:', error);
      vscode.window.showErrorMessage(`删除任务失败: ${error.message}`);
    }
  }

  /**
   * 处理添加子任务
   * 【R36】添加报告模板：完成任务后将详细报告写入[Rxx](path_to_rxx)
   * 【R36.1】使用公共函数 generateNewTaskContent 统一添加逻辑
   */
  private async handleAddSubTask(parentTaskId: string): Promise<void> {
    if (!this.currentFilePath) {
      vscode.window.showWarningMessage('请先打开一个TODO文件');
      return;
    }

    // 获取当前所有任务的ID，生成新的子任务编号
    const allTaskIds = this.getAllTaskIds(this.currentTasks);
    const newId = this.generateNewTaskId(allTaskIds, parentTaskId);

    // 【R36.1】使用公共函数生成任务内容（传入父任务ID以生成正确的标题级别）
    const newTaskContent = this.generateNewTaskContent(newId, parentTaskId);

    try {
      const fileService = new FileService();
      const content = await fileService.readFile(vscode.Uri.file(this.currentFilePath));
      const lines = content.split('\n');

      // 找到父任务的位置和层级
      let parentLine = -1;
      let parentLevel = 0;
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (line.includes(parentTaskId)) {
          parentLine = i;
          // 计算父任务的层级（#的数量）
          const match = line.match(/^(#+)/);
          parentLevel = match ? match[1].length : 2;
          break;
        }
      }

      if (parentLine === -1) {
        vscode.window.showWarningMessage(`未找到父任务 ${parentTaskId}`);
        return;
      }

      // 找到父任务内容的结束位置（下一个同级或更高级别任务之前）
      let insertPos = -1;
      for (let j = parentLine + 1; j < lines.length; j++) {
        const line = lines[j].trim();
        // 如果是任务标题行
        if (line.match(/^##+\s+/)) {
          const match = line.match(/^(#+)/);
          const level = match ? match[1].length : 2;
          // 如果是同级或更高级别的任务，说明父任务内容结束
          if (level <= parentLevel) {
            insertPos = j;
            break;
          }
        }
      }
      // 如果没找到，插在文件末尾
      if (insertPos === -1) {
        insertPos = lines.length;
      }

      // 在父任务内容后插入子任务
      lines.splice(insertPos, 0, newTaskContent);
      const newContent = lines.join('\n');

      await fileService.writeFile(vscode.Uri.file(this.currentFilePath), newContent);

      // 重新加载文件并通知webview新任务的ID用于滚动和聚焦
      await this.loadFile(this.currentFilePath);
      this.notifyNewTask(newId);
    } catch (error: any) {
      console.error('[MDTODO] Error adding subtask:', error);
      vscode.window.showErrorMessage(`添加子任务失败: ${error.message}`);
    }
  }

  /**
   * 【实现R46】处理延续任务
   * 在最后一个子任务上添加延续按钮，创建下一个同级子任务
   * 例如 R2.5 按延续按钮会创建 R2.6
   */
  private async handleContinueTask(currentTaskId: string): Promise<void> {
    if (!this.currentFilePath) {
      vscode.window.showWarningMessage('请先打开一个TODO文件');
      return;
    }

    // 获取当前所有任务的ID
    const allTaskIds = this.getAllTaskIds(this.currentTasks);

    // 解析当前任务ID，获取父任务ID
    // 例如 R2.5 -> parentId = 'R2', currentNumber = 5
    const parts = currentTaskId.split('.');
    if (parts.length < 2) {
      vscode.window.showWarningMessage('延续任务只能在子任务上使用');
      return;
    }

    // 生成新的任务ID（同级）
    const parentId = parts.slice(0, -1).join('.');
    const newId = this.generateNewTaskId(allTaskIds, parentId);

    // 【R36.1】使用公共函数生成任务内容（传入父任务ID以生成正确的标题级别）
    const newTaskContent = this.generateNewTaskContent(newId, parentId);

    try {
      const fileService = new FileService();
      const content = await fileService.readFile(vscode.Uri.file(this.currentFilePath));
      const lines = content.split('\n');

      // 找到当前任务的位置
      let currentLine = -1;
      let currentLevel = 0;
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        // 必须匹配任务标题行（使用精确匹配避免部分ID匹配）
        const taskPattern = new RegExp(`^#{2,6}\\s+[^\\n]*\\b${currentTaskId.replace(/\./g, '\\.')}(?:[)\\s]|$)`);
        if (taskPattern.test(line)) {
          currentLine = i;
          // 计算当前任务的层级（#的数量）
          const match = line.match(/^(#+)/);
          currentLevel = match ? match[1].length : 2;
          break;
        }
      }

      if (currentLine === -1) {
        vscode.window.showWarningMessage(`未找到任务 ${currentTaskId}`);
        return;
      }

      // 找到当前任务的结束位置（下一个同级或更高级别任务之前）
      let insertPos = -1;
      for (let j = currentLine + 1; j < lines.length; j++) {
        const line = lines[j].trim();
        // 如果是任务标题行
        if (line.match(/^##+\s+/)) {
          const match = line.match(/^(#+)/);
          const level = match ? match[1].length : 2;
          // 如果是同级或更高级别的任务，说明当前任务内容结束
          if (level <= currentLevel) {
            insertPos = j;
            break;
          }
        }
      }
      // 如果没找到，插在文件末尾
      if (insertPos === -1) {
        insertPos = lines.length;
      }

      // 在当前任务后插入新任务
      lines.splice(insertPos, 0, newTaskContent);
      const newContent = lines.join('\n');

      await fileService.writeFile(vscode.Uri.file(this.currentFilePath), newContent);

      // 重新加载文件并通知webview新任务的ID用于滚动和聚焦
      await this.loadFile(this.currentFilePath);
      this.notifyNewTask(newId);

      console.log(`[MDTODO] 延续任务: ${currentTaskId} -> ${newId}`);
    } catch (error: any) {
      console.error('[MDTODO] Error continuing task:', error);
      vscode.window.showErrorMessage(`延续任务失败: ${error.message}`);
    }
  }

  /**
   * 获取所有任务ID
   */
  private getAllTaskIds(tasks: TodoTask[]): string[] {
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
  private generateNewTaskId(existingIds: string[], parentId?: string): string {
    if (parentId) {
      // 生成子任务ID，如 R1 -> R1.1
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
      // 生成主任务ID，如 R6, R7
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
   * 处理刷新 - 直接重新加载当前文件
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
   * 查找任务
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
    const cssUri = this.panel!.webview.asWebviewUri(
      vscode.Uri.joinPath(this.context.extensionUri, 'resources', 'style.css')
    );
    const bundleUri = this.panel!.webview.asWebviewUri(
      vscode.Uri.joinPath(this.context.extensionUri, 'resources', 'bundle.js')
    );

    try {
      let html = fs.readFileSync(templatePath, 'utf-8');
      html = html.replace('{{STYLE_CSS_URI}}', cssUri.toString());
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
    this.updateWebview();
  }

  /**
   * 关闭面板
   */
  dispose(): void {
    // 【实现R47】停止定期刷新定时器
    this.stopPeriodicRefresh();
    if (this.panel) {
      this.panel.dispose();
      this.panel = undefined;
    }
  }

  /**
   * 检查面板是否已打开
   */
  isVisible(): boolean {
    return this.panel !== undefined;
  }
}

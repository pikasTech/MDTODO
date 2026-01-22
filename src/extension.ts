import * as vscode from 'vscode';
import { TodoParser } from './parser';
import { TodoWebviewProvider } from './providers/webviewProvider';
import { FileService } from './services/fileService';
import { ClaudeService } from './services/claudeService';
import { TodoTask } from './types';

// 【实现R34.1】使用 Map 管理多个 webview provider，每个文件对应一个
const webviewProviders = new Map<string, TodoWebviewProvider>();
let parser: TodoParser;
let fileService: FileService;
let claudeService: ClaudeService;

/**
 * 获取或创建指定文件的 webview provider
 */
function getWebviewProvider(filePath: string): TodoWebviewProvider {
  // 规范化文件路径（使用大小写不敏感的比对）
  const normalizedPath = filePath.toLowerCase();

  // 查找已存在的 provider
  for (const [path, provider] of webviewProviders) {
    if (path.toLowerCase() === normalizedPath) {
      return provider;
    }
  }

  // 不存在，创建新的 provider
  // 注意：需要在 extensionContext 中创建，这里使用全局的 context
  const context = getExtensionContext();
  if (!context) {
    throw new Error('Extension context not available');
  }

  const provider = new TodoWebviewProvider(context);
  webviewProviders.set(filePath, provider);
  return provider;
}

/**
 * 获取 extension context（需要在 activate 中设置）
 */
let extensionContext: vscode.ExtensionContext | null = null;

function getExtensionContext(): vscode.ExtensionContext {
  if (!extensionContext) {
    throw new Error('Extension not activated');
  }
  return extensionContext;
}

/**
 * 检查指定文件的 webview 是否已打开且显示该文件
 */
function isWebviewOpenForFile(filePath: string): boolean {
  const normalizedPath = filePath.toLowerCase();
  for (const [path, provider] of webviewProviders) {
    if (path.toLowerCase() === normalizedPath) {
      return provider.isVisible();
    }
  }
  return false;
}

export function activate(context: vscode.ExtensionContext) {
  console.log('MDTODO插件已激活');

  // 保存 extension context 供后续使用
  extensionContext = context;

  // 初始化服务
  parser = new TodoParser();
  fileService = new FileService();
  claudeService = new ClaudeService();

  // 注册打开独立视图命令
  context.subscriptions.push(
    vscode.commands.registerCommand('mdtodo.openView', async () => {
      // 加载默认TODO文件
      const files = await fileService.findTodoFiles();
      console.log('[MDTODO] openView found', files.length, 'files');
      files.forEach((f, i) => console.log(`[MDTODO] openView File ${i}:`, f.fsPath));

      if (files.length > 0) {
        // 优先选择包含 MDTODO 的文件
        const mdtodoFiles = files.filter(f => f.fsPath.includes('MDTODO'));
        const targetFiles = mdtodoFiles.length > 0 ? mdtodoFiles : files;

        // 按修改时间排序，最新的优先
        const sortedFiles = await Promise.all(
          targetFiles.map(async (file) => {
            try {
              const stat = await vscode.workspace.fs.stat(file);
              return { file, mtime: stat.mtime };
            } catch {
              return { file, mtime: 0 };
            }
          })
        );
        sortedFiles.sort((a, b) => b.mtime - a.mtime);

        const targetFile = sortedFiles[0].file.fsPath;
        console.log('[MDTODO] Target file (sorted by time):', targetFile);

        // 【实现R34.1】使用 getWebviewProvider 获取或创建 provider
        const provider = getWebviewProvider(targetFile);
        provider.showPanel();
        await provider.loadFile(targetFile);

        // 设置任务选择回调
        provider.onTaskSelected((task: TodoTask) => {
          vscode.window.showInformationMessage(`选中任务: ${task.id} - ${task.title}`);
        });
      }
    })
  );

  // 注册打开TODO文件命令
  context.subscriptions.push(
    vscode.commands.registerCommand('mdtodo.openFile', async () => {
      const files = await fileService.findTodoFiles();
      console.log('[MDTODO] findTodoFiles found:', files.length, 'files');
      files.forEach((f, i) => console.log(`[MDTODO] File ${i}:`, f.fsPath));

      if (files.length === 0) {
        vscode.window.showInformationMessage('未找到TODO文件 (*TODO*.md)');
        return;
      }

      if (files.length === 1) {
        const targetFile = files[0].fsPath;
        const provider = getWebviewProvider(targetFile);
        provider.showPanel();
        await provider.loadFile(targetFile);

        provider.onTaskSelected((task: TodoTask) => {
          vscode.window.showInformationMessage(`选中任务: ${task.id} - ${task.title}`);
        });
      } else {
        const selected = await vscode.window.showQuickPick(
          files.map(f => ({
            label: vscode.workspace.asRelativePath(f),
            uri: f
          })),
          { placeHolder: '选择TODO文件' }
        );

        if (selected) {
          const targetFile = selected.uri.fsPath;
          const provider = getWebviewProvider(targetFile);
          provider.showPanel();
          await provider.loadFile(targetFile);

          provider.onTaskSelected((task: TodoTask) => {
            vscode.window.showInformationMessage(`选中任务: ${task.id} - ${task.title}`);
          });
        }
      }
    })
  );

  // 注册刷新命令
  context.subscriptions.push(
    vscode.commands.registerCommand('mdtodo.refresh', async () => {
      const files = await fileService.findTodoFiles();
      if (files.length > 0) {
        const provider = getWebviewProvider(files[0].fsPath);
        await provider.loadFile(files[0].fsPath);
      }
    })
  );

  // 注册执行任务命令
  context.subscriptions.push(
    vscode.commands.registerCommand('mdtodo.executeTask', async (task: TodoTask) => {
      const files = await fileService.findTodoFiles();
      if (files.length > 0) {
        const result = await claudeService.executeTask(files[0].fsPath, task.id);
        vscode.window.showInformationMessage(result.output);
      }
    })
  );

  // 注册从预览打开命令
  context.subscriptions.push(
    vscode.commands.registerCommand('mdtodo.openFromPreview', async () => {
      console.log('[MDTODO] openFromPreview called');

      // 尝试多种方式获取当前 markdown 文件
      let uri: vscode.Uri | null = null;

      // 方式1: 获取活动编辑器
      const activeEditor = vscode.window.activeTextEditor;
      if (activeEditor && activeEditor.document.languageId === 'markdown') {
        uri = activeEditor.document.uri;
        console.log('[MDTODO] Got from activeEditor:', uri.fsPath);
      }

      // 方式2: 如果 activeEditor 为空，遍历可见编辑器查找 markdown
      if (!uri) {
        const visibleEditors = vscode.window.visibleTextEditors;
        const markdownEditor = visibleEditors.find(e => e.document.languageId === 'markdown');
        if (markdownEditor) {
          uri = markdownEditor.document.uri;
          console.log('[MDTODO] Got from visibleEditors:', uri.fsPath);
        }
      }

      // 方式3: 从 tabGroups 获取当前激活的 tab
      if (!uri) {
        try {
          const activeTab = vscode.window.tabGroups.activeTabGroup.activeTab;
          if (activeTab && activeTab.input instanceof vscode.TabInputText) {
            const input = activeTab.input as vscode.TabInputText;
            if (input.uri.path.endsWith('.md')) {
              uri = input.uri;
              console.log('[MDTODO] Got from tabGroups:', uri.fsPath);
            }
          }
        } catch (e) {
          console.log('[MDTODO] tabGroups API not available');
        }
      }

      if (uri) {
        const filePath = uri.fsPath;

        // 【实现R34.1】检查是否已经为该文件打开了一个 webview
        if (isWebviewOpenForFile(filePath)) {
          // 文件已在 webview 中显示，直接切换到该面板
          const provider = getWebviewProvider(filePath);
          provider.showPanel();
          // 刷新内容
          await provider.loadFile(filePath);
        } else {
          // 未打开，创建新的 webview
          const provider = getWebviewProvider(filePath);
          provider.showPanel();
          await provider.loadFile(filePath);

          // 设置任务选择回调
          provider.onTaskSelected((task: TodoTask) => {
            vscode.window.showInformationMessage(`选中任务: ${task.id} - ${task.title}`);
          });
        }
      } else {
        console.log('[MDTODO] No markdown file found');
        vscode.window.showInformationMessage('请先打开一个Markdown文件');
      }
    })
  );

  // 注册文件监听
  setupFileWatcher(context);

  // 启动时打开独立视图
  vscode.commands.executeCommand('mdtodo.openView');
}

function setupFileWatcher(context: vscode.ExtensionContext): void {
  const watcher = vscode.workspace.createFileSystemWatcher(
    '**/*TODO*.md',
    false,
    false,
    false
  );

  watcher.onDidChange(async (uri: vscode.Uri) => {
    try {
      const filePath = uri.fsPath;
      // 【实现R34.1】找到对应文件的 provider 并刷新
      const provider = webviewProviders.get(filePath);
      if (provider) {
        const content = await fileService.readFile(uri);
        const tasks = parser.parse(content, filePath);
        provider.refresh(tasks, filePath);
        console.log('[MDTODO] Refreshed webview for:', filePath);
      } else {
        console.log('[MDTODO] No webview provider found for changed file:', filePath);
      }
    } catch (error) {
      console.error('刷新文件失败:', error);
    }
  });

  context.subscriptions.push(watcher);
}

export function deactivate() {
  console.log('MDTODO插件已停用');
  // 【实现R34.1】清理所有 webview provider
  for (const [path, provider] of webviewProviders) {
    console.log('[MDTODO] Disposing webview for:', path);
    provider.dispose();
  }
  webviewProviders.clear();
}

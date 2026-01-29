import * as vscode from 'vscode';
import { TodoParser } from './parser';
import { TodoWebviewProvider, setGlobalLogsDir } from './providers/webviewProvider';
import { FileService } from './services/fileService';
import { ClaudeService } from './services/claudeService';
import { TodoTask } from './types';
import {
  getLogsDirectoryPath,
  ensureLogsDirectory,
  logPluginLifecycle,
  logFileEvent,
  logTaskEvent,
  initializeSessionLogFilename,
} from './services/logService';

// 【实现R34.1】使用 Map 管理多个 webview provider，每个文件对应一个
const webviewProviders = new Map<string, TodoWebviewProvider>();
let parser: TodoParser;
let fileService: FileService;
let claudeService: ClaudeService;

// Extension version from package.json
const EXTENSION_VERSION = '0.0.2';

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

export async function activate(context: vscode.ExtensionContext) {
  console.log('MDTODO插件已激活');

  // 保存 extension context 供后续使用
  extensionContext = context;

  // 初始化服务
  parser = new TodoParser();
  fileService = new FileService();
  claudeService = new ClaudeService();

  // 【R54.6.2】获取工作区路径并初始化日志
  const workspacePath = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || '';
  let logsDir: string | null = null;
  let primaryTodoFilePath: string | null = null;
  if (workspacePath) {
    logsDir = getLogsDirectoryPath(workspacePath);
    await ensureLogsDirectory(logsDir);
    console.log('[MDTODO] Logs initialized:');
    console.log('[MDTODO]   Workspace path:', workspacePath);
    console.log('[MDTODO]   Logs directory:', logsDir);
    // 【R54.6】设置全局日志目录供 webview 使用
    setGlobalLogsDir(logsDir);

    // 【R54.6.5】初始化会话日志文件名（使用启动时的时间戳，生命周期内共享一个文件）
    const files = await fileService.findTodoFiles();
    if (files.length > 0) {
      primaryTodoFilePath = files[0].fsPath;
      initializeSessionLogFilename(primaryTodoFilePath);
    }
  } else {
    console.warn('[MDTODO] Logging disabled: No workspace folder');
    console.log('[MDTODO] Available workspace folders:', vscode.workspace.workspaceFolders);
    setGlobalLogsDir(null);
  }

  // 【R54.6.2】日志插件激活事件
  const files = await fileService.findTodoFiles();
  if (files.length > 0 && logsDir) {
    await logPluginLifecycle(logsDir, files[0].fsPath, 'activate', {
      version: EXTENSION_VERSION,
      workspacePath,
      timestamp: new Date().toISOString(),
    });
  }

  // 注册打开独立视图命令
  context.subscriptions.push(
    vscode.commands.registerCommand('mdtodo.openView', async () => {
      // 加载默认TODO文件
      const todoFiles = await fileService.findTodoFiles();
      console.log('[MDTODO] openView found', todoFiles.length, 'files');
      todoFiles.forEach((f, i) => console.log(`[MDTODO] openView File ${i}:`, f.fsPath));

      if (todoFiles.length > 0) {
        // 优先选择包含 MDTODO 的文件
        const mdtodoFiles = todoFiles.filter(f => f.fsPath.includes('MDTODO'));
        const targetFiles = mdtodoFiles.length > 0 ? mdtodoFiles : todoFiles;

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

        // 【R54.6.2】日志文件加载事件
        if (logsDir) {
          await logFileEvent(logsDir, targetFile, 'fileLoaded', {
            command: 'mdtodo.openView',
            fileCount: todoFiles.length,
          });
        }

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
      const todoFiles = await fileService.findTodoFiles();
      console.log('[MDTODO] findTodoFiles found:', todoFiles.length, 'files');
      todoFiles.forEach((f, i) => console.log(`[MDTODO] File ${i}:`, f.fsPath));

      if (todoFiles.length === 0) {
        vscode.window.showInformationMessage('未找到TODO文件 (*TODO*.md)');
        return;
      }

      if (todoFiles.length === 1) {
        const targetFile = todoFiles[0].fsPath;
        const provider = getWebviewProvider(targetFile);
        provider.showPanel();
        await provider.loadFile(targetFile);

        // 【R54.6.2】日志文件加载事件
        if (logsDir) {
          await logFileEvent(logsDir, targetFile, 'fileLoaded', {
            command: 'mdtodo.openFile',
            fileCount: 1,
          });
        }

        provider.onTaskSelected((task: TodoTask) => {
          vscode.window.showInformationMessage(`选中任务: ${task.id} - ${task.title}`);
        });
      } else {
        const selected = await vscode.window.showQuickPick(
          todoFiles.map(f => ({
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

          // 【R54.6.2】日志文件加载事件
          if (logsDir) {
            await logFileEvent(logsDir, targetFile, 'fileLoaded', {
              command: 'mdtodo.openFile',
              fileCount: todoFiles.length,
              selectedFile: vscode.workspace.asRelativePath(selected.uri),
            });
          }

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
      const todoFiles = await fileService.findTodoFiles();
      if (todoFiles.length > 0) {
        const targetFile = todoFiles[0].fsPath;
        const provider = getWebviewProvider(targetFile);
        await provider.loadFile(targetFile);

        // 【R54.6.2】日志文件刷新事件
        if (logsDir) {
          await logFileEvent(logsDir, targetFile, 'fileRefresh', {
            command: 'mdtodo.refresh',
          });
        }
      }
    })
  );

  // 注册执行任务命令
  context.subscriptions.push(
    vscode.commands.registerCommand('mdtodo.executeTask', async (task: TodoTask) => {
      const todoFiles = await fileService.findTodoFiles();
      if (todoFiles.length > 0) {
        const result = await claudeService.executeTask(todoFiles[0].fsPath, task.id);

        // 【R54.6.2】日志任务执行事件
        if (logsDir) {
          await logTaskEvent(logsDir, todoFiles[0].fsPath, task.id, 'taskExecute', {
            taskTitle: task.title,
            result: result.output.substring(0, 200), // Limit result length
          });
        }

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

        // 【R54.6.2】日志文件加载事件（记录加载来源）
        const wasAlreadyOpen = isWebviewOpenForFile(filePath);

        // 【实现R34.1】检查是否已经为该文件打开了一个 webview
        if (wasAlreadyOpen) {
          // 文件已在 webview 中显示，直接切换到该面板
          const provider = getWebviewProvider(filePath);
          provider.showPanel();
          // 刷新内容
          await provider.loadFile(filePath);

          // 【R54.6.2】日志文件刷新事件
          if (logsDir) {
            await logFileEvent(logsDir, filePath, 'fileRefresh', {
              command: 'mdtodo.openFromPreview',
              wasAlreadyOpen: true,
            });
          }
        } else {
          // 未打开，创建新的 webview
          const provider = getWebviewProvider(filePath);
          provider.showPanel();
          await provider.loadFile(filePath);

          // 【R54.6.2】日志文件加载事件
          if (logsDir) {
            await logFileEvent(logsDir, filePath, 'fileLoaded', {
              command: 'mdtodo.openFromPreview',
              wasAlreadyOpen: false,
            });
          }

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
  setupFileWatcher(context, logsDir);

  // 启动时打开独立视图
  vscode.commands.executeCommand('mdtodo.openView');
}

function setupFileWatcher(context: vscode.ExtensionContext, logsDir: string | null): void {
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

        // 【R54.6.2】日志文件监控变更事件
        if (logsDir) {
          await logFileEvent(logsDir, filePath, 'fileChange', {
            source: 'fileWatcher',
          });
        }
      } else {
        console.log('[MDTODO] No webview provider found for changed file:', filePath);
      }
    } catch (error) {
      console.error('刷新文件失败:', error);
    }
  });

  context.subscriptions.push(watcher);
}

export async function deactivate() {
  console.log('MDTODO插件已停用');

  // 【R54.6】清理全局日志目录设置
  setGlobalLogsDir(null);

  // 【R54.6.2】日志插件停用事件
  try {
    const workspacePath = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || '';
    if (workspacePath) {
      const logsDir = getLogsDirectoryPath(workspacePath);
      await ensureLogsDirectory(logsDir);

      const files = await fileService.findTodoFiles();
      if (files.length > 0) {
        await logPluginLifecycle(logsDir, files[0].fsPath, 'deactivate', {
          version: EXTENSION_VERSION,
          timestamp: new Date().toISOString(),
          providerCount: webviewProviders.size,
        });
      }
    }
  } catch (error) {
    console.error('[MDTODO] Failed to log deactivation:', error);
  }

  // 【实现R34.1】清理所有 webview provider
  for (const [path, provider] of webviewProviders) {
    console.log('[MDTODO] Disposing webview for:', path);
    provider.dispose();
  }
  webviewProviders.clear();
}

import * as React from 'react';
import { createRoot } from 'react-dom/client';
import { TaskList } from './components/TaskList';

// React hooks
const useState = React.useState;
const useEffect = React.useEffect;
const useCallback = React.useCallback;
const useRef = React.useRef;

// Declare globals for TypeScript
declare const acquireVsCodeApi: any;
declare const window: any;

// 获取 VS Code API（只执行一次），并存入全局变量
let vscodeApi = null;
try {
  vscodeApi = acquireVsCodeApi();
  if (vscodeApi) {
    // 存储到 window 对象，确保所有组件可以访问
    if (typeof window.MDTODO === 'undefined') {
      window.MDTODO = {};
    }
    window.MDTODO.vscodeApi = vscodeApi;
    console.log('[Webview] VSCode API initialized successfully');
  } else {
    console.error('[Webview] acquireVsCodeApi returned null');
  }
} catch (error: any) {
  console.error('[Webview] Failed to initialize VSCode API:', error);
}

// 标记是否已发送 ready
let hasSentReady = false;

// 保存完成回调设置函数（通过全局变量暴露给 TaskList）
window.MDTODO.setSaveCompleteCallback = (callback: (taskId: string) => void) => {
  saveCompleteCallback = callback;
};

// 保存完成回调（在组件外部定义，避免闭包问题）
// 使用防抖确保回调在 useEffect 注册前被调用时不会出错
let saveCompleteCallback: ((taskId: string) => void) | null = null;
let lastTaskId: string | null = null;
let callbackCheckTimer: NodeJS.Timeout | null = null;

// 防抖处理：等待回调注册完成后调用
const scheduleCallbackCheck = (taskId: string) => {
  lastTaskId = taskId;
  if (callbackCheckTimer) {
    clearTimeout(callbackCheckTimer);
  }
  callbackCheckTimer = setTimeout(() => {
    if (saveCompleteCallback && lastTaskId) {
      saveCompleteCallback(lastTaskId);
    }
    lastTaskId = null;
    callbackCheckTimer = null;
  }, 50); // 50ms 后检查回调是否已注册
};

const handleSaveComplete = (taskId: string) => {
  // 如果回调已注册，直接调用
  if (saveCompleteCallback) {
    saveCompleteCallback(taskId);
  } else {
    // 回调还未注册（useEffect 还未执行），使用防抖等待
    scheduleCallbackCheck(taskId);
  }
};

// 刷新单个任务标题的方法（通过全局变量暴露给外部）
window.MDTODO.refreshTaskTitle = (taskId: string, newTitle: string) => {
  // 发送消息通知 TaskList 刷新单个任务
  if (vscodeApi) {
    vscodeApi.postMessage({ type: 'refreshTaskTitle', taskId, newTitle });
  }
};

// 刷新单个任务的状态更新函数（将在 TaskList 中注册）
window.MDTODO.updateTaskState = null;

// ============================================
// R54.8.3: 日志系统 (window.MDTODO.log/warn/error)
// 必须先定义，再注册事件监听器
// ============================================

/**
 * 发送日志到扩展端
 */
const sendLogToExtension = (level: string, args: any[], source: string = 'webview') => {
  if (vscodeApi) {
    const timestamp = new Date().toISOString();
    const message = args.map(arg => {
      if (typeof arg === 'object') {
        try {
          return JSON.stringify(arg);
        } catch {
          return String(arg);
        }
      }
      return String(arg);
    }).join(' ');

    vscodeApi.postMessage({
      type: 'mdtodoLog',
      level,
      message,
      timestamp,
      source,
      args: args.map(arg => {
        if (typeof arg === 'object') {
          try {
            return JSON.stringify(arg, null, 2);
          } catch {
            return String(arg);
          }
        }
        return arg;
      })
    });
  }
};

// 创建 window.MDTODO.log API
window.MDTODO.log = (...args: any[]) => {
  try {
    sendLogToExtension('info', args, 'MDTODO.log');
  } catch (error) {
    // 确保日志 API 本身不会抛出异常
    console.error('[MDTODO] Log API error:', error);
  }
};

// 创建 window.MDTODO.warn API
window.MDTODO.warn = (...args: any[]) => {
  try {
    sendLogToExtension('warning', args, 'MDTODO.warn');
  } catch (error) {
    console.error('[MDTODO] Warn API error:', error);
  }
};

// 创建 window.MDTODO.error API
window.MDTODO.error = (...args: any[]) => {
  try {
    sendLogToExtension('error', args, 'MDTODO.error');
  } catch (error) {
    console.error('[MDTODO] Error API error:', error);
  }
};

// ============================================
// R54.8.3: 全局错误处理器 (window.MDTODO.errorHandler)
// ============================================

/**
 * 内部日志函数 - 不依赖 window.MDTODO
 */
const internalLogError = (error: Error | string, context?: string) => {
  try {
    const errorMessage = typeof error === 'string' ? error : error.message;
    const errorStack = typeof error === 'string' ? '' : error.stack || '';

    if (vscodeApi) {
      vscodeApi.postMessage({
        type: 'mdtodoLog',
        level: 'error',
        message: `[Error Context: ${context || 'N/A'}] Message: ${errorMessage} Stack: ${errorStack}`,
        timestamp: new Date().toISOString(),
        source: 'MDTODO.errorHandler',
        args: [`[Error Context: ${context || 'N/A'}]`, `Message: ${errorMessage}`, `Stack: ${errorStack}`]
      });
    }
  } catch (e) {
    // 最后的备用方案
    try {
      const originalError = error instanceof Error ? error : new Error(String(error));
      console.error('[MDTODO ErrorHandler]', context, originalError.message, originalError.stack);
    } catch {
      // 静默失败
    }
  }
};

/**
 * 全局错误处理器 - 捕获并记录未处理的异常
 */
window.MDTODO.errorHandler = {
  /**
   * 记录错误到扩展端
   */
  logError: (error: Error | string, context?: string) => {
    internalLogError(error, context);
  },

  /**
   * 包装函数以捕获并记录错误
   */
  wrap: (fn: Function, context?: string): Function => {
    return function(...args: any[]) {
      try {
        return fn.apply(this, args);
      } catch (error) {
        internalLogError(error as Error, context);
        throw error;
      }
    };
  },

  /**
   * 包装 Promise 以捕获 rejection
   */
  wrapPromise: (promise: Promise<any>, context?: string): Promise<any> => {
    return promise.catch(error => {
      internalLogError(error as Error, context);
      return Promise.reject(error);
    });
  }
};

// ============================================
// R54.8.3: 捕获 unhandledrejection 事件
// ============================================

/**
 * 捕获未处理的 Promise rejection
 */
window.addEventListener('unhandledrejection', (event) => {
  try {
    const reason = event.reason;
    const errorMessage = reason instanceof Error ? reason.message : String(reason);
    const errorStack = reason instanceof Error ? reason.stack || '' : '';

    if (vscodeApi) {
      vscodeApi.postMessage({
        type: 'mdtodoLog',
        level: 'error',
        message: `[Unhandled Promise Rejection] Message: ${errorMessage} Stack: ${errorStack}`,
        timestamp: new Date().toISOString(),
        source: 'MDTODO.unhandledrejection',
        args: ['[Unhandled Promise Rejection]', `Message: ${errorMessage}`, `Stack: ${errorStack}`]
      });
    }
  } catch (e) {
    console.error('[MDTODO] Error in unhandledrejection handler:', e);
  }
  // 阻止默认行为，防止浏览器显示警告
  event.preventDefault();
});

/**
 * 捕获全局错误
 * 直接使用 vscodeApi.postMessage，避免依赖 window.MDTODO（可能在某些情况下未初始化）
 */
window.addEventListener('error', (event) => {
  try {
    const error = event.error;
    if (error && vscodeApi) {
      vscodeApi.postMessage({
        type: 'mdtodoLog',
        level: 'error',
        message: `[Global Error] Message: ${error.message} Stack: ${error.stack || ''}`,
        timestamp: new Date().toISOString(),
        source: 'MDTODO.globalError',
        args: ['[Global Error]', `Message: ${error.message}`, `Stack: ${error.stack || ''}`]
      });
    }
  } catch (e) {
    // 最后的备用方案：直接使用原生 console
    try {
      const originalError = error instanceof Error ? error : new Error(String(error));
      console.error('[MDTODO Global Error]', originalError.message, originalError.stack);
    } catch (fallbackError) {
      // 静默失败，避免递归错误
    }
  }
});

// ============================================
// R54.8.3: 使用 try-catch 包装关键代码
// ============================================

// 辅助函数：安全调用 MDTODO.log（处理未初始化的情况）
const safeLog = (...args: any[]) => {
  try {
    if (typeof window.MDTODO?.log === 'function') {
      window.MDTODO.log(...args);
    } else {
      console.log('[MDTODO]', ...args);
    }
  } catch {
    console.log('[MDTODO]', ...args);
  }
};

// 辅助函数：安全调用 MDTODO.error（处理未初始化的情况）
const safeError = (...args: any[]) => {
  try {
    if (typeof window.MDTODO?.error === 'function') {
      window.MDTODO.error(...args);
    } else {
      console.error('[MDTODO]', ...args);
    }
  } catch {
    console.error('[MDTODO]', ...args);
  }
};

// 启动应用函数 - 使用 try-catch 包装
const init = () => {
  try {
    const container = document.getElementById('root');
    if (container && !hasSentReady) {
      const root = createRoot(container);

      // 创建 TaskList 组件，传入 vscodeApi 和保存完成回调
      root.render(
        React.createElement(React.StrictMode, null,
          React.createElement(TaskList, {
            vscodeApi,
            onSaveComplete: handleSaveComplete
          })
        )
      );

      // 通知 extension webview 已准备好
      setTimeout(() => {
        if (vscodeApi && !hasSentReady) {
          safeLog('[Webview] Sending ready message');
          hasSentReady = true;
          vscodeApi.postMessage({ type: 'ready' });
        } else if (!vscodeApi) {
          safeError('[Webview] Cannot send ready: vscodeApi is null');
        }
      }, 100);
    }
  } catch (error) {
    safeError('[MDTODO] Error in init:', error);
  }
};

// 启动应用
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    console.log('[Webview] DOMContentLoaded - initializing');
    init();
  });
} else {
  // DOM already loaded
  console.log('[Webview] DOM ready - initializing immediately');
  init();
}

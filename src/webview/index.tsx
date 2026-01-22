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

// 启动应用函数
const init = () => {
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
        console.log('[Webview] Sending ready message');
        hasSentReady = true;
        vscodeApi.postMessage({ type: 'ready' });
      } else if (!vscodeApi) {
        console.error('[Webview] Cannot send ready: vscodeApi is null');
      }
    }, 100);
  }
};

init();

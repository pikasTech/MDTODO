import * as React from 'react';
import { marked } from 'marked';
import markedKatex from 'marked-katex-extension';
import 'katex/dist/katex.min.css';
import './TaskList.css';
import { Task, TextBlock, FilterType, BUTTON_IDS } from './types';
import { TaskItem } from './TaskItem';
import { renderTextBlocks } from './TaskBlock';
import { Toolbar } from './Toolbar';
import { TaskContextMenu } from './ContextMenu';

// Configure marked options for better rendering
marked.use(markedKatex as any, {
  throwOnError: false,
  output: 'html', // 确保输出为 HTML，避免后续 DOM 修改
  delimiters: [
    { left: '$$', right: '$$', display: true },
    { left: '$', right: '$', display: false },
    { left: '\\(', right: '\\)', display: false },
    { left: '\\[', right: '\\]', display: true }
  ]
});

marked.setOptions({
  breaks: true, // Convert \n to <br>
  gfm: true,    // Enable GitHub Flavored Markdown
});

// Declare globals for TypeScript
declare const window: any;

interface TaskListProps {
  initialTasks?: Task[];
  initialTextBlocks?: TextBlock[];
  filePath?: string;
  vscodeApi?: any;
  onSaveComplete?: (taskId: string) => void;  // 保存完成后退出编辑模式的回调
}

const TaskList: React.FC<TaskListProps> = (props) => {
  const { initialTasks = [], initialTextBlocks = [], filePath = '', vscodeApi, onSaveComplete } = props;
  const [tasks, setTasks] = React.useState<Task[]>(initialTasks);
  const [textBlocks, setTextBlocks] = React.useState<TextBlock[]>(initialTextBlocks);
  // 【修复R25】添加filePath状态，用于显示当前文件路径
  const [currentFilePath, setCurrentFilePath] = React.useState<string>(filePath || '');
  // 【R54.1.1.1】添加workspacePath状态，用于计算相对路径
  const [workspacePath, setWorkspacePath] = React.useState<string>('');
  const [expandedTasks, setExpandedTasks] = React.useState<Set<string>>(new Set([]));
  const [editModes, setEditModes] = React.useState<Record<string, boolean>>({});
  const [stats, setStats] = React.useState({ total: 0, completed: 0 });
  const [apiError, setApiError] = React.useState<string | null>(null);
  // 用于存储新添加的任务ID，在tasks更新后触发滚动
  const [pendingScrollTaskId, setPendingScrollTaskId] = React.useState<string | null>(null);
  // 用于保存正在编辑的任务ID，防止文件重载后丢失编辑状态
  const [editingTaskIds, setEditingTaskIds] = React.useState<Set<string>>(new Set());
  // 使用 ref 跟踪 editingTaskIds 的当前值，避免 useEffect 闭包问题
  const editingTaskIdsRef = React.useRef(editingTaskIds);
  editingTaskIdsRef.current = editingTaskIds;
  // 【修复R48.3】跟踪当前编辑任务的父任务ID，用于控制滚动行为
  const [editingTaskParentId, setEditingTaskParentId] = React.useState<string>('');
  // Claude执行按钮防抖状态 - 【实现R38.2】使用1秒独立防抖，避免误触
  const [claudeExecuting, setClaudeExecuting] = React.useState<Record<string, boolean>>({});
  const CLAUDE_EXECUTE_COOLDOWN = 1000; // 1秒冷却
  // 通用按钮防抖状态 - 【修复R38.1】改为每个按钮独立防抖
  const [buttonCooldown, setButtonCooldown] = React.useState<Record<string, boolean>>({});
  const BUTTON_COOLDOWN = 100; // 0.1秒冷却
  // 筛选状态
  const [filterType, setFilterType] = React.useState<FilterType>('all');
  const [searchKeyword, setSearchKeyword] = React.useState<string>('');
  // 【实现R28】任务跳转下拉菜单选中的任务ID
  const [jumpToTaskId, setJumpToTaskId] = React.useState<string>('');
  const taskListRef = React.useRef<HTMLUListElement>(null);
  // 用于外部调用刷新单个任务的函数 ref
  const updateTaskStateRef = React.useRef<((taskId: string, newTitle: string) => void) | null>(null);
  // 【实现R29.1】用于跟踪滚动位置，避免频繁发送滚动消息
  const lastScrollTaskRef = React.useRef<string>('');
  const SCROLL_THROTTLE = 300; // 滚动节流时间（毫秒）
  const lastScrollTimeRef = React.useRef<number>(0);
  // 双向滚动同步开关，默认关闭
  const [syncScrollEnabled, setSyncScrollEnabled] = React.useState(false);
  // 跳转下一个未完成任务的索引
  const [lastJumpIndex, setLastJumpIndex] = React.useState(-1);
  // 【R51.9】高亮定位状态：用于在折叠模式下定位目标任务而不展开
  const [highlightedTaskId, setHighlightedTaskId] = React.useState<string>('');
  // 【R51.9】标记是否是"全部收起"操作触发的折叠，用于控制是否滚动到底
  const [isCollapseAllTriggered, setIsCollapseAllTriggered] = React.useState(false);
  // 【R51.9】标记跳转操作进行中，用于防止滚动到底效果干扰跳转
  const [isJumpOperationInProgress, setIsJumpOperationInProgress] = React.useState(false);
  // 【R54.1】右键菜单状态
  // 【R54.1】【R54.2】右键菜单状态，R54.2增加taskTitle用于构造执行命令
  const [contextMenu, setContextMenu] = React.useState<{
    visible: boolean;
    x: number;
    y: number;
    href: string;
    taskId: string;
    taskTitle?: string;
  } | null>(null);

  // 【R13.5】普通文本块编辑状态
  const [textBlockEditModes, setTextBlockEditModes] = React.useState<Record<string, boolean>>({});

  // 【实现R37.3】滚动到顶部
  const getFileName = (path: string): string => {
    if (!path) return 'MDTODO 任务管理';
    // 提取文件名并去掉 .md 后缀
    const fileName = path.split('/').pop()?.split('\\').pop() || '';
    return fileName.replace(/\.md$/i, '') || 'MDTODO 任务管理';
  };

  // 用于显示的标题，从 filePath 派生
  const [displayTitle, setDisplayTitle] = React.useState(() => getFileName(filePath));

  // 保存完成后退出编辑模式的处理函数
  const handleSaveComplete = (taskId: string) => {
    // console.log('[Webview] handleSaveComplete: 退出编辑模式', taskId);
    setEditModes((prev) => ({
      ...prev,
      [taskId]: false,
    }));
    // 清除正在编辑的标记
    setEditingTaskIds((prev) => {
      const next = new Set(prev);
      next.delete(taskId);
      return next;
    });
    // 同时调用外部回调（用于同步状态）
    if (onSaveComplete) {
      onSaveComplete(taskId);
    }
  };

  // 刷新单个任务标题（外部调用）
  const handleRefreshTaskTitle = (taskId: string, newTitle: string) => {
    // console.log('[Webview] handleRefreshTaskTitle:', taskId, newTitle);
    setTasks((prevTasks) => {
      const updateTask = (taskList: Task[]): Task[] => {
        return taskList.map((task) => {
          if (task.id === taskId) {
            return { ...task, title: newTitle };
          }
          if (task.children && task.children.length > 0) {
            return { ...task, children: updateTask(task.children) };
          }
          return task;
        });
      };
      return updateTask(prevTasks);
    });
    // 清除该任务的编辑状态（刷新标题意味着完成编辑）
    setEditModes((prev) => {
      const next = { ...prev };
      delete next[taskId];
      return next;
    });
    setEditingTaskIds((prev) => {
      const next = new Set(prev);
      next.delete(taskId);
      return next;
    });
  };

  // 发送消息到 extension - 使用 props 传入的 vscodeApi
  const sendMessage = (message: any) => {
    if (vscodeApi) {
      vscodeApi.postMessage(message);
    } else {
      setApiError('VSCode API not available - 请重新加载窗口');
      console.error('[Webview] sendMessage failed: vscodeApi is', vscodeApi);
    }
  };

  React.useEffect(() => {
    const allTasks = getAllTasks(tasks);
    setStats({
      total: allTasks.length,
      completed: allTasks.filter((t) => t.completed).length,
    });
  }, [tasks]);

  // 当有待滚动的任务ID时，滚动到该任务并进入编辑模式
  // 【修复R19】这个效果只在添加新任务时触发，不应该在其他刷新操作中触发
  // 【修复R20】确保编辑模式互斥：进入新任务编辑模式时，清除其他任务的编辑状态
  React.useEffect(() => {
    if (pendingScrollTaskId) {
      // console.log('[Webview] pendingScrollTaskId effect triggered for:', pendingScrollTaskId);
      const taskElement = document.querySelector(`[data-task-id="${pendingScrollTaskId}"]`);
      if (taskElement) {
        taskElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
        // 【修复R20】进入编辑模式前，先清除其他任务的编辑状态，确保只有一个任务处于编辑模式
        setEditModes(prev => {
          const next: Record<string, boolean> = {};
          // 只保留当前要编辑的任务为 true，其他全部设为 false
          Object.keys(prev).forEach(key => {
            next[key] = key === pendingScrollTaskId;
          });
          return next;
        });
        // 【修复R20】同时更新 editingTaskIds，确保只有一个任务在编辑
        setEditingTaskIds(new Set([pendingScrollTaskId]));
        // console.log('[Webview] 已进入编辑模式并确保互斥:', pendingScrollTaskId);
        // 清除待滚动标记
        setPendingScrollTaskId(null);
      }
    }
  }, [pendingScrollTaskId]);

  React.useEffect(() => {
    const handleMessage = (event: any) => {
      const message = event.data;
      if (message.type === 'updateTasks') {
    //    console.log('[Webview] Received updateTasks, tasks:', message.tasks?.length, 'textBlocks:', message.textBlocks?.length, 'filePath:', message.filePath);
        setTasks(message.tasks || []);
        setTextBlocks(message.textBlocks || []);
        // 【修复R25】更新filePath状态
        setCurrentFilePath(message.filePath || '');
        // 【R54.1.1.1】更新workspacePath状态，用于计算相对路径
        setWorkspacePath(message.workspacePath || '');
        // 【实现R34】更新显示标题（从文件路径提取文件名，不带.md后缀）
        setDisplayTitle(getFileName(message.filePath || ''));
        // 【实现R48.2】默认启动时采用折叠模式，不默认展开任何任务
        // 只保留正在编辑的任务的展开状态
        const currentlyEditing = Array.from(editingTaskIdsRef.current);
        // console.log('[Webview] updateTasks: 正在编辑的任务:', currentlyEditing);
        // 获取所有任务ID用于判断
        const allCurrentTaskIds = getAllTaskIds(message.tasks || []);

        // 清除所有编辑状态，但保留正在编辑的任务的编辑状态
        setEditModes(prev => {
          const next: Record<string, boolean> = {};
          currentlyEditing.forEach(taskId => {
            // 只有当任务仍然存在于任务列表中时，才保留其编辑状态
            if (allCurrentTaskIds.includes(taskId)) {
              next[taskId] = true;
            }
          });
          return next;
        });

        // 同时更新 editingTaskIds，移除不存在的任务
        setEditingTaskIds(prev => {
          const next = new Set(prev);
          currentlyEditing.forEach(taskId => {
            if (!allCurrentTaskIds.includes(taskId)) {
              next.delete(taskId);
            }
          });
          return next;
        });

        // console.log('[Webview] updateTasks: 已更新编辑状态，保留正在编辑的任务');
      } else if (message.type === 'newTaskAdded') {
        // 【R50.3】设置待滚动的任务ID，tasks更新后会触发滚动
        setPendingScrollTaskId(message.taskId);
        // 【修复R19】标记新任务正在编辑，防止文件重载后丢失编辑状态
        setEditingTaskIds(new Set([message.taskId]));
        // 【修复R24】同时设置editModes，让新任务进入编辑模式
        setEditModes({ [message.taskId]: true });
        // console.log('[Webview] newTaskAdded: 设置新任务', message.taskId, '为编辑状态');
        // 【R50.3】不自动展开父任务，保持原折叠状态
      } else if (message.type === 'refreshTaskTitle') {
        // 刷新单个任务标题
        handleRefreshTaskTitle(message.taskId, message.newTitle);
      } else if (message.type === 'scrollToTask') {
        // 【实现R29】滚动到指定任务
        handleScrollToTask(message.taskId, message.lineNumber);
      } else if (message.type === 'executeCommandGenerated') {
        // 【R54.3】接收生成的命令并复制到剪贴板
        if (message.command) {
          navigator.clipboard.writeText(message.command).then(() => {
            console.log('[Webview] 执行命令已复制到剪贴板:', message.command);
          }).catch(err => {
            console.error('[Webview] 复制失败:', err);
          });
        }
      }
    };

    window.addEventListener('message', handleMessage);

    // 注册 updateTaskState 到 window.MDTODO，供外部调用
    if (typeof window !== 'undefined') {
      if (typeof window.MDTODO === 'undefined') {
        window.MDTODO = {};
      }
      window.MDTODO.updateTaskState = (taskId: string, newTitle: string) => {
        handleRefreshTaskTitle(taskId, newTitle);
      };
    }

    return () => {
      window.removeEventListener('message', handleMessage);
    };
  }, []);

  const getAllTaskIds = (taskList: Task[]): string[] => {
    let result: string[] = [];
    for (const task of taskList) {
      result.push(task.id);
      if (task.children && task.children.length > 0) {
        result = result.concat(getAllTaskIds(task.children));
      }
    }
    return result;
  };

  const getAllTasks = (taskList: Task[]): Task[] => {
    let result: Task[] = [];
    for (const task of taskList) {
      result.push(task);
      if (task.children && task.children.length > 0) {
        result = result.concat(getAllTasks(task.children));
      }
    }
    return result;
  };

  // 【实现R37.3.1】【R51.18修改】计算未完成任务的数量（在getAllTasks之后定义，避免初始化顺序问题）
  // 【R51.18】进行中的任务也当作未完成支持跳转
  const incompleteCount = React.useMemo(() => {
    const allTasks = getAllTasks(tasks);
    return allTasks.filter(t => !t.completed).length;
  }, [tasks]);

  const handleToggleExpand = (taskId: string) => {
    setExpandedTasks((prev) => {
      const next = new Set(prev);
      if (next.has(taskId)) {
        next.delete(taskId);
      } else {
        next.add(taskId);
      }
      return next;
    });
  };

  // 展开所有任务
  const handleExpandAll = () => {
    // 防抖：如果冷却中，不执行
    if (buttonCooldown[BUTTON_IDS.EXPAND_ALL]) {
      // console.log('[Webview] 展开按钮防抖，跳过重复点击');
      return;
    }
    const allTaskIds = getAllTaskIds(tasks);
    setExpandedTasks(new Set(allTaskIds));
    // 设置防抖状态
    setButtonCooldown(prev => ({ ...prev, [BUTTON_IDS.EXPAND_ALL]: true }));
    setTimeout(() => {
      setButtonCooldown(prev => ({ ...prev, [BUTTON_IDS.EXPAND_ALL]: false }));
    }, BUTTON_COOLDOWN);
  };

  // 收起所有任务
  const handleCollapseAll = () => {
    // 防抖：如果冷却中，不执行
    if (buttonCooldown[BUTTON_IDS.COLLAPSE_ALL]) {
      // console.log('[Webview] 收起按钮防抖，跳过重复点击');
      return;
    }
    // 【R51.9】标记这是用户主动的"全部收起"操作，用于触发滚动到底
    setIsCollapseAllTriggered(true);
    setExpandedTasks(new Set());
    // 500ms后重置标志，让后续的收起操作不再触发滚动到底
    setTimeout(() => {
      setIsCollapseAllTriggered(false);
    }, 500);
    // 设置防抖状态
    setButtonCooldown(prev => ({ ...prev, [BUTTON_IDS.COLLAPSE_ALL]: true }));
    setTimeout(() => {
      setButtonCooldown(prev => ({ ...prev, [BUTTON_IDS.COLLAPSE_ALL]: false }));
    }, BUTTON_COOLDOWN);
  };

  const handleToggleComplete = (taskId: string) => {
    // 防抖：如果冷却中，不执行
    const cooldownId = `${BUTTON_IDS.TOGGLE_COMPLETE}_${taskId}`;
    if (buttonCooldown[cooldownId]) {
      // console.log('[Webview] 完成复选框防抖，跳过重复点击');
      return;
    }
    sendMessage({ type: 'markComplete', taskId });
    // 设置防抖状态
    setButtonCooldown(prev => ({ ...prev, [cooldownId]: true }));
    setTimeout(() => {
      setButtonCooldown(prev => ({ ...prev, [cooldownId]: false }));
    }, BUTTON_COOLDOWN);
  };

  const handleSelect = (taskId: string) => {
    sendMessage({ type: 'taskSelected', taskId });
  };

  const handleToggleEdit = (taskId: string) => {
    // 这个函数主要用于Escape键取消编辑
    // 编辑模式由双击进入，blur退出
    const willBeEditMode = !editModes[taskId];
    // console.log('[Webview] handleToggleEdit:', taskId, '->', willBeEditMode ? '编辑模式' : '非编辑模式');

    // 【修复R20】确保编辑模式互斥：当进入编辑模式时，关闭所有其他任务的编辑状态
    if (willBeEditMode) {
      setEditModes({
        [taskId]: true,
      });
      setEditingTaskIds(new Set([taskId]));
    } else {
      // 退出编辑模式
      setEditModes((prev) => {
        const next = { ...prev };
        delete next[taskId];
        return next;
      });
      setEditingTaskIds((prev) => {
        const next = new Set(prev);
        next.delete(taskId);
        return next;
      });
    }
  };

  // 双击进入编辑模式
  // 【修复R20】确保编辑模式互斥：关闭其他任务的编辑状态
  // 【修复R48.3】设置当前编辑任务的父任务ID，用于控制滚动行为
  const handleDoubleClick = (taskId: string) => {
    // 计算父任务ID（用于控制滚动）
    const parentId = taskId.split('.').slice(0, -1).join('.');
    console.log('[R48.3] handleDoubleClick: taskId=', taskId, ', parentId=', parentId);
    setEditingTaskParentId(parentId);
    // 关闭所有其他任务的编辑状态，只保留当前任务
    setEditModes({
      [taskId]: true,
    });
    // 标记该任务正在编辑，防止文件重载后丢失编辑状态
    setEditingTaskIds(new Set([taskId]));
  };

  const handleSaveTitle = (taskId: string, title: string) => {
    sendMessage({ type: 'saveTitle', taskId, title });
  };

  // 【R13.5】普通文本块双击进入编辑模式
  const handleTextBlockDoubleClick = (blockId: string) => {
    // console.log('[Webview] handleTextBlockDoubleClick: 进入编辑模式', blockId);
    // 关闭其他文本块的编辑状态，只保留当前
    setTextBlockEditModes({
      [blockId]: true,
    });
  };

  // 【R13.5】保存普通文本块内容
  const handleSaveTextBlock = (blockId: string, content: string) => {
    console.log('[Webview] handleSaveTextBlock:', blockId, content);
    sendMessage({ type: 'saveTextBlock', blockId, content });
    // 退出编辑模式
    setTextBlockEditModes((prev) => ({
      ...prev,
      [blockId]: false,
    }));
  };

  // 【R13.5】取消文本块编辑
  const handleCancelTextBlockEdit = (blockId: string) => {
    setTextBlockEditModes((prev) => ({
      ...prev,
      [blockId]: false,
    }));
  };

  const handleRefresh = () => {
    // 防抖：如果冷却中，不执行
    if (buttonCooldown[BUTTON_IDS.REFRESH]) {
      console.log('[Webview] 刷新按钮防抖，跳过重复点击');
      return;
    }
    sendMessage({ type: 'refresh' });
    // 设置防抖状态
    setButtonCooldown(prev => ({ ...prev, [BUTTON_IDS.REFRESH]: true }));
    setTimeout(() => {
      setButtonCooldown(prev => ({ ...prev, [BUTTON_IDS.REFRESH]: false }));
    }, BUTTON_COOLDOWN);
  };

  const handleOpenFile = () => {
    // 防抖：如果冷却中，不执行
    if (buttonCooldown[BUTTON_IDS.OPEN_FILE]) {
      console.log('[Webview] 打开文件按钮防抖，跳过重复点击');
      return;
    }
    sendMessage({ type: 'openFile' });
    // 设置防抖状态
    setButtonCooldown(prev => ({ ...prev, [BUTTON_IDS.OPEN_FILE]: true }));
    setTimeout(() => {
      setButtonCooldown(prev => ({ ...prev, [BUTTON_IDS.OPEN_FILE]: false }));
    }, BUTTON_COOLDOWN);
  };

  // 【实现R37】打开原MDTODO文件
  const handleOpenSourceFile = () => {
    // 防抖：如果冷却中，不执行
    if (buttonCooldown[BUTTON_IDS.OPEN_SOURCE_FILE]) {
      console.log('[Webview] 打开原文按钮防抖，跳过重复点击');
      return;
    }
    sendMessage({ type: 'openSourceFile' });
    // 设置防抖状态
    setButtonCooldown(prev => ({ ...prev, [BUTTON_IDS.OPEN_SOURCE_FILE]: true }));
    setTimeout(() => {
      setButtonCooldown(prev => ({ ...prev, [BUTTON_IDS.OPEN_SOURCE_FILE]: false }));
    }, BUTTON_COOLDOWN);
  };

  const handleClaudeExecute = (taskId: string) => {
    // 防抖：如果正在执行或冷却中，不执行
    if (claudeExecuting[taskId]) {
      console.log('[Webview] Claude执行防抖，跳过重复点击');
      return;
    }
    // 发送执行消息
    sendMessage({ type: 'claudeExecute', taskId });
    // 设置防抖状态
    setClaudeExecuting(prev => ({ ...prev, [taskId]: true }));
    // 0.5秒后清除防抖状态
    setTimeout(() => {
      setClaudeExecuting(prev => ({ ...prev, [taskId]: false }));
    }, CLAUDE_EXECUTE_COOLDOWN);
  };

  // 添加新任务
  const handleAddTask = () => {
    // 防抖：如果冷却中，不执行
    if (buttonCooldown[BUTTON_IDS.ADD_TASK]) {
      console.log('[Webview] 添加任务按钮防抖，跳过重复点击');
      return;
    }
    sendMessage({ type: 'addTask' });
    // 设置防抖状态
    setButtonCooldown(prev => ({ ...prev, [BUTTON_IDS.ADD_TASK]: true }));
    setTimeout(() => {
      setButtonCooldown(prev => ({ ...prev, [BUTTON_IDS.ADD_TASK]: false }));
    }, BUTTON_COOLDOWN);
  };

  // 删除任务
  const handleDeleteTask = (taskId: string) => {
    // 防抖：如果冷却中，不执行
    const cooldownId = `${BUTTON_IDS.DELETE_TASK}_${taskId}`;
    if (buttonCooldown[cooldownId]) {
      console.log('[Webview] 删除按钮防抖，跳过重复点击');
      return;
    }
    sendMessage({ type: 'deleteTask', taskId });
    // 设置防抖状态
    setButtonCooldown(prev => ({ ...prev, [cooldownId]: true }));
    setTimeout(() => {
      setButtonCooldown(prev => ({ ...prev, [cooldownId]: false }));
    }, BUTTON_COOLDOWN);
  };

  // 添加子任务
  const handleAddSubTask = (taskId: string) => {
    // 防抖：如果冷却中，不执行
    const cooldownId = `${BUTTON_IDS.ADD_SUB_TASK}_${taskId}`;
    if (buttonCooldown[cooldownId]) {
      console.log('[Webview] 添加子任务按钮防抖，跳过重复点击');
      return;
    }
    console.log('[Webview] Sending addSubTask, taskId:', taskId);
    sendMessage({ type: 'addSubTask', taskId });
    // 设置防抖状态
    setButtonCooldown(prev => ({ ...prev, [cooldownId]: true }));
    setTimeout(() => {
      setButtonCooldown(prev => ({ ...prev, [cooldownId]: false }));
    }, BUTTON_COOLDOWN);
  };

  // 【实现R46】延续任务：在最后一个子任务上添加延续按钮，创建下一个同级子任务
  const handleContinueTask = (taskId: string) => {
    // 防抖：如果冷却中，不执行
    const cooldownId = `${BUTTON_IDS.CONTINUE_TASK}_${taskId}`;
    if (buttonCooldown[cooldownId]) {
      console.log('[Webview] 延续任务按钮防抖，跳过重复点击');
      return;
    }
    console.log('[Webview] Sending continueTask, taskId:', taskId);
    sendMessage({ type: 'continueTask', taskId });
    // 设置防抖状态
    setButtonCooldown(prev => ({ ...prev, [cooldownId]: true }));
    setTimeout(() => {
      setButtonCooldown(prev => ({ ...prev, [cooldownId]: false }));
    }, BUTTON_COOLDOWN);
  };

  // 筛选任务：支持状态筛选和关键词搜索
  // filterType: 'all' | 'active' | 'hide-completed' | 'processing'
  const filterTasks = (taskList: Task[]): Task[] => {
    return taskList
      .map(task => {
        // 递归筛选子任务
        const filteredChildren = task.children ? filterTasks(task.children) : [];
        const matchingTask = {
          ...task,
          children: filteredChildren.length > 0 ? filteredChildren : undefined
        };

        // 检查当前任务是否匹配筛选条件
        // active = 未完成 且 未执行中
        // hide-completed = 隐藏已完成（显示未完成任务和进行中任务）
        // processing = 执行中 且 未完成
        const isActive = !matchingTask.completed && !matchingTask.processing;
        const matchesStatus = filterType === 'all' ||
          (filterType === 'active' && isActive) ||
          (filterType === 'hide-completed' && !matchingTask.completed) ||
          (filterType === 'processing' && matchingTask.processing && !matchingTask.completed);

        const matchesKeyword = searchKeyword.trim() === '' ||
          matchingTask.title.toLowerCase().includes(searchKeyword.toLowerCase()) ||
          matchingTask.id.toLowerCase().includes(searchKeyword.toLowerCase());

        // 如果任务本身匹配，或者有子任务匹配，则保留
        if ((matchesStatus && matchesKeyword) || filteredChildren.length > 0) {
          return matchingTask;
        }
        return null;
      })
      .filter((task): task is Task => task !== null);
  };

  // 获取筛选后的任务列表
  const filteredTasks = filterTasks(tasks);

  // 计算筛选后的统计信息
  const getFilteredStats = () => {
    const allFilteredTasks = getAllTasks(filteredTasks);
    return {
      total: allFilteredTasks.length,
      completed: allFilteredTasks.filter((t) => t.completed).length
    };
  };

  // 【R51.5.7】获取所有任务用于跳转下拉菜单
  const allTasks = React.useMemo(() => getAllTasks(tasks), [tasks]);

  // 清除筛选条件
  const handleClearFilter = () => {
    setFilterType('all');
    setSearchKeyword('');
  };

  // 【R51.9】滚动到目标任务：支持折叠模式下的双层滚动
  // 如果父任务已展开，正常滚动到目标
  // 如果父任务折叠，先滚动到父任务，再滚动子任务区域内部到目标
  const scrollToTask = (taskId: string, onComplete?: () => void) => {
    const parentId = taskId.split('.').slice(0, -1).join('.');
    const isParentExpanded = parentId ? expandedTasks.has(parentId) : true;

    // 设置跳转操作进行中标志，防止滚动到底效果干扰
    setIsJumpOperationInProgress(true);

    // 设置高亮
    setHighlightedTaskId(taskId);
    // 3秒后清除高亮
    setTimeout(() => setHighlightedTaskId(''), 3000);

    if (isParentExpanded) {
      // 父任务已展开，直接滚动到目标
      const taskElement = document.querySelector(`[data-task-id="${taskId}"]`);
      if (taskElement) {
        taskElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    } else {
      // 父任务折叠，需要双层滚动
      const targetElement = document.querySelector(`[data-task-id="${taskId}"]`);
      const parentElement = document.querySelector(`[data-task-id="${parentId}"]`);

      if (targetElement && parentElement) {
        // 第一步：滚动主容器到父任务位置
        parentElement.scrollIntoView({ behavior: 'smooth', block: 'start' });

        // 第二步：滚动子任务区域到目标位置
        // 使用 setTimeout 确保主容器滚动完成后再滚动子任务区域
        setTimeout(() => {
          const childrenUl = parentElement.querySelector(':scope > .children, :scope > ul');
          if (childrenUl) {
            // 直接滚动到目标元素，使用 auto 避免动画冲突
            childrenUl.scrollTo({ top: targetElement.offsetTop, behavior: 'auto' });
          }
        }, 300); // 等待主容器滚动完成
      }
    }

    // 延迟清除跳转操作标志，确保滚动到底效果不会干扰
    setTimeout(() => {
      setIsJumpOperationInProgress(false);
      if (onComplete) onComplete();
    }, 400);
  };

  // 【实现R28】【R51.9】跳转到指定任务，跳转完成后复位下拉菜单
  const handleJumpToTask = (taskId: string) => {
    setJumpToTaskId(taskId);
    if (taskId) {
      scrollToTask(taskId, () => {
        // 跳转完成后复位下拉菜单到"跳转"状态
        setJumpToTaskId('');
      });
    }
  };

  // 【实现R29】【R51.9】滚动到指定任务（来自VSCode编辑器的滚动同步）
  const handleScrollToTask = (taskId: string, lineNumber: number) => {
//    console.log('[Webview] scrollToTask:', taskId, 'line:', lineNumber);
    scrollToTask(taskId, () => {
      // 更新最后滚动的任务
      lastScrollTaskRef.current = taskId;
    });
  };

  // 处理任务内容中的链接点击
  const handleTaskContentClick = (e: React.MouseEvent, taskId: string) => {
    const target = e.target as HTMLElement;

    // 查找最近的链接元素（处理嵌套元素的情况）
    const anchorElement = target.closest('a');

    if (anchorElement) {
      e.preventDefault();
      e.stopPropagation(); // 阻止事件冒泡到 task-main-left，避免触发 handleSelect
      const href = anchorElement.getAttribute('href');
      if (href) {
//        console.log(`[Webview] 点击链接 (任务 ${taskId}):`, href);
        sendMessage({ type: 'openLink', url: href });
      }
    } else {
      // 如果点击的不是链接，关闭右键菜单
      closeContextMenu();
    }
  };

  // 【R54.1】【R54.2】处理任务内容中的右键点击
  const handleTaskContentContextMenu = (e: React.MouseEvent, taskId: string) => {
    const target = e.target as HTMLElement;

    // 查找最近的链接元素
    const anchorElement = target.closest('a');
    const href = anchorElement ? anchorElement.getAttribute('href') : null;

    // 右键点击任务任意位置都显示菜单
    e.preventDefault();
    e.stopPropagation();

    // 显示右键菜单
    setContextMenu({
      visible: true,
      x: e.clientX,
      y: e.clientY,
      href: href || '',
      taskId: taskId
    });
  };

  // 【R54.1】关闭右键菜单
  const closeContextMenu = () => {
    setContextMenu(null);
  };

  // 【R54.1】删除链接文件
  const handleDeleteLinkFile = () => {
    if (contextMenu && contextMenu.href) {
      sendMessage({ type: 'deleteLinkFile', url: contextMenu.href });
      closeContextMenu();
    }
  };

  // 【R54.1.1】【R54.1.1.1】复制链接绝对路径到剪贴板
  const handleCopyLinkPath = () => {
    if (contextMenu && contextMenu.href) {
      // 解析链接路径
      let linkPath = contextMenu.href;
      if (linkPath.startsWith('file://')) {
        linkPath = linkPath.slice(7);
      }
      // 解码 URL 编码的路径
      try {
        linkPath = decodeURIComponent(linkPath);
      } catch (e) {
        // 如果解码失败，保持原样
      }

      // 判断是否为相对路径（不以 / 开头，且不是 Windows 盘符）
      const isRelativePath = !linkPath.startsWith('/') && !linkPath.match(/^[A-Za-z]:/);

      let absolutePath = linkPath;
      if (isRelativePath && currentFilePath) {
        // 相对路径：基于当前文件路径解析为绝对路径
        const currentDir = currentFilePath.replace(/[/\\][^/\\]*$/, '');
        absolutePath = currentDir + '/' + linkPath;
      }

      // 将反斜杠替换为斜杠，保持路径格式一致性
      absolutePath = absolutePath.replace(/\\/g, '/');

      navigator.clipboard.writeText(absolutePath).then(() => {
        console.log('链接绝对路径已复制到剪贴板:', absolutePath);
      }).catch(err => {
        console.error('复制失败:', err);
      });

      closeContextMenu();
    }
  };

  // 【R54.1.1】【R54.1.1.1】复制链接相对路径到剪贴板（相对于 VSCode 工作区）
  const handleCopyLinkRelativePath = () => {
    if (contextMenu && contextMenu.href) {
      // 解析链接路径
      let linkPath = contextMenu.href;
      if (linkPath.startsWith('file://')) {
        linkPath = linkPath.slice(7);
      }
      // 解码 URL 编码的路径
      try {
        linkPath = decodeURIComponent(linkPath);
      } catch (e) {
        // 如果解码失败，保持原样
      }

      // 判断是否为相对路径（不以 / 开头，且不是 Windows 盘符）
      const isRelativePath = !linkPath.startsWith('/') && !linkPath.match(/^[A-Za-z]:/);

      let absolutePath = linkPath;
      if (isRelativePath && currentFilePath) {
        // 相对路径：基于当前文件路径解析为绝对路径
        const currentDir = currentFilePath.replace(/[/\\][^/\\]*$/, '');
        absolutePath = currentDir + '/' + linkPath;
      }

      // 计算相对于工作区的相对路径
      let relativePath = absolutePath;
      if (workspacePath && absolutePath.startsWith(workspacePath)) {
        // 去除工作区前缀，得到相对于工作区的路径
        relativePath = absolutePath.slice(workspacePath.length);
        // 去除开头的斜杠
        if (relativePath.startsWith('/') || relativePath.startsWith('\\')) {
          relativePath = relativePath.slice(1);
        }
      }

      // 将反斜杠替换为斜杠，保持路径格式一致性
      relativePath = relativePath.replace(/\\/g, '/');

      navigator.clipboard.writeText(relativePath).then(() => {
        console.log('链接相对路径已复制到剪贴板:', relativePath);
      }).catch(err => {
        console.error('复制失败:', err);
      });

      closeContextMenu();
    }
  };

  // 【R54.2】【R54.3】复制执行命令到剪贴板
  // R54.3修改：改为发送消息给extension，由extension的命令生成函数生成命令，确保与实际执行一致
  const handleCopyExecuteCommand = () => {
    if (contextMenu && contextMenu.taskId) {
      // 发送消息给extension，请求生成执行命令
      sendMessage({
        type: 'generateExecuteCommand',
        taskId: contextMenu.taskId
      });
      closeContextMenu();
    }
  };

  // 【实现R29】处理滚动事件 - 当用户滚动webview时，同步到VSCode编辑器
  const handleScroll = React.useCallback(() => {
    // 【实现R29.2】如果同步开关关闭，不处理滚动同步
    if (!syncScrollEnabled) {
      return;
    }

    const now = Date.now();

    // 节流控制
    if (now - lastScrollTimeRef.current < SCROLL_THROTTLE) {
      return;
    }
    lastScrollTimeRef.current = now;

    // 查找当前可见区域中最顶部的任务
    const taskElements = document.querySelectorAll('[data-task-id]');
    let topmostTask: { id: string; lineNumber: number; element: Element } | null = null;
    let minTop = Infinity;

    const container = document.querySelector('.task-container');
    const containerRect = container?.getBoundingClientRect();

    if (!containerRect) return;

    taskElements.forEach((element) => {
      const taskId = element.getAttribute('data-task-id');
      if (!taskId) return;

      const rect = element.getBoundingClientRect();
      const relativeTop = rect.top - containerRect.top;

      // 计算元素顶部相对于容器顶部的位置
      // 如果元素在可视区域内或接近可视区域顶部
      if (relativeTop >= -50 && relativeTop < minTop) {
        minTop = relativeTop;
        // 查找任务的lineNumber
        const task = findTaskById(tasks, taskId);
        if (task) {
          topmostTask = { id: taskId, lineNumber: task.lineNumber, element };
        }
      }
    });

    // 如果找到当前可见的任务，且与上一次不同，发送滚动消息到VSCode
    if (topmostTask && topmostTask.id !== lastScrollTaskRef.current) {
      lastScrollTaskRef.current = topmostTask.id;
      console.log('[Webview] Sending scroll sync:', topmostTask.id, 'line:', topmostTask.lineNumber);
      // 【实现R29.1】发送滚动消息前先通知webview成为焦点
      sendMessage({ type: 'webviewActive' });
      sendMessage({
        type: 'webviewScrolled',
        taskId: topmostTask.id,
        lineNumber: topmostTask.lineNumber
      });
    }
  }, [tasks, sendMessage]);

  // 辅助函数：根据ID查找任务
  const findTaskById = (taskList: Task[], taskId: string): Task | undefined => {
    for (const task of taskList) {
      if (task.id === taskId) {
        return task;
      }
      if (task.children && task.children.length > 0) {
        const found = findTaskById(task.children, taskId);
        if (found) return found;
      }
    }
    return undefined;
  };

  // 【实现R29.1】发送焦点状态到extension（注释掉以减少高频日志）
  const notifyWebviewActive = React.useCallback(() => {
    // sendMessage({ type: 'webviewActive' });
  }, [sendMessage]);

  // 【实现R29.2】切换双向滚动同步开关
  const handleToggleSyncScroll = () => {
    const newState = !syncScrollEnabled;
    setSyncScrollEnabled(newState);
    console.log('[Webview] 双向滚动同步:', newState ? '开启' : '关闭');
    // 发送状态变更通知
    sendMessage({ type: 'syncScrollChanged', enabled: newState });
  };

  // 【实现R37.3】滚动到顶部
  const handleScrollToTop = () => {
    if (buttonCooldown[BUTTON_IDS.SCROLL_TO_TOP]) {
      console.log('[Webview] 顶部按钮防抖，跳过重复点击');
      return;
    }
    const container = document.querySelector('.task-container');
    if (container) {
      container.scrollTo({ top: 0, behavior: 'smooth' });
    }
    // 设置防抖状态
    setButtonCooldown(prev => ({ ...prev, [BUTTON_IDS.SCROLL_TO_TOP]: true }));
    setTimeout(() => {
      setButtonCooldown(prev => ({ ...prev, [BUTTON_IDS.SCROLL_TO_TOP]: false }));
    }, BUTTON_COOLDOWN);
  };

  // 【实现R37.3】滚动到底部
  const handleScrollToBottom = () => {
    if (buttonCooldown[BUTTON_IDS.SCROLL_TO_BOTTOM]) {
      console.log('[Webview] 底部按钮防抖，跳过重复点击');
      return;
    }
    const container = document.querySelector('.task-container');
    if (container) {
      container.scrollTo({ top: container.scrollHeight, behavior: 'smooth' });
    }
    // 设置防抖状态
    setButtonCooldown(prev => ({ ...prev, [BUTTON_IDS.SCROLL_TO_BOTTOM]: true }));
    setTimeout(() => {
      setButtonCooldown(prev => ({ ...prev, [BUTTON_IDS.SCROLL_TO_BOTTOM]: false }));
    }, BUTTON_COOLDOWN);
  };

  // 【实现R37.3】跳转到下一个未完成的任务（循环）
  const handleJumpToNextIncomplete = () => {
    if (buttonCooldown[BUTTON_IDS.JUMP_TO_NEXT]) {
      console.log('[Webview] 下一个按钮防抖，跳过重复点击');
      return;
    }
    // 【R51.18修改】获取所有任务（只排除已完成，进行中的也算未完成）
    const allTasks = getAllTasks(tasks);
    const incompleteTasks = allTasks.filter(t => !t.completed);

    if (incompleteTasks.length === 0) {
      // 没有未完成的任务（包括进行中的），提示用户
      console.log('[Webview] 没有未完成的任务（包括进行中的）');
      setButtonCooldown(prev => ({ ...prev, [BUTTON_IDS.JUMP_TO_NEXT]: true }));
      setTimeout(() => {
        setButtonCooldown(prev => ({ ...prev, [BUTTON_IDS.JUMP_TO_NEXT]: false }));
      }, BUTTON_COOLDOWN);
      return;
    }

    // 找到当前索引的下一个任务
    let nextIndex = 0;
    if (lastJumpIndex >= 0 && lastJumpIndex < incompleteTasks.length - 1) {
      // 从当前位置继续往后找
      nextIndex = lastJumpIndex + 1;
    } else if (lastJumpIndex >= incompleteTasks.length - 1) {
      // 已经到末尾了，循环回到开头
      nextIndex = 0;
    }

    const nextTask = incompleteTasks[nextIndex];
    if (nextTask) {
      // 使用统一的滚动函数，支持折叠模式下的双层滚动
      scrollToTask(nextTask.id);
      // 更新索引记录
      setLastJumpIndex(nextIndex);
    }

    // 设置防抖状态
    setButtonCooldown(prev => ({ ...prev, [BUTTON_IDS.JUMP_TO_NEXT]: true }));
    setTimeout(() => {
      setButtonCooldown(prev => ({ ...prev, [BUTTON_IDS.JUMP_TO_NEXT]: false }));
    }, BUTTON_COOLDOWN);
  };

  // 【实现R29】添加滚动事件监听器
  // 【修复R29.3】将 syncScrollEnabled 添加到依赖项，确保开关状态变化时重新绑定事件
  React.useEffect(() => {
    const container = document.querySelector('.task-container');
    if (container) {
      // 【实现R29.1】监听滚动事件，先通知webview成为焦点
      const handleScrollWithFocus = () => {
        notifyWebviewActive();
        handleScroll();
      };

      container.addEventListener('scroll', handleScrollWithFocus, { passive: true });

      // 【实现R29.1】监听点击事件，设置webview为焦点
      container.addEventListener('click', notifyWebviewActive, { passive: true });

      return () => {
        container.removeEventListener('scroll', handleScrollWithFocus);
        container.removeEventListener('click', notifyWebviewActive);
      };
    }
  }, [handleScroll, notifyWebviewActive, syncScrollEnabled]);

  // 判断是否有任何筛选条件激活
  // 【R51.5.7】筛选栏的激活状态只检查筛选类型（搜索已独立到标题栏）
  const hasActiveFilters = filterType !== 'all';

  // 显示 API 错误提示
  const renderApiError = () => {
    if (!apiError) return null;
    return React.createElement('div', {
      className: 'api-error',
      style: {
        padding: '12px',
        backgroundColor: '#c0392b',
        color: 'white',
        marginBottom: '12px',
        borderRadius: '4px',
        fontSize: '13px'
      }
    }, `错误: ${apiError} - 请重新加载窗口`);
  };

  // 处理文本块中的链接点击
  const handleTextBlockClick = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    // 检查是否点击了链接
    if (target.tagName === 'A' && target instanceof HTMLAnchorElement) {
      e.preventDefault();
      e.stopPropagation();
      const href = target.getAttribute('href');
      if (href) {
        console.log('[Webview] 点击文本块链接:', href);
        sendMessage({ type: 'openLink', url: href });
      }
    } else {
      // 点击非链接区域，关闭右键菜单
      closeContextMenu();
    }
  };

  // 【R51.5.8】筛选状态处理逻辑保留
  // 保留的筛选状态：filterType, searchKeyword, jumpToTaskId
  // 保留的筛选功能：filterTasks, handleJumpToTask, handleClearFilter

  // 筛选类型选项 - 【R51.5.8】用于下拉菜单
  const filterOptions = [
    { type: 'all' as const, label: '全部' },
    { type: 'hide-completed' as const, label: '隐藏完成' },
    { type: 'active' as const, label: '未开始' },
    { type: 'processing' as const, label: '进行中' },
  ];

  // 【R54.1】点击外部/滚动时关闭右键菜单
  React.useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      setContextMenu((prev) => {
        if (prev && prev.visible) {
          const target = e.target as HTMLElement;
          // 如果点击的不是右键菜单本身，则关闭菜单
          if (!target.closest('.context-menu')) {
            return null;
          }
        }
        return prev;
      });
    };

    const handleWheel = () => {
      setContextMenu((prev) => {
        if (prev && prev.visible) {
          return null;
        }
        return prev;
      });
    };

    document.addEventListener('click', handleClick);
    document.addEventListener('wheel', handleWheel, { passive: true });
    return () => {
      document.removeEventListener('click', handleClick);
      document.removeEventListener('wheel', handleWheel);
    };
  }, []);

  return React.createElement('div', { className: 'app' },
    React.createElement('header', { className: 'header' },
      React.createElement(Toolbar, {
        syncScrollEnabled,
        expandedTasks,
        buttonCooldown,
        incompleteCount,
        jumpToTaskId,
        searchKeyword,
        filterType,
        hasActiveFilters,
        allTasks,
        tasks,
        handleToggleSyncScroll,
        handleExpandAll,
        handleCollapseAll,
        handleRefresh,
        handleOpenFile,
        handleOpenSourceFile,
        handleScrollToTop,
        handleScrollToBottom,
        handleJumpToNextIncomplete,
        handleJumpToTask,
        setSearchKeyword,
        setFilterType,
        handleClearFilter,
        handleAddTask,
        getAllTaskIds,
      })
    ),
    React.createElement('main', { className: 'task-container' },
      renderApiError(),
      // 渲染普通文本块
      textBlocks.length > 0 && renderTextBlocks({
        textBlocks,
        textBlockEditModes,
        onTextBlockDoubleClick: handleTextBlockDoubleClick,
        onSaveTextBlock: handleSaveTextBlock,
        onCancelTextBlockEdit: handleCancelTextBlockEdit,
        onTextBlockClick: handleTextBlockClick,
      }),
      tasks.length === 0
        ? React.createElement('div', { className: 'empty-state' },
            React.createElement('div', { className: 'empty-state-icon' }, '📋'),
            React.createElement('p', null, '暂未加载任务文件'),
            React.createElement('button', { className: 'btn btn-primary', style: { marginTop: '16px' }, onClick: handleOpenFile }, '打开文件')
          )
        : null,
      tasks.length > 0 && filteredTasks.length === 0
        ? React.createElement('div', { className: 'empty-state' },
            React.createElement('div', { className: 'empty-state-icon' }, '🔍'),
            React.createElement('p', null, '没有匹配的任务'),
            React.createElement('button', { className: 'btn btn-secondary', style: { marginTop: '16px' }, onClick: handleClearFilter }, '清除筛选')
          )
        : null,
      tasks.length > 0 && filteredTasks.length > 0 && React.createElement('ul', { className: 'task-list', ref: taskListRef },
          filteredTasks.map((task, index) =>
            React.createElement(TaskItem, {
              key: task.id,
              task,
              depth: 0,
              expandedTasks,
              editModes,
              buttonCooldown,
              editingTaskParentId,  // 【修复R48.3】传递当前编辑任务的父任务ID
              highlightedTaskId,  // 【R51.9】高亮定位状态
              onToggleExpand: handleToggleExpand,
              onToggleComplete: handleToggleComplete,
              onSelect: handleSelect,
              onToggleEdit: handleToggleEdit,
              onSaveTitle: handleSaveTitle,
              onClaudeExecute: handleClaudeExecute,
              onDelete: handleDeleteTask,
              onAddSubTask: handleAddSubTask,
              onContinueTask: handleContinueTask,
              isLastChild: false,  // 顶层任务没有延续按钮
              claudeExecuting,
              isCollapseAllTriggered,  // 【R51.9】标记"全部收起"操作
              onDoubleClick: handleDoubleClick,
              onSaveComplete: handleSaveComplete,
              onTaskContentClick: handleTaskContentClick,
              onTaskContentContextMenu: handleTaskContentContextMenu,
            })
          )
        )
    ),
    React.createElement('footer', { className: 'status-bar' },
      React.createElement('span', { className: 'file-path' }, currentFilePath || '未选择文件'),
      React.createElement('span', { className: 'stats' }, `共 ${stats.total} 个任务，${stats.completed} 已完成`)
    ),
    // 【R54.1】【R54.2】右键菜单
    React.createElement(TaskContextMenu, {
      contextMenu,
      onCopyExecuteCommand: handleCopyExecuteCommand,
      onCopyLinkPath: handleCopyLinkPath,
      onCopyLinkRelativePath: handleCopyLinkRelativePath,
      onDeleteLinkFile: handleDeleteLinkFile,
    })
  );
};

export { TaskList };

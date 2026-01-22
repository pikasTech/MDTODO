import * as React from 'react';
import { marked } from 'marked';
import './TaskList.css';

// Configure marked options for better rendering
marked.setOptions({
  breaks: true, // Convert \n to <br>
  gfm: true,    // Enable GitHub Flavored Markdown
});

// Declare globals for TypeScript
declare const window: any;

// 【修复R38.1】按钮ID常量，用于独立防抖状态
const BUTTON_IDS = {
  EXPAND_ALL: 'expandAll',
  COLLAPSE_ALL: 'collapseAll',
  TOGGLE_COMPLETE: 'toggleComplete',
  REFRESH: 'refresh',
  OPEN_FILE: 'openFile',
  OPEN_SOURCE_FILE: 'openSourceFile',
  ADD_TASK: 'addTask',
  DELETE_TASK: 'deleteTask',
  ADD_SUB_TASK: 'addSubTask',
  SCROLL_TO_TOP: 'scrollToTop',
  SCROLL_TO_BOTTOM: 'scrollToBottom',
  JUMP_TO_NEXT: 'jumpToNext',
} as const;

interface Task {
  id: string;
  title: string;
  rawContent: string;  // 【修复R23】原始内容，用于编辑时显示
  completed: boolean;
  processing: boolean;
  children?: Task[];
  lineNumber?: number;  // 【实现R29】任务在文件中的行号
  // 【实现R39】链接统计信息
  linkCount: number;
  linkExists: number;
}

interface FilterType {
  type: 'all' | 'active' | 'hide-completed' | 'processing';
  label: string;
}

interface TextBlock {
  id: string;
  content: string;
  lineNumber: number;
}

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
  // Claude执行按钮防抖状态
  const [claudeExecuting, setClaudeExecuting] = React.useState<Record<string, boolean>>({});
  const CLAUDE_EXECUTE_COOLDOWN = 100; // 0.1秒冷却
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
  // 【实现R29.2】双向滚动同步开关，默认关闭
  const [syncScrollEnabled, setSyncScrollEnabled] = React.useState(false);
  // 【实现R37.3】跳转到下一个未完成任务的当前位置记录
  const [lastJumpIndex, setLastJumpIndex] = React.useState(-1);

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
    console.log('[Webview] handleSaveComplete: 退出编辑模式', taskId);
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
    console.log('[Webview] handleRefreshTaskTitle:', taskId, newTitle);
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
    // 确保任务展开
    setExpandedTasks((prev) => new Set(prev).add(taskId));
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
      console.log('[Webview] pendingScrollTaskId effect triggered for:', pendingScrollTaskId);
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
        console.log('[Webview] 已进入编辑模式并确保互斥:', pendingScrollTaskId);
        // 清除待滚动标记
        setPendingScrollTaskId(null);
      }
    }
  }, [pendingScrollTaskId]);

  React.useEffect(() => {
    const handleMessage = (event: any) => {
      const message = event.data;
      if (message.type === 'updateTasks') {
        console.log('[Webview] Received updateTasks, tasks:', message.tasks?.length, 'textBlocks:', message.textBlocks?.length, 'filePath:', message.filePath);
        setTasks(message.tasks || []);
        setTextBlocks(message.textBlocks || []);
        // 【修复R25】更新filePath状态
        setCurrentFilePath(message.filePath || '');
        // 【实现R34】更新显示标题（从文件路径提取文件名，不带.md后缀）
        setDisplayTitle(getFileName(message.filePath || ''));
        // 默认展开所有任务
        const allTaskIds = getAllTaskIds(message.tasks || []);
        setExpandedTasks(new Set(allTaskIds));

        // 【修复R19/R20】刷新文件时清除编辑状态，但保留正在编辑的任务
        // 使用 editingTaskIdsRef 来判断哪些任务正在被编辑
        const currentlyEditing = Array.from(editingTaskIdsRef.current);
        console.log('[Webview] updateTasks: 正在编辑的任务:', currentlyEditing);

        // 清除所有编辑状态，但保留正在编辑的任务的编辑状态
        setEditModes(prev => {
          const next: Record<string, boolean> = {};
          currentlyEditing.forEach(taskId => {
            // 只有当任务仍然存在于任务列表中时，才保留其编辑状态
            if (allTaskIds.includes(taskId)) {
              next[taskId] = true;
            }
          });
          return next;
        });

        // 同时更新 editingTaskIds，移除不存在的任务
        setEditingTaskIds(prev => {
          const next = new Set(prev);
          currentlyEditing.forEach(taskId => {
            if (!allTaskIds.includes(taskId)) {
              next.delete(taskId);
            }
          });
          return next;
        });

        console.log('[Webview] updateTasks: 已更新编辑状态，保留正在编辑的任务');
      } else if (message.type === 'newTaskAdded') {
        // 设置待滚动的任务ID，tasks更新后会触发滚动
        setPendingScrollTaskId(message.taskId);
        // 【修复R19】标记新任务正在编辑，防止文件重载后丢失编辑状态
        setEditingTaskIds(new Set([message.taskId]));
        // 【修复R24】同时设置editModes，让新任务进入编辑模式
        setEditModes({ [message.taskId]: true });
        console.log('[Webview] newTaskAdded: 设置新任务', message.taskId, '为编辑状态');
        // 确保父任务展开
        const parentId = message.taskId.split('.').slice(0, -1).join('.');
        if (parentId) {
          setExpandedTasks(prev => new Set([...prev, parentId]));
        }
      } else if (message.type === 'refreshTaskTitle') {
        // 刷新单个任务标题
        handleRefreshTaskTitle(message.taskId, message.newTitle);
      } else if (message.type === 'scrollToTask') {
        // 【实现R29】滚动到指定任务
        handleScrollToTask(message.taskId, message.lineNumber);
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

  // 【实现R37.3.1】计算未完成任务的数量（在getAllTasks之后定义，避免初始化顺序问题）
  const incompleteCount = React.useMemo(() => {
    const allTasks = getAllTasks(tasks);
    return allTasks.filter(t => !t.completed && !t.processing).length;
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
      console.log('[Webview] 展开按钮防抖，跳过重复点击');
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
      console.log('[Webview] 收起按钮防抖，跳过重复点击');
      return;
    }
    setExpandedTasks(new Set());
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
      console.log('[Webview] 完成复选框防抖，跳过重复点击');
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
    console.log('[Webview] handleToggleEdit:', taskId, '->', willBeEditMode ? '编辑模式' : '非编辑模式');

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
  const handleDoubleClick = (taskId: string) => {
    console.log('[Webview] handleDoubleClick: 进入编辑模式', taskId);
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

  // 清除筛选条件
  const handleClearFilter = () => {
    setFilterType('all');
    setSearchKeyword('');
  };

  // 【实现R28】跳转到指定任务
  const handleJumpToTask = (taskId: string) => {
    setJumpToTaskId(taskId);
    if (taskId) {
      // 确保任务展开
      const parentId = taskId.split('.').slice(0, -1).join('.');
      if (parentId) {
        setExpandedTasks(prev => new Set([...prev, parentId]));
      }
      // 滚动到任务位置 - 【修复R28.2】改为顶对齐
      setTimeout(() => {
        const taskElement = document.querySelector(`[data-task-id="${taskId}"]`);
        if (taskElement) {
          taskElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }, 50);
    }
  };

  // 【实现R29】滚动到指定任务（来自VSCode编辑器的滚动同步）
  const handleScrollToTask = (taskId: string, lineNumber: number) => {
    console.log('[Webview] scrollToTask:', taskId, 'line:', lineNumber);

    // 确保任务展开
    const parentId = taskId.split('.').slice(0, -1).join('.');
    if (parentId) {
      setExpandedTasks(prev => new Set([...prev, parentId]));
    }

    // 滚动到任务位置 - 【修复R28.2】改为顶对齐
    setTimeout(() => {
      const taskElement = document.querySelector(`[data-task-id="${taskId}"]`);
      if (taskElement) {
        taskElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
        // 更新最后滚动的任务
        lastScrollTaskRef.current = taskId;
      }
    }, 50);
  };

  // 处理任务内容中的链接点击
  const handleTaskContentClick = (e: React.MouseEvent, taskId: string) => {
    const target = e.target as HTMLElement;
    // 检查是否点击了链接
    if (target.tagName === 'A' && target instanceof HTMLAnchorElement) {
      e.preventDefault();
      e.stopPropagation(); // 阻止事件冒泡到 task-main-left，避免触发 handleSelect
      const href = target.getAttribute('href');
      if (href) {
        console.log('[Webview] 点击链接:', href);
        sendMessage({ type: 'openLink', url: href });
      }
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

  // 【实现R29.1】发送焦点状态到extension
  const notifyWebviewActive = React.useCallback(() => {
    sendMessage({ type: 'webviewActive' });
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
    // 获取所有任务（未完成 + 未进行中）
    const allTasks = getAllTasks(tasks);
    const incompleteTasks = allTasks.filter(t => !t.completed && !t.processing);

    if (incompleteTasks.length === 0) {
      // 没有未完成的任务，提示用户
      console.log('[Webview] 没有未完成的任务');
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
      // 确保任务展开
      const parentId = nextTask.id.split('.').slice(0, -1).join('.');
      if (parentId) {
        setExpandedTasks(prev => new Set([...prev, parentId]));
      }
      // 滚动到任务位置 - 顶对齐
      setTimeout(() => {
        const taskElement = document.querySelector(`[data-task-id="${nextTask.id}"]`);
        if (taskElement) {
          taskElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }, 50);
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
  const hasActiveFilters = filterType !== 'all' || searchKeyword.trim() !== '';

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
    }
  };

  // 渲染文本块 - 使用marked渲染markdown内容
  const renderTextBlocks = () => {
    if (!textBlocks || textBlocks.length === 0) return null;

    // HTML转义函数
    const escapeHtml = (text: string) => {
      return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
    };

    return React.createElement('div', { className: 'text-blocks' },
      textBlocks.map((block) => {
        // 使用marked渲染markdown内容
        let renderedContent;
        try {
          renderedContent = marked.parse(block.content, { async: false });
        } catch (error) {
          console.error('[Webview] TextBlock Markdown渲染错误:', error);
          renderedContent = escapeHtml(block.content);
        }

        return React.createElement('div', {
          key: block.id,
          className: 'text-block',
          style: {
            padding: '8px 12px',
            margin: '4px 0',
            backgroundColor: '#2d2d2d',
            borderRadius: '4px',
            fontSize: '13px',
            color: '#a0a0a0',
            lineHeight: '1.5',
            cursor: 'pointer'
          },
          dangerouslySetInnerHTML: { __html: renderedContent as string },
          onClick: handleTextBlockClick
        });
      })
    );
  };

  // 渲染筛选栏
  const renderFilterBar = () => {
    const filteredStats = getFilteredStats();
    // 【实现R28/R28.1】获取所有任务ID用于跳转下拉菜单，按文档原始顺序（移除sort，保持文档顺序）
    const allTaskIds = getAllTasks(tasks).map(t => t.id);

    return React.createElement('div', { className: 'filter-bar' },
      // 【实现R28】任务跳转下拉菜单 - 位于最左侧
      React.createElement('div', { className: 'filter-group' },
        React.createElement('span', { className: 'filter-label' }, '跳转:'),
        React.createElement('select', {
          className: 'jump-select',
          value: jumpToTaskId,
          onChange: (e: React.ChangeEvent<HTMLSelectElement>) => handleJumpToTask(e.target.value)
        },
          React.createElement('option', { value: '' }, '-- 选择任务 --'),
          allTaskIds.map(taskId =>
            React.createElement('option', { key: taskId, value: taskId }, taskId)
          )
        )
      ),
      React.createElement('div', { className: 'filter-group' },
        React.createElement('span', { className: 'filter-label' }, '状态:'),
        React.createElement('div', { className: 'filter-buttons' },
          React.createElement('button', {
            className: `filter-btn ${filterType === 'all' ? 'active' : ''}`,
            onClick: () => setFilterType('all')
          }, '全部'),
          React.createElement('button', {
            className: `filter-btn ${filterType === 'active' ? 'active' : ''}`,
            onClick: () => setFilterType('active')
          }, '未开始'),
          React.createElement('button', {
            className: `filter-btn ${filterType === 'processing' ? 'active' : ''}`,
            onClick: () => setFilterType('processing')
          }, '进行中'),
          React.createElement('button', {
            className: `filter-btn ${filterType === 'hide-completed' ? 'active' : ''}`,
            onClick: () => setFilterType('hide-completed')
          }, '隐藏已完成')
        )
      ),
      React.createElement('div', { className: 'filter-group' },
        React.createElement('span', { className: 'filter-label' }, '搜索:'),
        React.createElement('input', {
          type: 'text',
          className: 'search-input',
          placeholder: '输入关键词搜索...',
          value: searchKeyword,
          onChange: (e: React.ChangeEvent<HTMLInputElement>) => setSearchKeyword(e.target.value)
        }),
        searchKeyword && React.createElement('button', {
          className: 'clear-search-btn',
          onClick: () => setSearchKeyword(''),
          title: '清除搜索'
        }, '×')
      ),
      hasActiveFilters && React.createElement('button', {
        className: 'clear-filter-btn',
        onClick: handleClearFilter
      }, '清除筛选'),
      // 添加任务按钮放入筛选栏内
      React.createElement('button', {
        className: `btn btn-primary add-task-btn ${buttonCooldown[BUTTON_IDS.ADD_TASK] ? 'disabled' : ''}`,
        disabled: buttonCooldown[BUTTON_IDS.ADD_TASK],
        onClick: handleAddTask,
        title: '添加新任务'
      }, '+ 添加任务'),
      React.createElement('div', { className: 'filter-stats' },
        `显示 ${filteredStats.total} 个任务，${filteredStats.completed} 已完成`
      )
    );
  };

  return React.createElement('div', { className: 'app' },
    React.createElement('header', { className: 'header' },
      React.createElement('h1', null, displayTitle),
      React.createElement('div', { className: 'header-actions' },
        // 【实现R29.2】双向滚动同步开关按钮
        React.createElement('button', {
          className: `sync-scroll-btn ${syncScrollEnabled ? 'enabled' : ''}`,
          onClick: handleToggleSyncScroll,
          title: syncScrollEnabled ? '关闭双向滚动同步' : '开启双向滚动同步'
        },
          React.createElement('svg', {
            viewBox: '0 0 24 24',
            fill: 'none',
            stroke: 'currentColor',
            strokeWidth: 2,
            width: 16,
            height: 16
          },
            React.createElement('path', {
              d: 'M17 1l4 4-4 4'
            }),
            React.createElement('path', {
              d: 'M3 11V9a4 4 0 0 1 4-4h14'
            }),
            React.createElement('path', {
              d: 'M7 23l-4-4 4-4'
            }),
            React.createElement('path', {
              d: 'M21 13v2a4 4 0 0 1-4 4H3'
            })
          )
        ),
        // 全部展开按钮 - 图标
        React.createElement('button', {
          className: `toolbar-icon-btn ${buttonCooldown[BUTTON_IDS.EXPAND_ALL] ? 'disabled' : ''}`,
          disabled: buttonCooldown[BUTTON_IDS.EXPAND_ALL],
          onClick: handleExpandAll,
          title: '全部展开'
        },
          React.createElement('svg', { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, width: 16, height: 16 },
            React.createElement('polyline', { points: '15 3 21 3 21 9' }),
            React.createElement('polyline', { points: '9 21 3 21 3 15' }),
            React.createElement('line', { x1: '21', y1: '3', x2: '14', y2: '10' }),
            React.createElement('line', { x1: '3', y1: '21', x2: '10', y2: '14' })
          )
        ),
        // 全部收起按钮 - 图标
        React.createElement('button', {
          className: `toolbar-icon-btn ${buttonCooldown[BUTTON_IDS.COLLAPSE_ALL] ? 'disabled' : ''}`,
          disabled: buttonCooldown[BUTTON_IDS.COLLAPSE_ALL],
          onClick: handleCollapseAll,
          title: '全部收起'
        },
          React.createElement('svg', { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, width: 16, height: 16 },
            React.createElement('polyline', { points: '4 14 10 14 10 20' }),
            React.createElement('polyline', { points: '20 10 14 10 14 4' }),
            React.createElement('line', { x1: '14', y1: '10', x2: '21', y2: '3' }),
            React.createElement('line', { x1: '3', y1: '21', x2: '10', y2: '14' })
          )
        ),
        // 刷新按钮 - 图标
        React.createElement('button', {
          className: `toolbar-icon-btn ${buttonCooldown[BUTTON_IDS.REFRESH] ? 'disabled' : ''}`,
          disabled: buttonCooldown[BUTTON_IDS.REFRESH],
          onClick: handleRefresh,
          title: '刷新'
        },
          React.createElement('svg', { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, width: 16, height: 16 },
            React.createElement('polyline', { points: '23 4 23 10 17 10' }),
            React.createElement('path', { d: 'M20.49 15a9 9 0 1 1-2.12-9.36L23 10' })
          )
        ),
        // 打开文件按钮 - 图标
        React.createElement('button', {
          className: `toolbar-icon-btn ${buttonCooldown[BUTTON_IDS.OPEN_FILE] ? 'disabled' : ''}`,
          disabled: buttonCooldown[BUTTON_IDS.OPEN_FILE],
          onClick: handleOpenFile,
          title: '打开文件'
        },
          React.createElement('svg', { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, width: 16, height: 16 },
            React.createElement('path', { d: 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z' }),
            React.createElement('polyline', { points: '14 2 14 8 20 8' }),
            React.createElement('line', { x1: '16', y1: '13', x2: '8', y2: '13' }),
            React.createElement('line', { x1: '16', y1: '17', x2: '8', y2: '17' }),
            React.createElement('polyline', { points: '10 9 9 9 8 9' })
          )
        ),
        // 打开原文按钮 - 图标
        React.createElement('button', {
          className: `toolbar-icon-btn ${buttonCooldown[BUTTON_IDS.OPEN_SOURCE_FILE] ? 'disabled' : ''}`,
          disabled: buttonCooldown[BUTTON_IDS.OPEN_SOURCE_FILE],
          onClick: handleOpenSourceFile,
          title: '在VSCode中打开原文'
        },
          React.createElement('svg', { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, width: 16, height: 16 },
            React.createElement('path', { d: 'M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6' }),
            React.createElement('polyline', { points: '15 3 21 3 21 9' }),
            React.createElement('line', { x1: '10', y1: '14', x2: '21', y2: '3' })
          )
        ),
        // 【实现R37.3】快速到顶部按钮 - 图标
        React.createElement('button', {
          className: `toolbar-icon-btn ${buttonCooldown[BUTTON_IDS.SCROLL_TO_TOP] ? 'disabled' : ''}`,
          disabled: buttonCooldown[BUTTON_IDS.SCROLL_TO_TOP],
          onClick: handleScrollToTop,
          title: '快速到顶部'
        },
          React.createElement('svg', { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, width: 16, height: 16 },
            React.createElement('polyline', { points: '18 15 12 9 6 15' })
          )
        ),
        // 【实现R37.3】快速到底部按钮 - 图标
        React.createElement('button', {
          className: `toolbar-icon-btn ${buttonCooldown[BUTTON_IDS.SCROLL_TO_BOTTOM] ? 'disabled' : ''}`,
          disabled: buttonCooldown[BUTTON_IDS.SCROLL_TO_BOTTOM],
          onClick: handleScrollToBottom,
          title: '快速到底部'
        },
          React.createElement('svg', { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, width: 16, height: 16 },
            React.createElement('polyline', { points: '6 9 12 15 18 9' })
          )
        ),
        // 【实现R37.3】跳转到下一个未完成任务按钮 - 图标 + 数字徽章
        React.createElement('div', { className: 'jump-next-btn-wrapper' },
          React.createElement('button', {
            className: `toolbar-icon-btn ${buttonCooldown[BUTTON_IDS.JUMP_TO_NEXT] ? 'disabled' : ''}`,
            disabled: buttonCooldown[BUTTON_IDS.JUMP_TO_NEXT],
            onClick: handleJumpToNextIncomplete,
            title: '跳转到下一个未完成任务（循环）'
          },
            React.createElement('svg', { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, width: 16, height: 16 },
              React.createElement('circle', { cx: '12', cy: '12', r: '10' }),
              React.createElement('polyline', { points: '12 6 16 10 12 14' }),
              React.createElement('line', { x1: '8', y1: '10', x2: '8', y2: '14' })
            )
          ),
          // 【实现R37.3.1】数字徽章，显示未完成任务数量
          incompleteCount > 0 && React.createElement('span', {
            className: 'jump-next-badge'
          }, incompleteCount)
        )
      )
    ),
    // 浮动筛选栏 - 位于header下方，滚动时固定在顶部
    tasks.length > 0 && renderFilterBar(),
    React.createElement('main', { className: 'task-container' },
      renderApiError(),
      // 渲染普通文本块
      textBlocks.length > 0 && renderTextBlocks(),
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
          filteredTasks.map((task) =>
            React.createElement(TaskItem, {
              key: task.id,
              task,
              depth: 0,
              expandedTasks,
              editModes,
              buttonCooldown,
              onToggleExpand: handleToggleExpand,
              onToggleComplete: handleToggleComplete,
              onSelect: handleSelect,
              onToggleEdit: handleToggleEdit,
              onSaveTitle: handleSaveTitle,
              onClaudeExecute: handleClaudeExecute,
              onDelete: handleDeleteTask,
              onAddSubTask: handleAddSubTask,
              claudeExecuting,
              onDoubleClick: handleDoubleClick,
              onSaveComplete: handleSaveComplete,
              onTaskContentClick: handleTaskContentClick,
            })
          )
        )
    ),
    React.createElement('footer', { className: 'status-bar' },
      React.createElement('span', { className: 'file-path' }, currentFilePath || '未选择文件'),
      React.createElement('span', { className: 'stats' }, `共 ${stats.total} 个任务，${stats.completed} 已完成`)
    )
  );
};

const TaskItem: React.FC<{
  task: Task;
  depth: number;
  expandedTasks: Set<string>;
  editModes: Record<string, boolean>;
  claudeExecuting: Record<string, boolean>;
  buttonCooldown: Record<string, boolean>;  // 按钮冷却状态 - 【修复R38.1】改为每个按钮独立防抖
  onToggleExpand: (taskId: string) => void;
  onToggleComplete: (taskId: string) => void;
  onSelect: (taskId: string) => void;
  onToggleEdit: (taskId: string) => void;  // 保留，用于Escape键取消编辑
  onSaveTitle: (taskId: string, title: string) => void;
  onClaudeExecute: (taskId: string) => void;
  onDelete: (taskId: string) => void;
  onAddSubTask: (taskId: string) => void;
  onDoubleClick: (taskId: string) => void;
  onSaveComplete?: (taskId: string) => void;  // 保存完成后退出编辑模式的回调
  onTaskContentClick?: (e: React.MouseEvent, taskId: string) => void;  // 任务内容链接点击回调
}> = (props) => {
  const {
    task,
    depth,
    expandedTasks,
    editModes,
    claudeExecuting,
    buttonCooldown,
    onToggleExpand,
    onToggleComplete,
    onSelect,
    onToggleEdit,
    onSaveTitle,
    onClaudeExecute,
    onDelete,
    onAddSubTask,
    onDoubleClick,
    onSaveComplete,
    onTaskContentClick,
  } = props;

  const titleInputRef = React.useRef<HTMLTextAreaElement>(null);
  // 【修复R23】使用rawContent作为编辑内容，保留原始格式包括编号列表
  const [editValue, setEditValue] = React.useState(task.rawContent || task.title);

  // 【修复R27/R27.1】计算textarea高度：根据行数动态调整，整体比之前高50%
  const LINE_HEIGHT = 32; // 行高 = 14px * 2.3 ≈ 32px（比之前21px高50%）
  const MIN_LINES = 3;    // 最小3行
  const MAX_LINES = 15;   // 最大15行
  const PADDING = 24;     // 上下padding = 12px * 2 = 24px（比之前16px高50%）

  const calculateTextareaHeight = (text: string): string => {
    const lineCount = (text.match(/\n/g) || []).length + 1;
    const clampedLines = Math.max(MIN_LINES, Math.min(MAX_LINES, lineCount));
    return `${clampedLines * LINE_HEIGHT + PADDING}px`;
  };

  const [textareaHeight, setTextareaHeight] = React.useState(() =>
    calculateTextareaHeight(task.rawContent || task.title)
  );

  // 当编辑内容变化时，重新计算高度
  React.useEffect(() => {
    setTextareaHeight(calculateTextareaHeight(editValue));
  }, [editValue]);

  const hasChildren = task.children && task.children.length > 0;
  const isExpanded = expandedTasks.has(task.id);
  const isEditMode = editModes[task.id] || false;
  // Check if this is a newly added task (empty rawContent and just entered edit mode)
  const isNewTask = (task.rawContent || task.title).trim() === '' && isEditMode;
  const childrenStyle = {
    maxHeight: isExpanded ? '2000px' : '0',
    marginLeft: `${24 + depth * 16}px`,
  };

  // 【修复R23】当进入编辑模式时，从rawContent初始化editValue（保留原始格式）
  React.useEffect(() => {
    if (isEditMode) {
      setEditValue(task.rawContent || task.title);
    }
  }, [isEditMode, task.rawContent, task.title]);

  // Auto-focus when entering edit mode
  // 【R36】将光标移动到输入框的最开始，而不是末尾
  React.useEffect(() => {
    if (isEditMode && titleInputRef.current) {
      titleInputRef.current.focus();
      // 将光标移到文本开头
      titleInputRef.current.selectionStart = 0;
      titleInputRef.current.selectionEnd = 0;
    }
  }, [isEditMode]);

  // 【修复R22.3】使用textarea原生多行编辑，天然支持换行
  // 保存时直接使用textarea的value，保留所有换行符
  const handleTitleBlur = (e: React.FocusEvent<HTMLTextAreaElement>, taskId: string) => {
    const newTitle = e.currentTarget.value.trim();
    if (newTitle) {
      onSaveTitle(taskId, newTitle);
      // 保存完成后退出编辑模式
      if (onSaveComplete) {
        onSaveComplete(taskId);
      }
    }
  };

  const handleTitleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      // Enter键完成编辑（不阻止默认行为，让blur处理）
      e.preventDefault();
      // 触发blur事件来保存
      e.currentTarget.blur();
    }
    if (e.key === 'Escape') {
      // 【修复R23】Escape键取消编辑，恢复原始内容（使用rawContent）
      setEditValue(task.rawContent || task.title);
      onToggleEdit(taskId);
    }
  };

  // 【修复R22.3】添加handleChange处理函数
  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setEditValue(e.target.value);
  };

  const escapeHtml = (text: string) => {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  };

  const renderContent = () => {
    // 非编辑模式下使用marked渲染Markdown
    try {
      return marked.parse(task.title, { async: false });
    } catch (error) {
      console.error('[Webview] Markdown渲染错误:', error);
      return escapeHtml(task.title);
    }
  };

  // 计算任务样式类名
  const taskClassName = `task-item ${task.completed ? 'completed' : ''} ${task.processing ? 'processing' : ''}`;

  return React.createElement('li', { className: taskClassName, 'data-task-id': task.id },
    React.createElement('div', {
      className: 'task-card',
      onDoubleClick: () => onDoubleClick(task.id),
    },
      React.createElement('div', { className: 'task-main' },
        React.createElement('div', {
          className: 'task-main-left',
          onClick: () => onSelect(task.id),
          tabIndex: 0,
          role: 'button',
        },
          hasChildren && React.createElement('div', {
            className: `expand-icon ${isExpanded ? 'expanded' : ''}`,
            onClick: (e: React.MouseEvent) => {
              e.stopPropagation();
              onToggleExpand(task.id);
            },
          }, '▶'),
          React.createElement('div', {
            className: `task-checkbox ${task.completed ? 'checked' : ''}`,
            onClick: (e: React.MouseEvent) => {
              e.stopPropagation();
              onToggleComplete(task.id);
            },
          }),
          React.createElement('div', { className: 'task-content' },
            React.createElement('div', { className: 'task-id-wrapper' },
              React.createElement('span', { className: 'task-id' }, task.id),
              task.processing && React.createElement('span', { className: 'processing-badge' }, '执行中'),
              // 【实现R39】链接数量图标
              task.linkCount > 0 && React.createElement('span', {
                className: `link-status-icon ${task.linkExists === task.linkCount ? 'link-complete' : 'link-partial'}`,
                title: `链接检查: ${task.linkExists}/${task.linkCount} 个链接存在`
              },
                React.createElement('svg', { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, width: 14, height: 14 },
                  React.createElement('path', { d: 'M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71' }),
                  React.createElement('path', { d: 'M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71' })
                ),
                React.createElement('span', { className: 'link-count' }, `${task.linkExists}/${task.linkCount}`)
              )
            ),
            // 【修复R22.3】使用原生textarea替代contentEditable，支持多行编辑
            // 编辑模式：使用textarea原生value，保留所有换行符
            // 非编辑模式：使用marked渲染Markdown
            isEditMode
              ? React.createElement('textarea', {
                  ref: titleInputRef,
                  className: 'task-title-edit',
                  value: editValue,
                  onChange: handleChange,
                  onBlur: (e: React.FocusEvent<HTMLTextAreaElement>) => handleTitleBlur(e, task.id),
                  onKeyDown: handleTitleKeyDown,
                  placeholder: '输入任务内容...',
                  style: { height: textareaHeight }
                })
              : React.createElement('div', {
                  className: 'task-title',
                  dangerouslySetInnerHTML: isNewTask ? undefined : { __html: renderContent() },
                  onClick: (e: React.MouseEvent) => {
                    if (onTaskContentClick) {
                      onTaskContentClick(e, task.id);
                    }
                  },
                  style: { cursor: 'pointer' }
                })
          )
        ),
        // 按钮区域移到任务内容下方，右对齐
        React.createElement('div', { className: 'task-actions' },
          React.createElement('button', {
            className: `action-btn ${buttonCooldown[`${BUTTON_IDS.ADD_SUB_TASK}_${task.id}`] ? 'disabled' : ''}`,
            disabled: buttonCooldown[`${BUTTON_IDS.ADD_SUB_TASK}_${task.id}`],
            onClick: (e: React.MouseEvent) => {
              e.stopPropagation();
              onAddSubTask(task.id);
            },
            title: '添加子任务'
          },
            React.createElement('svg', { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, width: 14, height: 14 },
              React.createElement('line', { x1: '12', y1: '5', x2: '12', y2: '19' }),
              React.createElement('line', { x1: '5', y1: '12', x2: '19', y2: '12' })
            )
          ),
          React.createElement('button', {
            className: `action-btn delete-btn ${buttonCooldown[`${BUTTON_IDS.DELETE_TASK}_${task.id}`] ? 'disabled' : ''}`,
            disabled: buttonCooldown[`${BUTTON_IDS.DELETE_TASK}_${task.id}`],
            onClick: (e: React.MouseEvent) => {
              e.stopPropagation();
              onDelete(task.id);
            },
            title: '删除任务'
          },
            React.createElement('svg', { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, width: 14, height: 14 },
              React.createElement('polyline', { points: '3 6 5 6 21 6' }),
              React.createElement('path', { d: 'M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2' }),
              React.createElement('line', { x1: '10', y1: '11', x2: '10', y2: '17' }),
              React.createElement('line', { x1: '14', y1: '11', x2: '14', y2: '17' })
            )
          ),
          React.createElement('button', {
            className: `action-btn claude-btn ${claudeExecuting[task.id] ? 'disabled' : ''}`,
            disabled: claudeExecuting[task.id],
            onClick: (e: React.MouseEvent) => {
              e.stopPropagation();
              if (!claudeExecuting[task.id]) {
                onClaudeExecute(task.id);
              }
            },
            title: claudeExecuting[task.id] ? '执行中...' : '执行任务'
          },
            React.createElement('svg', { viewBox: '0 0 24 24', fill: 'currentColor', stroke: 'none', width: 14, height: 14 },
              React.createElement('polygon', { points: '5 3 19 12 5 21 5 3' })
            )
          )
        )
      )
    ),
    hasChildren && React.createElement('ul', { className: `children ${isExpanded ? '' : 'collapsed'}`, style: childrenStyle },
      task.children!.map((child) =>
        React.createElement(TaskItem, {
          key: child.id,
          task: child,
          depth: depth + 1,
          expandedTasks,
          editModes,
          buttonCooldown,
          onToggleExpand,
          onToggleComplete,
          onSelect,
          onToggleEdit,
          onSaveTitle,
          onClaudeExecute,
          onDelete,
          onAddSubTask,
          claudeExecuting,
          onDoubleClick,
          onSaveComplete,
          onTaskContentClick,
        })
      )
    )
  );
};

export { TaskList };

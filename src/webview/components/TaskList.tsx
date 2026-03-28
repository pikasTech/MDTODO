import * as React from 'react';
import { marked } from '../utils/marked';
import './TaskList.css';
import { Task, TextBlock, FilterType, BUTTON_IDS, TaskListProps } from './types';
import { TaskItem } from './TaskItem';
import { renderTextBlocks } from './TaskBlock';
import { Toolbar } from './Toolbar';
import { TaskContextMenu } from './ContextMenu';
import { SettingsPanel, ExecutionMode } from './Settings';
import {
  useTaskListState,
  useTaskOperations,
  useLinkOperations,
  useScrollHandler,
  useTaskListMessages,
} from './TaskList/hooks';

// Declare globals for TypeScript
declare const window: any;

// Maximum depth level for indentation (0 = level 1, 1 = level 2, max 2 levels total)
const MAX_DEPTH = 1;

/**
 * Calculate the depth level from a task ID.
 * R1 -> depth 0 (level 1, 0 dots)
 * R1.1 -> depth 1 (level 2, 1 dot)
 * R1.1.1 -> depth 1 (capped at max, 2 dots but max depth is 1)
 */
const calculateTaskDepth = (taskId: string): number => {
  const dotCount = (taskId.match(/\./g) || []).length;
  return Math.min(dotCount, MAX_DEPTH);
};

/**
 * Get the prefix of a task ID for level comparison.
 * R1.3.1 -> prefix "R1.3"
 * R1.3 -> prefix "R1"
 * R1 -> prefix "" (root level)
 */
const getTaskPrefix = (taskId: string): string => {
  const lastDotIndex = taskId.lastIndexOf('.');
  return lastDotIndex > 0 ? taskId.substring(0, lastDotIndex) : '';
};

/**
 * Check if a task is the last task in its level.
 * A task is last in its level if:
 * 1. For root tasks (no prefix): it's the last task in the root array
 * 2. For subtasks: no task with the same prefix comes after it in the entire task tree
 */
const isLastTaskInLevel = (taskId: string, allTasks: Task[]): boolean => {
  if (!allTasks || allTasks.length === 0) {
    return false;
  }

  const prefix = getTaskPrefix(taskId);

  // Collect all task IDs in order from the entire task tree
  const collectAllTaskIds = (tasks: Task[]): string[] => {
    const result: string[] = [];
    const traverse = (list: Task[]) => {
      for (const task of list) {
        result.push(task.id);
        if (task.children && task.children.length > 0) {
          traverse(task.children);
        }
      }
    };
    traverse(tasks);
    return result;
  };

  const allTaskIds = collectAllTaskIds(allTasks);

  if (!prefix) {
    // Root level task: check if it's the last in the root array
    const rootTasks = allTasks;
    return rootTasks.length > 0 && rootTasks[rootTasks.length - 1].id === taskId;
  } else {
    // Subtask: check if any task with the same prefix comes after it
    const taskIndex = allTaskIds.indexOf(taskId);
    if (taskIndex === -1 || taskIndex === allTaskIds.length - 1) {
      return taskIndex !== -1; // If it's the only task or last task overall, it's last in level
    }
    // Check if any subsequent task has the same prefix
    for (let i = taskIndex + 1; i < allTaskIds.length; i++) {
      if (getTaskPrefix(allTaskIds[i]) === prefix) {
        return false; // Found a task with same prefix after this one
      }
      // If we encounter a task with a different shorter prefix, stop checking
      // because tasks are ordered hierarchically
      const currentPrefix = getTaskPrefix(allTaskIds[i]);
      if (!currentPrefix.startsWith(prefix) && !prefix.startsWith(currentPrefix)) {
        // Different branch, no more tasks with same prefix will appear
        break;
      }
    }
    return true;
  }
};

const TaskList: React.FC<TaskListProps> = (props) => {
  const { initialTasks = [], initialTextBlocks = [], filePath = '', vscodeApi, onSaveComplete } = props;

  // Initialize state using hook
  const state = useTaskListState({
    initialTasks,
    initialTextBlocks,
    filePath,
  });

  // Destructure state for easier access
  const {
    tasks,
    setTasks,
    textBlocks,
    setTextBlocks,
    currentFilePath,
    setCurrentFilePath,
    workspacePath,
    setWorkspacePath,
    expandedTasks,
    setExpandedTasks,
    editModes,
    setEditModes,
    stats,
    editingTaskIds,
    setEditingTaskIds,
    editingTaskIdsRef,
    editingTaskParentId,
    setEditingTaskParentId,
    claudeExecuting,
    setClaudeExecuting,
    buttonCooldown,
    setButtonCooldown,
    filterType,
    setFilterType,
    searchKeyword,
    setSearchKeyword,
    jumpToTaskId,
    setJumpToTaskId,
    pendingScrollTaskId,
    setPendingScrollTaskId,
    syncScrollEnabled,
    setSyncScrollEnabled,
    lastJumpIndex,
    setLastJumpIndex,
    highlightedTaskId,
    setHighlightedTaskId,
    isCollapseAllTriggered,
    setIsCollapseAllTriggered,
    isJumpOperationInProgress,
    setIsJumpOperationInProgress,
    contextMenu,
    setContextMenu,
    textBlockEditModes,
    setTextBlockEditModes,
    displayTitle,
    setDisplayTitle,
    // 【R54.9.2.1】设置面板状态
    settingsPanelOpen,
    setSettingsPanelOpen,
    executionMode,
    setExecutionMode,
    model,
    models,
    setModel,
    setModels,
    allTasks,
    incompleteCount,
    filteredTasks,
    apiError,
  } = state;

  // Refs
  const taskListRef = React.useRef<HTMLUListElement>(null);
  const lastScrollTaskRef = React.useRef<string>('');
  const SCROLL_THROTTLE = 300;
  const lastScrollTimeRef = React.useRef<number>(0);

  // Save complete handler
  const handleSaveComplete = React.useCallback((taskId: string) => {
    setEditModes((prev) => ({
      ...prev,
      [taskId]: false,
    }));
    setEditingTaskIds((prev) => {
      const next = new Set(prev);
      next.delete(taskId);
      return next;
    });
    if (onSaveComplete) {
      onSaveComplete(taskId);
    }
  }, [setEditModes, setEditingTaskIds, onSaveComplete]);

  // Refresh task title handler
  const handleRefreshTaskTitle = React.useCallback((taskId: string, newTitle: string) => {
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
  }, [setTasks, setEditModes, setEditingTaskIds]);

  // Send message to extension
  const sendMessage = React.useCallback((message: any) => {
    if (vscodeApi) {
      vscodeApi.postMessage(message);
    } else {
      console.error('[Webview] sendMessage failed: vscodeApi is', vscodeApi);
    }
  }, [vscodeApi]);

  // Initialize operations hook
  const operations = useTaskOperations({
    vscodeApi,
    setApiError: () => {},
    setEditModes,
    setEditingTaskIds,
    setEditingTaskParentId,
    setTextBlockEditModes,
    setClaudeExecuting,
    setButtonCooldown,
    setHighlightedTaskId,
    setIsJumpOperationInProgress,
    setJumpToTaskId,
    setLastJumpIndex,
    setFilterType,
    setSearchKeyword,
    setSyncScrollEnabled,
    setPendingScrollTaskId,
    setIsCollapseAllTriggered,
    setExpandedTasks,
    tasks,
    expandedTasks,
    buttonCooldown,
    claudeExecuting,
    lastJumpIndex,
  });

  // Initialize link operations hook
  const linkOps = useLinkOperations({
    contextMenu,
    currentFilePath,
    workspacePath,
    sendMessage,
    setContextMenu,
  });

  // Initialize scroll handler hook
  const scrollHandler = useScrollHandler({
    tasks,
    syncScrollEnabled,
    sendMessage,
    scrollToTask: operations.scrollToTask,
    lastScrollTaskRef,
    SCROLL_THROTTLE,
    lastScrollTimeRef,
    notifyWebviewActive: () => {},
  });

  // Initialize message handler hook
  useTaskListMessages({
    setTasks,
    setTextBlocks,
    setCurrentFilePath,
    setWorkspacePath,
    setDisplayTitle,
    setEditModes,
    setEditingTaskIds,
    editingTaskIdsRef,
    setPendingScrollTaskId,
    setExecutionMode,
    setModel,
    setModels,
    handleRefreshTaskTitle,
    handleScrollToTask: operations.handleScrollToTask,
  });

  // Pending scroll effect
  React.useEffect(() => {
    if (pendingScrollTaskId) {
      const taskElement = document.querySelector(`[data-task-id="${pendingScrollTaskId}"]`);
      if (taskElement) {
        taskElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
        setEditModes(prev => {
          const next: Record<string, boolean> = {};
          Object.keys(prev).forEach(key => {
            next[key] = key === pendingScrollTaskId;
          });
          return next;
        });
        setEditingTaskIds(new Set([pendingScrollTaskId]));
        setPendingScrollTaskId(null);
      }
    }
  }, [pendingScrollTaskId, setEditModes, setEditingTaskIds, setPendingScrollTaskId]);

  // 【R54.9.6】打开设置面板时自动获取模型列表
  React.useEffect(() => {
    if (settingsPanelOpen && executionMode === 'opencode' && models.length === 0) {
      sendMessage({ type: 'fetchModels' });
    }
  }, [settingsPanelOpen, executionMode, models.length, sendMessage]);

  // Context menu click/wheel handlers
  React.useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      setContextMenu((prev) => {
        if (prev && prev.visible) {
          const target = e.target as HTMLElement;
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
  }, [setContextMenu]);

  // Handle text block click
  const handleTextBlockClick = React.useCallback((e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (target.tagName === 'A' && target instanceof HTMLAnchorElement) {
      e.preventDefault();
      e.stopPropagation();
      const href = target.getAttribute('href');
      if (href) {
        sendMessage({ type: 'openLink', url: href });
      }
    } else {
      linkOps.closeContextMenu();
    }
  }, [sendMessage, linkOps]);

  // Filter options
  const filterOptions = [
    { type: 'all' as const, label: '全部' },
    { type: 'hide-completed' as const, label: '隐藏完成' },
    { type: 'active' as const, label: '未开始' },
    { type: 'processing' as const, label: '进行中' },
  ];

  // 【R54.9.2.1】打开设置面板
  const handleOpenSettings = React.useCallback(() => {
    setSettingsPanelOpen(true);
  }, [setSettingsPanelOpen]);

  // 【R54.9.2.1】处理执行模式变更
  const handleExecutionModeChange = React.useCallback((mode: ExecutionMode) => {
    setExecutionMode(mode);
    setSettingsPanelOpen(false);
    // 可以在这里发送消息到扩展端保存设置
    sendMessage({ type: 'executionModeChanged', mode });
  }, [setExecutionMode, setSettingsPanelOpen, sendMessage]);

  // 【R54.9.6】处理模型变更
  const handleModelChange = React.useCallback((modelId: string) => {
    setModel(modelId);
    sendMessage({ type: 'modelChanged', model: modelId });
  }, [setModel, sendMessage]);

  // 【R54.9.6】获取模型列表
  const handleFetchModels = React.useCallback(() => {
    sendMessage({ type: 'fetchModels' });
  }, [sendMessage]);

  // Has active filters
  const hasActiveFilters = filterType !== 'all';

  // Render API error
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
        handleToggleSyncScroll: operations.handleToggleSyncScroll,
        handleExpandAll: operations.handleExpandAll,
        handleCollapseAll: operations.handleCollapseAll,
        handleRefresh: operations.handleRefresh,
        handleOpenFile: operations.handleOpenFile,
        handleOpenSourceFile: operations.handleOpenSourceFile,
        handleScrollToTop: operations.handleScrollToTop,
        handleScrollToBottom: operations.handleScrollToBottom,
        handleJumpToNextIncomplete: operations.handleJumpToNextIncomplete,
        handleJumpToTask: operations.handleJumpToTask,
        setSearchKeyword,
        setFilterType,
        handleClearFilter: operations.handleClearFilter,
        handleAddTask: operations.handleAddTask,
        handleOpenSettings,
        getAllTaskIds: (list: Task[]) => {
          let result: string[] = [];
          const collect = (taskList: Task[]) => {
            for (const task of taskList) {
              result.push(task.id);
              if (task.children && task.children.length > 0) {
                collect(task.children);
              }
            }
          };
          collect(list);
          return result;
        },
      })
    ),
    React.createElement('main', { className: 'task-container' },
      renderApiError(),
      textBlocks.length > 0 && renderTextBlocks({
        textBlocks,
        textBlockEditModes,
        onTextBlockDoubleClick: operations.handleTextBlockDoubleClick,
        onSaveTextBlock: operations.handleSaveTextBlock,
        onCancelTextBlockEdit: operations.handleCancelTextBlockEdit,
        onTextBlockClick: handleTextBlockClick,
      }),
      tasks.length === 0
        ? React.createElement('div', { className: 'empty-state' },
            React.createElement('div', { className: 'empty-state-icon' }, '📋'),
            React.createElement('p', null, '暂未加载任务文件'),
            React.createElement('button', { className: 'btn btn-primary', style: { marginTop: '16px' }, onClick: operations.handleOpenFile }, '打开文件')
          )
        : null,
      tasks.length > 0 && filteredTasks.length === 0
        ? React.createElement('div', { className: 'empty-state' },
            React.createElement('div', { className: 'empty-state-icon' }, '🔍'),
            React.createElement('p', null, '没有匹配的任务'),
            React.createElement('button', { className: 'btn btn-secondary', style: { marginTop: '16px' }, onClick: operations.handleClearFilter }, '清除筛选')
          )
        : null,
      tasks.length > 0 && filteredTasks.length > 0 && React.createElement('ul', { className: 'task-list', ref: taskListRef },
          filteredTasks.map((task, index) =>
            React.createElement(TaskItem, {
              key: task.id,
              task,
              depth: calculateTaskDepth(task.id),
              expandedTasks,
              editModes,
              buttonCooldown,
              editingTaskParentId,
              highlightedTaskId,
              onToggleExpand: operations.handleToggleExpand,
              onToggleComplete: operations.handleToggleComplete,
              onSelect: operations.handleSelect,
              onToggleEdit: operations.handleToggleEdit,
              onSaveTitle: operations.handleSaveTitle,
              onClaudeExecute: operations.handleClaudeExecute,
              onDelete: operations.handleDeleteTask,
              onAddSubTask: operations.handleAddSubTask,
              onContinueTask: operations.handleContinueTask,
              isLastChild: isLastTaskInLevel(task.id, tasks),
              allTasks: tasks,
              claudeExecuting,
              isCollapseAllTriggered,
              onDoubleClick: operations.handleDoubleClick,
              onSaveComplete: handleSaveComplete,
              onTaskContentClick: (e: React.MouseEvent) => linkOps.handleTaskContentClick(e, task.id),
              onTaskContentContextMenu: (e: React.MouseEvent) => linkOps.handleTaskContentContextMenu(e, task.id),
            })
          )
        )
    ),
    React.createElement('footer', { className: 'status-bar' },
      React.createElement('span', { className: 'file-path' }, currentFilePath || '未选择文件'),
      React.createElement('span', { className: 'stats' }, `共 ${stats.total} 个任务，${stats.completed} 已完成`)
    ),
    React.createElement(TaskContextMenu, {
      contextMenu,
      onCopyExecuteCommand: linkOps.handleCopyExecuteCommand,
      onCopyLinkPath: linkOps.handleCopyLinkPath,
      onCopyLinkRelativePath: linkOps.handleCopyLinkRelativePath,
      onDeleteLinkFile: linkOps.handleDeleteLinkFile,
    }),
    // 【R54.9.2.1】设置面板
    React.createElement(SettingsPanel, {
      isOpen: settingsPanelOpen,
      executionMode,
      model,
      models,
      onClose: () => setSettingsPanelOpen(false),
      onChange: handleExecutionModeChange,
      onModelChange: handleModelChange,
      onFetchModels: handleFetchModels,
    })
  );
};

export { TaskList };

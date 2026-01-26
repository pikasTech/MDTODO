import * as React from 'react';
import { marked } from '../utils/marked';
import './TaskList.css';
import { Task, TextBlock, FilterType, BUTTON_IDS, TaskListProps } from './types';
import { TaskItem } from './TaskItem';
import { renderTextBlocks } from './TaskBlock';
import { Toolbar } from './Toolbar';
import { TaskContextMenu } from './ContextMenu';
import {
  useTaskListState,
  useTaskOperations,
  useLinkOperations,
  useScrollHandler,
  useTaskListMessages,
} from './TaskList/hooks';

// Declare globals for TypeScript
declare const window: any;

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
              depth: 0,
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
              isLastChild: false,
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
    })
  );
};

export { TaskList };

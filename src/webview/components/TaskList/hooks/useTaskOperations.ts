import * as React from 'react';
import { BUTTON_IDS, Task, FilterType } from '../../types';
import { getAllTasks, getAllTaskIds } from '../../../utils/taskUtils';

export interface TaskOperationsParams {
  vscodeApi: any;
  setApiError: React.Dispatch<React.SetStateAction<string | null>>;
  setEditModes: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  setEditingTaskIds: React.Dispatch<React.SetStateAction<Set<string>>>;
  setEditingTaskParentId: React.Dispatch<React.SetStateAction<string>>;
  setTextBlockEditModes: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  setClaudeExecuting: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  setButtonCooldown: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  setHighlightedTaskId: React.Dispatch<React.SetStateAction<string>>;
  setIsJumpOperationInProgress: React.Dispatch<React.SetStateAction<boolean>>;
  setJumpToTaskId: React.Dispatch<React.SetStateAction<string>>;
  setLastJumpIndex: React.Dispatch<React.SetStateAction<number>>;
  setFilterType: React.Dispatch<React.SetStateAction<FilterType>>;
  setSearchKeyword: React.Dispatch<React.SetStateAction<string>>;
  setSyncScrollEnabled: React.Dispatch<React.SetStateAction<boolean>>;
  setPendingScrollTaskId: React.Dispatch<React.SetStateAction<string | null>>;
  setIsCollapseAllTriggered: React.Dispatch<React.SetStateAction<boolean>>;
  setExpandedTasks: React.Dispatch<React.SetStateAction<Set<string>>>;
  tasks: Task[];
  expandedTasks: Set<string>;
  buttonCooldown: Record<string, boolean>;
  claudeExecuting: Record<string, boolean>;
  lastJumpIndex: number;
}

const CLAUDE_EXECUTE_COOLDOWN = 1000;
const BUTTON_COOLDOWN = 100;

export const useTaskOperations = (params: TaskOperationsParams) => {
  const {
    vscodeApi,
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
  } = params;

  // Send message to extension
  const sendMessage = React.useCallback((message: any) => {
    if (vscodeApi) {
      vscodeApi.postMessage(message);
    } else {
      setApiError?.('VSCode API not available - 请重新加载窗口');
      console.error('[Webview] sendMessage failed: vscodeApi is', vscodeApi);
    }
  }, [vscodeApi]);

  // Scroll to task (supports collapsed mode double scroll)
  const scrollToTask = React.useCallback((taskId: string, onComplete?: () => void) => {
    const parentId = taskId.split('.').slice(0, -1).join('.');
    const isParentExpanded = parentId ? expandedTasks.has(parentId) : true;

    setIsJumpOperationInProgress(true);
    setHighlightedTaskId(taskId);
    setTimeout(() => setHighlightedTaskId(''), 3000);

    if (isParentExpanded) {
      const taskElement = document.querySelector(`[data-task-id="${taskId}"]`);
      if (taskElement) {
        taskElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    } else {
      const targetElement = document.querySelector(`[data-task-id="${taskId}"]`);
      const parentElement = document.querySelector(`[data-task-id="${parentId}"]`);

      if (targetElement && parentElement) {
        parentElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
        setTimeout(() => {
          const childrenUl = parentElement.querySelector(':scope > .children, :scope > ul');
          if (childrenUl) {
            childrenUl.scrollTo({ top: targetElement.offsetTop, behavior: 'auto' });
          }
        }, 300);
      }
    }

    setTimeout(() => {
      setIsJumpOperationInProgress(false);
      if (onComplete) onComplete();
    }, 400);
  }, [expandedTasks, setHighlightedTaskId, setIsJumpOperationInProgress]);

  // Handle toggle expand
  const handleToggleExpand = React.useCallback((taskId: string) => {
    setExpandedTasks((prev) => {
      const next = new Set(prev);
      if (next.has(taskId)) {
        next.delete(taskId);
      } else {
        next.add(taskId);
      }
      return next;
    });
  }, [setExpandedTasks]);

  // Handle expand all
  const handleExpandAll = React.useCallback(() => {
    if (buttonCooldown[BUTTON_IDS.EXPAND_ALL]) return;
    const allTaskIds = getAllTaskIds(tasks);
    setExpandedTasks(new Set(allTaskIds));
    setButtonCooldown(prev => ({ ...prev, [BUTTON_IDS.EXPAND_ALL]: true }));
    setTimeout(() => {
      setButtonCooldown(prev => ({ ...prev, [BUTTON_IDS.EXPAND_ALL]: false }));
    }, BUTTON_COOLDOWN);
  }, [tasks, buttonCooldown, setExpandedTasks, setButtonCooldown]);

  // Handle collapse all
  const handleCollapseAll = React.useCallback(() => {
    if (buttonCooldown[BUTTON_IDS.COLLAPSE_ALL]) return;
    setIsCollapseAllTriggered(true);
    setExpandedTasks(new Set());
    setTimeout(() => setIsCollapseAllTriggered(false), 500);
    setButtonCooldown(prev => ({ ...prev, [BUTTON_IDS.COLLAPSE_ALL]: true }));
    setTimeout(() => {
      setButtonCooldown(prev => ({ ...prev, [BUTTON_IDS.COLLAPSE_ALL]: false }));
    }, BUTTON_COOLDOWN);
  }, [buttonCooldown, setExpandedTasks, setButtonCooldown, setIsCollapseAllTriggered]);

  // Handle toggle complete
  const handleToggleComplete = React.useCallback((taskId: string) => {
    const cooldownId = `${BUTTON_IDS.TOGGLE_COMPLETE}_${taskId}`;
    if (buttonCooldown[cooldownId]) return;
    sendMessage({ type: 'markComplete', taskId });
    setButtonCooldown(prev => ({ ...prev, [cooldownId]: true }));
    setTimeout(() => {
      setButtonCooldown(prev => ({ ...prev, [cooldownId]: false }));
    }, BUTTON_COOLDOWN);
  }, [buttonCooldown, sendMessage, setButtonCooldown]);

  // Handle select
  const handleSelect = React.useCallback((taskId: string) => {
    sendMessage({ type: 'taskSelected', taskId });
  }, [sendMessage]);

  // Handle toggle edit
  const handleToggleEdit = React.useCallback((taskId: string) => {
    const getEditModes = () => document.querySelector('[data-task-id]') ? ({} as Record<string, boolean>) : ({} as Record<string, boolean>);
    const willBeEditMode = !getEditModes()[taskId];

    if (willBeEditMode) {
      setEditModes({ [taskId]: true });
      setEditingTaskIds(new Set([taskId]));
    } else {
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
  }, [setEditModes, setEditingTaskIds]);

  // Handle double click
  const handleDoubleClick = React.useCallback((taskId: string) => {
    const parentId = taskId.split('.').slice(0, -1).join('.');
    setEditingTaskParentId(parentId);
    setEditModes({ [taskId]: true });
    setEditingTaskIds(new Set([taskId]));
  }, [setEditModes, setEditingTaskIds, setEditingTaskParentId]);

  // Handle save title
  const handleSaveTitle = React.useCallback((taskId: string, title: string) => {
    sendMessage({ type: 'saveTitle', taskId, title });
  }, [sendMessage]);

  // Handle text block double click
  const handleTextBlockDoubleClick = React.useCallback((blockId: string) => {
    setTextBlockEditModes({ [blockId]: true });
  }, [setTextBlockEditModes]);

  // Handle save text block
  const handleSaveTextBlock = React.useCallback((blockId: string, content: string) => {
    sendMessage({ type: 'saveTextBlock', blockId, content });
    setTextBlockEditModes((prev) => ({ ...prev, [blockId]: false }));
  }, [sendMessage, setTextBlockEditModes]);

  // Handle cancel text block edit
  const handleCancelTextBlockEdit = React.useCallback((blockId: string) => {
    setTextBlockEditModes((prev) => ({ ...prev, [blockId]: false }));
  }, [setTextBlockEditModes]);

  // Handle refresh
  const handleRefresh = React.useCallback(() => {
    if (buttonCooldown[BUTTON_IDS.REFRESH]) return;
    sendMessage({ type: 'refresh' });
    setButtonCooldown(prev => ({ ...prev, [BUTTON_IDS.REFRESH]: true }));
    setTimeout(() => {
      setButtonCooldown(prev => ({ ...prev, [BUTTON_IDS.REFRESH]: false }));
    }, BUTTON_COOLDOWN);
  }, [buttonCooldown, sendMessage, setButtonCooldown]);

  // Handle open file
  const handleOpenFile = React.useCallback(() => {
    if (buttonCooldown[BUTTON_IDS.OPEN_FILE]) return;
    sendMessage({ type: 'openFile' });
    setButtonCooldown(prev => ({ ...prev, [BUTTON_IDS.OPEN_FILE]: true }));
    setTimeout(() => {
      setButtonCooldown(prev => ({ ...prev, [BUTTON_IDS.OPEN_FILE]: false }));
    }, BUTTON_COOLDOWN);
  }, [buttonCooldown, sendMessage, setButtonCooldown]);

  // Handle open source file
  const handleOpenSourceFile = React.useCallback(() => {
    if (buttonCooldown[BUTTON_IDS.OPEN_SOURCE_FILE]) return;
    sendMessage({ type: 'openSourceFile' });
    setButtonCooldown(prev => ({ ...prev, [BUTTON_IDS.OPEN_SOURCE_FILE]: true }));
    setTimeout(() => {
      setButtonCooldown(prev => ({ ...prev, [BUTTON_IDS.OPEN_SOURCE_FILE]: false }));
    }, BUTTON_COOLDOWN);
  }, [buttonCooldown, sendMessage, setButtonCooldown]);

  // Handle Claude execute
  const handleClaudeExecute = React.useCallback((taskId: string) => {
    if (claudeExecuting[taskId]) return;
    sendMessage({ type: 'claudeExecute', taskId });
    setClaudeExecuting(prev => ({ ...prev, [taskId]: true }));
    setTimeout(() => {
      setClaudeExecuting(prev => ({ ...prev, [taskId]: false }));
    }, CLAUDE_EXECUTE_COOLDOWN);
  }, [claudeExecuting, sendMessage, setClaudeExecuting]);

  // Handle add task
  const handleAddTask = React.useCallback(() => {
    if (buttonCooldown[BUTTON_IDS.ADD_TASK]) return;
    sendMessage({ type: 'addTask' });
    setButtonCooldown(prev => ({ ...prev, [BUTTON_IDS.ADD_TASK]: true }));
    setTimeout(() => {
      setButtonCooldown(prev => ({ ...prev, [BUTTON_IDS.ADD_TASK]: false }));
    }, BUTTON_COOLDOWN);
  }, [buttonCooldown, sendMessage, setButtonCooldown]);

  // Handle delete task
  const handleDeleteTask = React.useCallback((taskId: string) => {
    const cooldownId = `${BUTTON_IDS.DELETE_TASK}_${taskId}`;
    if (buttonCooldown[cooldownId]) return;
    sendMessage({ type: 'deleteTask', taskId });
    setButtonCooldown(prev => ({ ...prev, [cooldownId]: true }));
    setTimeout(() => {
      setButtonCooldown(prev => ({ ...prev, [cooldownId]: false }));
    }, BUTTON_COOLDOWN);
  }, [buttonCooldown, sendMessage, setButtonCooldown]);

  // Handle add subtask
  const handleAddSubTask = React.useCallback((taskId: string) => {
    const cooldownId = `${BUTTON_IDS.ADD_SUB_TASK}_${taskId}`;
    if (buttonCooldown[cooldownId]) return;
    sendMessage({ type: 'addSubTask', taskId });
    setButtonCooldown(prev => ({ ...prev, [cooldownId]: true }));
    setTimeout(() => {
      setButtonCooldown(prev => ({ ...prev, [cooldownId]: false }));
    }, BUTTON_COOLDOWN);
  }, [buttonCooldown, sendMessage, setButtonCooldown]);

  // Handle continue task
  const handleContinueTask = React.useCallback((taskId: string) => {
    const cooldownId = `${BUTTON_IDS.CONTINUE_TASK}_${taskId}`;
    if (buttonCooldown[cooldownId]) return;
    sendMessage({ type: 'continueTask', taskId });
    setButtonCooldown(prev => ({ ...prev, [cooldownId]: true }));
    setTimeout(() => {
      setButtonCooldown(prev => ({ ...prev, [cooldownId]: false }));
    }, BUTTON_COOLDOWN);
  }, [buttonCooldown, sendMessage, setButtonCooldown]);

  // Handle clear filter
  const handleClearFilter = React.useCallback(() => {
    setFilterType('all');
    setSearchKeyword('');
  }, [setFilterType, setSearchKeyword]);

  // Handle jump to task
  const handleJumpToTask = React.useCallback((taskId: string) => {
    setJumpToTaskId(taskId);
    if (taskId) {
      scrollToTask(taskId, () => {
        setJumpToTaskId('');
      });
    }
  }, [scrollToTask, setJumpToTaskId]);

  // Handle scroll to task
  const handleScrollToTask = React.useCallback((taskId: string, lineNumber: number) => {
    scrollToTask(taskId);
  }, [scrollToTask]);

  // Handle toggle sync scroll
  const handleToggleSyncScroll = React.useCallback(() => {
    setSyncScrollEnabled(prev => {
      const newState = !prev;
      sendMessage({ type: 'syncScrollChanged', enabled: newState });
      return newState;
    });
  }, [sendMessage, setSyncScrollEnabled]);

  // Handle scroll to top
  const handleScrollToTop = React.useCallback(() => {
    if (buttonCooldown[BUTTON_IDS.SCROLL_TO_TOP]) return;
    const container = document.querySelector('.task-container');
    if (container) {
      container.scrollTo({ top: 0, behavior: 'smooth' });
    }
    setButtonCooldown(prev => ({ ...prev, [BUTTON_IDS.SCROLL_TO_TOP]: true }));
    setTimeout(() => {
      setButtonCooldown(prev => ({ ...prev, [BUTTON_IDS.SCROLL_TO_TOP]: false }));
    }, BUTTON_COOLDOWN);
  }, [buttonCooldown, setButtonCooldown]);

  // Handle scroll to bottom
  const handleScrollToBottom = React.useCallback(() => {
    if (buttonCooldown[BUTTON_IDS.SCROLL_TO_BOTTOM]) return;
    const container = document.querySelector('.task-container');
    if (container) {
      container.scrollTo({ top: container.scrollHeight, behavior: 'smooth' });
    }
    setButtonCooldown(prev => ({ ...prev, [BUTTON_IDS.SCROLL_TO_BOTTOM]: true }));
    setTimeout(() => {
      setButtonCooldown(prev => ({ ...prev, [BUTTON_IDS.SCROLL_TO_BOTTOM]: false }));
    }, BUTTON_COOLDOWN);
  }, [buttonCooldown, setButtonCooldown]);

  // Handle jump to next incomplete
  const handleJumpToNextIncomplete = React.useCallback(() => {
    if (buttonCooldown[BUTTON_IDS.JUMP_TO_NEXT]) return;
    const allTasks = getAllTasks(tasks);
    const incompleteTasks = allTasks.filter(t => !t.completed);

    if (incompleteTasks.length === 0) {
      setButtonCooldown(prev => ({ ...prev, [BUTTON_IDS.JUMP_TO_NEXT]: true }));
      setTimeout(() => {
        setButtonCooldown(prev => ({ ...prev, [BUTTON_IDS.JUMP_TO_NEXT]: false }));
      }, BUTTON_COOLDOWN);
      return;
    }

    let nextIndex = 0;
    if (lastJumpIndex >= 0 && lastJumpIndex < incompleteTasks.length - 1) {
      nextIndex = lastJumpIndex + 1;
    } else if (lastJumpIndex >= incompleteTasks.length - 1) {
      nextIndex = 0;
    }

    const nextTask = incompleteTasks[nextIndex];
    if (nextTask) {
      scrollToTask(nextTask.id);
      setLastJumpIndex(nextIndex);
    }

    setButtonCooldown(prev => ({ ...prev, [BUTTON_IDS.JUMP_TO_NEXT]: true }));
    setTimeout(() => {
      setButtonCooldown(prev => ({ ...prev, [BUTTON_IDS.JUMP_TO_NEXT]: false }));
    }, BUTTON_COOLDOWN);
  }, [tasks, lastJumpIndex, buttonCooldown, scrollToTask, setLastJumpIndex, setButtonCooldown]);

  return {
    sendMessage,
    handleToggleExpand,
    handleExpandAll,
    handleCollapseAll,
    handleToggleComplete,
    handleSelect,
    handleToggleEdit,
    handleDoubleClick,
    handleSaveTitle,
    handleTextBlockDoubleClick,
    handleSaveTextBlock,
    handleCancelTextBlockEdit,
    handleRefresh,
    handleOpenFile,
    handleOpenSourceFile,
    handleClaudeExecute,
    handleAddTask,
    handleDeleteTask,
    handleAddSubTask,
    handleContinueTask,
    handleClearFilter,
    handleJumpToTask,
    handleScrollToTask,
    handleToggleSyncScroll,
    handleScrollToTop,
    handleScrollToBottom,
    handleJumpToNextIncomplete,
    scrollToTask,
  };
};

import * as React from 'react';
import { marked } from 'marked';
import { Task, BUTTON_IDS } from './types';

export interface TaskItemProps {
  task: Task;
  depth: number;
  expandedTasks: Set<string>;
  editModes: Record<string, boolean>;
  claudeExecuting: Record<string, boolean>;
  buttonCooldown: Record<string, boolean>;
  editingTaskParentId: string;
  highlightedTaskId: string;
  isCollapseAllTriggered: boolean;
  isJumpOperationInProgress: boolean;
  onToggleExpand: (taskId: string) => void;
  onToggleComplete: (taskId: string) => void;
  onSelect: (taskId: string) => void;
  onToggleEdit: (taskId: string) => void;
  onSaveTitle: (taskId: string, title: string) => void;
  onClaudeExecute: (taskId: string) => void;
  onDelete: (taskId: string) => void;
  onAddSubTask: (taskId: string) => void;
  onContinueTask: (taskId: string) => void;
  isLastChild: boolean;
  onDoubleClick: (taskId: string) => void;
  onSaveComplete?: (taskId: string) => void;
  onTaskContentClick?: (e: React.MouseEvent, taskId: string) => void;
  onTaskContentContextMenu?: (e: React.MouseEvent, taskId: string) => void;
}

export const TaskItem: React.FC<TaskItemProps> = (props) => {
  const {
    task,
    depth,
    expandedTasks,
    editModes,
    claudeExecuting,
    buttonCooldown,
    editingTaskParentId,
    highlightedTaskId,
    isCollapseAllTriggered,
    isJumpOperationInProgress,
    onToggleExpand,
    onToggleComplete,
    onSelect,
    onToggleEdit,
    onSaveTitle,
    onClaudeExecute,
    onDelete,
    onAddSubTask,
    onContinueTask,
    isLastChild,
    onDoubleClick,
    onSaveComplete,
    onTaskContentClick,
    onTaskContentContextMenu,
  } = props;

  const titleInputRef = React.useRef<HTMLTextAreaElement>(null);
  const [editValue, setEditValue] = React.useState(task.rawContent || task.title);

  const LINE_HEIGHT = 32;
  const MIN_LINES = 3;
  const MAX_LINES = 15;
  const PADDING = 24;

  const calculateTextareaHeight = (text: string): string => {
    const lineCount = (text.match(/\n/g) || []).length + 1;
    const clampedLines = Math.max(MIN_LINES, Math.min(MAX_LINES, lineCount));
    return `${clampedLines * LINE_HEIGHT + PADDING}px`;
  };

  const [textareaHeight, setTextareaHeight] = React.useState(() =>
    calculateTextareaHeight(task.rawContent || task.title)
  );

  React.useEffect(() => {
    setTextareaHeight(calculateTextareaHeight(editValue));
  }, [editValue]);

  const hasChildren = task.children && task.children.length > 0;
  const isExpanded = expandedTasks.has(task.id);
  const childrenLength = task.children ? task.children.length : 0;
  const showChildrenCount = isExpanded ? childrenLength : childrenLength;
  const isEditMode = editModes[task.id] || false;
  const isNewTask = (task.rawContent || task.title).trim() === '' && isEditMode;
  const childrenRef = React.useRef<HTMLUListElement>(null);
  const savedScrollRef = React.useRef<number>(0);
  const PREVIEW_MAX_HEIGHT = 300;

  const [canScrollUp, setCanScrollUp] = React.useState(false);
  const [canScrollDown, setCanScrollDown] = React.useState(false);

  const updateScrollShadows = React.useCallback(() => {
    if (childrenRef.current) {
      const element = childrenRef.current;
      const scrollTop = element.scrollTop;
      const scrollHeight = element.scrollHeight;
      const clientHeight = element.clientHeight;

      const canUp = scrollTop > 0;
      const canDown = scrollTop + clientHeight < scrollHeight - 1;

      setCanScrollUp(canUp);
      setCanScrollDown(canDown);
    }
  }, []);

  React.useEffect(() => {
    const element = childrenRef.current;
    if (!element) return;

    updateScrollShadows();

    const handleScroll = () => {
      updateScrollShadows();
    };

    element.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      element.removeEventListener('scroll', handleScroll);
    };
  }, [expandedTasks, showChildrenCount, task.children, updateScrollShadows]);

  React.useEffect(() => {
    if (editingTaskParentId === task.id && childrenRef.current) {
      if (savedScrollRef.current === 0) {
        savedScrollRef.current = childrenRef.current.scrollTop;
      }
    } else if (savedScrollRef.current > 0 && childrenRef.current && editingTaskParentId === '') {
      childrenRef.current.scrollTop = savedScrollRef.current;
      savedScrollRef.current = 0;
    }
  }, [editingTaskParentId, task.id]);

  React.useEffect(() => {
    const hasChildEditing = editingTaskParentId === task.id;
    const shouldScroll = !isExpanded && !hasChildEditing && childrenRef.current &&
                         task.children && task.children.length > 2 &&
                         !isJumpOperationInProgress &&
                         isCollapseAllTriggered;

    if (shouldScroll) {
      const timer = setTimeout(() => {
        if (childrenRef.current && savedScrollRef.current === 0) {
          childrenRef.current.scrollTo({ top: childrenRef.current.scrollHeight, behavior: 'smooth' });
        }
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [isCollapseAllTriggered, isJumpOperationInProgress, isExpanded, editingTaskParentId, task.children, task.id]);

  const isInitialMountRef = React.useRef(true);

  React.useEffect(() => {
    if (isInitialMountRef.current) {
      isInitialMountRef.current = false;
      const hasChildEditing = editingTaskParentId === task.id;
      const shouldScroll = !isExpanded && !hasChildEditing && childrenRef.current &&
                           task.children && task.children.length > 2;

      if (shouldScroll) {
        const timer = setTimeout(() => {
          if (childrenRef.current && savedScrollRef.current === 0) {
            childrenRef.current.scrollTo({ top: childrenRef.current.scrollHeight, behavior: 'smooth' });
          }
        }, 50);
        return () => clearTimeout(timer);
      }
    }
    return () => {};
  }, []);

  const childrenStyle = {
    maxHeight: isExpanded ? '10000px' : `${PREVIEW_MAX_HEIGHT}px`,
    marginLeft: `${24 + depth * 16}px`,
    overflowY: isExpanded ? 'hidden' : 'auto',
    scrollBehavior: isExpanded ? undefined : 'smooth',
  };

  React.useEffect(() => {
    if (isEditMode) {
      setEditValue(task.rawContent || task.title);
    }
  }, [isEditMode, task.rawContent, task.title]);

  React.useEffect(() => {
    if (isEditMode && titleInputRef.current) {
      titleInputRef.current.focus();
      titleInputRef.current.selectionStart = 0;
      titleInputRef.current.selectionEnd = 0;
    }
  }, [isEditMode]);

  const handleTitleBlur = (e: React.FocusEvent<HTMLTextAreaElement>, taskId: string) => {
    const newTitle = e.currentTarget.value.trim();
    if (newTitle) {
      onSaveTitle(taskId, newTitle);
      if (onSaveComplete) {
        onSaveComplete(taskId);
      }
    }
  };

  const handleTitleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      e.currentTarget.blur();
    }
    if (e.key === 'Escape') {
      setEditValue(task.rawContent || task.title);
      onToggleEdit(taskId);
    }
  };

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
    try {
      return marked.parse(task.title);
    } catch (error) {
      return escapeHtml(task.title);
    }
  };

  const taskClassName = `task-item ${task.completed ? 'completed' : ''} ${task.processing ? 'processing' : ''}`;
  const isHighlighted = highlightedTaskId === task.id;
  const taskCardClassName = `task-card${isHighlighted ? ' task-card-highlighted' : ''}`;

  return React.createElement('li', { className: taskClassName, 'data-task-id': task.id },
    React.createElement('div', {
      className: taskCardClassName,
      onDoubleClick: () => onDoubleClick(task.id),
    },
      React.createElement('div', { className: 'task-main' },
        React.createElement('div', {
          className: 'task-main-left',
          onClick: (e: React.MouseEvent) => {
            e.stopPropagation();
            onSelect(task.id);
          },
          tabIndex: 0,
          role: 'button',
        },
          React.createElement('div', { className: 'task-content' },
            React.createElement('div', { className: 'task-id-wrapper' },
              React.createElement('span', { className: 'task-id' }, task.id),
              task.processing && React.createElement('span', { className: 'processing-badge' }, '执行中'),
              task.linkCount > 0 && React.createElement('span', {
                className: `link-status-icon ${task.linkExists === task.linkCount ? 'link-complete' : 'link-partial'}`,
                title: `链接检查: ${task.linkExists}/${task.linkCount} 个链接存在`
              },
                React.createElement('svg', { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, width: 14, height: 14 },
                  React.createElement('path', { d: 'M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71' }),
                  React.createElement('path', { d: 'M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71' })
                ),
                React.createElement('span', { className: 'link-count' }, `${task.linkExists}/${task.linkCount}`)
              ),
              React.createElement('div', {
                className: `task-checkbox ${task.completed ? 'checked' : ''}`,
                onClick: (e: React.MouseEvent) => {
                  e.stopPropagation();
                  onToggleComplete(task.id);
                },
              }),
              React.createElement('div', { className: 'task-actions-inline' },
                isLastChild && React.createElement('button', {
                  className: `action-btn continue-btn ${buttonCooldown[`${BUTTON_IDS.CONTINUE_TASK}_${task.id}`] ? 'disabled' : ''}`,
                  disabled: buttonCooldown[`${BUTTON_IDS.CONTINUE_TASK}_${task.id}`],
                  onClick: (e: React.MouseEvent) => {
                    e.stopPropagation();
                    onContinueTask(task.id);
                  },
                  title: '延续创建下一个同级子任务'
                },
                  React.createElement('svg', { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, width: 12, height: 12 },
                    React.createElement('line', { x1: '5', y1: '12', x2: '19', y2: '12' }),
                    React.createElement('polyline', { points: '12 5 19 12 12 19' })
                  )
                ),
                React.createElement('button', {
                  className: `action-btn ${buttonCooldown[`${BUTTON_IDS.ADD_SUB_TASK}_${task.id}`] ? 'disabled' : ''}`,
                  disabled: buttonCooldown[`${BUTTON_IDS.ADD_SUB_TASK}_${task.id}`],
                  onClick: (e: React.MouseEvent) => {
                    e.stopPropagation();
                    onAddSubTask(task.id);
                  },
                  title: '添加子任务'
                },
                  React.createElement('svg', { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, width: 12, height: 12 },
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
                  React.createElement('svg', { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, width: 12, height: 12 },
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
                  React.createElement('svg', { viewBox: '0 0 24 24', fill: 'currentColor', stroke: 'none', width: 12, height: 12 },
                    React.createElement('polygon', { points: '5 3 19 12 5 21 5 3' })
                  )
                )
              )
            ),
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
                  dangerouslySetInnerHTML: isNewTask ? undefined : { __html: renderContent() as string },
                  onClick: (e: React.MouseEvent) => {
                    if (onTaskContentClick) {
                      onTaskContentClick(e, task.id);
                    }
                  },
                  onContextMenu: (e: React.MouseEvent) => {
                    if (onTaskContentContextMenu) {
                      onTaskContentContextMenu(e, task.id);
                    }
                  },
                  style: { cursor: 'pointer' }
                })
          )
        )
      )
    ),
    hasChildren && React.createElement('ul', {
      ref: childrenRef,
      className: `children${!isExpanded ? ' collapsed-preview' : ''}${canScrollUp ? ' can-scroll-up' : ''}${canScrollDown ? ' can-scroll-down' : ''}`,
      style: childrenStyle
    },
      !isExpanded && React.createElement('div', { className: 'scroll-shadow-top' }),
      (task.children || []).map((child, index) =>
        React.createElement(TaskItem, {
          key: child.id,
          task: child,
          depth: depth + 1,
          expandedTasks,
          editModes,
          buttonCooldown,
          editingTaskParentId,
          highlightedTaskId,
          isCollapseAllTriggered,
          isJumpOperationInProgress,
          onToggleExpand,
          onToggleComplete,
          onSelect,
          onToggleEdit,
          onSaveTitle,
          onClaudeExecute,
          onDelete,
          onAddSubTask,
          onContinueTask,
          isLastChild: index === childrenLength - 1,
          claudeExecuting,
          onDoubleClick,
          onSaveComplete,
          onTaskContentClick,
          onTaskContentContextMenu,
        })
      ),
      !isExpanded && React.createElement('div', { className: 'scroll-shadow-bottom' })
    )
  );
};

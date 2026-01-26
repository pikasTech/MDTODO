import * as React from 'react';
import { Task, TextBlock, FilterType } from '../../types';
import { getAllTasks, getFileName } from '../../../utils/taskUtils';

export interface TaskListStateProps {
  initialTasks: Task[];
  initialTextBlocks: TextBlock[];
  filePath: string;
}

export interface TaskListStateReturn {
  // State
  tasks: Task[];
  setTasks: React.Dispatch<React.SetStateAction<Task[]>>;
  textBlocks: TextBlock[];
  setTextBlocks: React.Dispatch<React.SetStateAction<TextBlock[]>>;
  currentFilePath: string;
  setCurrentFilePath: React.Dispatch<React.SetStateAction<string>>;
  workspacePath: string;
  setWorkspacePath: React.Dispatch<React.SetStateAction<string>>;
  expandedTasks: Set<string>;
  setExpandedTasks: React.Dispatch<React.SetStateAction<Set<string>>>;
  editModes: Record<string, boolean>;
  setEditModes: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  stats: { total: number; completed: number };
  editingTaskIds: Set<string>;
  setEditingTaskIds: React.Dispatch<React.SetStateAction<Set<string>>>;
  editingTaskIdsRef: React.MutableRefObject<Set<string>>;
  editingTaskParentId: string;
  setEditingTaskParentId: React.Dispatch<React.SetStateAction<string>>;
  claudeExecuting: Record<string, boolean>;
  setClaudeExecuting: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  buttonCooldown: Record<string, boolean>;
  setButtonCooldown: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  filterType: FilterType;
  setFilterType: React.Dispatch<React.SetStateAction<FilterType>>;
  searchKeyword: string;
  setSearchKeyword: React.Dispatch<React.SetStateAction<string>>;
  jumpToTaskId: string;
  setJumpToTaskId: React.Dispatch<React.SetStateAction<string>>;
  pendingScrollTaskId: string | null;
  setPendingScrollTaskId: React.Dispatch<React.SetStateAction<string | null>>;
  syncScrollEnabled: boolean;
  setSyncScrollEnabled: React.Dispatch<React.SetStateAction<boolean>>;
  lastJumpIndex: number;
  setLastJumpIndex: React.Dispatch<React.SetStateAction<number>>;
  highlightedTaskId: string;
  setHighlightedTaskId: React.Dispatch<React.SetStateAction<string>>;
  isCollapseAllTriggered: boolean;
  setIsCollapseAllTriggered: React.Dispatch<React.SetStateAction<boolean>>;
  isJumpOperationInProgress: boolean;
  setIsJumpOperationInProgress: React.Dispatch<React.SetStateAction<boolean>>;
  contextMenu: {
    visible: boolean;
    x: number;
    y: number;
    href: string;
    taskId: string;
    taskTitle?: string;
  } | null;
  setContextMenu: React.Dispatch<React.SetStateAction<{
    visible: boolean;
    x: number;
    y: number;
    href: string;
    taskId: string;
    taskTitle?: string;
  } | null>>;
  textBlockEditModes: Record<string, boolean>;
  setTextBlockEditModes: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  displayTitle: string;
  // Computed
  allTasks: Task[];
  incompleteCount: number;
  filteredTasks: Task[];
  apiError: string | null;
}

export const useTaskListState = (props: TaskListStateProps): TaskListStateReturn => {
  const { initialTasks = [], initialTextBlocks = [], filePath = '' } = props;

  // Core state
  const [tasks, setTasks] = React.useState<Task[]>(initialTasks);
  const [textBlocks, setTextBlocks] = React.useState<TextBlock[]>(initialTextBlocks);
  const [currentFilePath, setCurrentFilePath] = React.useState<string>(filePath || '');
  const [workspacePath, setWorkspacePath] = React.useState<string>('');
  const [expandedTasks, setExpandedTasks] = React.useState<Set<string>>(new Set([]));
  const [editModes, setEditModes] = React.useState<Record<string, boolean>>({});
  const [stats, setStats] = React.useState({ total: 0, completed: 0 });
  const [apiError, setApiError] = React.useState<string | null>(null);
  const [pendingScrollTaskId, setPendingScrollTaskId] = React.useState<string | null>(null);
  const [editingTaskIds, setEditingTaskIds] = React.useState<Set<string>>(new Set());
  const editingTaskIdsRef = React.useRef(editingTaskIds);
  editingTaskIdsRef.current = editingTaskIds;
  const [editingTaskParentId, setEditingTaskParentId] = React.useState<string>('');
  const [claudeExecuting, setClaudeExecuting] = React.useState<Record<string, boolean>>({});
  const [buttonCooldown, setButtonCooldown] = React.useState<Record<string, boolean>>({});
  const [filterType, setFilterType] = React.useState<FilterType>('all');
  const [searchKeyword, setSearchKeyword] = React.useState<string>('');
  const [jumpToTaskId, setJumpToTaskId] = React.useState<string>('');
  const [syncScrollEnabled, setSyncScrollEnabled] = React.useState(false);
  const [lastJumpIndex, setLastJumpIndex] = React.useState(-1);
  const [highlightedTaskId, setHighlightedTaskId] = React.useState<string>('');
  const [isCollapseAllTriggered, setIsCollapseAllTriggered] = React.useState(false);
  const [isJumpOperationInProgress, setIsJumpOperationInProgress] = React.useState(false);
  const [contextMenu, setContextMenu] = React.useState<{
    visible: boolean;
    x: number;
    y: number;
    href: string;
    taskId: string;
    taskTitle?: string;
  } | null>(null);
  const [textBlockEditModes, setTextBlockEditModes] = React.useState<Record<string, boolean>>({});

  // Computed values
  const [displayTitle, setDisplayTitle] = React.useState(() => getFileName(filePath));
  const allTasks = React.useMemo(() => getAllTasks(tasks), [tasks]);
  const incompleteCount = React.useMemo(() => {
    return allTasks.filter(t => !t.completed).length;
  }, [tasks]);
  const filteredTasks = React.useMemo(() => {
    const { filterTasks } = require('../../../utils/filterUtils');
    return filterTasks(tasks, filterType, searchKeyword);
  }, [tasks, filterType, searchKeyword]);

  // Update stats when tasks change
  React.useEffect(() => {
    setStats({
      total: allTasks.length,
      completed: allTasks.filter((t) => t.completed).length,
    });
  }, [tasks]);

  return {
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
  };
};

// Task 接口
export interface Task {
  id: string;
  title: string;
  rawContent: string;
  completed: boolean;
  processing: boolean;
  children?: Task[];
  lineNumber?: number;
  linkCount: number;
  linkExists: number;
}

// TextBlock 接口
export interface TextBlock {
  id: string;
  content: string;
  rawContent: string;
  lineNumber: number;
}

// FilterType 接口
export interface FilterType {
  type: 'all' | 'active' | 'hide-completed' | 'processing';
  label: string;
}

// BUTTON_IDS 常量
export const BUTTON_IDS = {
  EXPAND_ALL: 'expandAll',
  COLLAPSE_ALL: 'collapseAll',
  TOGGLE_COMPLETE: 'toggleComplete',
  REFRESH: 'refresh',
  OPEN_FILE: 'openFile',
  OPEN_SOURCE_FILE: 'openSourceFile',
  ADD_TASK: 'addTask',
  DELETE_TASK: 'deleteTask',
  ADD_SUB_TASK: 'addSubTask',
  CONTINUE_TASK: 'continueTask',
  SCROLL_TO_TOP: 'scrollToTop',
  SCROLL_TO_BOTTOM: 'scrollToBottom',
  JUMP_TO_NEXT: 'jumpToNext',
} as const;

// TaskListProps 接口
export interface TaskListProps {
  initialTasks?: Task[];
  initialTextBlocks?: TextBlock[];
  filePath?: string;
  vscodeApi?: any;
  onSaveComplete?: (taskId: string) => void;  // 保存完成后退出编辑模式的回调
}

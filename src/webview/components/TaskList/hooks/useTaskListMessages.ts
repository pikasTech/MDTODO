import * as React from 'react';
import { Task, TextBlock } from '../../types';
import { getAllTaskIds, getFileName } from '../../../utils/taskUtils';

export interface MessageHandlerParams {
  setTasks: React.Dispatch<React.SetStateAction<Task[]>>;
  setTextBlocks: React.Dispatch<React.SetStateAction<TextBlock[]>>;
  setCurrentFilePath: React.Dispatch<React.SetStateAction<string>>;
  setWorkspacePath: React.Dispatch<React.SetStateAction<string>>;
  setDisplayTitle: React.Dispatch<React.SetStateAction<string>>;
  setEditModes: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  setEditingTaskIds: React.Dispatch<React.SetStateAction<Set<string>>>;
  editingTaskIdsRef: React.MutableRefObject<Set<string>>;
  setPendingScrollTaskId: React.Dispatch<React.SetStateAction<string | null>>;
  handleRefreshTaskTitle: (taskId: string, newTitle: string) => void;
  handleScrollToTask: (taskId: string, lineNumber: number) => void;
}

export const useTaskListMessages = (params: MessageHandlerParams) => {
  const {
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
    handleScrollToTask,
  } = params;

  React.useEffect(() => {
    const handleMessage = (event: any) => {
      const message = event.data;

      if (message.type === 'updateTasks') {
        setTasks(message.tasks || []);
        setTextBlocks(message.textBlocks || []);
        setCurrentFilePath(message.filePath || '');
        setWorkspacePath(message.workspacePath || '');
        setDisplayTitle(getFileName(message.filePath || ''));

        const currentlyEditing = Array.from(editingTaskIdsRef.current);
        const allCurrentTaskIds = getAllTaskIds(message.tasks || []);

        setEditModes(prev => {
          const next: Record<string, boolean> = {};
          currentlyEditing.forEach(taskId => {
            if (allCurrentTaskIds.includes(taskId)) {
              next[taskId] = true;
            }
          });
          return next;
        });

        setEditingTaskIds(prev => {
          const next = new Set(prev);
          currentlyEditing.forEach(taskId => {
            if (!allCurrentTaskIds.includes(taskId)) {
              next.delete(taskId);
            }
          });
          return next;
        });
      } else if (message.type === 'newTaskAdded') {
        setPendingScrollTaskId(message.taskId);
        setEditingTaskIds(new Set([message.taskId]));
        setEditModes({ [message.taskId]: true });
      } else if (message.type === 'refreshTaskTitle') {
        handleRefreshTaskTitle(message.taskId, message.newTitle);
      } else if (message.type === 'scrollToTask') {
        handleScrollToTask(message.taskId, message.lineNumber);
      } else if (message.type === 'executeCommandGenerated') {
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

    // Register updateTaskState to window.MDTODO
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
  }, [
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
    handleScrollToTask,
  ]);
};

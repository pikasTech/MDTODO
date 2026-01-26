import * as React from 'react';
import { Task } from '../../types';
import { findTaskById } from '../../../utils/taskUtils';

export interface ScrollHandlerParams {
  tasks: Task[];
  syncScrollEnabled: boolean;
  sendMessage: (message: any) => void;
  scrollToTask: (taskId: string, onComplete?: () => void) => void;
  lastScrollTaskRef: React.MutableRefObject<string>;
  SCROLL_THROTTLE: number;
  lastScrollTimeRef: React.MutableRefObject<number>;
  notifyWebviewActive: () => void;
}

export const useScrollHandler = (params: ScrollHandlerParams) => {
  const {
    tasks,
    syncScrollEnabled,
    sendMessage,
    scrollToTask,
    lastScrollTaskRef,
    SCROLL_THROTTLE,
    lastScrollTimeRef,
    notifyWebviewActive,
  } = params;

  // Handle scroll event
  const handleScroll = React.useCallback(() => {
    if (!syncScrollEnabled) return;

    const now = Date.now();
    if (now - lastScrollTimeRef.current < SCROLL_THROTTLE) return;
    lastScrollTimeRef.current = now;

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

      if (relativeTop >= -50 && relativeTop < minTop) {
        minTop = relativeTop;
        const task = findTaskById(tasks, taskId);
        if (task) {
          topmostTask = { id: taskId, lineNumber: task.lineNumber, element };
        }
      }
    });

    if (topmostTask && topmostTask.id !== lastScrollTaskRef.current) {
      lastScrollTaskRef.current = topmostTask.id;
      sendMessage({ type: 'webviewActive' });
      sendMessage({
        type: 'webviewScrolled',
        taskId: topmostTask.id,
        lineNumber: topmostTask.lineNumber
      });
    }
  }, [tasks, syncScrollEnabled, sendMessage, lastScrollTaskRef, lastScrollTimeRef]);

  // Setup scroll event listeners
  React.useEffect(() => {
    const container = document.querySelector('.task-container');
    if (container) {
      const handleScrollWithFocus = () => {
        notifyWebviewActive();
        handleScroll();
      };

      container.addEventListener('scroll', handleScrollWithFocus, { passive: true });
      container.addEventListener('click', notifyWebviewActive, { passive: true });

      return () => {
        container.removeEventListener('scroll', handleScrollWithFocus);
        container.removeEventListener('click', notifyWebviewActive);
      };
    }
  }, [handleScroll, notifyWebviewActive, syncScrollEnabled]);

  return {
    handleScroll,
  };
};

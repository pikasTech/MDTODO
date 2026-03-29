import * as React from 'react';

export interface LinkOperationsParams {
  contextMenu: {
    visible: boolean;
    x: number;
    y: number;
    href: string;
    taskId: string;
    taskTitle?: string;
  } | null;
  currentFilePath: string;
  workspacePath: string;
  sendMessage: (message: any) => void;
  setContextMenu: React.Dispatch<React.SetStateAction<{
    visible: boolean;
    x: number;
    y: number;
    href: string;
    taskId: string;
    taskTitle?: string;
  } | null>>;
}

export const useLinkOperations = (params: LinkOperationsParams) => {
  const { contextMenu, currentFilePath, workspacePath, sendMessage, setContextMenu } = params;

  // Close context menu
  const closeContextMenu = React.useCallback(() => {
    setContextMenu(null);
  }, [setContextMenu]);

  // Delete link file
  const handleDeleteLinkFile = React.useCallback(() => {
    if (contextMenu && contextMenu.href) {
      sendMessage({ type: 'deleteLinkFile', url: contextMenu.href });
      closeContextMenu();
    }
  }, [contextMenu, sendMessage, closeContextMenu]);

  // Copy link absolute path
  const handleCopyLinkPath = React.useCallback(() => {
    if (contextMenu && contextMenu.href) {
      let linkPath = contextMenu.href;
      if (linkPath.startsWith('file://')) {
        linkPath = linkPath.slice(7);
      }
      try {
        linkPath = decodeURIComponent(linkPath);
      } catch (e) {}

      const isRelativePath = !linkPath.startsWith('/') && !linkPath.match(/^[A-Za-z]:/);
      let absolutePath = linkPath;
      if (isRelativePath && currentFilePath) {
        const currentDir = currentFilePath.replace(/[/\\][^/\\]*$/, '');
        absolutePath = currentDir + '/' + linkPath;
      }
      absolutePath = absolutePath.replace(/\\/g, '/');

      // 规范化路径：移除开头的 ./ 模式
      absolutePath = absolutePath.replace(/^\.\//, '');
      // 移除路径中间的 /./ 模式
      absolutePath = absolutePath.replace(/\/\.\//g, '/');
      // 处理路径末尾的 ./
      absolutePath = absolutePath.replace(/\/\.$/, '');
      // 处理连续的 ./ 情况
      absolutePath = absolutePath.replace(/(\/)\./g, '$1');

      navigator.clipboard.writeText(absolutePath).then(() => {
        console.log('链接绝对路径已复制到剪贴板:', absolutePath);
      }).catch(err => {
        console.error('复制失败:', err);
      });

      closeContextMenu();
    }
  }, [contextMenu, currentFilePath, closeContextMenu]);

  // Copy link relative path (relative to VSCode workspace)
  const handleCopyLinkRelativePath = React.useCallback(() => {
    if (contextMenu && contextMenu.href) {
      let linkPath = contextMenu.href;
      if (linkPath.startsWith('file://')) {
        linkPath = linkPath.slice(7);
      }
      try {
        linkPath = decodeURIComponent(linkPath);
      } catch (e) {}

      const isRelativePath = !linkPath.startsWith('/') && !linkPath.match(/^[A-Za-z]:/);
      let absolutePath = linkPath;
      if (isRelativePath && currentFilePath) {
        const currentDir = currentFilePath.replace(/[/\\][^/\\]*$/, '');
        absolutePath = currentDir + '/' + linkPath;
      }

      let relativePath = absolutePath;
      if (workspacePath && absolutePath.startsWith(workspacePath)) {
        relativePath = absolutePath.slice(workspacePath.length);
        if (relativePath.startsWith('/') || relativePath.startsWith('\\')) {
          relativePath = relativePath.slice(1);
        }
      }
      relativePath = relativePath.replace(/\\/g, '/');

      // 规范化路径：移除开头的 ./ 模式
      relativePath = relativePath.replace(/^\.\//, '');
      // 移除路径中间的 /./ 模式
      relativePath = relativePath.replace(/\/\.\//g, '/');
      // 处理路径末尾的 ./
      relativePath = relativePath.replace(/\/\.$/, '');
      // 处理连续的 ./ 情况
      relativePath = relativePath.replace(/(\/)\./g, '$1');

      navigator.clipboard.writeText(relativePath).then(() => {
        console.log('链接相对路径已复制到剪贴板:', relativePath);
      }).catch(err => {
        console.error('复制失败:', err);
      });

      closeContextMenu();
    }
  }, [contextMenu, currentFilePath, workspacePath, closeContextMenu]);

  // Copy execute command
  const handleCopyExecuteCommand = React.useCallback(() => {
    if (contextMenu && contextMenu.taskId) {
      sendMessage({
        type: 'generateExecuteCommand',
        taskId: contextMenu.taskId
      });
      closeContextMenu();
    }
  }, [contextMenu, sendMessage, closeContextMenu]);

  // Handle task content click
  const handleTaskContentClick = React.useCallback((e: React.MouseEvent, taskId: string) => {
    const target = e.target as HTMLElement;
    const anchorElement = target.closest('a');

    if (anchorElement) {
      e.preventDefault();
      e.stopPropagation();
      const href = anchorElement.getAttribute('href');
      if (href) {
        sendMessage({ type: 'openLink', url: href });
      }
    } else {
      closeContextMenu();
    }
  }, [sendMessage, closeContextMenu]);

  // Handle task content context menu
  const handleTaskContentContextMenu = React.useCallback((e: React.MouseEvent, taskId: string) => {
    const target = e.target as HTMLElement;
    const anchorElement = target.closest('a');
    const href = anchorElement ? anchorElement.getAttribute('href') : null;

    e.preventDefault();
    e.stopPropagation();

    setContextMenu({
      visible: true,
      x: e.clientX,
      y: e.clientY,
      href: href || '',
      taskId: taskId
    });
  }, [setContextMenu]);

  return {
    closeContextMenu,
    handleDeleteLinkFile,
    handleCopyLinkPath,
    handleCopyLinkRelativePath,
    handleCopyExecuteCommand,
    handleTaskContentClick,
    handleTaskContentContextMenu,
  };
};

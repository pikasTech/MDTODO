import * as React from 'react';

interface TaskContextMenuProps {
  contextMenu: {
    visible: boolean;
    x: number;
    y: number;
    href: string;
    taskId: string;
    taskTitle?: string;
  } | null;
  onCopyExecuteCommand: () => void;
  onCopyLinkPath: () => void;
  onCopyLinkRelativePath: () => void;
  onDeleteLinkFile: () => void;
}

const TaskContextMenu: React.FC<TaskContextMenuProps> = (props) => {
  const { contextMenu, onCopyExecuteCommand, onCopyLinkPath, onCopyLinkRelativePath, onDeleteLinkFile } = props;

  if (!contextMenu || !contextMenu.visible) {
    return null;
  }

  return React.createElement('div', {
    className: 'context-menu',
    style: {
      left: contextMenu.x,
      top: contextMenu.y,
      position: 'fixed',
      zIndex: 10000
    }
  },
    // 【R54.2】复制执行命令菜单项
    contextMenu.taskId && React.createElement('div', {
      className: 'context-menu-item',
      onClick: onCopyExecuteCommand
    }, '复制执行命令'),
    // 【R54.1.1】复制链接绝对路径菜单项（仅当存在链接时显示）
    contextMenu.href && React.createElement('div', {
      className: 'context-menu-item',
      onClick: onCopyLinkPath
    }, '复制路径'),
    // 【R54.1.1】复制链接相对路径菜单项（仅当存在链接时显示）
    contextMenu.href && React.createElement('div', {
      className: 'context-menu-item',
      onClick: onCopyLinkRelativePath
    }, '复制相对路径'),
    // 【R54.1】删除链接文件菜单项（仅当存在链接时显示）
    contextMenu.href && React.createElement('div', {
      className: 'context-menu-item',
      onClick: onDeleteLinkFile
    }, '删除链接文件')
  );
};

export { TaskContextMenu };
export type { TaskContextMenuProps };

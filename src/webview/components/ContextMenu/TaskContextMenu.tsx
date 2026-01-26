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

// 菜单项数量（用于计算高度）
const MENU_ITEM_COUNT = 4;
// 菜单项高度（px）
const MENU_ITEM_HEIGHT = 36;
// 菜单内边距（px）
const MENU_PADDING = 8;

const TaskContextMenu: React.FC<TaskContextMenuProps> = (props) => {
  const { contextMenu, onCopyExecuteCommand, onCopyLinkPath, onCopyLinkRelativePath, onDeleteLinkFile } = props;
  const menuRef = React.useRef<HTMLDivElement>(null);

  if (!contextMenu || !contextMenu.visible) {
    return null;
  }

  // 计算实际显示的菜单项数量
  let visibleItemCount = 1; // 复制执行命令
  if (contextMenu.href) {
    visibleItemCount += 3; // 复制路径、复制相对路径、删除链接文件
  }

  // 计算菜单高度
  const menuHeight = visibleItemCount * MENU_ITEM_HEIGHT + MENU_PADDING;

  // 【R54.4】检测是否需要向上弹出（当点击位置靠近屏幕底部时）
  const viewportHeight = window.innerHeight;
  const needsFlipUp = contextMenu.y + menuHeight > viewportHeight;

  // 计算菜单位置
  const positionStyle: React.CSSProperties = {
    left: contextMenu.x,
    top: needsFlipUp ? contextMenu.y - menuHeight : contextMenu.y,
    position: 'fixed',
    zIndex: 10000
  };

  return React.createElement('div', {
    ref: menuRef,
    className: 'context-menu',
    style: positionStyle
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

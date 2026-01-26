import * as React from 'react';
import { Task, FilterType, BUTTON_IDS } from '../types';

interface ToolbarProps {
  // 状态
  syncScrollEnabled: boolean;
  expandedTasks: Set<string>;
  buttonCooldown: Record<string, boolean>;
  incompleteCount: number;
  jumpToTaskId: string;
  searchKeyword: string;
  filterType: FilterType;
  hasActiveFilters: boolean;
  allTasks: Task[];
  tasks: Task[];
  // 函数
  handleToggleSyncScroll: () => void;
  handleExpandAll: () => void;
  handleCollapseAll: () => void;
  handleRefresh: () => void;
  handleOpenFile: () => void;
  handleOpenSourceFile: () => void;
  handleScrollToTop: () => void;
  handleScrollToBottom: () => void;
  handleJumpToNextIncomplete: () => void;
  handleJumpToTask: (taskId: string) => void;
  setSearchKeyword: (keyword: string) => void;
  setFilterType: (filterType: FilterType) => void;
  handleClearFilter: () => void;
  handleAddTask: () => void;
  // 工具函数
  getAllTaskIds: (tasks: Task[]) => string[];
}

const Toolbar: React.FC<ToolbarProps> = (props) => {
  const {
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
    handleToggleSyncScroll,
    handleExpandAll,
    handleCollapseAll,
    handleRefresh,
    handleOpenFile,
    handleOpenSourceFile,
    handleScrollToTop,
    handleScrollToBottom,
    handleJumpToNextIncomplete,
    handleJumpToTask,
    setSearchKeyword,
    setFilterType,
    handleClearFilter,
    handleAddTask,
    getAllTaskIds,
  } = props;

  const filterOptions = [
    { type: 'all' as const, label: '全部' },
    { type: 'hide-completed' as const, label: '隐藏完成' },
    { type: 'active' as const, label: '未开始' },
    { type: 'processing' as const, label: '进行中' },
  ];

  return React.createElement('div', { className: 'header-actions' },
    // 【实现R29.2】双向滚动同步开关按钮
    React.createElement('button', {
      className: `sync-scroll-btn ${syncScrollEnabled ? 'enabled' : ''}`,
      onClick: handleToggleSyncScroll,
      title: syncScrollEnabled ? '关闭双向滚动同步' : '开启双向滚动同步'
    },
      React.createElement('svg', {
        viewBox: '0 0 24 24',
        fill: 'none',
        stroke: 'currentColor',
        strokeWidth: 2,
        width: 14,
        height: 14
      },
        React.createElement('path', {
          d: 'M17 1l4 4-4 4'
        }),
        React.createElement('path', {
          d: 'M3 11V9a4 4 0 0 1 4-4h14'
        }),
        React.createElement('path', {
          d: 'M7 23l-4-4 4-4'
        }),
        React.createElement('path', {
          d: 'M21 13v2a4 4 0 0 1-4 4H3'
        })
      )
    ),
    // 【R51.10】全部展开/收起合并按钮
    React.createElement('button', {
      className: `toolbar-icon-btn expand-collapse-btn ${expandedTasks.size > 0 && expandedTasks.size === getAllTaskIds(tasks).length ? 'expanded' : ''} ${buttonCooldown[BUTTON_IDS.EXPAND_ALL] || buttonCooldown[BUTTON_IDS.COLLAPSE_ALL] ? 'disabled' : ''}`,
      disabled: buttonCooldown[BUTTON_IDS.EXPAND_ALL] || buttonCooldown[BUTTON_IDS.COLLAPSE_ALL],
      onClick: () => {
        // 如果全部展开了就收起，否则就展开
        const allIds = getAllTaskIds(tasks);
        const allExpanded = allIds.length > 0 && allIds.every(id => expandedTasks.has(id));
        if (allExpanded) {
          handleCollapseAll();
        } else {
          handleExpandAll();
        }
      },
      title: expandedTasks.size > 0 && expandedTasks.size === getAllTaskIds(tasks).length ? '全部收起' : '全部展开'
    },
      React.createElement('svg', { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, width: 14, height: 14 },
        React.createElement('polyline', { points: '15 3 21 3 21 9' }),
        React.createElement('polyline', { points: '9 21 3 21 3 15' }),
        React.createElement('line', { x1: '21', y1: '3', x2: '14', y2: '10' }),
        React.createElement('line', { x1: '3', y1: '21', x2: '10', y2: '14' })
      )
    ),
    // 刷新按钮 - 图标
    React.createElement('button', {
      className: `toolbar-icon-btn ${buttonCooldown[BUTTON_IDS.REFRESH] ? 'disabled' : ''}`,
      disabled: buttonCooldown[BUTTON_IDS.REFRESH],
      onClick: handleRefresh,
      title: '刷新'
    },
      React.createElement('svg', { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, width: 14, height: 14 },
        React.createElement('polyline', { points: '23 4 23 10 17 10' }),
        React.createElement('path', { d: 'M20.49 15a9 9 0 1 1-2.12-9.36L23 10' })
      )
    ),
    // 打开文件按钮 - 图标
    React.createElement('button', {
      className: `toolbar-icon-btn ${buttonCooldown[BUTTON_IDS.OPEN_FILE] ? 'disabled' : ''}`,
      disabled: buttonCooldown[BUTTON_IDS.OPEN_FILE],
      onClick: handleOpenFile,
      title: '打开文件'
    },
      React.createElement('svg', { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, width: 14, height: 14 },
        React.createElement('path', { d: 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z' }),
        React.createElement('polyline', { points: '14 2 14 8 20 8' }),
        React.createElement('line', { x1: '16', y1: '13', x2: '8', y2: '13' }),
        React.createElement('line', { x1: '16', y1: '17', x2: '8', y2: '17' }),
        React.createElement('polyline', { points: '10 9 9 9 8 9' })
      )
    ),
    // 打开原文按钮 - 图标
    React.createElement('button', {
      className: `toolbar-icon-btn ${buttonCooldown[BUTTON_IDS.OPEN_SOURCE_FILE] ? 'disabled' : ''}`,
      disabled: buttonCooldown[BUTTON_IDS.OPEN_SOURCE_FILE],
      onClick: handleOpenSourceFile,
      title: '在VSCode中打开原文'
    },
      React.createElement('svg', { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, width: 14, height: 14 },
        React.createElement('path', { d: 'M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6' }),
        React.createElement('polyline', { points: '15 3 21 3 21 9' }),
        React.createElement('line', { x1: '10', y1: '14', x2: '21', y2: '3' })
      )
    ),
    // 【实现R37.3】快速到顶部按钮 - 图标
    React.createElement('button', {
      className: `toolbar-icon-btn ${buttonCooldown[BUTTON_IDS.SCROLL_TO_TOP] ? 'disabled' : ''}`,
      disabled: buttonCooldown[BUTTON_IDS.SCROLL_TO_TOP],
      onClick: handleScrollToTop,
      title: '快速到顶部'
    },
      React.createElement('svg', { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, width: 14, height: 14 },
        React.createElement('polyline', { points: '18 15 12 9 6 15' })
      )
    ),
    // 【实现R37.3】快速到底部按钮 - 图标
    React.createElement('button', {
      className: `toolbar-icon-btn ${buttonCooldown[BUTTON_IDS.SCROLL_TO_BOTTOM] ? 'disabled' : ''}`,
      disabled: buttonCooldown[BUTTON_IDS.SCROLL_TO_BOTTOM],
      onClick: handleScrollToBottom,
      title: '快速到底部'
    },
      React.createElement('svg', { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, width: 14, height: 14 },
        React.createElement('polyline', { points: '6 9 12 15 18 9' })
      )
    ),
    // 【实现R37.3】跳转到下一个未完成任务按钮 - 图标 + 数字徽章
    React.createElement('div', { className: 'jump-next-btn-wrapper' },
      React.createElement('button', {
        className: `toolbar-icon-btn ${buttonCooldown[BUTTON_IDS.JUMP_TO_NEXT] ? 'disabled' : ''}`,
        disabled: buttonCooldown[BUTTON_IDS.JUMP_TO_NEXT],
        onClick: handleJumpToNextIncomplete,
        title: '跳转到下一个未完成任务（循环）'
      },
        React.createElement('svg', { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, width: 14, height: 14 },
          React.createElement('circle', { cx: '12', cy: '12', r: '10' }),
          React.createElement('polyline', { points: '12 6 16 10 12 14' }),
          React.createElement('line', { x1: '8', y1: '10', x2: '8', y2: '14' })
        )
      ),
      // 【实现R37.3.1】数字徽章，显示未完成任务数量
      incompleteCount > 0 && React.createElement('span', {
        className: 'jump-next-badge'
      }, incompleteCount)
    ),
    // 【R51.5.7】跳转下拉菜单 - 图标形式
    React.createElement('div', { className: 'header-dropdown' },
      React.createElement('select', {
        className: 'header-select',
        value: jumpToTaskId,
        onChange: (e: React.ChangeEvent<HTMLSelectElement>) => handleJumpToTask(e.target.value),
        title: '跳转到任务'
      },
        React.createElement('option', { value: '' }, '跳转'),
        allTasks.map(task =>
          React.createElement('option', {
            key: task.id,
            value: task.id,
          }, task.id)
        )
      )
    ),
    // 【R51.5.7】搜索框（常驻显示）
    React.createElement('div', { className: 'header-search' },
      React.createElement('input', {
        type: 'text',
        className: 'header-search-input',
        placeholder: '搜索...',
        value: searchKeyword,
        onChange: (e: React.ChangeEvent<HTMLInputElement>) => setSearchKeyword(e.target.value),
      }),
      searchKeyword && React.createElement('button', {
        className: 'search-clear-btn',
        onClick: () => setSearchKeyword(''),
        title: '清除搜索'
      }, '×')
    ),
    // 【R51.5.8】筛选下拉菜单
    React.createElement('select', {
      className: 'filter-dropdown',
      value: filterType,
      onChange: (e: React.ChangeEvent<HTMLSelectElement>) => setFilterType(e.target.value as FilterType),
      title: '筛选任务'
    },
      filterOptions.map(option =>
        React.createElement('option', {
          key: option.type,
          value: option.type,
        }, option.label)
      )
    ),
    // 【R51.5.8】清除筛选按钮（当有激活的筛选时显示）
    hasActiveFilters && React.createElement('button', {
      className: 'clear-filter-btn toolbar-icon-btn',
      onClick: handleClearFilter,
      title: '清除筛选'
    }, '×'),
    // 添加任务按钮 - 图标形式
    React.createElement('button', {
      className: `toolbar-icon-btn add-task-header-btn ${buttonCooldown[BUTTON_IDS.ADD_TASK] ? 'disabled' : ''}`,
      disabled: buttonCooldown[BUTTON_IDS.ADD_TASK],
      onClick: handleAddTask,
      title: '添加任务'
    },
      React.createElement('svg', { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, width: 14, height: 14 },
        React.createElement('line', { x1: '12', y1: '5', x2: '12', y2: '19' }),
        React.createElement('line', { x1: '5', y1: '12', x2: '19', y2: '12' })
      )
    )
  );
};

export { Toolbar };
export type { ToolbarProps };

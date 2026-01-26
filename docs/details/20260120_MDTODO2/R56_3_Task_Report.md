# R56.3 任务报告：代码拆解分析

## 任务目标
继续分析如何拆解代码库，目标是最长的文件不超过1000行，形成详细报告。

---

## 一、代码库文件行数统计

### 超过 1000 行的文件

| 文件 | 行数 |
|------|------|
| `src/providers/webviewProvider.ts` | 1871 |
| `src/webview/components/TaskList.tsx` | 1142 |

### 500-1000 行的文件
无

---

## 二、webviewProvider.ts 详细分析（1871 行）

### 主要功能块划分

| 功能块 | 行号范围 | 行数 |
|--------|----------|------|
| 类初始化 | 10-35 | 26 |
| Webview 面板管理 | 41-113 | 73 |
| 定期刷新机制 | 119-295 | 177 |
| 消息发送 | 360-398 | 39 |
| 消息处理 | 440-513 | 74 |
| 滚动同步 | 520-640 | 121 |
| 文件操作方法 | 681-941 | 261 |
| 任务状态管理 | 1238-1396 | 159 |
| 任务 CRUD | 1431-1739 | 309 |
| 辅助方法 | 1744-1871 | 128 |

### 可拆分为独立模块的部分

1. **`scrollSyncManager.ts`** - 双向滚动同步功能（约150行）
   - 当前行：520-640
   - 包含：handleWebviewScrolled, setupScrollSync, findNearestTask

2. **`linkHandler.ts`** - 链接处理模块（约120行）
   - 当前行：877-941（handleOpenLink）+ 948-1026（handleDeleteLinkFile）
   - 包含：路径解析、文件打开/删除、URL处理

3. **`fileRefreshManager.ts`** - 文件刷新管理器（约200行）
   - 当前行：119-295
   - 包含：startPeriodicRefresh, checkAndRefresh, checkAndUpdateLinkStatus

4. **`taskStatusManager.ts`** - 任务状态管理器（约180行）
   - 当前行：1238-1396
   - 包含：markTaskAsProcessing, markTaskAsFinished, 状态切换逻辑

---

## 三、TaskList.tsx 详细分析（1142 行）

### 主要功能块划分

| 功能块 | 行号范围 | 行数 |
|--------|----------|------|
| 状态定义 | 15-76 | 62 |
| 消息处理 useEffect | 140-261 | 122 |
| 工具函数 | 263-279 | 17 |
| 任务操作事件 | 281-512 | 232 |
| 滚动跳转事件 | 560-627 | 68 |
| 链接相关事件 | 630-783 | 154 |
| 滚动同步事件 | 786-857 | 72 |
| 筛选功能 | 1002-1007 | 6 |
| 右键菜单处理 | 1009-1039 | 31 |
| 渲染（JSX） | 1041-1139 | 99 |

### 可拆分为独立模块的部分

1. **`useTaskActions.ts`** - 任务操作 hooks（约250行）
   - 当前行：281-512
   - 可导出：useTaskActions, useExpandCollapse, useTaskCRUD

2. **`useScrollManager.ts`** - 滚动管理 hooks（约140行）
   - 当前行：560-627 + 786-857
   - 包含：scrollToTask, handleScroll, handleJumpToTask

3. **`useContextMenu.ts`** - 右键菜单 hook（约160行）
   - 当前行：630-783
   - 包含：所有链接处理和右键菜单相关函数

4. **`TaskListRender.tsx`** - 渲染逻辑分离（约100行）
   - 当前行：1041-1139
   - 可拆分为独立组件

---

## 四、拆解方案

### 方案1：webviewProvider.ts 拆解

```
src/providers/
├── webviewProvider.ts      （保留核心职责，约800行）
├── scrollSyncManager.ts    （新建，约150行）
├── linkHandler.ts          （新建，约120行）
├── fileRefreshManager.ts   （新建，约200行）
└── taskStatusManager.ts    （新建，约180行）
```

**优先级**：高 - 该文件已超过1000行目标

### 方案2：TaskList.tsx 拆解

```
src/webview/components/TaskList/
├── TaskList.tsx            （主组件，约500行）
├── useTaskActions.ts       （新建hooks，约250行）
├── useScrollManager.ts     （新建hooks，约140行）
└── useContextMenu.ts       （新建hooks，约160行）
```

**优先级**：中 - 该文件刚过1000行，可考虑先拆解hooks

---

## 五、总结

| 分类 | 文件数 | 总行数 |
|------|--------|--------|
| > 1000行 | 2 | 3013 |
| 500-1000行 | 0 | 0 |
| < 500行 | 23 | 1768 |

**首要任务**：将 `webviewProvider.ts`（1871行）拆分为4-5个独立模块，每个模块控制在200行以内。

---

## 六、执行计划

### R56.4 执行内容
1. 创建 `src/providers/managers/` 目录
2. 拆分 `scrollSyncManager.ts`
3. 拆分 `linkHandler.ts`
4. 拆分 `fileRefreshManager.ts`
5. 拆分 `taskStatusManager.ts`
6. 更新 `webviewProvider.ts` 导入新模块
7. 测试功能完整性

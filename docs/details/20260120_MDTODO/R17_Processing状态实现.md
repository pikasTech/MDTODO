# R17 Processing状态实现

## 需求描述

点击 Claude 执行之后，在 RXX 后面加上 `[Processing]` 并配合适当的 WebUI 渲染来区分进行中的任务。筛选栏也应该区分进行中和未开始。

## 实现内容

### 1. 类型定义更新

**文件**: `src/types/index.ts`

- 在 `TodoTask` 接口中添加 `processing: boolean` 字段

### 2. 解析器更新

**文件**: `src/parser/index.ts`

- 在 `parseTask` 方法中检测 `[Processing]` 标记
- 从标题中移除 `[Processing]` 标记（类似 `[completed]`）
- 将 `processing` 状态添加到返回的任务对象中

### 3. WebView Provider 更新

**文件**: `src/providers/webviewProvider.ts`

- `serializeTasks` 方法中添加 `processing` 字段序列化
- 新增 `handleClaudeExecute` 方法：
  1. 在执行前添加 `[Processing]` 标记到 md 文件
  2. 刷新显示
  3. 调用 Claude 执行
  4. （注：由于 Claude 是异步执行，不自动移除标记，用户可手动完成）
- 新增 `markTaskAsProcessing` 方法：
  - 查找任务所在行
  - 添加或移除 `[Processing]` 标记
  - 写入文件

### 4. WebView 组件更新

**文件**: `src/webview/components/TaskList.tsx`

- `Task` 接口中添加 `processing: boolean` 字段
- `FilterType` 类型扩展为 `'all' | 'active' | 'completed' | 'processing'`
- `filterTasks` 函数更新筛选逻辑：
  - `active`: 未完成且未执行中（改名为"未开始"）
  - `processing`: 执行中且未完成
- `renderFilterBar` 更新筛选按钮：
  - "全部" → 显示所有任务
  - "未开始" → 显示未完成且未执行中的任务
  - "进行中" → 显示正在执行的任务
  - "已完成" → 显示已标记完成的任务
- `TaskItem` 组件更新：
  - 根据 `processing` 状态添加 CSS 类名
  - 在任务 ID 旁边显示"执行中"徽章

### 5. 样式更新

**文件**: `src/webview/components/TaskList.css`

- `.task-id-wrapper`: 任务 ID 包装器，支持徽章并排显示
- `.processing-badge`: 橙色"执行中"徽章，带脉冲动画
- `.task-item.processing .task-card`: 执行中任务的卡片边框为橙色，带发光效果
- `.task-item.processing .task-checkbox`: 复选框带脉冲动画效果
- `@keyframes pulse`: 脉冲动画效果
- `@keyframes checkboxPulse`: 复选框脉冲动画效果

## 功能效果

1. **点击 Claude 执行**：
   - 任务标题后自动添加 `[Processing]` 标记
   - 文件中显示：`## R17 [Processing]`
   - WebUI 任务卡片边框变为橙色
   - 任务 ID 旁边显示闪烁的"执行中"徽章
   - 复选框显示脉冲动画效果

2. **筛选功能**：
   - "未开始"：显示未完成且未执行中的任务
   - "进行中"：显示正在执行 Claude 任务的项目
   - "已完成"：显示已标记完成的任务

## 测试方法

1. 在 VSCode 中加载插件
2. 打开一个 TODO 文件
3. 点击某个任务的 "Claude 执行" 按钮
4. 观察：
   - 任务卡片变为橙色边框
   - 显示"执行中"徽章
   - 文件中 `[Processing]` 标记已添加
5. 使用筛选功能验证：
   - 切换到"进行中"筛选，只显示当前执行中的任务
   - 切换到"未开始"筛选，排除正在执行的任务

## 注意事项

- `[Processing]` 标记不会自动移除，需要用户手动点击"完成"来标记任务完成并移除该标记
- 如果任务已标记 `[completed]`，则不会添加 `[Processing]` 标记

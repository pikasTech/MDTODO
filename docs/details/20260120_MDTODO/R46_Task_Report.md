# R46 任务报告：延续按钮功能实现

## 任务概述

**R46**：在每个任务的最后一个子任务上加一个延续创建下一个子任务的按钮而不是创建子任务的子任务，这个按钮的作用和在任务级别创建子任务一样，例如R2.5按这个延续按钮会创建R2.6而不是R2.5.1，R2.4就没有这个按钮，因为R2.5已经存在，不能创建冲突的子任务。

## 实现方案

### 1. Webview 前端修改

#### 1.1 添加按钮常量
在 `TaskList.tsx` 中添加延续按钮的常量标识：
```typescript
CONTINUE_TASK: 'continueTask',  // 【实现R46】延续按钮
```

#### 1.2 添加延续按钮处理函数
```typescript
const handleContinueTask = (taskId: string) => {
  // 防抖处理
  const cooldownId = `${BUTTON_IDS.CONTINUE_TASK}_${taskId}`;
  if (buttonCooldown[cooldownId]) return;

  console.log('[Webview] Sending continueTask, taskId:', taskId);
  sendMessage({ type: 'continueTask', taskId });

  // 设置防抖状态
  setButtonCooldown(prev => ({ ...prev, [cooldownId]: true }));
  setTimeout(() => {
    setButtonCooldown(prev => ({ ...prev, [cooldownId]: false }));
  }, BUTTON_COOLDOWN);
};
```

#### 1.3 修改 TaskItem 组件
为 TaskItem 添加两个新属性：
- `onContinueTask`: 延续任务的回调函数
- `isLastChild`: 标识当前任务是否为父任务的最后一个子任务

#### 1.4 延续按钮渲染
在按钮区域，仅对 `isLastChild` 为 true 的任务渲染延续按钮：
```jsx
isLastChild && React.createElement('button', {
  className: `action-btn continue-btn`,
  onClick: (e) => {
    e.stopPropagation();
    onContinueTask(task.id);
  },
  title: '延续创建下一个同级子任务'
}, /* 右箭头图标 */)
```

延续按钮使用右箭头图标（→），表示继续往后添加：
```jsx
<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14">
  <line x1="5" y1="12" x2="19" y2="12" />
  <polyline points="12 5 19 12 12 19" />
</svg>
```

#### 1.5 判断最后一个子任务
在渲染子任务时，通过索引判断是否为最后一个：
```jsx
task.children!.map((child, index) =>
  React.createElement(TaskItem, {
    // ...
    isLastChild: index === task.children!.length - 1,  // 【实现R46】判断是否为最后一个子任务
    // ...
  })
)
```

### 2. Extension 后端修改

#### 2.1 添加消息处理
在 `webviewProvider.ts` 的消息处理 switch 中添加：
```typescript
case 'continueTask':
  await this.handleContinueTask(message.taskId);
  break;
```

#### 2.2 实现 handleContinueTask 方法
核心逻辑：
1. 解析当前任务ID，获取父任务ID（如 R2.5 -> parentId = 'R2'）
2. 使用 `generateNewTaskId` 生成新的同级任务ID（如 R2.6）
3. 找到当前任务在文件中的位置
4. 找到当前任务的结束位置（下一个同级或更高级别任务之前）
5. 在当前任务后插入新任务
6. 重新加载文件并通知 webview

```typescript
private async handleContinueTask(currentTaskId: string): Promise<void> {
  // 解析当前任务ID，获取父任务ID
  const parts = currentTaskId.split('.');
  if (parts.length < 2) {
    vscode.window.showWarningMessage('延续任务只能在子任务上使用');
    return;
  }

  const parentId = parts.slice(0, -1).join('.');
  const newId = this.generateNewTaskId(allTaskIds, parentId);

  // 找到当前任务的位置
  let currentLine = -1;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    const taskPattern = new RegExp(`^#{2,6}\\s+[^\\n]*\\b${currentTaskId.replace(/\./g, '\\.')}(?:[)\\s]|$)`);
    if (taskPattern.test(line)) {
      currentLine = i;
      break;
    }
  }

  // 找到当前任务的结束位置，插入新任务
  // ...
}
```

### 3. CSS 样式

为延续按钮添加绿色主题样式：
```css
.action-btn.continue-btn {
  background-color: #2d7a2d;
  color: white;
}

.action-btn.continue-btn:hover {
  background-color: #3d9a3d;
}
```

## 功能特点

1. **智能显示**：延续按钮仅显示在每个父任务的最后一个子任务上
2. **同级延续**：点击后创建的是同级子任务（如 R2.5 -> R2.6），而不是子任务的子任务
3. **防抖保护**：按钮有 100ms 的防抖保护，避免误触
4. **图标按钮**：使用直观的右箭头图标，表示继续往后添加
5. **自动聚焦**：新任务创建后自动滚动并进入编辑模式

## 测试场景

| 场景 | 预期行为 |
|------|---------|
| R2 有子任务 R2.1, R2.2, R2.3 | 仅 R2.3 显示延续按钮 |
| 点击 R2.3 的延续按钮 | 创建 R2.4，光标聚焦并进入编辑模式 |
| R2.2 不显示延续按钮 | 因为 R2.3 已存在，创建 R2.4 会冲突 |
| 多级嵌套（如 R1.1.1, R1.1.2） | 仅最后一个显示延续按钮 |

## 修改的文件

1. `src/webview/components/TaskList.tsx` - 添加延续按钮和逻辑
2. `src/webview/components/TaskList.css` - 添加延续按钮样式
3. `src/providers/webviewProvider.ts` - 处理延续任务消息

## 总结

R46 功能已成功实现。用户现在可以在任何父任务的最后一个子任务上看到延续按钮，点击后可以方便地创建下一个同级子任务，无需手动计算任务编号。

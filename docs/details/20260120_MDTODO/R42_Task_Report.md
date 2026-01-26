# R42 执行报告：文件不存在时弹窗询问创建

## 任务描述

点击链接后如果文件不存在，弹出一个对话框，提示文件不存在，是否创建文件，如果点创建则创建空文件然后用 typora 打开。

## 执行过程

### 1. 分析现有代码

查看 `src/providers/webviewProvider.ts` 中的 `openWithTypora` 方法：

```typescript
private async openWithTypora(filePath: string): Promise<void> {
  try {
    // 检查文件是否存在
    if (!fs.existsSync(filePath)) {
      vscode.window.showErrorMessage(`文件不存在: ${filePath}`);
      return;
    }
    // ... 其余打开逻辑
  }
}
```

原有的逻辑只是简单地显示错误消息并返回。

### 2. 修改代码实现功能

修改 `openWithTypora` 方法，在文件不存在时弹出对话框询问用户：

```typescript
/**
 * 使用 Typora 打开 md 文件
 * 【实现R42】如果文件不存在，弹出对话框询问是否创建
 */
private async openWithTypora(filePath: string): Promise<void> {
  try {
    // 【实现R42】检查文件是否存在，如果不存在则询问是否创建
    if (!fs.existsSync(filePath)) {
      // 弹出对话框询问是否创建文件
      const choice = await vscode.window.showWarningMessage(
        `文件不存在: ${filePath}`,
        { modal: true },
        '创建文件并打开',
        '取消'
      );

      if (choice === '创建文件并打开') {
        try {
          // 创建空文件
          const dir = path.dirname(filePath);
          if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
          }
          fs.writeFileSync(filePath, '', 'utf-8');
          console.log('[MDTODO] 已创建文件:', filePath);
        } catch (createError) {
          vscode.window.showErrorMessage(`创建文件失败: ${createError}`);
          return;
        }
      } else {
        // 用户选择取消，不执行任何操作
        console.log('[MDTODO] 用户取消创建文件');
        return;
      }
    }
    // ... 其余打开逻辑（保持不变）
  }
}
```

### 3. 关键实现点

1. **模态对话框**：使用 `{ modal: true }` 使对话框成为模态，强制用户做出选择
2. **递归创建目录**：使用 `fs.mkdirSync(dir, { recursive: true })` 确保父目录也存在
3. **错误处理**：创建文件失败时显示错误消息
4. **取消处理**：用户选择取消时正常返回，不执行后续打开操作

### 4. 编译验证

执行 `npm.cmd run compile` 编译成功：

```
webpack 5.104.1 compiled successfully
```

## 执行结果

| 项目 | 状态 |
|------|------|
| 代码修改 | 已完成 |
| TypeScript 编译 | 通过 |
| Webpack 打包 | 通过 |
| bundle.js 更新 | 已生成 |

## 功能说明

- **触发条件**：点击链接打开 md 文件时，如果文件不存在
- **用户交互**：弹出模态对话框，显示文件名和"文件不存在"提示
- **可选操作**：
  - "创建文件并打开"：创建空文件并用 Typora 打开
  - "取消"：关闭对话框，不执行任何操作
- **目录自动创建**：如果目标文件的父目录不存在，会自动创建

## 修改文件

- `src/providers/webviewProvider.ts`: 修改 `openWithTypora` 方法

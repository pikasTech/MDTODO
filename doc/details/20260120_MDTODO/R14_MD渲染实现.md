# R14 执行日志：MD内容渲染实现

## 任务目标

非编辑模式下应当用第三方包来渲染任务内部的md内容块，编辑模式下直接显示源码。

## 执行步骤

### 1. 调研Markdown渲染库

经过调研，选择使用 `marked` 库，原因如下：
- 轻量级（压缩后约6KB）
- 支持GitHub Flavored Markdown (GFM)
- 广泛使用，稳定可靠
- 支持服务端和客户端渲染

### 2. 安装依赖包

```bash
npm install marked --save
npm install @types/marked --save-dev
```

### 3. 修改 TaskList.tsx

**导入配置：**
```typescript
import { marked } from 'marked';

marked.setOptions({
  breaks: true, // Convert \n to <br>
  gfm: true,    // Enable GitHub Flavored Markdown
});
```

**修改渲染逻辑：**
```typescript
const renderContent = () => {
  if (isEditMode) {
    // 编辑模式下显示原始Markdown源码
    return escapeHtml(task.title);
  }
  // 非编辑模式下使用marked渲染Markdown
  try {
    return marked.parse(task.title, { async: false });
  } catch (error) {
    console.error('[Webview] Markdown渲染错误:', error);
    return escapeHtml(task.title);
  }
};
```

### 4. 更新 CSS 样式

为Markdown渲染元素添加样式支持：
- 标题 (h1-h6)
- 段落 (p)
- 粗体 (strong) 和斜体 (em)
- 列表 (ul, ol, li)
- 引用块 (blockquote)
- 代码块 (pre, code)
- 分割线 (hr)
- 表格 (table, th, td)

样式规则使用 `.task-title:not(.edit-mode)` 选择器，确保仅在非编辑模式下生效。

### 5. 构建测试

运行 `npm run compile` 成功编译：
- extension.js: 21.9 KiB
- bundle.js: 62.6 KiB

## 修改文件清单

| 文件 | 修改内容 |
|------|----------|
| `package.json` | 添加 `marked` 和 `@types/marked` 依赖 |
| `src/webview/components/TaskList.tsx` | 导入 marked，修改 renderContent 函数 |
| `src/webview/components/TaskList.css` | 添加 Markdown 渲染元素样式 |

## 功能效果

### 非编辑模式
任务内容中的 Markdown 语法会被渲染为格式化文本：
- `# 标题` → 显示为标题样式
- `**粗体**` → 显示为粗体
- `*斜体*` → 显示为斜体
- `- 列表项` → 显示为列表
- `> 引用` → 显示为引用块
- `` `代码` `` → 显示为内联代码
- ```` ```代码块``` ```` → 显示为代码块
- `[链接](url)` → 显示为可点击链接

### 编辑模式
点击"编辑"按钮后，任务内容切换为纯文本编辑模式，显示原始 Markdown 源码，方便用户修改。

## 验证方式

1. 在 VSCode 中按 F5 启动插件开发宿主
2. 打开一个 MDTODO 文件
3. 观察任务内容的 Markdown 渲染效果
4. 点击"编辑"按钮确认显示源码
5. 点击"完成"按钮确认恢复渲染模式

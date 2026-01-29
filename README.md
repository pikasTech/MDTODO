# VSCODE MDTODO Plugin

VSCODE插件，渲染TODO文件为树形任务列表，支持Claude Code集成。

## 功能特性

- **树形任务列表**：将Markdown格式的TODO文件渲染为可展开/折叠的树形结构
- **任务状态管理**：支持完成状态标记 `[completed]`、进行中状态 `[in_progress]`
- **实时预览**：自动检测文件变化并更新视图
- **Claude Code集成**：一键执行任务，支持生成执行报告并自动链接
- **Markdown渲染**：支持行内代码、代码块、LaTeX公式渲染
- **链接管理**：支持跳转到链接文档，右键菜单提供复制路径、删除链接等操作
- **快捷导航**：快速跳转到下一个未完成任务
- **多文件支持**：同时管理多个 TODO 文件
- **双向滚动同步**：与 VSCode 编辑器滚动位置同步

## 安装

### 方式一：使用 install.bat（推荐，适用于 Windows）

在项目目录下直接运行：

```powershell
.\install.bat
```

或使用 PowerShell：

```powershell
powershell -ExecutionPolicy Bypass -Command ".\install.bat"
```

> **注意**：需要在 vscode-mdtodo 目录下执行

安装脚本会自动完成以下步骤：
1. 安装项目依赖
2. 编译项目（使用 TypeScript + Webpack）
3. 打包为 VSIX 安装包
4. 卸载旧版本（如果存在）
5. 安装新版本到 VSCode

**安装成功后的验证方法：**
1. 打开 VSCode
2. 按 `Ctrl+Shift+X` 打开扩展面板
3. 搜索 "MDTODO" 确认已安装

**故障排除：**
- 如果安装失败，请确保 VSCode 的 `code` 命令已在 PATH 中
- 添加方法：打开 VSCode，按 `Ctrl+Shift+P`，输入 "Shell Command: Install 'code' command in PATH"
- 确保使用 PowerShell 执行，Windows 命令提示符不支持 `-ExecutionPolicy` 参数

### 方式二：手动安装

1. 确保已安装 Node.js（推荐 v18+）
2. 安装依赖：`npm install`
3. 编译项目：`npm.cmd run compile`
   > **重要**：Windows 下必须使用 `npm.cmd`，直接使用 `npm` 会导致构建失败
4. 打包：`npm.cmd run package`
5. 在 VSCode 中安装生成的 `.vsix` 文件（拖拽或通过扩展面板右上角"..."选择"从VSIX安装"）

## 开发

```bash
# 安装依赖
npm install

# 开发模式（监听文件变化，自动重新编译）
npm.cmd run watch

# 按 F5 启动调试（会打开一个新的 VSCode 窗口进行测试）
```

## 项目结构

```
vscode-mdtodo/
├── src/
│   ├── extension.ts           # 扩展入口
│   ├── parser/                # Markdown 解析器
│   ├── providers/             # Webview 提供者和管理器
│   │   └── managers/          # 管理器模块
│   ├── services/              # 文件服务和 Claude 服务
│   ├── types/                 # TypeScript 类型定义
│   └── webview/               # React 前端组件
│       └── components/        # UI 组件
└── resources/                 # 构建产物
```

## 使用

1. **打开任务列表**
   - 按 `Ctrl+Shift+P` 打开命令面板
   - 输入 "MDTODO" 或 "打开TODO文件"
   - 选择要打开的 TODO 文件

2. **基本操作**
   - 点击任务标题进入编辑模式
   - 点击复选框标记完成/未完成
   - 点击展开/折叠按钮查看子任务
   - 点击 Claude 按钮执行任务

3. **右键菜单操作**
   - 任务块：复制执行命令
   - 链接：打开链接、复制路径、删除链接

4. **快捷键**
   - `Ctrl+Shift+P`：打开命令面板
   - 在调试窗口按 `Ctrl+R`：重新加载扩展

## 命令

| 命令 | 说明 |
|------|------|
| `MDTODO` | 打开 MDTODO 独立视图 |
| `MDTODO: 打开TODO文件` | 打开一个新的 TODO 文件 |
| `MDTODO: 刷新任务列表` | 手动刷新视图 |
| `MDTODO: 使用Claude执行任务` | 执行当前选中的任务 |
| `MDTODO` (从预览) | 从 Markdown 预览打开 |

## 文件格式

```markdown
## R1 任务标题

任务描述，支持 **Markdown** 格式，包括代码块和 LaTeX 公式。

### R1.1 子任务 [in_progress]

子任务描述...

### R1.2 已完成子任务 [completed]

完成的描述...

#### R1.2.1 三级子任务

更深层级的子任务...
```

**状态标记说明：**
| 标记 | 状态 |
|------|------|
| `[completed]` | 已完成 |
| `[in_progress]` | 进行中 |
| 无标记 | 未开始 |

**兼容性说明：**
- 旧标记 `[Processing]` 会自动转换为 `[in_progress]`
- 旧标记 `[Finished]` 会自动转换为 `[completed]`

## 依赖要求

- **Node.js**：推荐 v18+
- **VSCode**：^1.70.0
- **操作系统**：Windows/macOS/Linux

## 版本信息

- **当前版本**：0.0.2
- **VSCode 兼容性**：^1.70.0

## 常见问题

**Q: 修改代码后视图没有更新？**
A: 确保在开发模式下运行 `npm.cmd run watch`，然后在调试窗口中按 `Ctrl+R` 重新加载。

**Q: Windows 下 npm 命令不工作？**
A: 请使用 `npm.cmd` 替代 `npm`，这是 Windows 特有的要求。

**Q: 如何更新插件？**
A: 重新运行 `install.bat` 脚本（或手动执行编译打包流程），它会自动卸载旧版本并安装新版本。

**Q: 如何卸载插件？**
A: 在 VSCode 扩展面板中找到 MDTODO，点击齿轮图标选择"卸载"，或运行命令：
```bash
code --uninstall-extension mdtodo
```

**Q: 支持多级子任务吗？**
A: 支持，格式为 `## R1` → `### R1.1` → `#### R1.1.1`，支持无限层级嵌套。

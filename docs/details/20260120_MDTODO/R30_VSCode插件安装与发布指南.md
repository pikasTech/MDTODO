# R30 VSCode插件安装与发布指南

## 一、本地开发模式安装

### 1.1 调试模式运行（推荐用于开发）

在VS Code中直接按 `F5` 即可启动一个"扩展开发宿主"窗口，该窗口会自动加载当前插件进行调试。

### 1.2 本地VSIX安装（用于实际工作使用）

将插件打包为VSIX文件后，可以通过以下方式安装到VS Code中：

#### 方式一：命令行安装

```bash
# 使用 code 命令安装（需将VS Code添加到系统PATH）
code --install-extension vscode-mdtodo-0.0.1.vsix

# VS Code Insiders 版本
code-insiders --install-extension vscode-mdtodo-0.0.1.vsix
```

#### 方式二：GUI安装

1. 打开VS Code
2. 按 `Ctrl+Shift+P` 打开命令面板
3. 输入 "Extensions: Install from VSIX"
4. 选择打包好的 `.vsix` 文件

### 1.3 通过符号链接安装（开发期间推荐）

将插件目录通过符号链接关联到VS Code的扩展目录，这样修改代码后无需重新打包即可测试：

```bash
# Windows PowerShell
$extensionPath = "$env:USERPROFILE\.vscode\extensions\mdtodo"
New-Item -ItemType Junction -Path $extensionPath -Target "d:\Work\big-paper2\vscode-mdtodo"
```

插件目录结构：
```
vscode-mdtodo/
├── package.json
├── src/
├── node_modules/
└── out/
```

## 二、打包VSIX文件

### 2.1 安装vsce工具

```bash
npm install -g @vscode/vsce
```

### 2.2 打包命令

在插件根目录执行：

```bash
vsce package
```

这会生成一个 `.vsix` 文件，可用于离线分发或上传到市场。

### 2.3 版本号管理

在 `package.json` 中更新版本号：

```json
{
  "version": "0.0.1",
  "publisher": "your-publisher-name"
}
```

## 三、上传到VS Code插件市场

### 3.1 创建Azure DevOps账号

1. 访问 https://dev.azure.com 并注册/登录
2. 创建组织（Organization）

### 3.2 创建Personal Access Token (PAT)

1. 在Azure DevOps中点击用户设置 → Personal access tokens
2. 创建新token，设置以下权限：
   - Marketplace: Acquire & Manage（发布和管理扩展）
   - 过期时间建议设置为90天或更短

### 3.3 登录vsce

```bash
vsce login <publisher-name>
# 输入刚才创建的PAT
```

### 3.4 首次发布

```bash
# 首次发布需要指定publisher名称
vsce publish --publisher <publisher-name>
```

### 3.5 后续更新

每次更新时：
1. 修改 `package.json` 中的版本号
2. 重新打包：`vsce package`
3. 发布：`vsce publish`

### 3.6 发布到Open-VSX（开源替代市场）

Open-VSX是VS Code的开源替代市场：

```bash
# 安装open-vsx命令行工具
npm install -g @open-vsx/publish

# 发布
npx ovsx publish -p <token>
```

## 四、当前项目的具体操作步骤

### 步骤1：检查并更新package.json

```json
{
  "name": "vscode-mdtodo",
  "displayName": "MDTODO",
  "description": "VS Code extension for rendering TODO files as tree task lists",
  "version": "0.0.1",
  "publisher": "your-name",  // 需修改为你的发布者名称
  "engines": {
    "vscode": "^1.74.0"
  },
  "categories": [
    "Other"
  ],
  "activationEvents": [
    "onCommand:mdtodo.openWebview"
  ],
  "main": "./out/extension.js",
  "contributes": {
    "commands": [
      {
        "command": "mdtodo.openWebview",
        "title": "Open MDTODO"
      }
    ],
    "viewsContainers": {
      "activitybar": [
        {
          "id": "mdtodo-container",
          "title": "MDTODO"
        }
      ]
    },
    "views": {
      "mdtodo-container": [
        {
          "type": "webview",
          "id": "mdtodo.webview",
          "name": "MDTODO"
        }
      ]
    }
  }
}
```

### 步骤2：构建项目

```bash
# 编译TypeScript
cd vscode-mdtodo
npm.cmd run compile
```

### 步骤3：本地安装测试

```bash
# 打包
vsce package

# 安装
code --install-extension vscode-mdtodo-0.0.1.vsix
```

### 步骤4：发布到市场（如需要）

```bash
# 登录（首次）
vsce login <publisher-name>

# 发布
vsce publish
```

## 五、常见问题

### Q1: vsce命令找不到？

确保全局安装了vsce：
```bash
npm install -g @vscode/vsce
```

### Q2: 打包失败，提示"Error: Missing publisher information"？

在 `package.json` 中添加或修改 `publisher` 字段。

### Q3: 发布时提示"Extension is already published"？

修改 `package.json` 中的版本号后再发布。

### Q4: 如何卸载已安装的插件？

```bash
code --uninstall-extension vscode-mdtodo
```

## 六、推荐的工作流程

1. **开发阶段**：使用 `F5` 调试模式
2. **本地测试**：打包VSIX后通过命令行安装
3. **日常使用**：通过符号链接方式安装（修改代码后自动生效）
4. **正式发布**：打包并上传到插件市场

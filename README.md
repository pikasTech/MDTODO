# VSCODE MDTODO Plugin

VSCODE插件，渲染TODO文件为树形任务列表，支持Claude Code集成。

## 功能

- 将Markdown格式的TODO文件渲染为树形任务列表
- 支持任务展开折叠
- 支持完成状态标记
- 支持实时预览文件变化
- 支持调用Claude Code执行任务

## 安装

1. 编译项目：`npm run compile`
2. 打包：`npm run package`
3. 安装生成的`.vsix`文件

## 开发

1. `npm install`
2. `npm run watch`
3. 按F5启动调试

## 使用

1. 打开命令面板 (Ctrl+Shift+P)
2. 运行 "MDTODO: 打开TODO文件"
3. 选择要打开的TODO文件
4. 在侧边栏查看任务列表

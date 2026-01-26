# R41 任务执行报告：Typora 启动黑窗问题修复

## 任务描述

每次点开链接，启动 Typora 之前都会先弹出一下黑窗，希望不要弹出黑窗直接启动 Typora。

## 问题分析

在 Windows 平台上，原来的实现使用 `cmd.exe /c start` 命令来启动 Typora：

```typescript
spawn('cmd.exe', ['/c', 'start', '', typoraPath, filePath], {
  detached: true,
  stdio: 'ignore'
});
```

这个 `cmd.exe /c start` 命令会先启动一个命令提示符窗口，然后在该窗口中执行启动 Typora 的操作，导致用户看到黑窗闪一下。

## 解决方案

修改 Windows 平台的 Typora 启动方式，直接使用 `spawn` 调用 Typora 可执行文件，并添加 `windowsHide: true` 选项来隐藏窗口：

```typescript
spawn(typoraPath, [filePath], {
  detached: true,
  stdio: 'ignore',
  windowsHide: true
});
```

**关键改动：**
1. 直接调用 `typoraPath`（Typora.exe 的完整路径），而不是通过 `cmd.exe /c start`
2. 添加 `windowsHide: true` 选项，告知 Node.js 在 Windows 上隐藏子进程的控制台窗口

## 修改文件

- `src/providers/webviewProvider.ts:594-600` - 修改 `openWithTypora` 方法中的 Windows 启动逻辑

## 验证步骤

1. 重新编译插件：`npm run compile`
2. 在 VSCode 中以调试模式运行插件
3. 点击任意文档链接
4. 验证 Typora 是否正常打开，且没有黑窗闪现

## 执行日期

2026-01-22

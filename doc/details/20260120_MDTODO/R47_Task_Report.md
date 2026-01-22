# R47 定期刷新机制实现报告

## 任务描述

增加低频率的定期刷新机制，防止文件变更事件遗漏，按照5s的周期低频定期刷新。

## 实现方案

### 核心思路

1. **文件内容比对机制**：记录当前文件内容，定期检查文件是否有变化
2. **懒加载刷新**：只有检测到变化时才重新加载，避免不必要的刷新操作
3. **生命周期管理**：在面板打开时启动定时器，关闭时停止定时器

### 实现细节

#### 1. 新增成员变量 (`webviewProvider.ts:17-19`)

```typescript
// 【实现R47】定期刷新定时器
private refreshTimer: NodeJS.Timer | undefined;
private lastFileContent: string = '';
```

#### 2. 启动定时器 (`webviewProvider.ts:102-115`)

```typescript
private startPeriodicRefresh(): void {
  // 先停止已有的定时器
  this.stopPeriodicRefresh();

  // 记录当前文件内容用于比较
  this.recordCurrentFileContent();

  // 启动5秒周期的定时器
  this.refreshTimer = setInterval(async () => {
    await this.checkAndRefresh();
  }, 5000);

  console.log('[MDTODO] 已启动定期刷新定时器（5秒周期）');
}
```

#### 3. 停止定时器 (`webviewProvider.ts:120-126`)

```typescript
private stopPeriodicRefresh(): void {
  if (this.refreshTimer) {
    clearInterval(this.refreshTimer);
    this.refreshTimer = undefined;
    console.log('[MDTODO] 已停止定期刷新定时器');
  }
}
```

#### 4. 记录文件内容 (`webviewProvider.ts:131-139`)

```typescript
private async recordCurrentFileContent(): Promise<void> {
  if (this.currentFilePath && fs.existsSync(this.currentFilePath)) {
    try {
      this.lastFileContent = fs.readFileSync(this.currentFilePath, 'utf-8');
    } catch (error) {
      console.error('[MDTODO] 读取文件内容失败:', error);
    }
  }
}
```

#### 5. 检查并刷新 (`webviewProvider.ts:144-165`)

```typescript
private async checkAndRefresh(): Promise<void> {
  if (!this.currentFilePath || !this.panel) {
    return;
  }

  if (!fs.existsSync(this.currentFilePath)) {
    return;
  }

  try {
    const currentContent = fs.readFileSync(this.currentFilePath, 'utf-8');

    // 比较文件内容是否有变化
    if (currentContent !== this.lastFileContent) {
      console.log('[MDTODO] 检测到文件变化，自动刷新...');
      await this.loadFile(this.currentFilePath);
      this.lastFileContent = currentContent;
    }
  } catch (error) {
    console.error('[MDTODO] 检查文件变化失败:', error);
  }
}
```

### 生命周期集成

1. **面板打开时** (`showPanel` 方法)：
   - 启动定期刷新定时器

2. **面板Dispose时** (`onDidDispose` 和 `dispose` 方法)：
   - 停止定期刷新定时器

3. **手动加载文件时** (`loadFile` 方法)：
   - 加载完成后记录文件内容，用于后续比较

## 优势

1. **低频率**：5秒周期，避免频繁I/O操作
2. **懒加载**：只检测到变化时才刷新，减少不必要的渲染
3. **资源安全**：面板关闭时自动停止定时器，避免内存泄漏
4. **外部变更检测**：可以检测到Typora或其他编辑器对文件的修改

## 测试验证

1. 在MDTODO面板打开时，检查控制台是否输出"已启动定期刷新定时器（5秒周期）"
2. 在Typora中修改TODO文件内容，等待5秒后检查MDTODO面板是否自动刷新
3. 关闭MDTODO面板后，检查控制台是否输出"已停止定期刷新定时器"

## 总结

通过实现定期刷新机制，解决了文件变更事件可能遗漏的问题，确保外部编辑器对TODO文件的修改能够及时同步到MDTODO面板。

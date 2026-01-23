# R49 任务报告：时间戳命名报告文件

## 任务内容

修改创建任务后的模板中，文件的命名方式，不再用 `RXX_Task_Report.md` 命名，而是用时间戳命名，例如 `20260123_1050_Task_Report.md`。

## 修改文件

- `src/providers/webviewProvider.ts`

## 修改内容

在 `generateNewTaskContent` 函数中，修改报告文件的命名逻辑：

### 修改前

```typescript
const reportPath = `./details/${fileName}/${taskId}_Task_Report.md`;
```

### 修改后

```typescript
// 【R49】使用时间戳格式命名：YYYYMMDD_HHmm_Task_Report.md
const now = new Date();
const year = now.getFullYear();
const month = String(now.getMonth() + 1).padStart(2, '0');
const day = String(now.getDate()).padStart(2, '0');
const hours = String(now.getHours()).padStart(2, '0');
const minutes = String(now.getMinutes()).padStart(2, '0');
const timestamp = `${year}${month}${day}_${hours}${minutes}`;
const reportPath = `./details/${fileName}/${timestamp}_Task_Report.md`;
```

## 时间戳格式说明

时间戳格式：`YYYYMMDD_HHmm`

- `YYYY`: 4位年份
- `MM`: 2位月份（01-12）
- `DD`: 2位日期（01-31）
- `_`: 分隔符
- `HH`: 2位小时（00-23）
- `mm`: 2位分钟（00-59）

示例：`20260123_1050` 表示 2026年1月23日 10:50

## 验证

- 项目编译成功（`npm run compile`）
- 创建新任务时，报告文件链接将使用时间戳命名

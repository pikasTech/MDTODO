---
name: mdtodo-edit
description: MUST USE THIS SKILL TO EDIT MDTODO FILE, DO NOT EDIT BY HAND!
---
# mdtodo-edit

Markdown TODO 任务管理工具。支持在 Claude Code 中直接管理 Markdown 格式的任务文件，自动查找 `*TODO*.md` 文件并执行增删改查操作。

## 前置条件

在使用此 skill 之前，确保 MDTODO CLI 已正确安装：

```bash
npm install --prefix ~/.claude/skills/mdtodo-edit/scripts/
```

## 快速开始

```bash
# 列出 TODO 任务（使用绝对路径）
node ~/.claude/skills/mdtodo-edit/scripts/dist/cli.js list -f /path/to/project/TODO.md

# 添加新任务
node ~/.claude/skills/mdtodo-edit/scripts/dist/cli.js add -f /path/to/project/TODO.md

# 标记任务完成
node ~/.claude/skills/mdtodo-edit/scripts/dist/cli.js complete R1 -f /path/to/project/TODO.md
```

## 命令列表

### 通用选项

| 选项 | 说明 |
|-----|------|
| `-f, --file <path>` | 指定 TODO 文件路径（必填，如不指定则自动查找当前目录的 `*TODO*.md` 文件） |
| `--json` | JSON 格式输出 |

### 1. list - 列出所有任务

**命令格式：**
```bash
node ~/.claude/skills/mdtodo-edit/scripts/dist/cli.js list -f <path/to/TODO.md>
```

**示例：**
```bash
# 指定 TODO 文件
node ~/.claude/skills/mdtodo-edit/scripts/dist/cli.js list -f /path/to/project/TODO.md

# JSON 格式输出
node ~/.claude/skills/mdtodo-edit/scripts/dist/cli.js list -f /path/to/project/TODO.md --json
```

**输出示例：**
```
[ ] R1 第一个任务
  [x] R1.1 子任务已完成
  [-] R1.2 子任务进行中
[ ] R2 第二个任务

统计: 共 3 个任务，已完成 1，进行中 1，待处理 1
```

---

### 2. get - 获取任务详情

**命令格式：**
```bash
node ~/.claude/skills/mdtodo-edit/scripts/dist/cli.js get <taskId> -f <path/to/TODO.md>
```

**taskId 说明：**
- 顶级任务：`R1`, `R2`, `R3`, ...
- 一级子任务：`R1.1`, `R1.2`, ...
- 二级子任务：`R1.1.1`, `R1.1.2`, ...

**示例：**
```bash
# 获取 R1 任务详情
node ~/.claude/skills/mdtodo-edit/scripts/dist/cli.js get R1 -f /path/to/project/TODO.md

# 获取子任务详情
node ~/.claudeodo-edit/scripts/dist/cli.js get R1.1 -f /path/to/skills/mdt/project/TODO.md

# JSON 格式输出
node ~/.claude/skills/mdtodo-edit/scripts/dist/cli.js get R1 -f /path/to/project/TODO.md --json
```

**输出示例：**
```
任务 ID: R1
标题: 第一个任务
状态: 待处理
行号: 1
链接统计: 0/1

子任务:
  [x] R1.1 子任务已完成
  [-] R1.2 子任务进行中
```

---

### 3. add - 添加新任务

**命令格式：**
```bash
node ~/.claude/skills/mdtodo-edit/scripts/dist/cli.js add -f <path/to/TODO.md>
```

**说明：**
- 自动生成新任务 ID（如 R3）
- 自动创建任务模板，包含任务报告链接
- 无需交互式输入任务标题

**示例：**
```bash
# 添加新任务（自动生成 ID 和模板内容）
node ~/.claude/skills/mdtodo-edit/scripts/dist/cli.js add -f /path/to/project/TODO.md
```

**输出示例：**
```
任务 R3 添加成功
```

**生成的任务模板：**
```markdown
## R3

, 完成任务后将详细报告写入[R3](./details/TODO/R3_YYYYMMDD_HHMM_Task_Report.md)。
```

---

### 4. add-sub - 添加子任务

**命令格式：**
```bash
node ~/.claude/skills/mdtodo-edit/scripts/dist/cli.js add-sub <parentTaskId> -f <path/to/TODO.md>
```

**示例：**
```bash
# 在 R1 下添加子任务
node ~/.claude/skills/mdtodo-edit/scripts/dist/cli.js add-sub R1 -f /path/to/project/TODO.md

# 在 R2.1 下添加二级子任务
node ~/.claude/skills/mdtodo-edit/scripts/dist/cli.js add-sub R2.1 -f /path/to/project/TODO.md
```

---

### 5. delete / remove - 删除任务

**命令格式：**
```bash
node ~/.claude/skills/mdtodo-edit/scripts/dist/cli.js delete <taskId> -f <path/to/TODO.md>
# 或使用别名
node ~/.claude/skills/mdtodo-edit/scripts/dist/cli.js remove <taskId> -f <path/to/TODO.md>
```

**警告：** 删除父任务时会级联删除所有子任务。

**示例：**
```bash
# 删除任务
node ~/.claude/skills/mdtodo-edit/scripts/dist/cli.js delete R1 -f /path/to/project/TODO.md

# 使用别名
node ~/.claude/skills/mdtodo-edit/scripts/dist/cli.js remove R2 -f /path/to/project/TODO.md

# 删除子任务
node ~/.claude/skills/mdtodo-edit/scripts/dist/cli.js delete R1.1 -f /path/to/project/TODO.md
```

---

### 6. complete / done - 标记任务完成

**命令格式：**
```bash
node ~/.claude/skills/mdtodo-edit/scripts/dist/cli.js complete <taskId> -f <path/to/TODO.md>
# 或使用别名
node ~/.claude/skills/mdtodo-edit/scripts/dist/cli.js done <taskId> -f <path/to/TODO.md>
```

**示例：**
```bash
# 标记任务完成
node ~/.claude/skills/mdtodo-edit/scripts/dist/cli.js complete R1 -f /path/to/project/TODO.md

# 使用别名
node ~/.claude/skills/mdtodo-edit/scripts/dist/cli.js done R2 -f /path/to/project/TODO.md

# 标记子任务完成
node ~/.claude/skills/mdtodo-edit/scripts/dist/cli.js complete R1.1 -f /path/to/project/TODO.md
```

---

### 7. start - 标记任务进行中

**命令格式：**
```bash
node ~/.claude/skills/mdtodo-edit/scripts/dist/cli.js start <taskId> -f <path/to/TODO.md>
```

**示例：**
```bash
# 标记任务为进行中
node ~/.claude/skills/mdtodo-edit/scripts/dist/cli.js start R1 -f /path/to/project/TODO.md

# 标记子任务为进行中
node ~/.claude/skills/mdtodo-edit/scripts/dist/cli.js start R1.1 -f /path/to/project/TODO.md
```

---

### 8. update - 更新任务标题

**命令格式：**
```bash
node ~/.claude/skills/mdtodo-edit/scripts/dist/cli.js update <taskId> "<newTitle>" -f <path/to/TODO.md>
```

**示例：**
```bash
# 更新任务标题
node ~/.claude/skills/mdtodo-edit/scripts/dist/cli.js update R1 "新的任务标题" -f /path/to/project/TODO.md

# 更新子任务标题
node ~/.claude/skills/mdtodo-edit/scripts/dist/cli.js update R1.1 "新的子任务标题" -f /path/to/project/TODO.md
```

---

### 9. stats - 显示任务统计

**命令格式：**
```bash
node ~/.claude/skills/mdtodo-edit/scripts/dist/cli.js stats -f <path/to/TODO.md>
```

**示例：**
```bash
# 显示统计信息
node ~/.claude/skills/mdtodo-edit/scripts/dist/cli.js stats -f /path/to/project/TODO.md

# JSON 格式输出
node ~/.claude/skills/mdtodo-edit/scripts/dist/cli.js stats -f /path/to/project/TODO.md --json
```

**输出示例：**
```
任务统计:
  总任务数: 10
  已完成: 5
  进行中: 2
  待处理: 3
```

---

## 完整使用场景

### 场景1：初始化新的 TODO 文件

```bash
# 创建 TODO.md 文件
echo "# 项目任务" > /path/to/project/TODO.md

# 添加第一个任务（自动生成 R1）
node ~/.claude/skills/mdtodo-edit/scripts/dist/cli.js add -f /path/to/project/TODO.md

# 添加第二个任务（自动生成 R2）
node ~/.claude/skills/mdtodo-edit/scripts/dist/cli.js add -f /path/to/project/TODO.md

# 查看任务列表
node ~/.claude/skills/mdtodo-edit/scripts/dist/cli.js list -f /path/to/project/TODO.md
```

### 场景2：创建任务层级结构

```bash
# 添加父任务（自动生成 R1）
node ~/.claude/skills/mdtodo-edit/scripts/dist/cli.js add -f /path/to/project/TODO.md

# 在 R1 下添加子任务（自动生成 R1.1）
node ~/.claude/skills/mdtodo-edit/scripts/dist/cli.js add-sub R1 -f /path/to/project/TODO.md

# 添加第二个子任务（自动生成 R1.2）
node ~/.claude/skills/mdtodo-edit/scripts/dist/cli.js add-sub R1 -f /path/to/project/TODO.md

# 在 R1.2 下添加三级子任务（自动生成 R1.2.1）
node ~/.claude/skills/mdtodo-edit/scripts/dist/cli.js add-sub R1.2 -f /path/to/project/TODO.md
```

### 场景3：管理工作流程

```bash
# 1. 查看当前任务
node ~/.claude/skills/mdtodo-edit/scripts/dist/cli.js list -f /path/to/project/TODO.md

# 2. 开始一个任务
node ~/.claude/skills/mdtodo-edit/scripts/dist/cli.js start R1 -f /path/to/project/TODO.md

# 3. 获取任务详情
node ~/.claude/skills/mdtodo-edit/scripts/dist/cli.js get R1 -f /path/to/project/TODO.md

# 4. 完成子任务
node ~/.claude/skills/mdtodo-edit/scripts/dist/cli.js complete R1.1 -f /path/to/project/TODO.md

# 5. 查看统计
node ~/.claude/skills/mdtodo-edit/scripts/dist/cli.js stats -f /path/to/project/TODO.md
```

### 场景4：批量操作（逐个执行）

```bash
# 逐个完成多个任务
node ~/.claude/skills/mdtodo-edit/scripts/dist/cli.js complete R1 -f /path/to/project/TODO.md
node ~/.claude/skills/mdtodo-edit/scripts/dist/cli.js complete R2 -f /path/to/project/TODO.md
node ~/.claude/skills/mdtodo-edit/scripts/dist/cli.js complete R3 -f /path/to/project/TODO.md

# 验证完成状态
node ~/.claude/skills/mdtodo-edit/scripts/dist/cli.js list -f /path/to/project/TODO.md
```

### 场景5：清理已完成的任务

```bash
# 先查看所有任务
node ~/.claude/skills/mdtodo-edit/scripts/dist/cli.js list -f /path/to/project/TODO.md

# 删除已完成的任务（会级联删除子任务）
node ~/.claude/skills/mdtodo-edit/scripts/dist/cli.js delete R1 -f /path/to/project/TODO.md
node ~/.claude/skills/mdtodo-edit/scripts/dist/cli.js delete R3 -f /path/to/project/TODO.md

# 验证删除结果
node ~/.claude/skills/mdtodo-edit/scripts/dist/cli.js list -f /path/to/project/TODO.md
```

### 场景6：修改任务标题

```bash
# 更新任务标题
node ~/.claude/skills/mdtodo-edit/scripts/dist/cli.js update R1 "更新后的标题" -f /path/to/project/TODO.md

# 批量更新
node ~/.claude/skills/mdtodo-edit/scripts/dist/cli.js update R1 "新的标题" -f /path/to/project/TODO.md && \
node ~/.claude/skills/mdtodo-edit/scripts/dist/cli.js update R2 "另一个标题" -f /path/to/project/TODO.md
```

---

## 任务状态说明

| 状态 | 显示符号 | 说明 |
|-----|---------|------|
| 待处理 | `[ ]` | 任务尚未开始 |
| 进行中 | `[-]` | 任务正在进行中 |
| 已完成 | `[x]` | 任务已完成 |

---

## 文件自动搜索规则

当不使用 `-f` 选项时，CLI 会按以下规则查找 TODO 文件：

1. 在当前工作目录查找匹配 `*TODO*.md` 模式的文件
2. 如果找到多个文件，使用第一个
3. 如果没有找到，返回错误

**示例：**
```bash
cd /path/to/project

# 自动查找 ./TODO.md 或 ./*TODO*.md
node ~/.claude/skills/mdtodo-edit/scripts/dist/cli.js list

# 显式指定文件
node ~/.claude/skills/mdtodo-edit/scripts/dist/cli.js list -f ./TODO.md
```

---

## 注意事项

1. **使用绝对路径**：命令中使用绝对路径避免路径问题
2. **任务 ID**：CLI 使用精确匹配，必须输入完整的任务 ID（如 `R1.1` 不能简写为 `1.1`）
3. **级联删除**：删除父任务会同时删除所有子任务
4. **备份建议**：执行批量删除前建议备份 TODO 文件

---

## 错误处理

### 常见错误及解决方法

| 错误信息 | 原因 | 解决方法 |
|---------|------|---------|
| `未找到 TODO 文件` | 当前目录没有 `*TODO*.md` 文件 | 使用 `-f` 选项指定文件路径 |
| `任务不存在` | 任务 ID 不正确 | 使用 `list` 命令查看所有任务 |
| `任务 ID 格式错误` | 任务 ID 不符合规范 | 使用 `R1`、`R1.1` 等格式 |

### 调试步骤

1. 先执行 `list -f /absolute/path/to/TODO.md` 确认文件存在
2. 执行 `get R1 -f /absolute/path/to/TODO.md` 确认任务 ID 正确

---

## Debug 调试命令

### 1. debug model-list - 列出可用模型

**命令格式：**
```bash
node dist/cli.js debug model-list
```

**说明：**
- 调用 `opencode models` 获取可用模型列表
- 需要确保 `opencode` CLI 已安装并在 PATH 中

**输出示例：**
```json
{
  "success": true,
  "count": 54,
  "models": [
    { "id": "minimax/MiniMax-M2.5", "name": "MiniMax M2.5", "provider": "minimax" },
    { "id": "github-copilot/claude-opus-4.6", "name": "claude opus 4.6", "provider": "github-copilot" }
  ]
}
```

**错误示例（opencode 未安装）：**
```json
{
  "success": false,
  "error": "Failed to spawn opencode: ..."
}
```

---

### 2. debug config-get - 获取当前配置

**命令格式：**
```bash
node dist/cli.js debug config-get [-w <workspace-path>]
```

**选项：**
| 选项 | 说明 |
|-----|------|
| `-w, --workspace <path>` | 工作区路径（默认当前目录） |

**输出示例：**
```json
{
  "success": true,
  "configPath": "/path/to/workspace/.vscode/mdtodo/settings.json",
  "config": {
    "executionMode": "opencode",
    "model": "minimax/MiniMax-M2.5"
  }
}
```

---

### 3. debug config-set - 设置配置项

**命令格式：**
```bash
node dist/cli.js debug config-set <key> <value> [-w <workspace-path>]
```

**支持的配置项：**

| Key | Value | 说明 |
|-----|-------|------|
| `executionMode` | `claude` 或 `opencode` | 执行模式 |
| `model` | 模型名称字符串 | 模型名称 |

**示例：**
```bash
# 设置执行模式为 opencode
node dist/cli.js debug config-set executionMode opencode

# 设置模型
node dist/cli.js debug config-set model "minimax/MiniMax-M2.5"

# 指定工作区路径
node dist/cli.js debug config-set executionMode claude -w /path/to/workspace
```

**输出示例：**
```json
{
  "success": true,
  "configPath": "/path/to/workspace/.vscode/mdtodo/settings.json",
  "config": {
    "executionMode": "claude",
    "model": "minimax/MiniMax-M2.5"
  }
}
```

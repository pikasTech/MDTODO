# MDTODO CLI 使用文档

## 简介

MDTODO CLI 是一个命令行任务管理工具，用于管理 Markdown 格式的 TODO 文件。支持任务的增删改查、状态标记、统计等功能。

## 安装

```bash
# 进入 CLI 目录
cd cli

# 安装依赖
npm install

# 构建
npm run build

# 全局安装（可选）
npm install -g .
```

## 使用方法

### 基本语法

```bash
mdtodo [options] [command]
```

### 全局选项

| 选项 | 说明 |
|-----|------|
| `-V, --version` | 输出版本号 |
| `-f, --file <path>` | 指定 TODO 文件路径 |
| `--json` | JSON 格式输出 |
| `-h, --help` | 显示帮助信息 |

### 命令

#### 1. list - 列出所有任务

```bash
# 列出当前目录下的 TODO 文件中的所有任务
mdtodo list

# 指定 TODO 文件
mdtodo list -f path/to/TODO.md

# JSON 格式输出
mdtodo list --json
```

**输出示例：**
```
[x] R1 任务标题1
  [x] R1.1 子任务1
  [-] R1.2 子任务2
[ ] R2 任务标题2

统计: 共 2 个任务，已完成 1，进行中 1，待处理 0
```

#### 2. get - 获取任务详情

```bash
# 获取指定任务详情
mdtodo get R1

# 指定 TODO 文件并 JSON 输出
mdtodo get R1.1 -f path/to/TODO.md --json
```

**输出示例：**
```
任务 ID: R1
标题: 任务标题1
状态: 已完成
行号: 1
链接统计: 0/1

子任务:
  [x] R1.1 子任务1
  [-] R1.2 子任务2
```

#### 3. add - 添加新任务

```bash
# 添加新任务（自动生成 ID）
mdtodo add

# 指定 TODO 文件
mdtodo add -f path/to/TODO.md
```

#### 4. add-sub - 添加子任务

```bash
# 添加子任务到指定任务
mdtodo add-sub R1

# 指定 TODO 文件
mdtodo add-sub R1 -f path/to/TODO.md
```

#### 5. delete - 删除任务

```bash
# 删除任务
mdtodo delete R1

# 使用别名
mdtodo remove R1

# 指定 TODO 文件
mdtodo delete R1 -f path/to/TODO.md
```

**注意：** 删除父任务时，其子任务也会被级联删除。

#### 6. complete - 标记任务完成

```bash
# 标记任务为已完成
mdtodo complete R1

# 使用别名
mdtodo done R1

# 指定 TODO 文件
mdtodo complete R1 -f path/to/TODO.md
```

#### 7. start - 标记任务进行中

```bash
# 标记任务为进行中
mdtodo start R1

# 指定 TODO 文件
mdtodo start R1 -f path/to/TODO.md
```

#### 8. update - 更新任务标题

```bash
# 更新任务标题
mdtodo update R1 "新的任务标题"

# 指定 TODO 文件
mdtodo update R1 "新的任务标题" -f path/to/TODO.md
```

#### 9. stats - 显示任务统计

```bash
# 显示任务统计
mdtodo stats

# JSON 格式输出
mdtodo stats --json
```

**输出示例：**
```
任务统计:
  总任务数: 10
  已完成: 5
  进行中: 2
  待处理: 3
```

## 任务状态说明

| 状态 | 显示 | 说明 |
|-----|------|------|
| 未开始 | `[ ]` | 任务尚未开始 |
| 进行中 | `[-]` | 任务正在进行中 |
| 已完成 | `[x]` | 任务已完成 |

## 任务 ID 格式

- 顶级任务：`R1`, `R2`, `R3`, ...
- 一级子任务：`R1.1`, `R1.2`, ...
- 二级子任务：`R1.1.1`, `R1.1.2`, ...
- 支持多级嵌套

## 自动文件搜索

当不使用 `-f` 选项时，CLI 会自动在当前目录查找 `*TODO*.md` 文件：

```bash
# 当前目录有多个 TODO 文件时，使用第一个
mdtodo list

# 当前目录没有 TODO 文件时，会报错
# 错误: 未找到 TODO 文件，请使用 --file 选项指定文件路径
```

## 与 VSCode 插件配合

MDTODO CLI 与 VSCode 插件使用相同的 TODO 文件格式，可以互相配合使用：

```bash
# 在终端查看任务
mdtodo list -f path/to/TODO.md

# 在 VSCode 中打开同一文件进行编辑
```

## 常用场景

### 场景1：快速查看今日任务

```bash
cd path/to/project
mdtodo list
```

### 场景2：标记任务完成

```bash
mdtodo complete R5
```

### 场景3：添加新任务

```bash
mdtodo add -f TODO.md
```

### 场景4：生成任务报告

```bash
mdtodo stats --json > task_stats.json
```

## 测试

```bash
# 运行单元测试
cd cli
npm test
```

## 目录结构

```
cli/
├── src/
│   ├── cli.ts              # CLI 入口
│   └── core/
│       ├── parser/         # 解析器
│       ├── managers/       # 任务管理器
│       ├── services/       # 文件服务
│       └── types/          # 类型定义
├── tests/
│   └── core.test.ts        # 单元测试
├── package.json
├── tsconfig.json
└── jest.config.js
```

## 注意事项

1. **文件路径**：建议使用绝对路径或相对于当前工作目录的路径
2. **任务 ID**：CLI 使用精确匹配，不支持模糊匹配
3. **状态标记**：`[completed]` 和 `[in_progress]` 是标准状态标记，旧版的 `[Finished]` 和 `[Processing]` 仍兼容
4. **备份**：执行批量操作前建议备份 TODO 文件

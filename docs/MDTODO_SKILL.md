# mdtodo-edit Skill 开发

**目标**：将 MDTODO CLI 工具创建为 Claude Code Skill，支持在任意项目中直接使用 MDTODO 管理任务

> **Windows 用户必读**：
> - **禁止使用反斜杠 `\`**（如 `D:\path\to\file`）- 这会导致路径解析失败
> - **必须使用正斜杠 `/`**（如 `D:/path/to/file`）或 Git Bash 的 `/d/...` 格式
> - **推荐方式**：先执行 `cd /d/你的项目路径`，再运行 CLI 命令
> - **错误示例**（会失败）：`node .../cli.js list -f D:\Work\project\TODO.md`
> - **正确示例**（一次成功）：
>   ```bash
>   cd /d/Work/vscode-mdtodo
>   node ~/.claude/skills/mdtodo-edit/scripts/dist/cli.js list
>   ```

**成功标准**：
- skill 可在 Claude Code 中正常加载和使用
- 迁移后的 CLI 功能完整
- subagent 能一次执行成功，无需试错

**执行模式**：mdtodo-loop

---

## R1 创建 mdtodo-edit skill（已验证可正常工作） [in_progress]

创建 mdtodo-edit skill，放到 `~/.claude/skills/mdtodo-edit/` 目录

### R1.1 [completed]

创建 skill 目录结构和 SKILL.md 文档，参考 mdtodo_plan 的结构，完成后将详细报告写入[R1.1](./details/mdtodo-edit/R1.1_Task_Report.md)。

**依赖**：R1

**验证标准**：
- [x] `~/.claude/skills/mdtodo-edit/` 目录存在
- [x] SKILL.md 文档格式正确

##### R1.1.1 [completed]

执行 R1.1 任务：创建 skill 目录结构和 SKILL.md 文档，参考 mdtodo_plan 的结构，完成任务后将详细报告写入[R1.1.1](./details/mdtodo-edit/R1.1.1_Task_Report.md)。

**验证标准**:
- [x] `~/.claude/skills/mdtodo-edit/` 目录存在
- [x] SKILL.md 文档格式正确

##### R1.1.2 [completed]

审查 R1.1.1 的执行报告，验证 SKILL.md 是否格式正确、目录是否创建，完成任务后将详细报告写入[R1.1.2](./details/mdtodo-edit/R1.1.2_Task_Report.md)。

**审查标准**：
- [x] SKILL.md 文档格式正确
- [x] 目录结构符合 skill 要求
- [x] 包含完整的命令说明

##### R1.2.1 [completed]

执行 R1.2 任务：复制 CLI 核心文件到 scripts 目录，迁移 cli.js、package.json、tsconfig.json、核心模块到 `~/.claude/skills/mdtodo-edit/scripts/`，完成任务后将详细报告写入[R1.2.1](./details/mdtodo-edit/R1.2.1_Task_Report.md)。

**验证标准**:
- [x] scripts 目录包含所有必要文件
- [x] package.json 依赖正确

##### R1.2.3 [completed]

根据 R1.2.2 的审查意见，修正 scripts 目录不存在的问题，确保 CLI 核心文件正确复制到 `~/.claude/skills/mdtodo-edit/scripts/` 目录，完成任务后将详细报告写入[R1.2.3](./details/mdtodo-edit/R1.2.3_Task_Report.md)。

**审查意见**：
- scripts 目录不存在，文件未正确复制
- 需要重新执行复制操作

**验证标准**:
- [x] scripts 目录存在
- [x] dist/cli.js 存在
- [x] src/core 源代码存在

##### R1.2.4 [completed]

审查 R1.2.3 的执行报告，验证 scripts 目录是否正确创建、CLI 文件是否完整复制，完成任务后将详细报告写入[R1.2.4](./details/mdtodo-edit/R1.2.4_Task_Report.md)。

**审查标准**：
- [x] scripts 目录存在
- [x] CLI 核心文件完整

### R1.2 [completed]

复制 CLI 核心文件到 scripts 目录，迁移 cli.js、package.json、tsconfig.json、核心模块到 `~/.claude/skills/mdtodo-edit/scripts/`，完成后将详细报告写入[R1.2](./details/mdtodo-edit/R1.2_Task_Report.md)。

**依赖**：R1.1

**验证标准**：
- [x] scripts 目录包含所有必要文件
- [x] package.json 依赖正确

##### R1.3.1 [completed]

执行 R1.3 任务：优化 SKILL.md 文档，添加详细的使用示例和命令说明，确保 subagent 能一次作对，完成任务后将详细报告写入[R1.3.1](./details/mdtodo-edit/R1.3.1_Task_Report.md)。

**验证标准**:
- [x] SKILL.md 包含完整命令说明
- [x] subagent 可直接使用 skill

##### R1.3.2 [completed]

审查 R1.3.1 的执行报告，验证 SKILL.md 是否包含完整命令说明、subagent 是否可直接使用 skill，完成任务后将详细报告写入[R1.3.2](./details/mdtodo-edit/R1.3.2_Task_Report.md)。

**审查标准**：
- [x] SKILL.md 包含完整命令说明
- [x] subagent 可直接使用 skill（有条件，需 skill.json 完善）

##### R1.3.3 [completed]

根据 R1.3.2 的审查意见，创建 skill.json 文件以完善 skill 配置，确保 Claude Code 能正确识别和加载 skill，完成任务后将详细报告写入[R1.3.3](./details/mdtodo-edit/R1.3.3_Task_Report.md)。

**审查意见**：
- 缺少 skill.json 文件，影响 skill 被 Claude Code 正确识别
- 需要创建 skill.json 配置

**验证标准**:
- [x] skill.json 文件存在
- [x] skill.json 配置正确

##### R1.3.4 [completed]

审查 R1.3.3 的执行报告，验证 skill.json 是否正确创建、Claude Code 能否识别 skill，完成任务后将详细报告写入[R1.3.4](./details/mdtodo-edit/R1.3.4_Task_Report.md)。

**审查标准**：
- [x] skill.json 文件存在
- [x] skill.json 配置正确

### R1.3 [completed]

优化 SKILL.md 文档，添加详细的使用示例和命令说明，确保 subagent 能一次作对，完成后将详细报告写入[R1.3](./details/mdtodo-edit/R1.3_Task_Report.md)。

**依赖**：R1.2

**验证标准**：
- [x] SKILL.md 包含完整命令说明
- [x] subagent 可直接使用 skill

##### R1.4.1 [completed]

执行 R1.4 任务：测试 skill 功能，在任意目录使用 skill 执行 MDTODO 操作，验证增删改查功能正常，完成任务后将详细报告写入[R1.4.1](./details/mdtodo-edit/R1.4.1_Task_Report.md)。

**验证标准**:
- [x] 增删改查功能测试通过
- [x] 文件结构保持正确

**发现的问题**：
- 需要手动执行 npm install
- SKILL.md 中 add 命令描述与实际 CLI 不符

##### R1.4.2 [completed]

根据 R1.4.1 的测试结果，修复以下问题：
1. 在 skill 目录执行 npm install 安装依赖
2. 修正 SKILL.md 中 add 命令描述，使其与实际 CLI 行为一致
完成任务后将详细报告写入[R1.4.2](./details/mdtodo-edit/R1.4.2_Task_Report.md)。

**审查意见**：
- 需要手动执行 npm install
- SKILL.md 中 add 命令描述与实际 CLI 不符

**验证标准**:
- [x] npm 依赖已安装
- [x] SKILL.md add 命令描述已修正

---

### R1.4 [completed]

测试 skill 功能，在任意目录使用 skill 执行 MDTODO 操作，验证增删改查功能正常，完成后将详细报告写入[R1.4](./details/mdtodo-edit/R1.4_Task_Report.md)。

**依赖**：R1.3

**验证标准**：
- [x] 增删改查功能测试通过
- [x] 文件结构保持正确
- [x] R1.4.1 问题已修复

##### R1.4.1

执行 R1.4 任务：测试 skill 功能，在任意目录使用 skill 执行 MDTODO 操作，验证增删改查功能正常，完成任务后将详细报告写入[R1.4.1](./details/mdtodo-edit/R1.4.1_Task_Report.md)。

---

## R1 [completed]

创建 mdtodo-edit skill，放到 `~/.claude/skills/mdtodo-edit/` 目录

### 完成总结

| 子任务 | 状态 | 说明 |
|--------|------|------|
| R1.1 | ✅ | 创建 SKILL.md 文档 |
| R1.2 | ✅ | 复制 CLI 核心文件到 scripts 目录 |
| R1.3 | ✅ | 优化 SKILL.md + 创建 skill.json |
| R1.4 | ✅ | 功能测试通过，问题已修复 |

### 最终产物

```
~/.claude/skills/mdtodo-edit/
├── SKILL.md          # skill 使用文档
├── skill.json        # skill 配置
└── scripts/
    ├── dist/cli.js   # 编译后的 CLI
    ├── src/core/     # TypeScript 源码
    ├── package.json
    └── tsconfig.json
```

### 验证结果

- [x] skill 可在 Claude Code 中正常加载
- [x] 迁移后的 CLI 功能完整（9个命令全部测试通过）
- [x] subagent 能一次作对（SKILL.md 文档完善）

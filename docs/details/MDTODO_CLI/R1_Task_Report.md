# R1 任务规划报告

**顶级目标**：开发 cli 工具，基于已有的基础设施，实现对 MDTODO 的增删改查功能，要有充分的单元测试覆盖各种边缘情况，要复制一份真实的 MDTODO 文件作为测试数据。

## 任务分解

| 子任务 | 任务描述 | 依赖 | 状态 |
|--------|---------|------|------|
| R1.1 | 提取和重构核心模块，移除 vscode 依赖 | - | 待执行 |
| R1.2 | 创建 CLI 入口和命令框架 | R1.1 | 待执行 |
| R1.3 | 实现查询命令（list、get） | R1.2 | 待执行 |
| R1.4 | 实现添加命令（add、add-sub） | R1.3 | 待执行 |
| R1.5 | 实现删除命令（delete） | R1.4 | 待执行 |
| R1.6 | 实现更新命令（update、complete、start） | R1.5 | 待执行 |
| R1.7 | 复制测试数据 | - | 待执行 |
| R1.8 | 编写单元测试覆盖边缘情况 | R1.7 | 待执行 |
| R1.9 | 最终验证和文档完善 | R1.1-R1.8 | 待执行 |

## 依赖关系图

```
R1.1 ──> R1.2 ──> R1.3 ──> R1.4 ──> R1.5 ──> R1.6 ──> R1.9
              │                               ↑
              │                               │
              └──> R1.3 ──> R1.4 ──> R1.5 ──┘

R1.7 ───────────────────────────────> R1.8 ──> R1.9
```

## 分析结论

### 现有基础设施
- `src/parser/index.ts` - TodoParser 解析器
- `src/types/index.ts` - TodoTask、TextBlock 类型定义
- `src/services/fileService.ts` - 文件服务
- `src/providers/managers/taskFileManager.ts` - 任务管理器（需要重构）

### 需要改造的部分
1. 移除 vscode 依赖（Uri、workspace.fs 等）
2. 使用 Node.js 原生 fs 模块
3. 创建 CLI 入口（bin/mdtodo）
4. 命令行参数解析（推荐使用 commander.js）

### 测试策略
- 使用 `docs/20260120_MDTODO.md` 作为测试数据
- 测试覆盖：解析、增删改查、边界情况
- 使用 Jest + ts-jest 框架

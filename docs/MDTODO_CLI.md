## 开发必读

### CSS 样式文件说明

**正确的做法**：在 React 组件中导入 CSS，由 webpack 打包内联到 bundle.js。

```typescript
// TaskList.tsx
import './TaskList.css';
```

**禁止**：
- ~~`resources/style.css`~~ - 已被废弃，不再使用
- ~~`src/webview/bundle.css`~~ - 未被导入，不会生效

所有 webview 样式添加到 `src/webview/components/TaskList.css`。

### Webpack 构建产物

- `resources/bundle.js` - webpack 从 `src/webview/index.tsx` 打包生成（包含 React 代码 + TaskList.css 样式内联）
- `out/extension.js` - webpack 从 `src/extension.ts` 打包生成的扩展代码

- 必须使用 `npm.cmd` 而不是 `npm` 来执行 npm 命令，否则 windows 下会无效。

- 编译命令 `npm.cmd run compile`

- 运行 install.bat 打包脚本的正确方式（PowerShell）：
```powershell
powershell -ExecutionPolicy Bypass -Command "cd 'd:\Work\vscode-mdtodo'; .\install.bat"
```

- 历史 TODO 见：[历史 TODO](./20260120_MDTODO.md)

## 总需求

开发 cli 工具，基于已有的基础设施，实现对 MDTODO 的增删改查功能，要有充分的单元测试覆盖各种边缘情况，要复制一份真实的 MDTODO 文件 `docs\20260120_MDTODO.md` 作为测试数据，确保测试的真实性和有效性。

## R1 [completed]

开发 cli 工具，基于已有的基础设施，实现对 MDTODO 的增删改查功能，要有充分的单元测试覆盖各种边缘情况，要复制一份真实的 MDTODO 文件 `docs\20260120_MDTODO.md` 作为测试数据，确保测试的真实性和有效性。

**执行模式**：mdtodo-loop

**任务完成总结**：
- [x] R1.1 - 核心模块重构（移除 vscode 依赖）
- [x] R1.2 - CLI 入口和命令框架（commander.js）
- [x] R1.3 - 查询命令（list、get）
- [x] R1.4 - 添加命令（add、add-sub）
- [x] R1.5 - 删除命令（delete，支持级联删除）
- [x] R1.6 - 更新命令（update、complete、start）
- [x] R1.7 - 测试数据复制（真实 MDTODO 文件）
- [x] R1.8 - 单元测试覆盖（60/100%）
- [x] R1.9 - 最终验证和文档完善

**最终产物**：
- CLI 工具：`cli/src/cli.ts`
- 核心模块：`cli/src/core/`
- 测试套件：`cli/tests/core.test.ts`
- 使用文档：`docs/MDTODO_CLI_USAGE.md`

### R1.1 [completed]

提取和重构核心模块，将 vscode 依赖的代码改造为纯 Node.js 可用的核心库，移除 vscode 依赖，创建独立的 CLI 基础模块，完成后将详细报告写入[R1.1](./details/MDTODO_CLI/R1.1_Task_Report.md)。

**验证标准**：
- [x] 核心模块不依赖 vscode
- [x] Parser、FileService 可独立运行
- [x] 原有功能保持不变

##### R1.1.1 [completed]

执行 R1.1 任务：提取和重构核心模块，将 vscode 依赖的代码改造为纯 Node.js 可用的核心库，移除 vscode 依赖，创建独立的 CLI 基础模块，完成任务后将详细报告写入[R1.1.1](./details/MDTODO_CLI/R1.1.1_Task_Report.md)。

**验证标准**:
- [x] 核心模块不依赖 vscode
- [x] Parser、FileService 可独立运行
- [x] 原有功能保持不变

##### R1.1.2 [completed]

审查 R1.1.1 的执行报告，验证核心模块是否成功重构并移除 vscode 依赖，Parser、FileService 是否可独立运行，完成任务后将详细报告写入[R1.1.2](./details/MDTODO_CLI/R1.1.2_Task_Report.md)。

**审查标准**：
- [x] 核心模块不依赖 vscode
- [x] Parser、FileService 可独立运行
- [x] 原有功能保持不变

##### R1.2.1 [completed]

执行 R1.2 任务：创建 CLI 入口和命令框架，使用 commander.js 或类似库实现命令行参数解析，创建基础命令结构，完成任务后将详细报告写入[R1.2.1](./details/MDTODO_CLI/R1.2.1_Task_Report.md)。

**验证标准**：
- [x] CLI 可正常启动
- [x] 支持 --help 参数
- [x] 子命令框架已建立

##### R1.2.2 [completed]

审查 R1.2.1 的执行报告，验证 CLI 是否可正常启动、是否支持 --help 参数、子命令框架是否已建立，完成任务后将详细报告写入[R1.2.2](./details/MDTODO_CLI/R1.2.2_Task_Report.md)。

**审查标准**：
- [x] CLI 可正常启动
- [x] 支持 --help 参数
- [x] 子命令框架已建立

### R1.2 [completed]

创建 CLI 入口和命令框架，使用 commander.js 或类似库实现命令行参数解析，创建基础命令结构，完成后将详细报告写入[R1.2](./details/MDTODO_CLI/R1.2_Task_Report.md)。

**依赖**：R1.1

**验证标准**：
- [x] CLI 可正常启动
- [x] 支持 --help 参数
- [x] 子命令框架已建立

##### R1.3.1 [completed]

执行 R1.3 任务：实现查询命令（list、get），实现查看所有任务和按 ID 查询任务的功能，支持 JSON 格式输出，完成任务后将详细报告写入[R1.3.1](./details/MDTODO_CLI/R1.3.1_Task_Report.md)。

**验证标准**：
- [x] list 命令可列出所有任务
- [x] get 命令可按 ID 查询任务
- [x] 支持 JSON 输出格式

##### R1.3.2 [completed]

审查 R1.3.1 的执行报告，验证 list 命令是否可列出所有任务、get 命令是否可按 ID 查询任务、是否支持 JSON 输出格式，完成任务后将详细报告写入[R1.3.2](./details/MDTODO_CLI/R1.3.2_Task_Report.md)。

**审查标准**：
- [x] list 命令可列出所有任务
- [x] get 命令可按 ID 查询任务
- [x] 支持 JSON 输出格式

### R1.3 [completed]

实现查询命令（list、get），实现查看所有任务和按 ID 查询任务的功能，支持 JSON 格式输出，完成后将详细报告写入[R1.3](./details/MDTODO_CLI/R1.3_Task_Report.md)。

**依赖**：R1.2

**验证标准**：
- [x] list 命令可列出所有任务
- [x] get 命令可按 ID 查询任务
- [x] 支持 JSON 输出格式

##### R1.4.1 [completed]

执行 R1.4 任务：实现添加命令（add、add-sub），实现添加顶级任务和子任务的功能，自动生成任务 ID，完成任务后将详细报告写入[R1.4.1](./details/MDTODO_CLI/R1.4.1_Task_Report.md)。

**验证标准**:
- [x] add 命令可添加顶级任务
- [x] add-sub 命令可添加子任务
- [x] 任务 ID 自动生成且不重复

### R1.4 [completed]

实现添加命令（add、add-sub），实现添加顶级任务和子任务的功能，自动生成任务 ID，完成后将详细报告写入[R1.4](./details/MDTODO_CLI/R1.4_Task_Report.md)。

**依赖**：R1.3

**验证标准**：
- [x] add 命令可添加顶级任务
- [x] add-sub 命令可添加子任务
- [x] 任务 ID 自动生成且不重复

---

##### R1.5.1 [completed]

执行 R1.5 任务：实现删除命令（delete），实现按 ID 删除任务的功能，正确处理子任务级联，完成任务后将详细报告写入[R1.5.1](./details/MDTODO_CLI/R1.5.1_Task_Report.md)。

**验证标准**:
- [x] delete 命令可删除任务
- [x] 删除父任务时子任务正确处理
- [x] 文件格式保持正确

---

### R1.5 [completed]

实现删除命令（delete），实现按 ID 删除任务的功能，正确处理子任务级联，完成后将详细报告写入[R1.5](./details/MDTODO_CLI/R1.5_Task_Report.md)。

**依赖**：R1.4

**验证标准**：
- [x] delete 命令可删除任务
- [x] 删除父任务时子任务正确处理
- [x] 文件格式保持正确

---

##### R1.6.1 [completed]

执行 R1.6 任务：实现更新命令（update、complete、start），实现更新任务内容、标记完成、标记进行中的功能，完成任务后将详细报告写入[R1.6.1](./details/MDTODO_CLI/R1.6.1_Task_Report.md)。

**验证标准**:
- [x] update 命令可更新任务内容
- [x] complete 命令可标记任务完成
- [x] start 命令可标记任务进行中
- [x] 子任务不会被误匹配
- [x] 文件格式保持正确

---

### R1.6 [completed]

实现更新命令（update、complete、start），实现更新任务内容、标记完成、标记进行中的功能，完成后将详细报告写入[R1.6](./details/MDTODO_CLI/R1.6_Task_Report.md)。

**依赖**：R1.5

**验证标准**：
- [x] update 命令可更新任务内容
- [x] complete 命令可标记任务完成
- [x] start 命令可标记任务进行中

##### R1.7.1 [completed]

执行 R1.7 任务：复制测试数据，将 `docs\20260120_MDTODO.md` 复制到 cli 测试目录作为测试数据，确保测试场景真实有效，完成任务后将详细报告写入[R1.7.1](./details/MDTODO_CLI/R1.7.1_Task_Report.md)。

**验证标准**:
- [x] 测试文件已复制
- [x] 包含完整的任务结构
- [x] 包含各种边缘情况

### R1.7 [completed]

复制测试数据，将 `docs\20260120_MDTODO.md` 复制到 cli 测试目录作为测试数据，确保测试场景真实有效，完成后将详细报告写入[R1.7](./details/MDTODO_CLI/R1.7_Task_Report.md)。

**验证标准**：
- [x] 测试文件已复制
- [x] 包含完整的任务结构
- [x] 包含各种边缘情况

##### R1.8.1 [completed]

执行 R1.8 任务：编写单元测试覆盖边缘情况，编写充分的单元测试覆盖各种边界情况（空文件、多层嵌套、特殊字符等），完成任务后将详细报告写入[R1.8.1](./details/MDTODO_CLI/R1.8.1_Task_Report.md)。

**验证标准**：
- [x] 单元测试覆盖增删改查
- [x] 边界情况已覆盖
- [x] 测试通过率 100%

##### R1.8.2 [completed]

审查 R1.8.1 的执行报告，验证单元测试是否覆盖增删改查、边界情况是否已覆盖、测试通过率是否 100%，完成任务后将详细报告写入[R1.8.2](./details/MDTODO_CLI/R1.8.2_Task_Report.md)。

**审查标准**：
- [x] 单元测试覆盖增删改查
- [x] 边界情况已覆盖
- [x] 测试通过率 100%

### R1.8 [completed]

编写单元测试覆盖边缘情况，编写充分的单元测试覆盖各种边界情况（空文件、多层嵌套、特殊字符等），完成后将详细报告写入[R1.8](./details/MDTODO_CLI/R1.8_Task_Report.md)。

**依赖**：R1.7

**验证标准**：
- [x] 单元测试覆盖增删改查
- [x] 边界情况已覆盖
- [x] 测试通过率 100%

---

##### R1.9.1 [completed]

执行 R1.9 任务：最终验证和文档完善，运行完整测试套件，编写 CLI 使用文档，完成任务后将详细报告写入[R1.9.1](./details/MDTODO_CLI/R1.9.1_Task_Report.md)。

---

### R1.9 [completed]

最终验证和文档完善，运行完整测试套件，编写 CLI 使用文档，完成后将详细报告写入[R1.9](./details/MDTODO_CLI/R1.9_Task_Report.md)。

**依赖**：R1.1 - R1.8

**验证标准**：
- [x] 所有测试通过
- [x] CLI 文档完整
- [x] 可正常安装和使用

## 总需求

开发一个 VSCODE 插件，功能是渲染TODO文件为树形任务列表，支持Claude Code集成任务执行。
详见 [总需求](./details/20260120_MDTODO/R0_总需求说明.md) 。

重要说明：

必须使用 `npm.cmd` 而不是 `npm` 来执行 npm 命令，否则 windows 下会无效。

## R1 [completed]

深入调研 VSCODE 插件开发相关知识，包括联网调研，形成调研报告。
报告写入 [R1](./details/20260120_MDTODO/R1_VSCODE_PLUGIN_RESEARCH.md) 。

## R2 [completed]

根据R1调研结果，规划VSCODE插件的开发阶段和模块分解。
规划文档写入 [R2](./details/20260120_MDTODO/R2_开发规划.md) 。

## R3 [completed]

根据R2的规划，编写每个阶段的详细执行计划。
执行计划写入 [R3](./details/20260120_MDTODO/R3_阶段计划.md) 。

### R3.1 [completed]

第1阶段详细执行计划：项目初始化与基础框架。
计划写入 [R3.1](./details/20260120_MDTODO/R3.1_阶段一计划.md) 。

### R3.2 [completed]

第2阶段详细执行计划：核心TODO列表功能。
计划写入 [R3.2](./details/20260120_MDTODO/R3.2_阶段二计划.md) 。

### R3.3 [completed]

第3阶段详细执行计划：文件读写与状态同步。
计划写入 [R3.3](./details/20260120_MDTODO/R3.3_阶段三计划.md) 。

### R3.4 [completed]

第4阶段详细执行计划：Claude Code集成与任务执行。
计划写入 [R3.4](./details/20260120_MDTODO/R3.4_阶段四计划.md) 。

### R3.5 [completed]

第5阶段详细执行计划：测试优化与功能完善。
计划写入 [R3.5](./details/20260120_MDTODO/R3.5_阶段五计划.md) 。

## R4.1 [completed]

执行R3.1的第1阶段计划：项目初始化与基础框架。
执行日志写入 [R4.1](./details/20260120_MDTODO/R4.1_阶段一执行.md) 。

### R4.1.1 [completed]

阶段一功能测试：插件加载与命令注册测试。
测试结果写入 [R4.1.1](./details/20260120_MDTODO/R4.1.1_阶段一测试.md) 。

### R4.1.2 [completed]

阶段一问题修复：如R4.1.1测试发现问题，在此修复。
修复记录写入 [R4.1.2](./details/20260120_MDTODO/R4.1.2_阶段一修复.md) 。

## R4.2 [completed]

执行R3.2的第2阶段计划：核心TODO列表功能。
执行日志写入 [R4.2](./details/20260120_MDTODO/R4.2_阶段二执行.md) 。

### R4.2.1 [completed]

阶段二功能测试：TreeView显示与解析功能测试。
测试结果写入 [R4.2.1](./details/20260120_MDTODO/R4.2.1_阶段二测试.md) 。

### R4.2.2 [completed]

阶段二问题修复：如R4.2.1测试发现问题，在此修复。
修复记录写入 [R4.2.2](./details/20260120_MDTODO/R4.2.2_阶段二修复.md) 。

## R4.3 [completed]

执行R3.3的第3阶段计划：文件读写与状态同步。
执行日志写入 [R4.3](./details/20260120_MDTODO/R4.3_阶段三执行.md) 。

### R4.3.1 [completed]

阶段三功能测试：文件读写与状态同步测试。
测试结果写入 [R4.3.1](./details/20260120_MDTODO/R4.3.1_阶段三测试.md) 。

### R4.3.2 [completed]

阶段三问题修复：如R4.3.1测试发现问题，在此修复。
修复记录写入 [R4.3.2](./details/20260120_MDTODO/R4.3.2_阶段三修复.md) 。

## R4.4 [completed]

执行R3.4的第4阶段计划：Claude Code集成与任务执行。
执行日志写入 [R4.4](./details/20260120_MDTODO/R4.4_阶段四执行.md) 。

### R4.4.1 [completed]

阶段四功能测试：Claude Code调用与任务执行测试。
测试结果写入 [R4.4.1](./details/20260120_MDTODO/R4.4.1_阶段四测试.md) 。

### R4.4.2 [completed]

阶段四问题修复：如R4.4.1测试发现问题，在此修复。
修复记录写入 [R4.4.2](./details/20260120_MDTODO/R4.4.2_阶段四修复.md) 。

## R4.5 [completed]

执行R3.5的第5阶段计划：测试优化与功能完善。
执行日志写入 [R4.5](./details/20260120_MDTODO/R4.5_阶段五执行.md) 。

### R4.5.1 [completed]

阶段五功能测试：完整功能集成测试与用户体验测试。
测试结果写入 [R4.5.1](./details/20260120_MDTODO/R4.5.1_阶段五测试.md) 。

### R4.5.2 [completed]

阶段五问题修复：如R4.5.1测试发现问题，在此修复。
修复记录写入 [R4.5.2](./details/20260120_MDTODO/R4.5.2_阶段五修复.md) 。


## R5 [completed]

将TreeView侧边栏改为独立Webview面板视图。修改记录写入 [R5](./details/20260120_MDTODO/R5_独立视图实现.md) 。


## R6 [completed]

1. 现在的 webview 缺少增加TODO，删除TODO，增加子TODO 等方法。2. 默认应当全部展开 TODO，并且增加一个全部展开和全部收起的按钮。
执行记录写入 [R6](./details/20260120_MDTODO/R6_功能增强执行.md) 。

## R7 [completed]

点击 Cluade 执行的时候，claude 这个命令行窗口的工作路径应该是当前 vscode 窗口的路径，传入的 TODO 路径应当是一个相对路径。
执行记录写入 [R7](./details/20260120_MDTODO/R7_工作路径与相对路径执行.md) 。

## R8 [completed]

1. "添加任务" 的按钮应当随时可见而不是仅仅处于 webview 的最上边，可以考虑使其浮动，这样不管滚动到哪里都可以添加。
2. 点击"+子任务" 或者 "添加任务" 后，自动滚动到对应的子任务或者任务，聚焦并使其处于编辑模式。

执行记录写入 [R8](./details/20260120_MDTODO/R8_功能增强执行.md) 。

## R9

删除功能还是有误删的问题，应当将 `doc\review\20260120_MDTODO.md` 作为例子，复制一份去做单元测试，测试各种边界情况下的删除功能，确保真正鲁棒地解析和编辑.md文件，充分测试边界情况。

## R10

Claude 执行按钮应该要加防抖，设置为 0.5s 的冷却，避免抖动导致多次执行。

## R11

应当有筛选的功能


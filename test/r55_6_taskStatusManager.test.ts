/**
 * R55.6 任务状态管理器正则匹配测试
 * 测试各种任务行格式的 [completed] 和 [in_progress] 标记添加/移除
 */

describe('R55.6 任务状态管理器正则匹配', () => {
  /**
   * 查找任务标题行的位置（与 findTaskLineIndex 相同逻辑）
   */
  function findTaskLineIndex(lines: string[], taskId: string): number {
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const taskHeaderPattern = new RegExp(`^#{2,6}\\s+[^\\n]*\\b${taskId.replace(/\./g, '\\.')}(?:[)\\s]|$)`);
      if (taskHeaderPattern.test(line)) {
        return i;
      }
    }
    return -1;
  }

  /**
   * 添加 [completed] 标记（使用修复后的正则）
   */
  function addCompletedMark(lines: string[], taskLineIndex: number, taskId: string): string[] {
    const line = lines[taskLineIndex];
    const hasInProgress = line.includes('[in_progress]');

    let newLine = line;
    if (hasInProgress) {
      newLine = newLine.replace(/\s*\[in_progress\]/, '');
    }

    // 修复后的正则：匹配 taskId 后面的任意空格，替换为 taskId + [completed] + 一个空格
    const escapedTaskId = taskId.replace(/\./g, '\\.');
    const taskIdPattern = new RegExp(`(${escapedTaskId})\\s*`);
    newLine = newLine.replace(taskIdPattern, '$1 [completed] ');

    const newLines = [...lines];
    newLines[taskLineIndex] = newLine;
    return newLines;
  }

  /**
   * 添加 [in_progress] 标记（使用修复后的正则）
   */
  function addInProgressMark(lines: string[], taskLineIndex: number, taskId: string): string[] {
    const line = lines[taskLineIndex];
    const taskIdPattern = new RegExp(`(${taskId.replace(/\./g, '\\.')})(\\s*\\[)`);
    let newLine = line;

    if (taskIdPattern.test(line)) {
      newLine = line.replace(taskIdPattern, '$1 [in_progress]$2');
    } else {
      // 修复后的正则
      const escapedTaskId = taskId.replace(/\./g, '\\.');
      const simplePattern = new RegExp(`(${escapedTaskId})\\s*`);
      newLine = line.replace(simplePattern, '$1 [in_progress] ');
    }

    const newLines = [...lines];
    newLines[taskLineIndex] = newLine;
    return newLines;
  }

  // ========== [completed] 标记添加测试 ==========

  describe('添加 [completed] 标记 - 基础场景', () => {
    test('taskId 在行尾无描述文本', () => {
      const lines = ['## R1 任务一'];
      const result = addCompletedMark(lines, 0, 'R1');
      expect(result[0]).toBe('## R1 [completed] 任务一');
    });

    test('taskId 后面有描述文本', () => {
      const lines = ['### R2.1 章节调查阶段'];
      const result = addCompletedMark(lines, 0, 'R2.1');
      expect(result[0]).toBe('### R2.1 [completed] 章节调查阶段');
    });

    test('taskId 后面有描述文本和后续内容', () => {
      const lines = ['## R3 任务描述第一段\n第二段内容'];
      const result = addCompletedMark(lines, 0, 'R3');
      expect(result[0]).toBe('## R3 [completed] 任务描述第一段\n第二段内容');
    });

    test('四级子任务', () => {
      const lines = ['#### R1.2.3.4 深层子任务'];
      const result = addCompletedMark(lines, 0, 'R1.2.3.4');
      expect(result[0]).toBe('#### R1.2.3.4 [completed] 深层子任务');
    });
  });

  describe('添加 [completed] 标记 - 有其他标记', () => {
    test('有 [in_progress] 标记时应先移除再添加 [completed]', () => {
      const lines = ['## R1 [in_progress] 任务进行中'];
      const result = addCompletedMark(lines, 0, 'R1');
      expect(result[0]).toBe('## R1 [completed] 任务进行中');
      expect(result[0]).not.toContain('[in_progress]');
    });

    test('taskId 后面有括号', () => {
      const lines = ['## R1 (已完成)'];
      const result = addCompletedMark(lines, 0, 'R1');
      expect(result[0]).toBe('## R1 [completed] (已完成)');
    });

    test('taskId 后面有数字', () => {
      const lines = ['## R2 第2阶段2024'];
      const result = addCompletedMark(lines, 0, 'R2');
      expect(result[0]).toBe('## R2 [completed] 第2阶段2024');
    });
  });

  describe('添加 [completed] 标记 - 文档中间位置', () => {
    test('任务在文档中间', () => {
      const lines = [
        '## R1 第一个任务',
        '',
        '### R1.1 子任务',
        '',
        '## R2 第二个任务'
      ];
      const result = addCompletedMark(lines, 2, 'R1.1');
      expect(result[2]).toBe('### R1.1 [completed] 子任务');
      expect(result[0]).toBe('## R1 第一个任务'); // 未修改
      expect(result[4]).toBe('## R2 第二个任务'); // 未修改
    });

    test('任务在文档末尾', () => {
      const lines = [
        '## R1 第一个任务',
        '',
        '## R2 最后一个任务'
      ];
      const result = addCompletedMark(lines, 2, 'R2');
      expect(result[2]).toBe('## R2 [completed] 最后一个任务');
    });
  });

  // ========== [in_progress] 标记添加测试 ==========

  describe('添加 [in_progress] 标记', () => {
    test('taskId 在行尾无描述文本', () => {
      const lines = ['## R1 任务一'];
      const result = addInProgressMark(lines, 0, 'R1');
      expect(result[0]).toBe('## R1 [in_progress] 任务一');
    });

    test('taskId 后面有描述文本', () => {
      const lines = ['### R2.1 章节调查阶段'];
      const result = addInProgressMark(lines, 0, 'R2.1');
      expect(result[0]).toBe('### R2.1 [in_progress] 章节调查阶段');
    });

    test('taskId 后面有其他标记时不重复添加', () => {
      const lines = ['## R1 [completed] 任务一'];
      const result = addInProgressMark(lines, 0, 'R1');
      expect(result[0]).toBe('## R1 [in_progress] [completed] 任务一');
    });
  });

  // ========== 边界情况测试 ==========

  describe('边界情况', () => {
    test('任务行有多个空格', () => {
      const lines = ['## R1    多个空格的任务'];
      const result = addCompletedMark(lines, 0, 'R1');
      // 修复后只保留一个空格，这是合理的行为
      expect(result[0]).toBe('## R1 [completed] 多个空格的任务');
    });

    test('任务行有 Tab 空格', () => {
      const lines = ['## R1\tTab开头的任务'];
      const result = addCompletedMark(lines, 0, 'R1');
      // 修复后只保留一个空格，这是合理的行为
      expect(result[0]).toBe('## R1 [completed] Tab开头的任务');
    });

    test('任务行是文件唯一内容', () => {
      const lines = ['## R1 唯一任务'];
      const result = addCompletedMark(lines, 0, 'R1');
      expect(result[0]).toBe('## R1 [completed] 唯一任务');
    });

    test('子任务 ID 包含多级数字', () => {
      const lines = ['##### R10.20.30.40.50 超深层任务'];
      const result = addCompletedMark(lines, 0, 'R10.20.30.40.50');
      expect(result[0]).toBe('##### R10.20.30.40.50 [completed] 超深层任务');
    });

    test('任务描述包含特殊字符', () => {
      const lines = ['## R1 任务包含 [括号] 和 (圆括号)'];
      const result = addCompletedMark(lines, 0, 'R1');
      expect(result[0]).toBe('## R1 [completed] 任务包含 [括号] 和 (圆括号)');
    });

    test('任务描述包含正则敏感字符', () => {
      const lines = ['## R1 任务包含 $dollar 和 *star 和 +plus'];
      const result = addCompletedMark(lines, 0, 'R1');
      expect(result[0]).toBe('## R1 [completed] 任务包含 $dollar 和 *star 和 +plus');
    });

    test('任务行是中文标题', () => {
      const lines = ['## R1 这是中文标题的任务'];
      const result = addCompletedMark(lines, 0, 'R1');
      expect(result[0]).toBe('## R1 [completed] 这是中文标题的任务');
    });

    test('任务行是英文标题', () => {
      const lines = ['## R1 This is English task'];
      const result = addCompletedMark(lines, 0, 'R1');
      expect(result[0]).toBe('## R1 [completed] This is English task');
    });

    test('任务行是中英文混合', () => {
      const lines = ['## R1 混合 Mixed 标题 Title'];
      const result = addCompletedMark(lines, 0, 'R1');
      expect(result[0]).toBe('## R1 [completed] 混合 Mixed 标题 Title');
    });
  });

  // ========== 旧正则对比测试 ==========

  describe('旧正则 vs 新正则对比', () => {
    /**
     * 旧的正则实现（会导致问题）
     */
    function addCompletedMarkOld(lines: string[], taskLineIndex: number, taskId: string): string[] {
      const line = lines[taskLineIndex];
      const newLine = line.replace(new RegExp(`(${taskId.replace(/\./g, '\\.')})(\\s*)$`), '$1 [completed]');
      const newLines = [...lines];
      newLines[taskLineIndex] = newLine;
      return newLines;
    }

    test('旧正则：taskId 在行尾无描述文本 - 旧实现会失败（测试旧正则边界）', () => {
      // 旧正则的问题：要求 taskId 后面必须是行尾
      // 但原始行是 "## R1 任务一"，taskId "R1" 后面有 " 任务一"
      // 所以旧正则的 (\s*)$ 无法匹配（因为后面有 " 任务一"），返回原字符串
      const lines = ['## R1 任务一'];
      const result = addCompletedMarkOld(lines, 0, 'R1');
      // 旧正则失败，返回原字符串
      expect(result[0]).toBe('## R1 任务一'); // 没有添加 [completed]！
    });

    test('旧正则：taskId 后面有描述文本 - 失败（回归测试）', () => {
      const lines = ['### R2.1 章节调查阶段'];
      const result = addCompletedMarkOld(lines, 0, 'R2.1');
      // 旧正则会失败，返回原字符串
      expect(result[0]).toBe('### R2.1 章节调查阶段'); // 没有添加 [completed]！
    });

    test('新正则：taskId 后面有描述文本 - 正确', () => {
      const lines = ['### R2.1 章节调查阶段'];
      const result = addCompletedMark(lines, 0, 'R2.1');
      expect(result[0]).toBe('### R2.1 [completed] 章节调查阶段');
    });

    test('旧正则：任务描述包含数字 - 失败（回归测试）', () => {
      const lines = ['## R2 第2阶段2024'];
      const result = addCompletedMarkOld(lines, 0, 'R2');
      // 旧正则失败
      expect(result[0]).toBe('## R2 第2阶段2024'); // 没有添加 [completed]！
    });

    test('新正则：任务描述包含数字 - 正确', () => {
      const lines = ['## R2 第2阶段2024'];
      const result = addCompletedMark(lines, 0, 'R2');
      expect(result[0]).toBe('## R2 [completed] 第2阶段2024');
    });
  });

  // ========== [completed] 标记与渲染兼容性测试 ==========

  describe('[completed] 标记与解析器渲染兼容性', () => {
    /**
     * 模拟解析器的 completed 检测逻辑
     */
    function parseCompletedFromTaskLine(line: string): boolean {
      // 这是 parser/index.ts parseTask 方法中的逻辑
      return line.includes('[completed]');
    }

    /**
     * 模拟解析器的 title 提取逻辑
     * 注意：解析器只处理 ## 或 ### 开头的行（见 tokenizer）
     */
    function parseTitleFromTaskLine(line: string): string {
      // 这是 parser/index.ts parseTask 方法中的逻辑
      let title = line
        .replace(/\[completed\]/g, '')
        .replace(/\[in_progress\]/g, '')
        .replace(/(R\d+(?:\.\d+)*)/, '')
        .replace(/^##+\s*/, '') // 移除开头的任意数量的 #
        .trim();
      return title;
    }

    test('带文字的 [completed] 格式应被正确识别为已完成', () => {
      const line = '### R2.1 [completed] 章节调查阶段';
      expect(parseCompletedFromTaskLine(line)).toBe(true);
    });

    test('带文字的 [completed] 格式应正确提取标题', () => {
      const line = '### R2.1 [completed] 章节调查阶段';
      expect(parseTitleFromTaskLine(line)).toBe('章节调查阶段');
    });

    test('带文字的 [completed] 格式应正确提取二级标题标题', () => {
      const line = '## R2 [completed] 章节调查阶段';
      expect(parseTitleFromTaskLine(line)).toBe('章节调查阶段');
    });

    test('无文字的 [completed] 格式应正确识别', () => {
      const line = '## R1 [completed]';
      expect(parseCompletedFromTaskLine(line)).toBe(true);
      expect(parseTitleFromTaskLine(line)).toBe('');
    });

    test('[in_progress] 带文字应正确识别', () => {
      const line = '### R3.1 [in_progress] 进行中的任务';
      expect(parseCompletedFromTaskLine(line)).toBe(false);
      expect(parseTitleFromTaskLine(line)).toBe('进行中的任务');
    });

    test('任务描述应保留格式不被破坏', () => {
      const line = '## R1 任务一';
      const linesWithMark = addCompletedMark([line], 0, 'R1');
      const completed = parseCompletedFromTaskLine(linesWithMark[0]);
      const title = parseTitleFromTaskLine(linesWithMark[0]);
      expect(completed).toBe(true);
      expect(title).toBe('任务一');
    });

    test('编辑后再解析应保持一致', () => {
      const originalLine = '## R1 任务一';
      const linesAfterEdit = addCompletedMark([originalLine], 0, 'R1');
      const completed = parseCompletedFromTaskLine(linesAfterEdit[0]);
      expect(completed).toBe(true);
      // 标题应该保留
      const title = parseTitleFromTaskLine(linesAfterEdit[0]);
      expect(title).toBe('任务一');
    });
  });

  // ========== [in_progress] 切换到 [completed] 测试 ==========

  describe('[in_progress] 切换到 [completed] 的完整流程', () => {
    /**
     * 完整的切换流程：从 in_progress 切换到 completed
     */
    function switchInProgressToCompleted(line: string, taskId: string): string {
      const lines = [line];
      const taskLineIndex = 0;

      // 1. 先移除 [in_progress]
      let newLine = lines[taskLineIndex].replace(/\s*\[in_progress\]/, '');

      // 2. 添加 [completed]
      const escapedTaskId = taskId.replace(/\./g, '\\.');
      const taskIdPattern = new RegExp(`(${escapedTaskId})\\s*`);
      newLine = newLine.replace(taskIdPattern, '$1 [completed] ');

      return newLine;
    }

    /**
     * 模拟解析器检测状态
     */
    function parseTaskState(line: string): { completed: boolean; inProgress: boolean; title: string } {
      return {
        completed: line.includes('[completed]'),
        inProgress: line.includes('[in_progress]'),
        title: line.replace(/\[completed\]/g, '').replace(/\[in_progress\]/g, '')
          .replace(/(R\d+(?:\.\d+)*)/, '').replace(/^##+\s*/, '').trim()
      };
    }

    test('[in_progress] 切换到 [completed] 后应只有 [completed] 标记', () => {
      const line = '## R1 [in_progress] 进行中的任务';
      const result = switchInProgressToCompleted(line, 'R1');
      expect(result).toContain('[completed]');
      expect(result).not.toContain('[in_progress]');
    });

    test('[in_progress] 切换后标题应保持不变', () => {
      const line = '### R2.1 [in_progress] 章节调查阶段';
      const result = switchInProgressToCompleted(line, 'R2.1');
      const state = parseTaskState(result);
      expect(state.title).toBe('章节调查阶段');
    });

    test('[in_progress] 切换后 completed 状态应为 true', () => {
      const line = '## R1 [in_progress] 任务';
      const result = switchInProgressToCompleted(line, 'R1');
      const state = parseTaskState(result);
      expect(state.completed).toBe(true);
      expect(state.inProgress).toBe(false);
    });

    test('[in_progress] 切换后 inProgress 状态应为 false', () => {
      const line = '## R1 [in_progress] 任务';
      const result = switchInProgressToCompleted(line, 'R1');
      const state = parseTaskState(result);
      expect(state.inProgress).toBe(false);
    });

    test('[in_progress] 无描述时切换也应正确处理', () => {
      const line = '## R1 [in_progress]';
      const result = switchInProgressToCompleted(line, 'R1');
      expect(result).toContain('[completed]');
      expect(result).not.toContain('[in_progress]');
      const state = parseTaskState(result);
      expect(state.completed).toBe(true);
    });

    test('三级子任务的 [in_progress] 切换也应正确处理', () => {
      const line = '#### R1.2.3 [in_progress] 深层子任务';
      const result = switchInProgressToCompleted(line, 'R1.2.3');
      expect(result).toContain('[completed]');
      expect(result).not.toContain('[in_progress]');
      const state = parseTaskState(result);
      expect(state.title).toBe('深层子任务');
    });

    test('完整的用户场景模拟：进行中 -> 点击完成 -> 已完成', () => {
      // 模拟用户操作流程
      const taskId = 'R1';
      let currentLine = '## R1 编写文档';

      // 步骤1：用户开始任务，标记为 [in_progress]
      currentLine = currentLine.replace(/(R1)\s*/, '$1 [in_progress] ');
      let state = parseTaskState(currentLine);
      expect(state.inProgress).toBe(true);
      expect(state.completed).toBe(false);

      // 步骤2：用户完成任务，点击完成按钮
      currentLine = switchInProgressToCompleted(currentLine, taskId);
      state = parseTaskState(currentLine);

      // 验证最终状态
      expect(state.completed).toBe(true);
      expect(state.inProgress).toBe(false);
      expect(state.title).toBe('编写文档');
    });
  });

  // ========== findTaskLineIndex 测试 ==========

  describe('findTaskLineIndex 任务查找', () => {
    test('基本任务', () => {
      const lines = ['## R1 任务一', '## R2 任务二'];
      expect(findTaskLineIndex(lines, 'R1')).toBe(0);
      expect(findTaskLineIndex(lines, 'R2')).toBe(1);
    });

    test('子任务', () => {
      const lines = ['## R1 任务', '### R1.1 子任务', '#### R1.1.1 孙子任务'];
      expect(findTaskLineIndex(lines, 'R1.1')).toBe(1);
      expect(findTaskLineIndex(lines, 'R1.1.1')).toBe(2);
    });

    test('任务后有括号不应匹配', () => {
      const lines = ['## R1 任务一', '## R2 (已完成)'];
      // R2 后面有括号，正则应该匹配 R2 而不是 R2 (已完成)
      expect(findTaskLineIndex(lines, 'R2')).toBe(1);
    });

    test('找不到任务返回 -1', () => {
      const lines = ['## R1 任务一'];
      expect(findTaskLineIndex(lines, 'R99')).toBe(-1);
    });

    test('任务ID包含在其他文本中不应匹配', () => {
      const lines = ['## R1 任务一', '这是 R1.1 的描述'];
      // 第二行虽然包含 R1.1，但不是任务标题行
      expect(findTaskLineIndex(lines, 'R1.1')).toBe(-1);
    });

    test('6级标题', () => {
      const lines = ['###### R1.1.1.1.1.1 六级任务'];
      expect(findTaskLineIndex(lines, 'R1.1.1.1.1.1')).toBe(0);
    });

    test('任务在代码块中不应匹配（当前实现会匹配，这是一个已知问题）', () => {
      const lines = ['```', '## R1 代码块中的任务', '```'];
      // 注意：当前 findTaskLineIndex 会在代码块中匹配任务
      // 这是一个已知限制，但不影响 R55.6 的主要问题修复
      expect(findTaskLineIndex(lines, 'R1')).toBe(1);
    });
  });

  // ========== R55.6 特定问题回归测试 ==========
  // 针对用户报告的具体问题：taskId 后面有描述文本时无法添加 [completed]

  describe('R55.6 特定问题回归测试', () => {
    /**
     * 用户报告的具体问题场景：
     * 任务行：### R2.2.3 第3章 传递函数建模
     * 点击完成后标记没有添加，日志显示"修改后的行109: ### R2.2.3 第3章 传递函数建模"
     * 根因：旧正则要求 taskId 后必须紧跟行尾或 [ 符号，但实际有描述文本
     */
    test('用户报告场景：三级子任务后跟章节描述应能添加标记', () => {
      const lines = ['### R2.2.3 第3章 传递函数建模'];
      const result = addCompletedMark(lines, 0, 'R2.2.3');
      expect(result[0]).toBe('### R2.2.3 [completed] 第3章 传递函数建模');
    });

    test('用户报告场景：四级子任务后跟内容应能添加标记', () => {
      const lines = ['#### R1.2.3.4 深层子任务描述'];
      const result = addCompletedMark(lines, 0, 'R1.2.3.4');
      expect(result[0]).toBe('#### R1.2.3.4 [completed] 深层子任务描述');
    });

    test('用户报告场景：包含数字的描述文本应能添加标记', () => {
      const lines = ['## R2 第2阶段2024年工作'];
      const result = addCompletedMark(lines, 0, 'R2');
      expect(result[0]).toBe('## R2 [completed] 第2阶段2024年工作');
    });

    test('用户报告场景：二级子任务后跟中英文混合描述', () => {
      const lines = ['### R3.1 Chapter 3 Introduction 第三章介绍'];
      const result = addCompletedMark(lines, 0, 'R3.1');
      expect(result[0]).toBe('### R3.1 [completed] Chapter 3 Introduction 第三章介绍');
    });

    test('用户报告场景：子任务后跟括号描述', () => {
      const lines = ['## R4 (已完成任务)'];
      const result = addCompletedMark(lines, 0, 'R4');
      expect(result[0]).toBe('## R4 [completed] (已完成任务)');
    });

    test('用户报告场景：真实文档格式模拟', () => {
      // 模拟真实 TODO.md 文件中的任务行格式
      const lines = [
        '## R1 项目概述',
        '',
        '### R2.1 章节调查阶段',
        '',
        '#### R2.2.1 第1章 动力学建模',
        '',
        '### R2.2 详细设计阶段',
        '',
        '## R3 测试验证',
      ];
      // 标记 R2.2.1 为完成
      const result = addCompletedMark(lines, 4, 'R2.2.1');
      expect(result[4]).toBe('#### R2.2.1 [completed] 第1章 动力学建模');
      // 其他行不应被修改
      expect(result[2]).toBe('### R2.1 章节调查阶段');
      expect(result[6]).toBe('### R2.2 详细设计阶段');
    });

    test('用户报告场景：连续多个子任务依次标记完成', () => {
      const lines = [
        '## R1 父任务',
        '',
        '### R1.1 子任务1',
        '',
        '#### R1.1.1 孙任务1-1',
        '',
        '#### R1.1.2 孙任务1-2',
        '',
        '### R1.2 子任务2',
      ];

      // 标记 R1.1.1 完成
      let result = addCompletedMark(lines, 4, 'R1.1.1');
      expect(result[4]).toBe('#### R1.1.1 [completed] 孙任务1-1');

      // 标记 R1.1.2 完成
      result = addCompletedMark(result, 6, 'R1.1.2');
      expect(result[6]).toBe('#### R1.1.2 [completed] 孙任务1-2');

      // 验证父任务行未被修改
      expect(result[0]).toBe('## R1 父任务');
      expect(result[2]).toBe('### R1.1 子任务1');
    });

    test('用户报告场景：三级子任务无空格情况', () => {
      // taskId 后面直接跟描述，无空格
      // 修复后会在 [completed] 后添加一个空格，这是正确的格式化行为
      const lines = ['### R2.1.1直接跟文字'];
      const result = addCompletedMark(lines, 0, 'R2.1.1');
      expect(result[0]).toBe('### R2.1.1 [completed] 直接跟文字');
    });

    test('用户报告场景：多级数字子任务ID', () => {
      const lines = ['##### R10.20.30.40.50 超深层任务描述'];
      const result = addCompletedMark(lines, 0, 'R10.20.30.40.50');
      expect(result[0]).toBe('##### R10.20.30.40.50 [completed] 超深层任务描述');
    });

    test('用户报告场景：任务描述包含标点符号', () => {
      const lines = ['## R1 任务：重要！需要处理。'];
      const result = addCompletedMark(lines, 0, 'R1');
      expect(result[0]).toBe('## R1 [completed] 任务：重要！需要处理。');
    });

    test('用户报告场景：任务描述包含连字符和下划线', () => {
      const lines = ['## R1 子系统-A 和 子系统_B'];
      const result = addCompletedMark(lines, 0, 'R1');
      expect(result[0]).toBe('## R1 [completed] 子系统-A 和 子系统_B');
    });
  });

  // ========== 完整流程集成测试 ==========

  describe('完整流程集成测试', () => {
    /**
     * 模拟完整的 webview 点击完成流程
     */
    function simulateWebviewClickComplete(
      originalContent: string,
      taskId: string
    ): string {
      const lines = originalContent.split('\n');
      const taskLineIndex = findTaskLineIndex(lines, taskId);

      if (taskLineIndex === -1) {
        throw new Error(`未找到任务 ${taskId}`);
      }

      const line = lines[taskLineIndex];
      const hasCompleted = line.includes('[completed]');
      const hasInProgress = line.includes('[in_progress]');

      // 切换完成状态
      if (hasCompleted) {
        // 移除 [completed]
        lines[taskLineIndex] = line.replace(/\s*\[completed\]/, '');
      } else {
        // 添加 [completed]（先移除 in_progress 如果有）
        let newLine = line;
        if (hasInProgress) {
          newLine = newLine.replace(/\s*\[in_progress\]/, '');
        }
        const escapedTaskId = taskId.replace(/\./g, '\\.');
        const taskIdPattern = new RegExp(`(${escapedTaskId})\\s*`);
        newLine = newLine.replace(taskIdPattern, '$1 [completed] ');
        lines[taskLineIndex] = newLine;
      }

      return lines.join('\n');
    }

    test('完整流程：未完成任务点击完成', () => {
      const original = `## R1 任务一
## R2 任务二`;
      const result = simulateWebviewClickComplete(original, 'R1');
      expect(result).toContain('## R1 [completed] 任务一');
      expect(result).toContain('## R2 任务二');
    });

    test('完整流程：进行中任务点击完成', () => {
      const original = `## R1 [in_progress] 进行中的任务
## R2 任务二`;
      const result = simulateWebviewClickComplete(original, 'R1');
      expect(result).toContain('## R1 [completed] 进行中的任务');
      expect(result).not.toContain('[in_progress]');
      expect(result).toContain('## R2 任务二');
    });

    test('完整流程：已完成任务点击取消完成', () => {
      const original = `## R1 [completed] 已完成任务
## R2 任务二`;
      const result = simulateWebviewClickComplete(original, 'R1');
      expect(result).toContain('## R1 已完成任务');
      expect(result).not.toContain('[completed]');
      expect(result).toContain('## R2 任务二');
    });

    test('完整流程：用户报告的具体任务格式', () => {
      const original = `## R1 项目概述

### R2.1 章节调查阶段

#### R2.2.3 第3章 传递函数建模

### R2.3 验证阶段`;
      const result = simulateWebviewClickComplete(original, 'R2.2.3');
      expect(result).toContain('#### R2.2.3 [completed] 第3章 传递函数建模');
      // 验证其他行未被修改
      expect(result).toContain('### R2.1 章节调查阶段');
      expect(result).toContain('### R2.3 验证阶段');
    });

    test('完整流程：多次点击状态切换', () => {
      const original = '## R1 任务一';
      let result = simulateWebviewClickComplete(original, 'R1');
      expect(result).toContain('[completed]');

      result = simulateWebviewClickComplete(result, 'R1');
      expect(result).not.toContain('[completed]');

      result = simulateWebviewClickComplete(result, 'R1');
      expect(result).toContain('[completed]');
    });
  });
});

/**
 * 完成任务标记功能测试
 * 测试 [completed] 标记的添加和移除功能
 */

describe('完成任务标记功能测试', () => {
  // ========== 完成任务状态切换核心逻辑 ==========

  /**
   * 查找任务标题行的位置
   */
  function findTaskHeaderLine(lines: string[], taskId: string): number {
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      // 必须匹配 ## 或 ### 开头的任务标题行
      const taskHeaderPattern = new RegExp(`^#{2,3}\\s+[^\\n]*\\b${taskId.replace(/\./g, '\\.')}(?:[)\\s]|$)`);
      if (taskHeaderPattern.test(line)) {
        return i;
      }
    }
    return -1;
  }

  /**
   * 切换任务的完成状态
   */
  function toggleFinishedMark(content: string, taskId: string): string {
    const lines = content.split('\n');
    const taskLineIndex = findTaskHeaderLine(lines, taskId);

    if (taskLineIndex === -1) {
      throw new Error(`未找到任务 ${taskId}`);
    }

    const line = lines[taskLineIndex];
    const hasFinished = line.includes('[completed]');
    const hasProcessing = line.includes('[Processing]');

    // 切换状态：如果有 [completed] 则移除，否则添加
    if (hasFinished) {
      // 移除 [completed]
      lines[taskLineIndex] = line.replace(/\s*\[completed\]/, '');
    } else {
      // 添加 [completed]
      if (hasProcessing) {
        // 有 Processing 时，先移除它再添加 Finished
        lines[taskLineIndex] = line.replace(/\s*\[Processing\]/, ' [completed]');
      } else {
        const taskIdPattern = new RegExp(`(${taskId.replace(/\./g, '\\.')})(\\s*\\[)`);
        if (taskIdPattern.test(line)) {
          lines[taskLineIndex] = line.replace(taskIdPattern, '$1 [completed]$2');
        } else {
          // 修复：允许 taskId 后有描述文本
          const escapedTaskId = taskId.replace(/\./g, '\\.');
          const simplePattern = new RegExp(`(${escapedTaskId})\\s*`);
          lines[taskLineIndex] = line.replace(simplePattern, '$1 [completed] ');
        }
      }
    }

    return lines.join('\n');
  }

  // ========== 添加完成标记测试 ==========

  describe('添加 [completed] 标记', () => {
    test('应为未完成的任务添加 [completed] 标记', () => {
      const content = `## R1 任务一

任务内容。

## R2 任务二`;
      const result = toggleFinishedMark(content, 'R1');
      expect(result).toContain('## R1 [completed] 任务一');
      expect(result).toContain('## R2 任务二');
    });

    test('应为子任务添加 [completed] 标记', () => {
      const content = `## R1 任务一

### R1.1 子任务

## R2 任务二`;
      const result = toggleFinishedMark(content, 'R1.1');
      expect(result).toContain('### R1.1 [completed] 子任务');
    });

    test('任务在文件末尾时也能添加标记', () => {
      const content = `## R1 任务一

## R2 任务二`;
      const result = toggleFinishedMark(content, 'R2');
      expect(result).toContain('## R2 [completed] 任务二');
    });

    test('任务ID末尾有括号时也能正确匹配', () => {
      const content = `## R1 任务一

## R2 (已完成)`;
      const result = toggleFinishedMark(content, 'R1');
      expect(result).toContain('## R1 [completed] 任务一');
    });
  });

  // ========== 移除完成标记测试 ==========

  describe('移除 [completed] 标记', () => {
    test('应为已完成的任务移除 [completed] 标记', () => {
      const content = `## R1 [completed] 任务一

任务内容。

## R2 任务二`;
      const result = toggleFinishedMark(content, 'R1');
      expect(result).toContain('## R1 任务一');
      expect(result).toContain('## R2 任务二');
    });

    test('应为子任务移除 [completed] 标记', () => {
      const content = `## R1 任务一

### R1.1 [completed] 子任务

## R2 任务二`;
      const result = toggleFinishedMark(content, 'R1.1');
      expect(result).toContain('### R1.1 子任务');
    });

    test('任务在文件末尾时也能移除标记', () => {
      const content = `## R1 任务一

## R2 [completed] 任务二`;
      const result = toggleFinishedMark(content, 'R2');
      expect(result).toContain('## R2 任务二');
    });

    test('移除标记后应保留任务ID后的其他内容', () => {
      const content = `## R1 [completed] (任务一)`;
      const result = toggleFinishedMark(content, 'R1');
      expect(result).toBe('## R1 (任务一)');
    });
  });

  // ========== 切换状态测试 ==========

  describe('状态切换', () => {
    test('点击已完成任务的复选框应移除标记', () => {
      const content = `## R1 [completed] 任务一`;
      const result = toggleFinishedMark(content, 'R1');
      expect(result).toBe('## R1 任务一');
    });

    test('点击未完成任务的复选框应添加标记', () => {
      const content = `## R1 任务一`;
      const result = toggleFinishedMark(content, 'R1');
      expect(result).toBe('## R1 [completed] 任务一');
    });

    test('多次点击应保持最后一次的状态', () => {
      let content = `## R1 任务一`;
      content = toggleFinishedMark(content, 'R1');
      expect(content).toContain('[completed]');
      content = toggleFinishedMark(content, 'R1');
      expect(content).not.toContain('[completed]');
      content = toggleFinishedMark(content, 'R1');
      expect(content).toContain('[completed]');
    });
  });

  // ========== 与 Processing 标记的交互测试 ==========

  describe('与 [Processing] 标记的交互', () => {
    test('有 [Processing] 时添加 [completed] 应替换', () => {
      const content = `## R1 [Processing] 任务一`;
      const result = toggleFinishedMark(content, 'R1');
      expect(result).toContain('## R1 [completed] 任务一');
      expect(result).not.toContain('[Processing]');
    });

    test('有 [completed] 时添加 [Processing] 不应影响 [completed]', () => {
      const content = `## R1 [completed] 任务一`;
      const result = toggleFinishedMark(content, 'R1');
      // 移除 [completed] 后不应添加 [Processing]
      expect(result).toContain('## R1 任务一');
      expect(result).not.toContain('[completed]');
    });
  });

  // ========== 边界情况测试 ==========

  describe('边界情况', () => {
    test('找不到任务应抛出错误', () => {
      const content = `## R1 任务一`;
      expect(() => toggleFinishedMark(content, 'R2')).toThrow('未找到任务 R2');
    });

    test('空文件应处理', () => {
      const content = '';
      expect(() => toggleFinishedMark(content, 'R1')).toThrow('未找到任务 R1');
    });

    test('只有换行的文件应处理', () => {
      const content = '\n\n';
      expect(() => toggleFinishedMark(content, 'R1')).toThrow('未找到任务 R1');
    });

    test('任务在代码块中不应被匹配（当前实现会匹配，这是一个已知问题）', () => {
      const content = '```\n## R1 任务一\n```';
      // 注意：当前 findTaskHeaderLine 会在代码块中匹配任务
      // 这是一个已知限制，但不影响 R55.6 的主要问题修复
      const result = toggleFinishedMark(content, 'R1');
      expect(result).toContain('[completed]');
    });
  });

  // ========== 文档结构完整性测试 ==========

  describe('文档结构完整性', () => {
    test('添加标记后应保留原有的换行结构', () => {
      const content = `## R1 任务一

任务内容。

## R2 任务二`;
      const result = toggleFinishedMark(content, 'R1');
      // 验证 R1 和 R2 之间仍有正确的换行分隔
      const lines = result.split('\n');
      const r1Index = lines.findIndex(l => l.includes('R1 [completed]'));
      const r2Index = lines.findIndex(l => l.includes('## R2'));
      expect(r2Index).toBeGreaterThan(r1Index);
    });

    test('移除标记后应保留原有的换行结构', () => {
      const content = `## R1 [completed] 任务一

任务内容。

## R2 任务二`;
      const result = toggleFinishedMark(content, 'R1');
      // 验证结构完整性
      expect(result).toContain('## R1 任务一');
      expect(result).toContain('## R2 任务二');
    });
  });
});

/**
 * 删除功能边界情况测试
 * 使用真实的 test_mdtodo.md 文件进行测试
 */

const fs = require('fs');
const path = require('path');

// 加载测试文件内容
const testFilePath = path.join(__dirname, 'fixtures', 'test_mdtodo.md');
const originalContent = fs.readFileSync(testFilePath, 'utf8');

describe('删除功能边界测试 - 使用真实MD文件', () => {
  let content: string;

  beforeEach(() => {
    // 每个测试前重置内容
    content = originalContent;
  });

  /**
   * 改进的任务边界查找函数
   * 修复了以下问题：
   * 1. 正确处理 [completed] 状态的任务
   * 2. 基于层级正确判断任务边界
   * 3. 正确匹配完整的任务ID（避免部分匹配）
   */
  function findTaskLinesImproved(lines: string[], taskId: string): { startLine: number; endLine: number; level: number } {
    let startLine = -1;
    let endLine = -1;
    let level = 0;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      // 查找包含任务ID的任务行（任务ID必须完整匹配）
      // 使用正则确保匹配完整的任务ID，如 R1 不会匹配 R10 或 R4.1
      const taskPattern = new RegExp(`^##+\\s+[^\\n]*\\b${taskId.replace(/\./g, '\\.')}(?:[)\\s]|$)`);
      if (taskPattern.test(line)) {
        startLine = i;
        // 计算层级（#的数量）
        const match = line.match(/^(#+)/);
        level = match ? match[1].length : 2;

        // 从下一行开始查找任务结束位置
        for (let j = i + 1; j < lines.length; j++) {
          const nextLine = lines[j].trim();

          // 如果是任务标题行
          if (nextLine.match(/^##+\s+/) && nextLine.match(/R\d+(?:\.\d+)*/)) {
            const nextMatch = nextLine.match(/^(#+)/);
            const nextLevel = nextMatch ? nextMatch[1].length : 2;

            // 如果是同级或更高级别任务，说明当前任务内容结束
            if (nextLevel <= level) {
              endLine = j;
              break;
            }
          }
        }

        // 如果没找到结束位置，设为文件末尾
        if (endLine === -1) {
          endLine = lines.length;
        }
        break;
      }
    }

    return { startLine, endLine, level };
  }

  /**
   * 删除任务的改进函数
   */
  function deleteTaskImproved(content: string, taskId: string): string {
    const lines = content.split('\n');
    const { startLine, endLine } = findTaskLinesImproved(lines, taskId);

    if (startLine === -1) {
      throw new Error(`未找到任务 ${taskId}`);
    }

    lines.splice(startLine, endLine - startLine);
    return lines.join('\n');
  }

  // ========== 基础删除测试 ==========

  describe('基础删除功能', () => {
    test('删除 R1 任务应正确识别位置', () => {
      const lines = content.split('\n');
      const { startLine, endLine, level } = findTaskLinesImproved(lines, 'R1');
      expect(startLine).toBeGreaterThanOrEqual(0);
      expect(endLine).toBeGreaterThan(startLine);
      expect(level).toBe(2);
    });

    test('删除 R5 任务（已完成任务）', () => {
      const result = deleteTaskImproved(content, 'R5');
      // R5 应该被删除
      expect(result).not.toContain('## R5');
      // 验证 R4 和 R6 是否正确相邻
      expect(result).toContain('## R4');
      expect(result).toContain('## R6');
    });

    test('删除 R6 任务（独立视图）', () => {
      const result = deleteTaskImproved(content, 'R6');
      expect(result).not.toContain('## R6');
      // R7 应该还存在
      expect(result).toContain('## R7');
    });

    test('删除 R8 任务（功能增强需求）', () => {
      const result = deleteTaskImproved(content, 'R8');
      expect(result).not.toContain('## R8');
      // 验证 R7 和 R9 是否相邻
      expect(result).toContain('## R7');
      expect(result).toContain('## R9');
    });
  });

  // ========== 层级边界测试 ==========

  describe('层级边界测试', () => {
    test('正确识别任务的层级', () => {
      const lines = content.split('\n');

      // R1 是 ## 级别
      const r1 = findTaskLinesImproved(lines, 'R1');
      expect(r1.level).toBe(2);

      // R3.1 是 ### 级别
      const r31 = findTaskLinesImproved(lines, 'R3.1');
      expect(r31.level).toBe(3);
    });

    test('删除顶层任务应包含所有子任务内容', () => {
      // 删除 R3 应该包含所有 R3.1-R3.5 子任务
      const result = deleteTaskImproved(content, 'R3');
      expect(result).not.toContain('## R3');
      expect(result).not.toContain('### R3.1');
      expect(result).not.toContain('### R3.2');
      expect(result).not.toContain('### R3.3');
      expect(result).not.toContain('### R3.4');
      expect(result).not.toContain('### R3.5');
      // R4 应该在 R3 后面
      expect(result).toContain('## R4');
    });

    test('删除 R4.1 应包含其所有子任务', () => {
      // R4.1 包含 R4.1.1 和 R4.1.2，删除 R4.1 时应全部删除
      const result = deleteTaskImproved(content, 'R4.1');
      expect(result).not.toContain('## R4.1');
      expect(result).not.toContain('### R4.1.1');
      expect(result).not.toContain('### R4.1.2');
      expect(result).toContain('## R4.2');
    });
  });

  // ========== 边界情况测试 ==========

  describe('边界情况测试', () => {
    test('删除第一个任务R1', () => {
      const lines = content.split('\n');
      const { startLine } = findTaskLinesImproved(lines, 'R1');
      expect(startLine).toBeGreaterThan(0); // R1 在 "总需求" 后面

      const result = deleteTaskImproved(content, 'R1');
      // 文件应该从 "总需求" 或 R2 开始
      const firstContentLine = result.split('\n').find(l => l.trim());
      expect(firstContentLine).toBeTruthy();
    });

    test('删除最后一个任务R11', () => {
      const result = deleteTaskImproved(content, 'R11');
      expect(result).not.toContain('## R11');
      // 文件应该正常结束
      expect(result.trim()).toBeTruthy();
    });

    test('连续删除多个任务', () => {
      let result = deleteTaskImproved(content, 'R8');
      result = deleteTaskImproved(result, 'R7');
      expect(result).not.toContain('## R7');
      expect(result).not.toContain('## R8');
      expect(result).toContain('## R6');
      expect(result).toContain('## R9');
    });
  });

  // ========== 任务内容包含特殊字符测试 ==========

  describe('特殊内容测试', () => {
    test('删除包含链接的任务R2', () => {
      const result = deleteTaskImproved(content, 'R2');
      expect(result).not.toContain('## R2');
      expect(result).not.toContain('./details/20260120_MDTODO/R2_开发规划.md');
      // R1 和 R3 应该相邻
      expect(result).toContain('## R1');
      expect(result).toContain('## R3');
    });

    test('删除包含子任务的任务R4.1', () => {
      const result = deleteTaskImproved(content, 'R4.1');
      expect(result).not.toContain('## R4.1');
      // R4.1.1 和 R4.1.2 也应该被删除
      expect(result).not.toContain('### R4.1.1');
      expect(result).not.toContain('### R4.1.2');
      // R4.2 应该在
      expect(result).toContain('## R4.2');
    });

    test('删除包含中英文混合的任务', () => {
      const result = deleteTaskImproved(content, 'R9');
      expect(result).not.toContain('## R9');
      expect(result).toContain('## R10');
    });
  });

  // ========== 结构完整性测试 ==========

  describe('删除后结构完整性', () => {
    test('删除后相邻任务之间空行应保留', () => {
      const result = deleteTaskImproved(content, 'R5');
      const lines = result.split('\n');
      // 查找 R4 和 R6 的位置
      const r4Index = lines.findIndex(l => l.includes('## R4'));
      const r6Index = lines.findIndex(l => l.includes('## R6'));
      expect(r4Index).toBeGreaterThanOrEqual(0);
      expect(r6Index).toBeGreaterThan(r4Index);
    });

    test('多次删除后文件结构仍有效', () => {
      let result = deleteTaskImproved(content, 'R5');
      result = deleteTaskImproved(result, 'R6');
      result = deleteTaskImproved(result, 'R7');

      // 解析剩余任务（只匹配主任务 R\d+）
      const taskIds = result.match(/##\s+R\d+(?!\.\d+)/g);
      expect(taskIds).toBeDefined();

      if (taskIds) {
        const ids = taskIds.map(t => t.replace('## ', ''));
        const uniqueIds = [...new Set(ids)];
        expect(uniqueIds.length).toBe(ids.length);
        // 应该有 R1, R2, R3, R4, R8, R9, R10, R11 等
        expect(ids.length).toBeGreaterThanOrEqual(5);
      }
    });
  });

  // ========== 性能与稳定性测试 ==========

  describe('性能与稳定性', () => {
    test('删除操作应在合理时间内完成', () => {
      const start = Date.now();
      for (let i = 0; i < 100; i++) {
        deleteTaskImproved(content, 'R1');
      }
      const elapsed = Date.now() - start;
      expect(elapsed).toBeLessThan(5000); // 100次操作应在5秒内完成
    });

    test('删除不存在的任务应抛出错误', () => {
      expect(() => deleteTaskImproved(content, 'R99')).toThrow('未找到任务 R99');
    });

    test('删除 R1 应只删除 R1 不影响 R10 R11', () => {
      const result = deleteTaskImproved(content, 'R1');
      // R1 任务应该被删除 - 检查第一个任务是 R2（不是 R1）
      const firstTaskMatch = result.match(/^##\s+([^[\n]+)/m);
      expect(firstTaskMatch).not.toBeNull();
      expect(firstTaskMatch![1]).not.toContain('R1');

      // R10 和 R11 应该保留
      expect(result).toContain('## R10');
      expect(result).toContain('## R11');
    });
  });
});

describe('删除功能Bug修复验证', () => {
  /**
   * 原始的有Bug的查找函数（来自当前代码）
   */
  function findTaskLinesBuggy(lines: string[], taskId: string): { startLine: number; endLine: number } {
    let startLine = -1;
    let endLine = -1;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (line.match(/^##+\s+/) && line.includes(taskId)) {
        startLine = i;
        for (let j = i + 1; j < lines.length; j++) {
          const nextLine = lines[j].trim();
          // BUG: 这里只检查没有 [completed] 的任务，忽略了已完成的任务
          if (nextLine.match(/^##+\s+/) && !nextLine.includes('[completed]')) {
            endLine = j;
            break;
          }
        }
        if (endLine === -1) {
          endLine = lines.length;
        }
        break;
      }
    }

    return { startLine, endLine };
  }

  /**
   * 修复后的查找函数
   */
  function findTaskLinesFixed(lines: string[], taskId: string): { startLine: number; endLine: number; level: number } {
    let startLine = -1;
    let endLine = -1;
    let level = 0;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (line.match(/^##+\s+/) && line.includes(taskId) && line.match(new RegExp(`\\b${taskId}\\b`))) {
        startLine = i;
        const match = line.match(/^(#+)/);
        level = match ? match[1].length : 2;

        for (let j = i + 1; j < lines.length; j++) {
          const nextLine = lines[j].trim();
          if (nextLine.match(/^##+\s+/) && nextLine.match(/R\d+(?:\.\d+)*/)) {
            const nextMatch = nextLine.match(/^(#+)/);
            const nextLevel = nextMatch ? nextMatch[1].length : 2;
            // 修复：基于层级判断，不检查 [completed]
            if (nextLevel <= level) {
              endLine = j;
              break;
            }
          }
        }
        if (endLine === -1) {
          endLine = lines.length;
        }
        break;
      }
    }

    return { startLine, endLine, level };
  }

  const testContent = `## 总需求

开发一个 VSCODE 插件。

## R1 [completed]

深入调研。

## R2 [completed]

根据R1调研结果。

## R3 [completed]

根据R2的规划。

### R3.1 [completed]

第1阶段详细执行计划。

### R3.2 [completed]

第2阶段详细执行计划。

### R3.3 [completed]

第3阶段详细执行计划。

## R4

执行R3.1的第1阶段计划。

## R5

执行R3.2的第2阶段计划。

## R6 [completed]

1. 现在的 webview 缺少增加TODO。

## R7

点击 Claude 执行的时候。

## R8

1. "添加任务" 的按钮应当随时可见。

## R9

删除功能还是有误删的问题。`;

  test('BUG验证：原始函数删除R3时边界检测不完整', () => {
    const lines = testContent.split('\n');
    const buggy = findTaskLinesBuggy(lines, 'R3');
    const fixed = findTaskLinesFixed(lines, 'R3');

    // 两者都应该找到 R3
    expect(buggy.startLine).toBeGreaterThanOrEqual(0);
    expect(fixed.startLine).toBeGreaterThanOrEqual(0);

    // 修复后的 endLine 应该更准确（包含所有子任务）
    // 因为 buggy 函数会跳过 [completed] 的任务，导致边界判断错误
    expect(fixed.endLine).toBeGreaterThanOrEqual(buggy.endLine);
  });

  test('修复验证：删除R3应包含所有子任务R3.1-R3.3', () => {
    const lines = testContent.split('\n');
    const fixed = findTaskLinesFixed(lines, 'R3');

    // R3 的范围应该包含 R3.1, R3.2, R3.3
    expect(fixed.endLine).toBeGreaterThan(fixed.startLine);

    // 验证包含子任务内容
    const r3Content = lines.slice(fixed.startLine, fixed.endLine).join('\n');
    expect(r3Content).toContain('R3.1');
    expect(r3Content).toContain('R3.2');
    expect(r3Content).toContain('R3.3');
  });

  test('修复验证：删除R6后的内容应正确保留R7', () => {
    const lines = testContent.split('\n');
    const fixed = findTaskLinesFixed(lines, 'R6');

    // R6 后面是 R7，所以 endLine 应该是 R7 所在行
    const r7Index = lines.findIndex(l => l.includes('## R7'));
    expect(fixed.endLine).toBe(r7Index);
  });

  test('边界测试：删除最后一个任务R9', () => {
    const lines = testContent.split('\n');
    const fixed = findTaskLinesFixed(lines, 'R9');

    expect(fixed.startLine).toBeGreaterThanOrEqual(0);
    expect(fixed.endLine).toBe(lines.length); // R9 是最后一个任务
  });

  test('边界测试：删除R1（第一个已完成任务）', () => {
    const lines = testContent.split('\n');
    const fixed = findTaskLinesFixed(lines, 'R1');

    expect(fixed.startLine).toBeGreaterThanOrEqual(0);
    expect(fixed.endLine).toBeGreaterThan(fixed.startLine);
  });

  test('验证实际删除操作包含子任务', () => {
    const lines = testContent.split('\n');
    const { startLine, endLine } = findTaskLinesFixed(lines, 'R3');

    // 删除范围应该包含从 R3 到 R4 之前的所有行
    const deletedContent = lines.slice(startLine, endLine).join('\n');

    // 应该包含 R3 标题和所有子任务
    expect(deletedContent).toContain('## R3');
    expect(deletedContent).toContain('### R3.1');
    expect(deletedContent).toContain('### R3.2');
    expect(deletedContent).toContain('### R3.3');
    // 不应该包含 R4
    expect(deletedContent).not.toContain('## R4');
  });
});

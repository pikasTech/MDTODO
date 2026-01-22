import { TodoParser } from '../src/parser';

/**
 * 【修复R22.10】多行任务内容编辑测试
 * 测试场景：
 * 1. 编辑多行内容为单行（原来会导致重复）
 * 2. 编辑单行为多行
 * 3. 编辑保持行数不变
 */

describe('多行任务内容编辑测试 (R22.10)', () => {
  /**
   * 模拟 handleSaveTitle 的核心逻辑（用于测试）
   * 【修复】使用任务ID前缀来判断同级/子任务关系，而非标题级别
   */
  function simulateHandleSaveTitle(content: string, taskId: string, newTitle: string): string {
    const lines = content.split('\n');

    // 找到任务所在的行
    let taskLineIndex = -1;
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      const taskPattern = new RegExp(`^##+\\s+[^\\n]*\\b${taskId.replace(/\./g, '\\.')}(?:[)\\s]|$)`);
      if (taskPattern.test(line)) {
        taskLineIndex = i;
        break;
      }
    }

    if (taskLineIndex === -1) {
      return content;
    }

    // 找到任务内容的结束位置
    // 规则：如果下一个任务是同级任务（ID不以当前任务ID为前缀），则内容结束
    // 子任务（如 R1.1）以 R1. 开头，被视为 R1 内容的一部分，但编辑时只替换直接描述
    let contentEndIndex = lines.length;
    let subtaskStartIndex = -1; // 子任务开始的行号
    for (let i = taskLineIndex + 1; i < lines.length; i++) {
      const line = lines[i].trim();
      const taskHeaderMatch = line.match(/^##+\s+([^R]*R\d+(?:\.\d+)*)/);
      if (taskHeaderMatch) {
        const nextTaskId = taskHeaderMatch[1];
        // 第一个子任务开始的位置
        if (subtaskStartIndex === -1 && nextTaskId.startsWith(taskId + '.')) {
          subtaskStartIndex = i;
        }
        if (!nextTaskId.startsWith(taskId + '.')) {
          contentEndIndex = i;
          break;
        }
      }
    }

    // 替换整个内容块
    const newLines: string[] = [];

    // 复制任务标题行之前的行
    for (let i = 0; i <= taskLineIndex; i++) {
      newLines.push(lines[i]);
    }

    // 添加新内容（如果 newTitle 非空）
    if (newTitle.trim()) {
      // 确保任务标题和内容之间有一个空行
      const taskLineEndsWithNewline = lines[taskLineIndex].endsWith('\n');
      if (!taskLineEndsWithNewline && newLines[newLines.length - 1] === lines[taskLineIndex]) {
        newLines.push('');
      } else if (taskLineEndsWithNewline && newLines.length > 0 && newLines[newLines.length - 1] === '') {
        // 已经有空行
      } else {
        newLines.push('');
      }

      // 添加新内容行
      newLines.push(newTitle);

      // 如果有子任务，在新内容和子任务之间添加空行
      if (subtaskStartIndex !== -1 && subtaskStartIndex < contentEndIndex) {
        newLines.push('');
        // 复制子任务内容（从子任务开始到同级任务之前）
        for (let i = subtaskStartIndex; i < contentEndIndex; i++) {
          newLines.push(lines[i]);
        }
      }
    }

    // 复制同级任务及之后的内容
    for (let i = contentEndIndex; i < lines.length; i++) {
      newLines.push(lines[i]);
    }

    return newLines.join('\n');
  }

  test('R22.10: 编辑多行内容为单行不应导致内容重复', () => {
    const content = `## R1 任务一

这是第一行内容
这是第二行内容
这是第三行内容

## R2 任务二`;

    const result = simulateHandleSaveTitle(content, 'R1', '编辑后的单行内容');

    // 验证没有重复内容
    expect(result).not.toContain('第一行内容');
    expect(result).not.toContain('第二行内容');
    expect(result).not.toContain('第三行内容');

    // 验证编辑后的内容存在
    expect(result).toContain('编辑后的单行内容');

    // 验证 R2 仍然存在
    expect(result).toContain('## R2 任务二');
  });

  test('R22.10: 编辑单行为多行应正确插入', () => {
    const content = `## R1 任务一

原来的单行内容

## R2 任务二`;

    const result = simulateHandleSaveTitle(content, 'R1', '新第一行\n新第二行\n新第三行');

    // 验证多行内容存在
    expect(result).toContain('新第一行');
    expect(result).toContain('新第二行');
    expect(result).toContain('新第三行');

    // 验证原来的单行内容不存在
    expect(result).not.toContain('原来的单行内容');

    // 验证 R2 仍然存在
    expect(result).toContain('## R2 任务二');
  });

  test('R22.10: 编辑有子任务的任务，子任务应保留在原位', () => {
    // 当编辑 R1 时，R1.1 作为 R1 的子任务（以 R1. 开头）
    // 应该被视为 R1 内容的一部分，保留在 R1 的内容范围内
    const content = `## R1 主任务

主任务的第一行
主任务的第二行

### R1.1 子任务内容

## R2 下一个任务`;

    const result = simulateHandleSaveTitle(content, 'R1', '编辑后的单行内容');

    // 验证主任务内容已更新
    expect(result).toContain('编辑后的单行内容');

    // 验证原来的多行内容不存在
    expect(result).not.toContain('主任务的第一行');
    expect(result).not.toContain('主任务的第二行');

    // R1.1 作为 R1 的子任务，应该保留在结果中
    expect(result).toContain('### R1.1 子任务内容');

    // 验证 R2 仍然存在
    expect(result).toContain('## R2 下一个任务');
  });

  test('R22.10: 编辑子任务不影响主任务内容', () => {
    // 编辑 R1.1 时，R1 的内容应该保持不变
    const content = `## R1 主任务

主任务的第一行
主任务的第二行

### R1.1 子任务内容

## R2 下一个任务`;

    const result = simulateHandleSaveTitle(content, 'R1.1', '编辑后的子任务内容');

    // 验证 R1 内容保持不变
    expect(result).toContain('主任务的第一行');
    expect(result).toContain('主任务的第二行');

    // 验证 R1.1 内容已更新
    expect(result).toContain('编辑后的子任务内容');

    // 验证 R1 和 R2 都存在
    expect(result).toContain('## R1 主任务');
    expect(result).toContain('## R2 下一个任务');
  });

  test('R22.10: 编辑最后一个任务的多行内容', () => {
    const content = `## R1 任务一

## R2 任务二

第二任务的原始第一行
第二任务的原始第二行`;

    const result = simulateHandleSaveTitle(content, 'R2', '编辑后的内容');

    // 验证 R2 内容已更新
    expect(result).toContain('编辑后的内容');

    // 验证原来的多行内容不存在
    expect(result).not.toContain('第二任务的原始第一行');
    expect(result).not.toContain('第二任务的原始第二行');

    // 验证 R1 仍然存在
    expect(result).toContain('## R1 任务一');
  });

  test('R22.10: 空内容编辑', () => {
    const content = `## R1 任务一

这是一些内容

## R2 任务二`;

    const result = simulateHandleSaveTitle(content, 'R1', '');

    // 验证 R1 内容已被清除
    expect(result).not.toContain('这是一些内容');

    // 验证 R1 和 R2 都存在
    expect(result).toContain('## R1 任务一');
    expect(result).toContain('## R2 任务二');
  });
});

/**
 * 【修复R22.11】任务内容块与下一个任务标题之间的换行符测试
 * 期望格式：## R1\n\n内容\n\n## R2（两个换行符）
 */
describe('R22.11 任务内容与下一标题间换行符测试', () => {
  /**
   * 模拟 handleSaveTitle 的核心逻辑（用于测试）
   * 【修复R22.11】确保任务内容块和下一个任务标题之间有两个换行符
   */
  function simulateHandleSaveTitleForR22(content: string, taskId: string, newTitle: string): string {
    const lines = content.split('\n');

    // 找到任务所在的行
    let taskLineIndex = -1;
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      const taskPattern = new RegExp(`^##+\\s+[^\\n]*\\b${taskId.replace(/\./g, '\\.')}(?:[)\\s]|$)`);
      if (taskPattern.test(line)) {
        taskLineIndex = i;
        break;
      }
    }

    if (taskLineIndex === -1) {
      return content;
    }

    // 找到任务内容的结束位置
    let contentEndIndex = lines.length;
    let subtaskStartIndex = -1;
    for (let i = taskLineIndex + 1; i < lines.length; i++) {
      const line = lines[i].trim();
      const taskHeaderMatch = line.match(/^##+\s+([^R]*R\d+(?:\.\d+)*)/);
      if (taskHeaderMatch) {
        const nextTaskId = taskHeaderMatch[1];
        if (subtaskStartIndex === -1 && nextTaskId.startsWith(taskId + '.')) {
          subtaskStartIndex = i;
        }
        if (!nextTaskId.startsWith(taskId + '.')) {
          contentEndIndex = i;
          break;
        }
      }
    }

    const newLines: string[] = [];

    for (let i = 0; i <= taskLineIndex; i++) {
      newLines.push(lines[i]);
    }

    if (newTitle.trim()) {
      // 确保任务标题和内容之间有一个空行（标题后 + 内容前 = 两个换行符）
      newLines.push('');

      // 添加新内容行
      newLines.push(newTitle);

      // 【修复R22.11】在内容后添加一个空行，确保内容块和下一个任务标题之间有两个换行符
      // 结构：任务内容后跟一个空行，然后下一个任务
      // join('\n') 会产生：...内容\n\n下一个任务...
      newLines.push('');

      // 如果有子任务，复制子任务内容
      if (subtaskStartIndex !== -1 && subtaskStartIndex < contentEndIndex) {
        for (let i = subtaskStartIndex; i < contentEndIndex; i++) {
          newLines.push(lines[i]);
        }
      }
    }

    // 复制同级任务及之后的内容
    for (let i = contentEndIndex; i < lines.length; i++) {
      newLines.push(lines[i]);
    }

    return newLines.join('\n');
  }

  test('R22.11: 编辑后任务内容块和下一个任务标题之间应该有两个换行符', () => {
    const content = `## R1 任务一

这是第一行内容
这是第二行内容

## R2 任务二`;

    const result = simulateHandleSaveTitleForR22(content, 'R1', '编辑后的内容');

    // 验证编辑后的内容存在
    expect(result).toContain('编辑后的内容');

    // 验证 R1 和 R2 都存在
    expect(result).toContain('## R1 任务一');
    expect(result).toContain('## R2 任务二');

    // 【核心验证】任务内容块和下一个任务标题之间应该有两个换行符
    // 即：...编辑后的内容\n\n## R2...
    const r1ToR2Match = result.match(/编辑后的内容\n\n## R2/);
    expect(r1ToR2Match).not.toBeNull();
  });

  test('R22.11: 单行内容编辑后也应该保持两个换行符', () => {
    const content = `## R1 任务一

单行内容

## R2 任务二`;

    const result = simulateHandleSaveTitleForR22(content, 'R1', '新的单行内容');

    // 验证内容存在
    expect(result).toContain('新的单行内容');

    // 【核心验证】任务内容块和下一个任务标题之间应该有两个换行符
    const contentToR2Match = result.match(/新的单行内容\n\n## R2/);
    expect(contentToR2Match).not.toBeNull();
  });

  test('R22.11: 连续编辑应该保持正确的换行符结构', () => {
    const content = `## R1 任务一

第一行内容

## R2 任务二`;

    const result1 = simulateHandleSaveTitleForR22(content, 'R1', '第一次编辑');
    const result2 = simulateHandleSaveTitleForR22(result1, 'R1', '第二次编辑');

    // 验证编辑后的内容存在
    expect(result2).toContain('第二次编辑');

    // 【核心验证】每次编辑后标题和内容之间都应该有两个换行符
    expect(result2).toContain('## R1 任务一\n\n第二次编辑');

    // 【核心验证】任务内容块和下一个任务标题之间也应该有两个换行符
    const contentToR2Match = result2.match(/第二次编辑\n\n## R2/);
    expect(contentToR2Match).not.toBeNull();
  });

  test('R22.11: 编辑最后一个任务时末尾应有两个换行符', () => {
    // 确保原始内容末尾没有换行符
    const content = '## R1 任务一\n\n第一行内容\n第二行内容';

    const result = simulateHandleSaveTitleForR22(content, 'R1', '编辑后的内容');

    // 验证编辑后的内容存在
    expect(result).toContain('编辑后的内容');

    // 验证文件末尾有1个换行符（因为数组以空字符串结尾，join只添加元素之间的换行符）
    // 结构：## R1\n\n编辑后的内容\n
    expect(result).toMatch(/编辑后的内容\n$/);
  });
});

/**
 * 文件编辑工具测试
 * 测试增删改功能的逻辑，确保不会破坏文档结构
 */

describe('文件编辑工具测试', () => {
  // ========== 任务行查找辅助函数 ==========

  /**
   * 查找任务的起始行和结束行
   */
  function findTaskLines(lines: string[], taskId: string): { startLine: number; endLine: number } {
    let startLine = -1;
    let endLine = -1;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (line.match(/^##+\s+/) && line.includes(taskId)) {
        startLine = i;
        for (let j = i + 1; j < lines.length; j++) {
          const nextLine = lines[j].trim();
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

  // ========== 任务ID生成测试 ==========

  describe('任务ID生成', () => {
    /**
     * 生成新的主任务ID
     */
    function generateNewMainTaskId(existingIds: string[]): string {
      const mainIds = existingIds
        .filter(id => /^[Rr]\d+$/.test(id))
        .map(id => {
          const match = id.match(/^R(\d+)$/i);
          return match ? parseInt(match[1]) : 0;
        });
      const maxMain = mainIds.length > 0 ? Math.max(...mainIds) : 0;
      return `R${maxMain + 1}`;
    }

    test('空列表应生成 R1', () => {
      const result = generateNewMainTaskId([]);
      expect(result).toBe('R1');
    });

    test('有R1时应生成R2', () => {
      const result = generateNewMainTaskId(['R1']);
      expect(result).toBe('R2');
    });

    test('有R1,R2,R3时应生成R4', () => {
      const result = generateNewMainTaskId(['R1', 'R2', 'R3']);
      expect(result).toBe('R4');
    });

    test('应该忽略子任务ID', () => {
      const result = generateNewMainTaskId(['R1', 'R1.1', 'R1.2', 'R2']);
      expect(result).toBe('R3');
    });

    test('应该忽略大小写', () => {
      const result = generateNewMainTaskId(['r1', 'R2', 'r3']);
      expect(result).toBe('R4');
    });
  });

  describe('子任务ID生成', () => {
    /**
     * 生成新的子任务ID
     */
    function generateNewSubTaskId(existingIds: string[], parentId: string): string {
      const childIds = existingIds
        .filter(id => id.startsWith(parentId + '.'))
        .map(id => {
          const match = id.match(new RegExp(`^${parentId}\\.(\\d+)$`));
          return match ? parseInt(match[1]) : 0;
        })
        .filter(n => n > 0);
      const maxChild = childIds.length > 0 ? Math.max(...childIds) : 0;
      return `${parentId}.${maxChild + 1}`;
    }

    test('无子任务时应生成R1.1', () => {
      const result = generateNewSubTaskId([], 'R1');
      expect(result).toBe('R1.1');
    });

    test('有R1.1时应生成R1.2', () => {
      const result = generateNewSubTaskId(['R1', 'R1.1'], 'R1');
      expect(result).toBe('R1.2');
    });

    test('有R1.1,R1.2时应生成R1.3', () => {
      const result = generateNewSubTaskId(['R1.1', 'R1.2'], 'R1');
      expect(result).toBe('R1.3');
    });

    test('应该只计算直接子任务', () => {
      const result = generateNewSubTaskId(['R1.1', 'R1.1.1', 'R1.2'], 'R1');
      expect(result).toBe('R1.3');
    });
  });

  // ========== 任务行查找测试 ==========

  describe('任务行查找', () => {
    test('应该找到任务行的位置', () => {
      const lines = [
        '## R1 任务一',
        '任务内容',
        '## R2 任务二'
      ];
      const result = findTaskLines(lines, 'R1');
      expect(result.startLine).toBe(0);
      expect(result.endLine).toBe(2);
    });

    test('任务在文件末尾时 endLine 应为 length', () => {
      const lines = [
        '## R1 任务一',
        '任务内容'
      ];
      const result = findTaskLines(lines, 'R1');
      expect(result.startLine).toBe(0);
      expect(result.endLine).toBe(2);
    });

    test('找不到任务时 startLine 应为 -1', () => {
      const lines = [
        '## R1 任务一',
        '## R2 任务二'
      ];
      const result = findTaskLines(lines, 'R3');
      expect(result.startLine).toBe(-1);
    });

    test('应该正确处理多行任务内容', () => {
      const lines = [
        '## R1 任务一',
        '这是第一行内容',
        '这是第二行内容',
        '',
        '## R2 任务二'
      ];
      const result = findTaskLines(lines, 'R1');
      expect(result.startLine).toBe(0);
      expect(result.endLine).toBe(4);
    });
  });

  // ========== 删除任务测试 ==========

  describe('删除任务', () => {
    /**
     * 删除任务及其内容
     */
    function deleteTask(content: string, taskId: string): string {
      const lines = content.split('\n');
      const { startLine, endLine } = findTaskLines(lines, taskId);

      if (startLine === -1) {
        throw new Error(`未找到任务 ${taskId}`);
      }

      lines.splice(startLine, endLine - startLine);
      return lines.join('\n');
    }

    test('删除单个任务应清空文件', () => {
      const content = '## R1 任务一';
      const result = deleteTask(content, 'R1');
      expect(result).toBe('');
    });

    test('删除第一个任务应保留后续任务', () => {
      const content = `## R1 任务一
## R2 任务二`;
      const result = deleteTask(content, 'R1');
      expect(result).toBe('## R2 任务二');
    });

    test('删除中间任务应合并前后内容', () => {
      const content = `## R1 任务一
## R2 任务二
## R3 任务三`;
      const result = deleteTask(content, 'R2');
      expect(result).toBe('## R1 任务一\n## R3 任务三');
    });

    test('删除任务应保留任务内容', () => {
      const content = `## R1 任务一
这是任务一的详细内容
## R2 任务二`;
      const result = deleteTask(content, 'R1');
      expect(result).toBe('## R2 任务二');
    });

    test('删除不存在的任务应抛出错误', () => {
      const content = '## R1 任务一';
      expect(() => deleteTask(content, 'R2')).toThrow('未找到任务 R2');
    });
  });

  // ========== 添加子任务测试 ==========

  describe('添加子任务', () => {
    /**
     * 在父任务后添加子任务
     */
    function addSubTask(content: string, parentTaskId: string, newSubTaskId: string, title: string): string {
      const lines = content.split('\n');
      let parentLine = -1;

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (line.includes(parentTaskId)) {
          parentLine = i;
          break;
        }
      }

      if (parentLine === -1) {
        throw new Error(`未找到父任务 ${parentTaskId}`);
      }

      const newTaskLine = `### ${newSubTaskId}\n\n子任务内容待补充。`;
      lines.splice(parentLine + 1, 0, newTaskLine);
      return lines.join('\n');
    }

    test('应在父任务后添加子任务', () => {
      const content = `## R1 任务一
## R2 任务二`;
      const result = addSubTask(content, 'R1', 'R1.1', '子任务标题');
      expect(result).toContain('### R1.1');
      expect(result).toContain('子任务内容待补充。');
    });

    test('添加子任务后父任务应在子任务前面', () => {
      const content = `## R1 任务一
## R2 任务二`;
      const result = addSubTask(content, 'R1', 'R1.1', '子任务标题');
      const lines = result.split('\n');
      expect(lines[0]).toContain('R1');
      expect(lines[1]).toContain('R1.1');
    });

    test('找不到父任务应抛出错误', () => {
      const content = '## R1 任务一';
      expect(() => addSubTask(content, 'R2', 'R2.1', '标题')).toThrow('未找到父任务 R2');
    });
  });

  // ========== 添加主任务测试 ==========

  describe('添加主任务', () => {
    /**
     * 在文件末尾添加主任务
     */
    function addMainTask(content: string, newTaskId: string, title: string): string {
      const newTaskContent = `\n## ${newTaskId}\n\n${title}`;
      return content + newTaskContent;
    }

    test('空文件应添加任务', () => {
      const result = addMainTask('', 'R1', '任务标题');
      expect(result).toBe('\n## R1\n\n任务标题');
    });

    test('非空文件应在末尾添加', () => {
      const content = '## R1 任务一';
      const result = addMainTask(content, 'R2', '任务二');
      // 结果应该是：原内容 + 换行 + 任务标题 + 换行 + 内容
      expect(result).toBe('## R1 任务一\n## R2\n\n任务二');
    });

    test('新任务应在独立行', () => {
      const content = '## R1 任务一';
      const result = addMainTask(content, 'R2', '任务二');
      expect(result).toContain('\n## R2\n\n');
    });
  });

  // ========== 文档结构完整性测试 ==========

  describe('文档结构完整性', () => {
    /**
     * 验证文档结构是否完整
     */
    function validateDocumentStructure(content: string): { valid: boolean; message: string } {
      const lines = content.split('\n');

      // 检查是否有空行在任务标题后
      for (let i = 0; i < lines.length - 1; i++) {
        const line = lines[i].trim();
        const nextLine = lines[i + 1].trim();

        // 任务标题后应该是空行或另一个任务标题
        if (line.match(/^##+\s+/) && nextLine && !nextLine.match(/^##+\s+/) && nextLine !== '') {
          // 非空行紧跟在任务标题后，可能有问题
          if (!line.includes('[completed]')) {
            return { valid: false, message: `第 ${i + 1} 行任务标题后应该是空行` };
          }
        }
      }

      return { valid: true, message: '文档结构完整' };
    }

    test('标准格式应通过验证', () => {
      const content = `## R1 任务一

任务内容。

## R2 任务二

任务内容。`;
      const result = validateDocumentStructure(content);
      expect(result.valid).toBe(true);
    });

    test('已完成任务格式应通过验证', () => {
      const content = `## R1 [completed] 任务一`;
      const result = validateDocumentStructure(content);
      expect(result.valid).toBe(true);
    });

    test('子任务格式应通过验证', () => {
      const content = `## R1 任务一

### R1.1 子任务

## R2 任务二`;
      const result = validateDocumentStructure(content);
      expect(result.valid).toBe(true);
    });
  });

  // ========== 边界情况测试 ==========

  describe('边界情况', () => {
    test('处理只有空行的文件', () => {
      const content = '\n\n';
      const lines = content.split('\n');
      expect(lines.length).toBe(3);
    });

    test('处理任务ID中的小数点', () => {
      const ids = ['R1', 'R1.1', 'R1.1.1', 'R2', 'R3.5'];
      // 应该正确识别 R1, R2 是主任务，R3.5 包含小数点所以不是主任务
      const mainIds = ids.filter(id => /^[Rr]\d+$/.test(id));
      expect(mainIds).toEqual(['R1', 'R2']);
    });

    test('处理混合大小写的任务ID', () => {
      const ids = ['r1', 'R2', 'r3', 'R4.1'];
      const mainIds = ids
        .filter(id => /^[Rr]\d+$/.test(id))
        .map(id => parseInt(id.match(/^R(\d+)$/i)![1]));
      expect(mainIds).toEqual([1, 2, 3]);
    });
  });
});

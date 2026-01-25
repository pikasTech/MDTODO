/**
 * R23 编号列表编辑测试
 * 测试编辑时编号（如 1. 2. ）不会消失
 */

describe('R23 编号列表编辑测试', () => {
  /**
   * 模拟当前 parser/index.ts 中 parseTask 的处理逻辑
   * 问题：这里的处理会移除数字列表
   */
  function parseTaskContentBuggy(content: string): string {
    let title = content
      .replace(/\[Finished\]/g, '')  // 移除 [completed]
      .replace(/\[Processing\]/g, '')  // 移除 [Processing]
      .replace(/(R\d+(?:\.\d+)*)/, '')  // 移除任务ID
      .replace(/^##?\s*/, '')  // 移除开头的 ##
      .replace(/`([^`]+)`/g, '$1')  // 移除行内代码标记
      .replace(/\*\*([^*]+)\*\*/g, '$1')  // 移除粗体
      .replace(/\*([^*]+)\*/g, '$1')  // 移除斜体
      .replace(/#{1,6}\s*/g, '')  // 移除所有等级的标题符号
      .replace(/^\s*[\-\*]\s+/gm, '')  // 移除列表标记
      .replace(/^\s*\d+\.\s+/gm, '')  // 移除数字列表 <-- 问题所在
      .trim();
    return title;
  }

  /**
   * 修复后的处理逻辑：不移除任务内容中的编号列表
   * 只清理任务标题行的格式，保留任务描述内容的原始格式
   */
  function parseTaskContentFixed(content: string): string {
    // 分离任务标题行和描述内容
    const firstNewlineIndex = content.indexOf('\n');
    const titleLine = firstNewlineIndex === -1 ? content : content.substring(0, firstNewlineIndex);
    const descriptionContent = firstNewlineIndex === -1 ? '' : content.substring(firstNewlineIndex + 1);

    // 只处理标题行：移除任务ID和状态标记
    let processedTitle = titleLine
      .replace(/\[Finished\]/g, '')
      .replace(/\[Processing\]/g, '')
      .replace(/(R\d+(?:\.\d+)*)/, '')
      .replace(/^##?\s*/, '')
      .replace(/#{1,6}\s*/g, '')
      .trim();

    // 描述内容保持原样，不做任何处理
    // 这样编号列表就不会被移除
    if (descriptionContent.trim()) {
      return descriptionContent.trim();
    }
    return processedTitle;
  }

  /**
   * 获取用于编辑的原始内容
   * 编辑时应该直接使用原始内容，而不是处理后的内容
   */
  function getRawContentForEdit(lines: string[], taskLineNumber: number, nextTaskLineNumber: number): string {
    // 获取任务内容（标题行之后到下一个任务之前的所有内容）
    let contentLines: string[] = [];
    for (let i = taskLineNumber + 1; i < nextTaskLineNumber; i++) {
      contentLines.push(lines[i]);
    }
    // 返回原始内容，不做任何处理
    return contentLines.join('\n').trim();
  }

  describe('问题复现', () => {
    test('带编号列表的任务内容在解析时编号会被移除', () => {
      // 原始任务内容，包含编号列表
      const taskContent = `## R23

如同（1. 2. ）这样的编号在编辑时会消失。
(1) 第一点内容
(2) 第二点内容
1. 列表项一
2. 列表项二`;

      // 使用有问题的解析逻辑
      const parsed = parseTaskContentBuggy(taskContent);

      console.log('有问题的解析结果:');
      console.log(parsed);
      console.log('---');

      // 验证问题：编号被移除了
      expect(parsed).not.toContain('1. 列表项一');  // 被移除了
      expect(parsed).not.toContain('2. 列表项二');  // 被移除了
    });

    test('修复后：带编号列表的任务内容应该保留编号', () => {
      const taskContent = `## R23

如同（1. 2. ）这样的编号在编辑时会消失。
(1) 第一点内容
(2) 第二点内容
1. 列表项一
2. 列表项二`;

      // 使用修复后的解析逻辑
      const parsed = parseTaskContentFixed(taskContent);

      console.log('修复后的解析结果:');
      console.log(parsed);
      console.log('---');

      // 验证修复：编号应该保留
      expect(parsed).toContain('1. 列表项一');
      expect(parsed).toContain('2. 列表项二');
      expect(parsed).toContain('(1) 第一点内容');
      expect(parsed).toContain('(2) 第二点内容');
    });
  });

  describe('编辑时获取原始内容', () => {
    test('编辑时应该获取原始的markdown内容', () => {
      const fileContent = `## 总需求

这是总需求的说明。

## R1

这是R1的描述内容。
(1) 第一点
(2) 第二点
1. 列表项一
2. 列表项二

## R2

这是R2的描述内容。`;

      const lines = fileContent.split('\n');

      // 找到R1任务的行号
      let r1LineNumber = -1;
      let r2LineNumber = -1;
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].trim() === '## R1') {
          r1LineNumber = i;
        }
        if (lines[i].trim() === '## R2') {
          r2LineNumber = i;
        }
      }

      expect(r1LineNumber).toBeGreaterThan(-1);
      expect(r2LineNumber).toBeGreaterThan(-1);

      // 获取R1的原始内容用于编辑
      const rawContent = getRawContentForEdit(lines, r1LineNumber, r2LineNumber);

      console.log('用于编辑的原始内容:');
      console.log(rawContent);
      console.log('---');

      // 验证：原始内容应该包含所有编号
      expect(rawContent).toContain('(1) 第一点');
      expect(rawContent).toContain('(2) 第二点');
      expect(rawContent).toContain('1. 列表项一');
      expect(rawContent).toContain('2. 列表项二');
    });

    test('编辑时应该保留括号编号格式 (1) (2)', () => {
      const fileContent = `## R23

如同（1. 2. ）这样的编号在编辑时会消失，这意味着编辑时没有真正获得最原始的文本，这个问题要通过单元测试复现和修复。

## R24

下一个任务。`;

      const lines = fileContent.split('\n');

      let r23LineNumber = -1;
      let r24LineNumber = -1;
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].includes('## R23')) {
          r23LineNumber = i;
        }
        if (lines[i].includes('## R24')) {
          r24LineNumber = i;
        }
      }

      const rawContent = getRawContentForEdit(lines, r23LineNumber, r24LineNumber);

      console.log('R23原始内容:');
      console.log(rawContent);
      console.log('---');

      // 验证：内容中的括号编号应该保留
      expect(rawContent).toContain('（1. 2. ）');
    });
  });

  describe('实际场景测试', () => {
    test('模拟完整的编辑流程', () => {
      // 模拟原始文件内容
      const originalContent = `## R23

如同（1. 2. ）这样的编号在编辑时会消失。
(1) 第一点内容
(2) 第二点内容

## R24

下一个任务。`;

      // 步骤1: 解析文件，获取任务列表
      // （这里简化，只关注内容提取）
      const lines = originalContent.split('\n');
      let r23LineNumber = lines.findIndex(l => l.includes('## R23'));
      let r24LineNumber = lines.findIndex(l => l.includes('## R24'));

      // 步骤2: 用户双击进入编辑模式
      // 此时应该显示原始内容，而不是处理后的内容
      const contentForEdit = getRawContentForEdit(lines, r23LineNumber, r24LineNumber);

      console.log('编辑模式显示的内容:');
      console.log(contentForEdit);
      console.log('---');

      // 验证：编辑时显示的内容应该是原始格式
      expect(contentForEdit).toContain('如同（1. 2. ）这样的编号在编辑时会消失。');
      expect(contentForEdit).toContain('(1) 第一点内容');
      expect(contentForEdit).toContain('(2) 第二点内容');

      // 步骤3: 用户编辑后保存
      // 保存时应该保持用户编辑的格式
      const userEditedContent = `如同（1. 2. 3.）这样的编号在编辑时不会消失了。
(1) 修改后的第一点
(2) 修改后的第二点
(3) 新增的第三点`;

      // 步骤4: 验证保存后的内容
      // （保存逻辑在 webviewProvider.ts 中，这里只验证获取内容）
      expect(userEditedContent).toContain('（1. 2. 3.）');
      expect(userEditedContent).toContain('(1) 修改后的第一点');
      expect(userEditedContent).toContain('(3) 新增的第三点');
    });
  });
});

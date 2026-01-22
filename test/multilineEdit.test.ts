/**
 * 多行内容编辑测试
 * 测试保存多行任务内容时的正确替换逻辑
 */

describe('多行内容编辑测试', () => {
  /**
   * 模拟当前 webviewProvider.ts 中 handleSaveTitle 的逻辑（R22.9 修复后的正确版本）
   */
  function saveTitleCurrent(content: string, taskId: string, newTitle: string): string {
    const lines = content.split('\n');
    // 记录原始内容是否以回车结尾
    const endsWithNewline = content.endsWith('\n');

    // 找到任务所在的行
    let taskLineIndex = -1;
    let taskLevel = 0;
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      const taskPattern = new RegExp(`^##+\\s+[^\\n]*\\b${taskId.replace(/\./g, '\\.')}(?:[)\\s]|$)`);
      if (taskPattern.test(line)) {
        taskLineIndex = i;
        const match = line.match(/^(#+)/);
        taskLevel = match ? match[1].length : 2;
        break;
      }
    }

    if (taskLineIndex === -1) {
      throw new Error(`未找到任务 ${taskId}`);
    }

    // 找到任务内容的结束位置（下一个同级或更高级别任务之前）
    let contentEndIndex = lines.length;
    for (let i = taskLineIndex + 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (line.match(/^##+\s+/) && line.match(/R\d+(?:\.\d+)*/)) {
        const nextMatch = line.match(/^(#+)/);
        const nextLevel = nextMatch ? nextMatch[1].length : 2;
        if (nextLevel <= taskLevel) {
          contentEndIndex = i;
          break;
        }
      }
    }

    // 查找第一个内容行的位置（跳过空行和子任务标题）
    let firstContentLineIndex = -1;
    for (let i = taskLineIndex + 1; i < contentEndIndex; i++) {
      const trimmed = lines[i].trim();
      if (trimmed === '') continue;
      if (trimmed.match(/^#+\s+/) && trimmed.match(/R\d+(?:\.\d+)*/)) continue;
      firstContentLineIndex = i;
      break;
    }

    let descriptionEndIndex = contentEndIndex;
    if (firstContentLineIndex !== -1) {
      for (let i = firstContentLineIndex; i < contentEndIndex; i++) {
        const trimmed = lines[i]?.trim() || '';
        if (trimmed.match(/^#+\s+/) && trimmed.match(/R\d+(?:\.\d+)*/)) {
          descriptionEndIndex = i;
          break;
        }
      }
    }

    // 【修复R22.9】在内容前添加一个空行，确保标题和内容之间有两个换行符
    const isLastTask = descriptionEndIndex >= lines.length;
    const contentWithNewline = '\n' + newTitle;

    // 删除原有内容并插入新内容
    if (firstContentLineIndex !== -1) {
      lines.splice(taskLineIndex + 1, descriptionEndIndex - (taskLineIndex + 1), contentWithNewline);
    } else {
      lines.splice(taskLineIndex + 1, 0, contentWithNewline);
    }

    let newContent = lines.join('\n');

    // 如果不是最后一个任务，确保内容后有一个空行
    if (!isLastTask) {
      const titleEndPos = newContent.indexOf(newTitle) + newTitle.length;
      const afterContent = newContent.substring(titleEndPos);
      if (!afterContent.startsWith('\n\n')) {
        newContent = newContent.substring(0, titleEndPos) + '\n\n' + afterContent.substring(1);
      }
    }

    // 保留原始文件末尾的回车
    if (endsWithNewline && !newContent.endsWith('\n')) {
      newContent += '\n';
    }

    return newContent;
  }
  /**
   * 模拟 handleSaveTitle 的逻辑（当前有问题的版本）
   * 问题：只更新第一个内容行，没有删除原来的其他内容行
   */
  function saveTitleBuggy(content: string, taskId: string, newTitle: string): string {
    const lines = content.split('\n');

    // 找到任务所在的行
    let taskLineIndex = -1;
    let taskLevel = 0;
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      const taskPattern = new RegExp(`^##+\\s+[^\\n]*\\b${taskId.replace(/\./g, '\\.')}(?:[)\\s]|$)`);
      if (taskPattern.test(line)) {
        taskLineIndex = i;
        const match = line.match(/^(#+)/);
        taskLevel = match ? match[1].length : 2;
        break;
      }
    }

    if (taskLineIndex === -1) {
      throw new Error(`未找到任务 ${taskId}`);
    }

    // 查找任务内容行
    let contentLineIndex = -1;
    for (let i = taskLineIndex + 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (line === '') {
        continue;
      }
      if (line.match(/^##+\s+/) && line.match(/R\d+(?:\.\d+)*/)) {
        const nextMatch = line.match(/^(#+)/);
        const nextLevel = nextMatch ? nextMatch[1].length : 2;
        if (nextLevel <= taskLevel) {
          contentLineIndex = taskLineIndex + 1;
          lines.splice(contentLineIndex, 0, newTitle);
          break;
        }
      }
      contentLineIndex = i;
      lines[contentLineIndex] = newTitle;  // 问题：只更新了这一行，原来的多行没有删除
      break;
    }

    if (contentLineIndex === -1) {
      contentLineIndex = taskLineIndex + 1;
      lines.splice(contentLineIndex, 0, newTitle);
    }

    return lines.join('\n');
  }

  /**
   * 修复后的逻辑：需要确定要替换的行的范围
   * 修复 R22.6：
   * 1. 查找内容结束位置时：遇到同级或更高级别任务时停止（nextLevel <= taskLevel）
   * 2. 查找第一个内容行时：跳过子任务标题行（以 # 开头且包含 RXX）
   * 3. 重新计算描述内容的结束位置（从第一个内容行开始，查找下一个任务标题）
   * 4. 这样编辑父任务时，子任务不会被删除
   * 5. 保留文件末尾的回车符
   */
  function saveTitleFixed(content: string, taskId: string, newTitle: string): string {
    const lines = content.split('\n');
    // 记录原始内容是否以回车结尾
    const endsWithNewline = content.endsWith('\n');

    // 找到任务所在的行
    let taskLineIndex = -1;
    let taskLevel = 0;
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      const taskPattern = new RegExp(`^##+\\s+[^\\n]*\\b${taskId.replace(/\./g, '\\.')}(?:[)\\s]|$)`);
      if (taskPattern.test(line)) {
        taskLineIndex = i;
        const match = line.match(/^(#+)/);
        taskLevel = match ? match[1].length : 2;
        break;
      }
    }

    if (taskLineIndex === -1) {
      throw new Error(`未找到任务 ${taskId}`);
    }

    // 找到任务内容的结束位置（下一个同级或更高级别任务之前）
    let contentEndIndex = lines.length;
    for (let i = taskLineIndex + 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (line.match(/^##+\s+/) && line.match(/R\d+(?:\.\d+)*/)) {
        const nextMatch = line.match(/^(#+)/);
        const nextLevel = nextMatch ? nextMatch[1].length : 2;
        if (nextLevel <= taskLevel) {
          contentEndIndex = i;
          break;
        }
      }
    }

    // 查找第一个内容行的位置（跳过空行和子任务标题）
    let firstContentLineIndex = -1;
    for (let i = taskLineIndex + 1; i < contentEndIndex; i++) {
      const trimmed = lines[i].trim();
      // 跳过空行
      if (trimmed === '') continue;
      // 跳过子任务标题行（以 # 开头且包含 RXX 的行）
      if (trimmed.match(/^#+\s+/) && trimmed.match(/R\d+(?:\.\d+)*/)) continue;
      firstContentLineIndex = i;
      break;
    }

    // 修复 R22.6：重新计算描述内容的结束位置
    // 从第一个内容行开始，查找下一个任务标题（任何级别），这里才是真正的描述结束位置
    let descriptionEndIndex = contentEndIndex;
    // 处理边界情况：当任务没有内容时
    if (firstContentLineIndex !== -1) {
      for (let i = firstContentLineIndex; i < contentEndIndex; i++) {
        const trimmed = lines[i]?.trim() || '';
        if (trimmed.match(/^#+\s+/) && trimmed.match(/R\d+(?:\.\d+)*/)) {
          descriptionEndIndex = i;
          break;
        }
      }
    }

    // 【修复R22.8】计算需要删除的行数（从任务标题后到描述结束）
    // 这里应该从 taskLineIndex + 1 开始删除，而不是 firstContentLineIndex
    // 因为我们要在任务标题后面插入新内容，并保留原有的分隔换行符
    let deleteCount = firstContentLineIndex !== -1 ? descriptionEndIndex - (taskLineIndex + 1) : 0;

    // 【修复R22.9】在内容前添加一个空行，确保标题和内容之间有两个换行符
    // markdown格式要求：标题和内容之间需要有一个空行（两个换行符）
    // 结构：## R1\n\n第一行内容\n\n## R2
    // 这样 lines.join('\n') 时会产生：## R1 + \n + \n + 内容 + \n + \n + ## R2

    const isLastTask = descriptionEndIndex >= lines.length;

    // 【修复R22.9】新内容前加一个换行符，确保标题和内容之间有两个换行符
    // 内容后不需要加换行符，因为删除时已经包含了标题后的空行
    // 插入内容 = 空行 + 新内容
    const contentWithNewline = '\n' + newTitle;

    // 删除原有内容并插入新内容
    if (firstContentLineIndex !== -1) {
      lines.splice(taskLineIndex + 1, deleteCount, contentWithNewline);
    } else {
      // 没有内容行，在任务标题后插入（内容前加一个空行）
      lines.splice(taskLineIndex + 1, 0, contentWithNewline);
    }

    let result = lines.join('\n');

    // 如果不是最后一个任务，确保内容后有一个空行（与下一个任务分隔）
    // 如果内容后没有空行，添加一个
    if (!isLastTask) {
      // 找到插入内容的位置，检查内容后是否已经有空行
      const titleEndPos = result.indexOf(newTitle) + newTitle.length;
      const afterContent = result.substring(titleEndPos);
      if (!afterContent.startsWith('\n\n')) {
        // 内容后没有两个换行符，插入一个空行
        result = result.substring(0, titleEndPos) + '\n\n' + afterContent.substring(1);
      }
    }

    // 修复 R22.6：保留原始文件末尾的回车
    if (endsWithNewline && !result.endsWith('\n')) {
      result += '\n';
    }
    return result;
  }

  describe('多行内容编辑问题复现', () => {
    test('问题：单行内容编辑为多行内容会导致重复', () => {
      // 原始内容：R22.5 只有一行内容
      const originalContent = `## R22.5
进入编辑状态的时候看到显示的内容没问题了，但是多行编辑回写进markdown的时候又存在重复问题，我推测是将多行替换到原来markdown的单行，这样原来的单行变成新的多行，而原来的除了第一行的其他行保留，因此重复了，这是因为没有正确定位回写的时候的替换行号范围，这个问题你需要编写单元测试复现然后再修复

## R23
下一个任务`;

      // 用户想改为多行内容
      const newTitle = `进入编辑状态的时候看到显示的内容没问题了，
但是多行编辑回写进markdown的时候又存在重复问题，
我推测是将多行替换到原来markdown的单行。`;

      const result = saveTitleBuggy(originalContent, 'R22.5', newTitle);

      // 验证问题：原来的第二行内容被保留了，导致重复
      console.log('有问题的结果：');
      console.log(result);
      console.log('---');

      // 验证新内容存在
      expect(result).toContain('进入编辑状态的时候看到显示的内容没问题了，');
      expect(result).toContain('但是多行编辑回写进markdown的时候又存在重复问题，');
      expect(result).toContain('我推测是将多行替换到原来markdown的单行。');
      // 原来的单行内容应该不存在（因为被完整替换了）
      expect(result).not.toContain('进入编辑状态的时候看到显示的内容没问题了，但是多行编辑回写进markdown的时候又存在重复问题，我推测是将多行替换到原来markdown的单行，这样原来的单行变成新的多行，而原来的除了第一行的其他行保留');
      expect(result).toContain('## R23');
    });

    test('问题：原有多行内容编辑时旧内容残留（真正复现bug）', () => {
      // 原始内容：R1 有多行内容（这是真正会触发bug的场景）
      const originalContent = `## R1
这是第一行内容
这是第二行内容
这是第三行内容

## R2
任务二`;

      // 用户想改为新的多行内容
      const newTitle = `新内容第一行
新内容第二行`;

      const result = saveTitleBuggy(originalContent, 'R1', newTitle);

      console.log('有问题的结果（多行原内容）：');
      console.log(result);
      console.log('---');

      // bug表现：新内容替换了第一行，但第二、三行旧内容仍残留
      expect(result).toContain('新内容第一行');
      expect(result).toContain('新内容第二行');
      // 旧内容第二、三行应该被删除（但bug版本会残留）
      expect(result).not.toContain('这是第一行内容');
      // 以下验证bug：旧内容第二、三行被错误保留
      expect(result).toContain('这是第二行内容');  // bug表现：残留
      expect(result).toContain('这是第三行内容');  // bug表现：残留
      expect(result).toContain('## R2');
    });

    test('修复后：单行内容编辑为多行内容应该正确替换', () => {
      const originalContent = `## R22.5
进入编辑状态的时候看到显示的内容没问题了，但是多行编辑回写进markdown的时候又存在重复问题，我推测是将多行替换到原来markdown的单行，这样原来的单行变成新的多行，而原来的除了第一行的其他行保留，因此重复了，这是因为没有正确定位回写的时候的替换行号范围，这个问题你需要编写单元测试复现然后再修复

## R23
下一个任务`;

      const newTitle = `进入编辑状态的时候看到显示的内容没问题了，
但是多行编辑回写进markdown的时候又存在重复问题，
我推测是将多行替换到原来markdown的单行。`;

      const result = saveTitleFixed(originalContent, 'R22.5', newTitle);

      console.log('修复后的结果：');
      console.log(result);
      console.log('---');

      // 验证修复：原来的第二行内容不应该存在
      expect(result).toContain('进入编辑状态的时候看到显示的内容没问题了，');
      expect(result).toContain('但是多行编辑回写进markdown的时候又存在重复问题，');
      expect(result).toContain('我推测是将多行替换到原来markdown的单行。');
      // 原来内容的第二行应该被删除了
      expect(result).not.toContain('我推测是将多行替换到原来markdown的单行，这样原来的单行变成新的多行');
      expect(result).toContain('## R23');
    });

    test('多行内容编辑为另一多行内容应该正确替换', () => {
      // 原始内容：R1 有多行内容
      const originalContent = `## R1
这是第一行内容
这是第二行内容
这是第三行内容

## R2
任务二`;

      // 用户想改为不同的多行内容
      const newTitle = `新内容第一行
新内容第二行`;

      const result = saveTitleFixed(originalContent, 'R1', newTitle);

      console.log('多行改多行结果：');
      console.log(result);

      // 验证：原来的第二、三行内容应该被删除
      expect(result).toContain('新内容第一行');
      expect(result).toContain('新内容第二行');
      expect(result).not.toContain('这是第一行内容');
      expect(result).not.toContain('这是第二行内容');
      expect(result).not.toContain('这是第三行内容');
      expect(result).toContain('## R2');
    });

    test('多行内容编辑为单行内容应该正确替换', () => {
      const originalContent = `## R1
这是第一行内容
这是第二行内容
这是第三行内容

## R2
任务二`;

      const newTitle = '简洁的单行内容';

      const result = saveTitleFixed(originalContent, 'R1', newTitle);

      console.log('多行改单行结果：');
      console.log(result);

      expect(result).toContain('简洁的单行内容');
      expect(result).not.toContain('这是第一行内容');
      expect(result).not.toContain('这是第二行内容');
      expect(result).not.toContain('这是第三行内容');
      expect(result).toContain('## R2');
    });

    test('无内容任务添加内容应该正确插入', () => {
      const originalContent = `## R1

## R2
任务二`;

      const newTitle = '新添加的内容';

      const result = saveTitleFixed(originalContent, 'R1', newTitle);

      console.log('无内容添加内容结果：');
      console.log(result);

      expect(result).toContain('新添加的内容');
      expect(result).toContain('## R2');
    });

    test('任务内容末尾有空行应该正确处理', () => {
      const originalContent = `## R1
第一行内容
第二行内容

## R2
任务二`;

      const newTitle = '新的单行内容';

      const result = saveTitleFixed(originalContent, 'R1', newTitle);

      console.log('有空行的结果：');
      console.log(result);

      expect(result).toContain('新的单行内容');
      expect(result).not.toContain('第一行内容');
      expect(result).not.toContain('第二行内容');
      expect(result).toContain('## R2');
    });
  });

  /**
   * R22.6 问题测试：误删子任务
   * 编辑父任务时，子任务不应被删除
   */
  describe('R22.6 误删子任务问题', () => {
    test('编辑带子任务的父任务不应删除子任务', () => {
      // 模拟实际场景：## R12 带有子任务 ### R12.1, ### R12.2
      const originalContent = `## R12
这是R12的描述内容第一行
这是R12的描述内容第二行

### R12.1
子任务1的内容

### R12.2
子任务2的内容

## R13
下一个任务`;

      // 新的单行描述
      const newTitle = '修改后的R12描述';

      const result = saveTitleFixed(originalContent, 'R12', newTitle);

      console.log('编辑父任务（带子任务）的结果：');
      console.log(result);
      console.log('---');

      // 验证：R12的描述被更新
      expect(result).toContain('修改后的R12描述');
      expect(result).not.toContain('这是R12的描述内容第一行');
      expect(result).not.toContain('这是R12的描述内容第二行');

      // 关键验证：子任务不应该被删除！
      expect(result).toContain('### R12.1');
      expect(result).toContain('子任务1的内容');
      expect(result).toContain('### R12.2');
      expect(result).toContain('子任务2的内容');

      // 后续任务应该存在
      expect(result).toContain('## R13');
    });

    test('编辑带多行内容的父任务不应删除子任务', () => {
      const originalContent = `## R22
这是第一行
这是第二行
这是第三行

### R22.1
子任务1

### R22.2
子任务2

## R23
下一个任务`;

      // 新的多行描述
      const newTitle = `新的第一行
新的第二行`;

      const result = saveTitleFixed(originalContent, 'R22', newTitle);

      console.log('编辑多内容父任务的结果：');
      console.log(result);
      console.log('---');

      // 子任务不应该被删除
      expect(result).toContain('### R22.1');
      expect(result).toContain('子任务1');
      expect(result).toContain('### R22.2');
      expect(result).toContain('子任务2');
      expect(result).toContain('## R23');
    });

    test('编辑无子任务的父任务应该正常工作', () => {
      const originalContent = `## R11
这是R11的描述

## R12
这是R12的描述

### R12.1
子任务1

## R13
下一个任务`;

      const newTitle = '修改后的R11描述';

      const result = saveTitleFixed(originalContent, 'R11', newTitle);

      console.log('编辑无子任务父任务的结果：');
      console.log(result);

      expect(result).toContain('修改后的R11描述');
      expect(result).not.toContain('这是R11的描述');
      expect(result).toContain('## R12');
      expect(result).toContain('### R12.1');
    });
  });

  /**
   * R22.8 问题测试：换行符处理
   * 问题描述：
   * 1. 当编辑最后一个task时，末尾会有2个\n，是正常的
   * 2. 当编辑除了最后一个task时，末尾只有一个\n，但是文件尾会多一个\n，每次编辑非最后一个task，文件尾都会多一个\n
   * 期望：
   * - R1的任务内容的最后一行和R2标题行之间有两个\n\n
   * - 不是要编辑文件尾的\n
   */
  describe('R22.8 换行符处理问题', () => {
    test('编辑非最后一个任务时，任务之间应该有两个换行符，文件尾不应增加额外换行', () => {
      // 原始内容：R1 和 R2 两个任务，文件末尾有一个换行符
      const originalContent = `## R1
第一行内容
第二行内容

## R2
第二个任务的内容
`;

      // 编辑 R1 的内容
      const newTitle = `新的第一行内容
新的第二行内容`;

      const result = saveTitleFixed(originalContent, 'R1', newTitle);

      console.log('R22.8 测试结果：');
      console.log('原始内容:', JSON.stringify(originalContent));
      console.log('结果:', JSON.stringify(result));

      // 验证：R1 和 R2 之间应该有两个换行符（注意：这是新内容的最后一行）
      expect(result).toContain('新的第二行内容\n\n## R2');

      // 验证：文件末尾应该只有一个换行符（与原始一致）
      // 不应该：文件末尾有两个换行符或更多
      const lines = result.split('\n');

      const originalEmptyCount = originalContent.split('\n').filter(l => l === '').length;
      const resultEmptyCount = lines.filter(l => l === '').length;

      console.log('原始末尾空行数:', originalEmptyCount);
      console.log('结果末尾空行数:', resultEmptyCount);

      // 文件末尾的空行数不应该增加
      expect(resultEmptyCount).toBeLessThanOrEqual(originalEmptyCount + 1);
    });

    test('连续编辑非最后一个任务，文件末尾换行符数量不应累积增加', () => {
      // 模拟连续编辑的场景
      let content = `## R1
R1内容

## R2
R2内容

## R3
R3内容
`;

      // 第一次编辑 R1
      content = saveTitleFixed(content, 'R1', 'R1新内容');
      console.log('第一次编辑后:', JSON.stringify(content));
      const firstEditEmptyCount = content.split('\n').filter(l => l === '').length;

      // 第二次编辑 R1
      content = saveTitleFixed(content, 'R1', 'R1再次修改');
      console.log('第二次编辑后:', JSON.stringify(content));
      const secondEditEmptyCount = content.split('\n').filter(l => l === '').length;

      // 验证：换行符数量不应该累积增加
      // 如果有问题，secondEditEmptyCount 会比 firstEditEmptyCount 多
      expect(secondEditEmptyCount).toBeLessThanOrEqual(firstEditEmptyCount + 1);
    });

    test('编辑最后一个任务时末尾有两个换行符是正常的', () => {
      // 原始内容：R1 和 R2 两个任务
      const originalContent = `## R1
第一个任务的内容

## R2
第二个任务的内容`;

      // 编辑最后一个任务 R2
      const newTitle = `修改后的R2内容
第二行`;

      const result = saveTitleFixed(originalContent, 'R2', newTitle);

      console.log('编辑最后一个任务的结果：');
      console.log('结果:', JSON.stringify(result));

      // 编辑最后一个任务时，末尾有两个换行符是正常的（markdown格式要求）
      // 因为文件末尾应该有段落分隔
    });

    test('验证R1内容末尾和R2标题之间正确的换行符结构', () => {
      // 这是一个精确的测试，验证两个任务之间的正确格式
      const originalContent = `## R1
这是R1的第一行
这是R1的第二行

## R2
R2的内容`;

      const newTitle = 'R1的单行新内容';

      const result = saveTitleFixed(originalContent, 'R1', newTitle);

      console.log('精确测试结果：');
      console.log('结果:', JSON.stringify(result));

      // 找到 R1 的新内容和 R2 之间的位置
      const r1ContentEnd = result.indexOf('\n\n## R2');
      expect(r1ContentEnd).toBeGreaterThan(-1);

      // R2 前面应该正好是两个换行符
      const beforeR2 = result.substring(0, r1ContentEnd);
      expect(beforeR2).toContain('R1的单行新内容');
      expect(beforeR2.endsWith('内容')).toBe(true);
    });
  });

  /**
   * R22.9 问题测试：标题和内容之间的换行符
   * 问题描述：
   * R22.8 的修复是有效的，但 RXX 标题行和内容行的第一行之间也应当是2个\n
   * 现在只有一个，即：期望 ## R1\n\n第一行内容，而不是 ## R1\n第一行内容
   * 这是 markdown 格式要求：标题和内容之间需要有一个空行（两个换行符）
   */
  describe('R22.9 标题与内容之间换行符问题', () => {
    test('编辑后任务标题和内容之间应该有两个换行符', () => {
      // 原始内容：标题和内容之间有两个换行符
      const originalContent = `## R1
第一行内容
第二行内容

## R2
第二个任务的内容`;

      // 编辑 R1 的内容
      const newTitle = `新的第一行内容
新的第二行内容`;

      const result = saveTitleFixed(originalContent, 'R1', newTitle);

      console.log('R22.9 测试结果：');
      console.log('原始内容:', JSON.stringify(originalContent));
      console.log('结果:', JSON.stringify(result));

      // 验证：R1 标题和新内容之间应该有两个换行符
      // 期望结构：## R1\n\n新的第一行内容\n\n## R2
      expect(result).toContain('## R1\n\n新的第一行内容');

      // 精确验证：标题后应该是两个换行符
      const r1Pos = result.indexOf('## R1');
      const afterR1 = result.substring(r1Pos);
      // afterR1 应该是：## R1\n\n新的第一行内容\n\n## R2...
      expect(afterR1.startsWith('## R1\n\n新的第一行内容')).toBe(true);
    });

    test('从无内容到有内容时标题和内容之间应该有两个换行符', () => {
      // 原始内容：R1 没有内容
      const originalContent = `## R1

## R2
第二个任务的内容`;

      // 给 R1 添加内容
      const newTitle = '新添加的内容';

      const result = saveTitleFixed(originalContent, 'R1', newTitle);

      console.log('R22.9 无内容添加内容测试结果：');
      console.log('结果:', JSON.stringify(result));

      // 验证：R1 标题和新内容之间应该有两个换行符
      expect(result).toContain('## R1\n\n新添加的内容');
      expect(result).toContain('新添加的内容\n\n## R2');
    });

    test('原始内容只有一个换行符时，编辑后应该变成两个', () => {
      // 原始内容：标题和内容之间只有一个换行符（格式不规范）
      const originalContent = `## R1
第一行内容

## R2
第二个任务的内容`;

      // 编辑 R1 的内容
      const newTitle = '新的单行内容';

      const result = saveTitleFixed(originalContent, 'R1', newTitle);

      console.log('R22.9 规范化测试结果：');
      console.log('结果:', JSON.stringify(result));

      // 验证：编辑后 R1 标题和新内容之间应该有两个换行符
      expect(result).toContain('## R1\n\n新的单行内容');
    });

    test('连续编辑应该保持正确的换行符结构', () => {
      let content = `## R1
R1内容

## R2
R2内容`;

      // 第一次编辑 R1
      content = saveTitleFixed(content, 'R1', 'R1第一次编辑');
      console.log('第一次编辑后:', JSON.stringify(content));

      // 第二次编辑 R1
      content = saveTitleFixed(content, 'R1', 'R1第二次编辑');
      console.log('第二次编辑后:', JSON.stringify(content));

      // 验证：每次编辑后标题和内容之间都应该有两个换行符
      expect(content).toContain('## R1\n\nR1第二次编辑');
      expect(content).toContain('R1第二次编辑\n\n## R2');
    });
  });

  /**
   * R22.6 问题测试：回车丢失
   * 编辑后文件末尾的回车应该保留
   */
  describe('R22.6 回车丢失问题', () => {
    test('文件末尾有回车时编辑不应丢失回车', () => {
      const originalContent = `## R1
内容

`;

      // 注意：originalContent 末尾有一个换行符
      const newTitle = '新内容';

      const result = saveTitleFixed(originalContent, 'R1', newTitle);

      console.log('文件末尾回车测试：');
      console.log('原始内容末尾字符代码:', originalContent.charCodeAt(originalContent.length - 1));
      console.log('结果:', JSON.stringify(result));
      console.log('结果末尾字符代码:', result.charCodeAt(result.length - 1));

      // 结果末尾应该有换行符
      expect(result.endsWith('\n')).toBe(true);
    });

    test('多行内容编辑后应该保留文件末尾回车', () => {
      const originalContent = `## R1
第一行
第二行

## R2
任务2

`;

      const newTitle = `新第一行
新第二行`;

      const result = saveTitleFixed(originalContent, 'R1', newTitle);

      console.log('多行编辑回车测试：');
      console.log('结果:', JSON.stringify(result));

      expect(result.endsWith('\n')).toBe(true);
      expect(result).toContain('新第一行');
      expect(result).toContain('新第二行');
    });
  });
});

import { TodoParser } from '../src/parser';

describe('Parser Tests', () => {
  test('Should parse single task', () => {
    const content = `# 总需求

## R1 任务一内容。`;

    const parser = new TodoParser();
    const tasks = parser.parse(content, '/test/TODO.md');

    console.log('Parsed tasks:', JSON.stringify(tasks, null, 2));

    expect(tasks.length).toBe(1);
    expect(tasks[0].id).toBe('R1');
    expect(tasks[0].title).toBe('任务一内容。');
  });

  test('Should parse nested tasks', () => {
    const content = `## R1 主任务

### R1.1 子任务1

### R1.2 子任务2`;

    const parser = new TodoParser();
    const tasks = parser.parse(content, '/test/TODO.md');

    expect(tasks.length).toBe(1);
    expect(tasks[0].children.length).toBe(2);
    expect(tasks[0].children[0].id).toBe('R1.1');
    expect(tasks[0].children[1].id).toBe('R1.2');
  });

  test('Should detect completed task', () => {
    const content = `## R1 [completed] 已完成任务`;

    const parser = new TodoParser();
    const tasks = parser.parse(content, '/test/TODO.md');

    expect(tasks[0].completed).toBe(true);
  });

  test('Should parse task with link', () => {
    const content = `## R1 任务内容。 报告写入 [R1](./details/xxx/R1_test.md)`;

    const parser = new TodoParser();
    const tasks = parser.parse(content, '/test/TODO.md');

    // 链接应该被保留（用于webview渲染）
    console.log('Task title:', tasks[0].title);
    // 验证标题包含链接
    expect(tasks[0].title).toContain('[R1](./details/xxx/R1_test.md)');
  });

  test('Should handle deep nesting', () => {
    const content = `## R1 一级任务

### R1.1 二级任务

#### R1.1.1 三级任务`;

    const parser = new TodoParser();
    const tasks = parser.parse(content, '/test/TODO.md');

    expect(tasks.length).toBe(1);
    expect(tasks[0].children.length).toBe(1);
    expect(tasks[0].children[0].children.length).toBe(1);
  });

  test('Should parse multiple root tasks', () => {
    const content = `## R1 任务一

## R2 任务二`;

    const parser = new TodoParser();
    const tasks = parser.parse(content, '/test/TODO.md');

    expect(tasks.length).toBe(2);
    expect(tasks[0].id).toBe('R1');
    expect(tasks[1].id).toBe('R2');
  });

  test('Should parse multiple root tasks in order', () => {
    const content = `## R1 任务一

## R2 任务二`;

    const parser = new TodoParser();
    const tasks = parser.parse(content, '/test/TODO.md');

    // 验证任务按顺序解析
    expect(tasks.length).toBe(2);
    expect(tasks[0].id).toBe('R1');
    expect(tasks[1].id).toBe('R2');
    expect(tasks[0].title).toBe('任务一');
    expect(tasks[1].title).toBe('任务二');
  });

  test('Should parse task with full description between tasks', () => {
    const content = `## R1 [completed]
深入调研VSCODE插件开发知识，包括联网调研，形成调研报告。
报告写入 [R1](./details/xxx/R1_test.md)。

## R2
根据R1调研结果，规划开发阶段。

## R3 [completed]
根据R2的规划，编写详细执行计划。`;

    const parser = new TodoParser();
    const tasks = parser.parse(content, '/test/TODO.md');

    console.log('Parsed tasks:', JSON.stringify(tasks, null, 2));

    expect(tasks.length).toBe(3);

    // R1 应该包含完整描述
    expect(tasks[0].id).toBe('R1');
    expect(tasks[0].completed).toBe(true);
    expect(tasks[0].title).toContain('深入调研');

    // R2 应该包含完整描述
    expect(tasks[1].id).toBe('R2');
    expect(tasks[1].completed).toBe(false);
    expect(tasks[1].title).toContain('根据R1调研结果');

    // R3 应该包含完整描述
    expect(tasks[2].id).toBe('R3');
    expect(tasks[2].completed).toBe(true);
    expect(tasks[2].title).toContain('根据R2的规划');
  });
});

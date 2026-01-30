import { TodoParser } from '../src/parser';

describe('R53.9.3 Task Depth by ID', () => {
  /**
   * R53.9 问题：webview渲染的缩进层级应该由任务ID决定，而不是由 ## 的数量决定
   *
   * 期望行为：
   * - 无论使用 ## R1.1 还是 ### R1.1，R1.1 都应该被解析为 R1 的子任务
   * - R1.1 和 R1.1.1 应该被解析为同级（在渲染时都是2级缩进）
   * - 最大缩进层级为2级
   */

  test('R53.9.3: Same ID pattern should have same depth regardless of ## count', () => {
    // 使用 ## R1.1 和 ### R1.1 都应该将 R1.1 解析为 R1 的子任务
    const content = `## R1 任务一

## R1.1 子任务1（使用 ##）

### R1.1.1 子子任务（使用 ###）`;

    const parser = new TodoParser();
    const tasks = parser.parse(content, '/test/TODO.md');

    console.log('Parsed structure:', JSON.stringify(tasks, null, 2));

    // 期望：R1 是顶级任务
    expect(tasks.length).toBe(1);
    expect(tasks[0].id).toBe('R1');

    // 期望：R1.1 应该是 R1 的子任务
    expect(tasks[0].children.length).toBe(1);
    expect(tasks[0].children[0].id).toBe('R1.1');

    // 期望：R1.1.1 应该是 R1.1 的子任务
    expect(tasks[0].children[0].children.length).toBe(1);
    expect(tasks[0].children[0].children[0].id).toBe('R1.1.1');
  });

  test('R53.9.3: R1.1 and R1.1.1 should be siblings when max depth is 1', () => {
    // 当使用统一格式（如全部用 ##）时
    // 注意：根据ID层级，R1.1 是 R1 的子任务，R1.1.1 是 R1.1 的子任务
    // 所以 R1.1.1 和 R1.1.2 应该是 R1.1 的子任务（同级别）
    const content = `## R1 任务一

## R1.1 子任务1

## R1.1.1 子子任务1

## R1.1.2 子子任务2`;

    const parser = new TodoParser();
    const tasks = parser.parse(content, '/test/TODO.md');

    console.log('Parsed structure:', JSON.stringify(tasks, null, 2));

    // 期望：根据ID层级
    // R1 是顶级
    expect(tasks.length).toBe(1);
    expect(tasks[0].id).toBe('R1');

    // R1.1 是 R1 的子任务
    expect(tasks[0].children.length).toBe(1);
    expect(tasks[0].children[0].id).toBe('R1.1');

    // R1.1.1 和 R1.1.2 是 R1.1 的子任务（同级别）
    expect(tasks[0].children[0].children.length).toBe(2);
    expect(tasks[0].children[0].children[0].id).toBe('R1.1.1');
    expect(tasks[0].children[0].children[1].id).toBe('R1.1.2');
  });

  test('R53.9.3: Nested tasks should be determined by ID prefix', () => {
    const content = `## R1 一级任务

## R1.1 二级任务

## R1.2 二级任务

## R2 一级任务

## R2.1 二级任务`;

    const parser = new TodoParser();
    const tasks = parser.parse(content, '/test/TODO.md');

    console.log('Parsed structure:', JSON.stringify(tasks, null, 2));

    // 根据ID层级，R1 和 R2 都是顶级任务（没有父子关系）
    // R1.1 和 R1.2 是 R1 的子任务
    // R2.1 是 R2 的子任务
    expect(tasks.length).toBe(2);
    expect(tasks[0].id).toBe('R1');
    expect(tasks[1].id).toBe('R2');

    // R1.1 和 R1.2 是 R1 的子任务
    expect(tasks[0].children.length).toBe(2);
    expect(tasks[0].children[0].id).toBe('R1.1');
    expect(tasks[0].children[1].id).toBe('R1.2');

    // R2.1 是 R2 的子任务
    expect(tasks[1].children.length).toBe(1);
    expect(tasks[1].children[0].id).toBe('R2.1');
  });

  test('R53.9.3: Deep nesting by ID should work correctly', () => {
    const content = `## R1

## R1.1

## R1.1.1

## R1.1.1.1

## R1.2

## R1.2.1`;

    const parser = new TodoParser();
    const tasks = parser.parse(content, '/test/TODO.md');

    console.log('Parsed structure:', JSON.stringify(tasks, null, 2));

    // R1 是顶级
    expect(tasks.length).toBe(1);
    expect(tasks[0].id).toBe('R1');

    // R1.1 和 R1.2 是 R1 的子任务
    expect(tasks[0].children.length).toBe(2);
    expect(tasks[0].children[0].id).toBe('R1.1');
    expect(tasks[0].children[1].id).toBe('R1.2');

    // R1.1.1 是 R1.1 的子任务
    expect(tasks[0].children[0].children.length).toBe(1);
    expect(tasks[0].children[0].children[0].id).toBe('R1.1.1');

    // R1.1.1.1 是 R1.1.1 的子任务
    expect(tasks[0].children[0].children[0].children.length).toBe(1);
    expect(tasks[0].children[0].children[0].children[0].id).toBe('R1.1.1.1');

    // R1.2.1 是 R1.2 的子任务
    expect(tasks[0].children[1].children.length).toBe(1);
    expect(tasks[0].children[1].children[0].id).toBe('R1.2.1');
  });

  test('R53.9.3: Mixed ## levels should still use ID for hierarchy', () => {
    // 即使混合使用 ##, ###, ####，也应该根据ID判断层级
    const content = `## R1 一级

### R1.1 二级（用 ###）

#### R1.1.1 三级（用 ####）

### R1.2 二级（用 ###）

## R2 一级（用 ##）`;

    const parser = new TodoParser();
    const tasks = parser.parse(content, '/test/TODO.md');

    console.log('Parsed structure:', JSON.stringify(tasks, null, 2));

    // 期望：R1 和 R2 都是顶级任务（忽略 ## 数量）
    expect(tasks.length).toBe(2);
    expect(tasks[0].id).toBe('R1');
    expect(tasks[1].id).toBe('R2');

    // R1.1 和 R1.2 应该是 R1 的子任务
    expect(tasks[0].children.length).toBe(2);
    expect(tasks[0].children[0].id).toBe('R1.1');
    expect(tasks[0].children[1].id).toBe('R1.2');

    // R1.1.1 应该是 R1.1 的子任务
    expect(tasks[0].children[0].children.length).toBe(1);
    expect(tasks[0].children[0].children[0].id).toBe('R1.1.1');
  });
});

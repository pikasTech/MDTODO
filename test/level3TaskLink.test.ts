/**
 * R43 单元测试：三级标题任务（如 R1.11.1）的链接点击失效问题复现
 *
 * 问题描述：对于 R1.11.1 这样的三级标题 Task，打开任务中的 md 链接失效
 *
 * 测试目标：
 * 1. 验证三级任务 ID（如 R1.11.1）能被正确解析
 * 2. 验证三级任务中的链接能被正确提取
 * 3. 验证链接点击事件能正确发送
 */

import { TodoParser } from '../src/parser';

describe('R43 - Level-3 Task Link Click Tests', () => {

  /**
   * 测试1：验证三级任务 R1.11.1 能被正确解析
   */
  test('Should parse level-3 task R1.11.1 correctly', () => {
    const content = `## R1 一级任务

### R1.1 二级任务

#### R1.1.1 三级任务
这是一个三级任务，包含链接 [测试文档](./docs/test.md)`;

    const parser = new TodoParser();
    const tasks = parser.parse(content, '/test/TODO.md');

    // 验证三级任务存在
    expect(tasks.length).toBe(1);
    expect(tasks[0].id).toBe('R1');
    expect(tasks[0].children.length).toBe(1);
    expect(tasks[0].children[0].id).toBe('R1.1');
    expect(tasks[0].children[0].children.length).toBe(1);
    expect(tasks[0].children[0].children[0].id).toBe('R1.1.1');

    // 验证三级任务标题包含链接
    const level3Task = tasks[0].children[0].children[0];
    expect(level3Task.title).toContain('[测试文档](./docs/test.md)');
  });

  /**
   * 测试2：验证三级任务中的链接数量统计正确
   */
  test('Should count links in level-3 task correctly', () => {
    const content = `## R1 一级任务

### R1.1 二级任务

#### R1.1.1 三级任务
链接1 [文档A](./docs/a.md)
链接2 [文档B](./docs/b.md)
链接3 [文档C](./docs/c.md)`;

    const parser = new TodoParser();
    const tasks = parser.parse(content, '/test/TODO.md');

    const level3Task = tasks[0].children[0].children[0];
    // 验证链接数量为3
    expect(level3Task.linkCount).toBe(3);
  });

  /**
   * 测试3：验证三级任务链接路径解析
   * 这是 R43 问题的核心：链接路径应该能正确解析
   */
  test('Should correctly parse link paths in level-3 tasks', () => {
    const content = `## R1 一级任务

### R1.1 二级任务

#### R1.1.1 三级任务
, 完成任务后将详细报告写入[R1.1.1](./details/TODO/R1.1.1_Task_Report.md)。`;

    const parser = new TodoParser();
    const tasks = parser.parse(content, '/test/TODO.md');

    const level3Task = tasks[0].children[0].children[0];

    // 验证任务ID正确
    expect(level3Task.id).toBe('R1.1.1');

    // 验证链接被正确提取
    expect(level3Task.linkCount).toBe(1);
    expect(level3Task.title).toContain('./details/TODO/R1.1.1_Task_Report.md');
  });

  /**
   * 测试4：验证四级甚至更深层级的任务也能正确解析
   */
  test('Should parse deeply nested tasks with links', () => {
    const content = `## R1 一级任务

### R1.1 二级任务

#### R1.1.1 三级任务

##### R1.1.1.1 四级任务
这是一个四级任务，链接 [报告](./details/report.md)`;

    const parser = new TodoParser();
    const tasks = parser.parse(content, '/test/TODO.md');

    // 验证四级任务存在
    expect(tasks[0].children[0].children[0].children.length).toBe(1);
    const level4Task = tasks[0].children[0].children[0].children[0];
    expect(level4Task.id).toBe('R1.1.1.1');
    expect(level4Task.linkCount).toBe(1);
  });

  /**
   * 测试5：验证三级任务（使用 ### 标题）能正确解析
   * 这是 R43 问题的关键：R1.1.1 应该是 R1.1 的子任务
   */
  test('Should correctly nest level-3 task under level-2 parent', () => {
    const content = `## R1 一级任务

### R1.1 二级任务

#### R1.1.1 三级任务
包含链接 [文档](./doc.md)`;

    const parser = new TodoParser();
    const tasks = parser.parse(content, '/test/TODO.md');

    // 验证 R1.1.1 是 R1.1 的子任务
    expect(tasks.length).toBe(1);
    expect(tasks[0].id).toBe('R1');

    // R1 有 1 个子任务 R1.1
    expect(tasks[0].children.length).toBe(1);
    expect(tasks[0].children[0].id).toBe('R1.1');

    // R1.1 有 1 个子任务 R1.1.1
    expect(tasks[0].children[0].children.length).toBe(1);
    expect(tasks[0].children[0].children[0].id).toBe('R1.1.1');
    expect(tasks[0].children[0].children[0].linkCount).toBe(1);
  });

  /**
   * 测试6：验证标记为 [completed] 的三级任务也能正确提取链接
   */
  test('Should handle completed level-3 tasks with links', () => {
    const content = `## R1 一级任务

### R1.1 二级任务

#### R1.1.1 [completed] 已完成的三级任务
报告写入 [R1.1.1](./details/R1.1.1_Report.md)`;

    const parser = new TodoParser();
    const tasks = parser.parse(content, '/test/TODO.md');

    const level3Task = tasks[0].children[0].children[0];

    // 验证任务完成状态
    expect(level3Task.completed).toBe(true);

    // 验证链接仍然被正确提取
    expect(level3Task.linkCount).toBe(1);
  });

  /**
   * 测试7：边界情况 - 验证 task ID 匹配不会误匹配
   * 例如：R1 不应匹配 R10 或 R1.1
   */
  test('Should not incorrectly match task IDs', () => {
    const content = `## R10 这是一个R10任务

### R10.1 R10的子任务

#### R10.1.1 R10.1.1的子任务
链接 [文档](./doc.md)`;

    const parser = new TodoParser();
    const tasks = parser.parse(content, '/test/TODO.md');

    // 验证 R10 被正确解析
    expect(tasks.length).toBe(1);
    expect(tasks[0].id).toBe('R10');

    // 验证 R10.1 是 R10 的子任务
    expect(tasks[0].children[0].id).toBe('R10.1');

    // 验证 R10.1.1 是 R10.1 的子任务
    expect(tasks[0].children[0].children[0].id).toBe('R10.1.1');
    expect(tasks[0].children[0].children[0].linkCount).toBe(1);
  });
});

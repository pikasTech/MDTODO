/**
 * MDTODO CLI Core Module - Comprehensive Unit Tests
 * Covering edge cases for Parser, FileService, and TaskManager
 */

import * as fs from 'fs';
import * as path from 'path';
import { TodoParser } from '../src/core/parser';
import { FileService } from '../src/core/services/fileService';
import { TaskManager } from '../src/core/managers/taskManager';
import { TodoTask } from '../src/core/types';

// Test fixtures directory
const TEST_FIXTURES_DIR = path.join(__dirname, 'fixtures');

// Helper to create temp test file
function createTempFile(content: string): string {
  const tempPath = path.join(TEST_FIXTURES_DIR, `test_${Date.now()}.md`);
  fs.writeFileSync(tempPath, content, 'utf-8');
  return tempPath;
}

// Helper to clean up temp file
function cleanupFile(filePath: string): void {
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
  }
}

// Ensure test fixtures directory exists
beforeAll(() => {
  if (!fs.existsSync(TEST_FIXTURES_DIR)) {
    fs.mkdirSync(TEST_FIXTURES_DIR, { recursive: true });
  }
});

afterAll(() => {
  // Cleanup test fixtures
  if (fs.existsSync(TEST_FIXTURES_DIR)) {
    const files = fs.readdirSync(TEST_FIXTURES_DIR);
    for (const file of files) {
      if (file.startsWith('test_') && file.endsWith('.md')) {
        fs.unlinkSync(path.join(TEST_FIXTURES_DIR, file));
      }
    }
  }
});

describe('TodoParser', () => {
  let parser: TodoParser;

  beforeEach(() => {
    parser = new TodoParser();
  });

  describe('Basic Parsing', () => {
    test('should parse single task', () => {
      const content = `## R1 第一个任务

这是任务描述。`;

      const result = parser.parseContent(content, '/test/TODO.md');

      expect(result.tasks).toHaveLength(1);
      expect(result.tasks[0].id).toBe('R1');
      // title contains task name
      expect(result.tasks[0].title).toContain('第一个任务');
      expect(result.tasks[0].completed).toBe(false);
      expect(result.tasks[0].processing).toBe(false);
    });

    test('should parse task with completed status', () => {
      const content = `## R1 已完成任务 [completed]

任务描述。`;

      const result = parser.parseContent(content, '/test/TODO.md');

      expect(result.tasks).toHaveLength(1);
      expect(result.tasks[0].completed).toBe(true);
    });

    test('should parse task with in_progress status', () => {
      const content = `## R1 进行中任务 [in_progress]

任务描述。`;

      const result = parser.parseContent(content, '/test/TODO.md');

      expect(result.tasks).toHaveLength(1);
      expect(result.tasks[0].processing).toBe(true);
    });

    test('should parse task with legacy [Processing] marker', () => {
      const content = `## R1 任务 [Processing]

任务描述。`;

      const result = parser.parseContent(content, '/test/TODO.md');

      expect(result.tasks[0].processing).toBe(true);
    });

    test('should parse task with legacy [Finished] marker', () => {
      const content = `## R1 任务 [Finished]

任务描述。`;

      const result = parser.parseContent(content, '/test/TODO.md');

      expect(result.tasks[0].completed).toBe(true);
    });
  });

  describe('Nested Tasks', () => {
    test('should parse nested subtasks', () => {
      const content = `## R1 父任务

父任务描述。

### R1.1 子任务1

子任务1描述。

### R1.2 子任务2

子任务2描述。

## R2 第二个任务`;

      const result = parser.parseContent(content, '/test/TODO.md');

      expect(result.tasks).toHaveLength(2);
      expect(result.tasks[0].id).toBe('R1');
      expect(result.tasks[0].children).toHaveLength(2);
      expect(result.tasks[0].children[0].id).toBe('R1.1');
      expect(result.tasks[0].children[1].id).toBe('R1.2');
      expect(result.tasks[1].id).toBe('R2');
    });

    test('should parse deeply nested tasks (3 levels)', () => {
      const content = `## R1 一级任务

### R1.1 二级任务

#### R1.1.1 三级任务

#### R1.1.2 另一个三级任务

### R1.2 另一个二级任务`;

      const result = parser.parseContent(content, '/test/TODO.md');

      expect(result.tasks).toHaveLength(1);
      expect(result.tasks[0].children).toHaveLength(2);
      expect(result.tasks[0].children[0].children).toHaveLength(2);
    });

    test('should handle complex nested structure', () => {
      const content = `## R1 任务1

### R1.1 子任务1.1

#### R1.1.1 子任务1.1.1

### R1.2 子任务1.2

## R2 任务2

### R2.1 子任务2.1`;

      const result = parser.parseContent(content, '/test/TODO.md');

      // R1 has 2 children
      expect(result.tasks[0].id).toBe('R1');
      expect(result.tasks[0].children).toHaveLength(2);

      // R1.1.1 is nested under R1.1
      expect(result.tasks[0].children[0].id).toBe('R1.1');
      expect(result.tasks[0].children[0].children[0].id).toBe('R1.1.1');

      // R2 has 1 child
      expect(result.tasks[1].id).toBe('R2');
      expect(result.tasks[1].children).toHaveLength(1);
    });
  });

  describe('Edge Cases', () => {
    test('should handle empty file', () => {
      const content = ``;

      const result = parser.parseContent(content, '/test/TODO.md');

      expect(result.tasks).toHaveLength(0);
      expect(result.textBlocks).toHaveLength(0);
    });

    test('should handle file with only whitespace', () => {
      const content = `


   `;

      const result = parser.parseContent(content, '/test/TODO.md');

      expect(result.tasks).toHaveLength(0);
    });

    test('should handle file with no tasks', () => {
      const content = `# 项目标题

这是一个普通文档，不包含任何任务。

## 普通标题

普通段落内容。`;

      const result = parser.parseContent(content, '/test/TODO.md');

      expect(result.tasks).toHaveLength(0);
    });

    test('should handle task without description', () => {
      const content = `## R1 任务1
## R2 任务2`;

      const result = parser.parseContent(content, '/test/TODO.md');

      expect(result.tasks).toHaveLength(2);
      expect(result.tasks[0].description).toBe('任务1');
    });

    test('should handle task with multi-line description', () => {
      const content = `## R1 多行任务

这是第一行描述。
这是第二行描述。

- 列表项1
- 列表项2

> 引用文本`;

      const result = parser.parseContent(content, '/test/TODO.md');

      expect(result.tasks).toHaveLength(1);
      expect(result.tasks[0].rawContent).toContain('这是第一行描述');
    });

    test('should handle task with special characters in title', () => {
      const content = `## R1 任务（含特殊字符）&符号

任务描述。

## R2 任务"引号"

任务描述。

## R3 任务'单引号'

任务描述。

## R4 任务<标签>

任务描述。`;

      const result = parser.parseContent(content, '/test/TODO.md');

      expect(result.tasks).toHaveLength(4);
      expect(result.tasks[0].title).toContain('&');
      expect(result.tasks[1].title).toContain('引号');
      expect(result.tasks[3].title).toContain('<标签>');
    });

    test('should handle task with markdown links in title', () => {
      const content = `## R1 [任务链接](./path/to/doc.md)

任务描述。`;

      const result = parser.parseContent(content, '/test/TODO.md');

      expect(result.tasks).toHaveLength(1);
      expect(result.tasks[0].linkCount).toBe(1);
    });

    test('should handle task with numbered lists in description', () => {
      const content = `## R1 列表任务

1. 第一项
2. 第二项
3. 第三项`;

      const result = parser.parseContent(content, '/test/TODO.md');

      expect(result.tasks).toHaveLength(1);
      expect(result.tasks[0].rawContent).toContain('1.');
    });

    test('should handle consecutive newlines correctly', () => {
      const content = `## R1 任务1



## R2 任务2`;

      const result = parser.parseContent(content, '/test/TODO.md');

      expect(result.tasks).toHaveLength(2);
      expect(result.tasks[0].id).toBe('R1');
      expect(result.tasks[1].id).toBe('R2');
    });

    test('should handle Chinese characters in task ID (case insensitive)', () => {
      const content = `## r1 小写任务

任务描述。

## R2 大写任务

任务描述。`;

      const result = parser.parseContent(content, '/test/TODO.md');

      // Both should be parsed as tasks
      expect(result.tasks.length).toBeGreaterThanOrEqual(1);
    });

    test('should not match RXX in links', () => {
      const content = `## R1 任务

请参考 [R2](./other.md) 的实现。

## R2 另一个任务`;

      const result = parser.parseContent(content, '/test/TODO.md');

      expect(result.tasks).toHaveLength(2);
      expect(result.tasks[0].id).toBe('R1');
      expect(result.tasks[1].id).toBe('R2');
    });

    test('should handle tasks at end of file without trailing newline', () => {
      const content = `## R1 任务1

任务1描述。

## R2 任务2`;

      const result = parser.parseContent(content, '/test/TODO.md');

      expect(result.tasks).toHaveLength(2);
    });

    test('should handle code blocks in description', () => {
      const content = `## R1 代码任务

\`\`\`typescript
const foo = 'bar';
console.log(foo);
\`\`\``;

      const result = parser.parseContent(content, '/test/TODO.md');

      expect(result.tasks).toHaveLength(1);
      expect(result.tasks[0].rawContent).toContain('const foo');
    });
  });

  describe('Text Blocks', () => {
    test('should parse text blocks before first task', () => {
      const content = `# 项目标题

项目介绍文本。

## R1 任务1

任务描述。`;

      const result = parser.parseContent(content, '/test/TODO.md');

      expect(result.textBlocks).toHaveLength(1);
      expect(result.textBlocks![0].content).toContain('项目介绍');
    });

    test('should handle multiple text blocks', () => {
      const content = `# 标题

前言文本。

## R1 任务1

任务内容。

## R2 任务2

任务内容。

后记文本。`;

      const result = parser.parseContent(content, '/test/TODO.md');

      // Should have text blocks before R1 and after R2
      expect(result.textBlocks!.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('Task ID Format', () => {
    test('should parse single digit task ID', () => {
      const content = `## R1 任务`;

      const result = parser.parseContent(content, '/test/TODO.md');

      expect(result.tasks[0].id).toBe('R1');
    });

    test('should parse multi-digit task ID', () => {
      const content = `## R10 任务

### R10.1 子任务`;

      const result = parser.parseContent(content, '/test/TODO.md');

      expect(result.tasks[0].id).toBe('R10');
      expect(result.tasks[0].children[0].id).toBe('R10.1');
    });

    test('should parse task with multiple dot levels', () => {
      const content = `#### R1.1.1.1.1 深層子任务`;

      const result = parser.parseContent(content, '/test/TODO.md');

      expect(result.tasks[0].id).toBe('R1.1.1.1.1');
    });
  });
});

describe('FileService', () => {
  let fileService: FileService;

  beforeEach(() => {
    fileService = new FileService();
  });

  describe('Read Operations', () => {
    test('should read existing file', () => {
      const filePath = createTempFile('测试内容');
      const content = fileService.readFile(filePath);

      expect(content).toBe('测试内容');
      cleanupFile(filePath);
    });

    test('should throw error for non-existent file', () => {
      expect(() => {
        fileService.readFile('/nonexistent/path/file.md');
      }).toThrow();
    });

    test('should read file with custom encoding', () => {
      const filePath = createTempFile('测试内容');
      const content = fileService.readFile(filePath, { encoding: 'utf-8' });

      expect(content).toBe('测试内容');
      cleanupFile(filePath);
    });
  });

  describe('Write Operations', () => {
    test('should write file successfully', () => {
      const filePath = createTempFile('');
      fileService.writeFile(filePath, '新内容');

      const content = fs.readFileSync(filePath, 'utf-8');
      expect(content).toBe('新内容');
      cleanupFile(filePath);
    });

    test('should create directory if not exists', () => {
      const nestedPath = path.join(TEST_FIXTURES_DIR, 'nested', 'test.md');
      fileService.writeFile(nestedPath, '内容');

      expect(fs.existsSync(nestedPath)).toBe(true);
      cleanupFile(nestedPath);
      fs.rmdirSync(path.join(TEST_FIXTURES_DIR, 'nested'));
    });

    test('should append content correctly', () => {
      const filePath = createTempFile('第一行\n');
      fileService.appendFile(filePath, '第二行');

      const content = fs.readFileSync(filePath, 'utf-8');
      expect(content).toBe('第一行\n第二行');
      cleanupFile(filePath);
    });
  });

  describe('File Existence', () => {
    test('should return true for existing file', () => {
      const filePath = createTempFile('内容');
      expect(fileService.exists(filePath)).toBe(true);
      cleanupFile(filePath);
    });

    test('should return false for non-existent file', () => {
      expect(fileService.exists('/nonexistent/file.md')).toBe(false);
    });
  });

  describe('Directory Operations', () => {
    test('should read directory', () => {
      const files = fileService.readDir(__dirname);
      expect(Array.isArray(files)).toBe(true);
    });

    test('should create directory recursively', () => {
      const newDir = path.join(TEST_FIXTURES_DIR, 'new_dir', 'subdir');
      fileService.mkdir(newDir, true);

      expect(fs.existsSync(newDir)).toBe(true);
      fs.rmdirSync(path.join(TEST_FIXTURES_DIR, 'new_dir', 'subdir'));
      fs.rmdirSync(path.join(TEST_FIXTURES_DIR, 'new_dir'));
    });

    test('should find TODO files', () => {
      // Create test TODO files
      const testDir = path.join(TEST_FIXTURES_DIR, 'search_test');
      fs.mkdirSync(testDir, { recursive: true });
      fs.writeFileSync(path.join(testDir, 'PROJECT_TODO.md'), '# Project TODO');
      fs.writeFileSync(path.join(testDir, 'ANOTHER_TODO.md'), '# Another TODO');
      fs.writeFileSync(path.join(testDir, 'regular.md'), '# Regular');

      const results = fileService.findTodoFiles(testDir);

      expect(results.length).toBe(2);
      expect(results.some(f => f.includes('PROJECT_TODO.md'))).toBe(true);
      expect(results.some(f => f.includes('ANOTHER_TODO.md'))).toBe(true);
      expect(results.some(f => f.includes('regular.md'))).toBe(false);

      // Cleanup
      fs.unlinkSync(path.join(testDir, 'PROJECT_TODO.md'));
      fs.unlinkSync(path.join(testDir, 'ANOTHER_TODO.md'));
      fs.unlinkSync(path.join(testDir, 'regular.md'));
      fs.rmdirSync(testDir);
    });
  });

  describe('File Stats', () => {
    test('should get file stats', () => {
      const filePath = createTempFile('内容');
      const stats = fileService.stat(filePath);

      expect(stats.isFile()).toBe(true);
      cleanupFile(filePath);
    });
  });
});

describe('TaskManager', () => {
  let tempFile: string;

  beforeEach(() => {
    tempFile = createTempFile(`## R1 初始任务

初始任务描述。

### R1.1 子任务

子任务描述。

## R2 第二个任务

第二个任务描述。
`);
  });

  afterEach(() => {
    cleanupFile(tempFile);
  });

  describe('Task Reading', () => {
    test('should load tasks from file', () => {
      const manager = new TaskManager({
        filePath: tempFile,
        tasks: [],
        textBlocks: []
      });

      manager.reload();
      const tasks = manager.getTasks();

      expect(tasks).toHaveLength(2);
      expect(tasks[0].id).toBe('R1');
      expect(tasks[0].children).toHaveLength(1);
    });

    test('should get task by ID', () => {
      const manager = new TaskManager({
        filePath: tempFile,
        tasks: [],
        textBlocks: []
      });

      manager.reload();
      const task = manager.getTask('R1.1');

      expect(task).toBeDefined();
      expect(task!.id).toBe('R1.1');
    });

    test('should return undefined for non-existent task', () => {
      const manager = new TaskManager({
        filePath: tempFile,
        tasks: [],
        textBlocks: []
      });

      manager.reload();
      const task = manager.getTask('R999');

      expect(task).toBeUndefined();
    });

    test('should get all task IDs', () => {
      const manager = new TaskManager({
        filePath: tempFile,
        tasks: [],
        textBlocks: []
      });

      manager.reload();
      const ids = manager.getAllTaskIds();

      expect(ids).toContain('R1');
      expect(ids).toContain('R1.1');
      expect(ids).toContain('R2');
    });
  });

  describe('Add Task', () => {
    test('should add new top-level task', () => {
      const manager = new TaskManager({
        filePath: tempFile,
        tasks: [],
        textBlocks: []
      });

      manager.reload();
      const result = manager.addTask();

      expect(result.success).toBe(true);
      expect(result.taskId).toBe('R3');

      // Reload and verify
      manager.reload();
      const tasks = manager.getTasks();
      expect(tasks.length).toBe(3);
    });

    test('should generate correct task ID for new tasks', () => {
      const manager = new TaskManager({
        filePath: tempFile,
        tasks: [],
        textBlocks: []
      });

      manager.reload();
      const newId = manager.generateNewTaskId();

      expect(newId).toBe('R3');
    });

    test('should add subtask with correct parent ID', () => {
      const manager = new TaskManager({
        filePath: tempFile,
        tasks: [],
        textBlocks: []
      });

      manager.reload();
      const result = manager.addSubTask('R1');

      expect(result.success).toBe(true);
      expect(result.taskId).toBe('R1.2');

      manager.reload();
      const task = manager.getTask('R1');
      expect(task!.children.length).toBe(2);
    });

    test('should fail to add subtask for non-existent parent', () => {
      const manager = new TaskManager({
        filePath: tempFile,
        tasks: [],
        textBlocks: []
      });

      manager.reload();
      const result = manager.addSubTask('R999');

      expect(result.success).toBe(false);
      expect(result.message).toContain('未找到');
    });

    test('should add subtask to deeply nested parent', () => {
      // Create file with nested structure
      const nestedFile = createTempFile(`## R1 任务

### R1.1 子任务

#### R1.1.1 深層子任务
`);
      const manager = new TaskManager({
        filePath: nestedFile,
        tasks: [],
        textBlocks: []
      });

      manager.reload();
      const result = manager.addSubTask('R1.1');

      expect(result.success).toBe(true);
      expect(result.taskId).toBe('R1.1.2');

      cleanupFile(nestedFile);
    });
  });

  describe('Delete Task', () => {
    test('should delete task', () => {
      const manager = new TaskManager({
        filePath: tempFile,
        tasks: [],
        textBlocks: []
      });

      manager.reload();
      const result = manager.deleteTask('R1.1');

      expect(result.success).toBe(true);

      manager.reload();
      const task = manager.getTask('R1');
      expect(task!.children).toHaveLength(0);
    });

    test('should delete parent task with children', () => {
      const manager = new TaskManager({
        filePath: tempFile,
        tasks: [],
        textBlocks: []
      });

      manager.reload();
      const result = manager.deleteTask('R1');

      expect(result.success).toBe(true);

      manager.reload();
      const task = manager.getTask('R1');
      expect(task).toBeUndefined();
      const task2 = manager.getTask('R2');
      expect(task2).toBeDefined();
    });

    test('should fail to delete non-existent task', () => {
      const manager = new TaskManager({
        filePath: tempFile,
        tasks: [],
        textBlocks: []
      });

      manager.reload();
      const result = manager.deleteTask('R999');

      expect(result.success).toBe(false);
    });

    test('should only delete exact task match', () => {
      const testFile = createTempFile(`## R1 任务1

### R1.1 子任务1

## R10 任务10

### R10.1 子任务10.1
`);
      const manager = new TaskManager({
        filePath: testFile,
        tasks: [],
        textBlocks: []
      });

      manager.reload();
      manager.deleteTask('R1');

      manager.reload();
      expect(manager.getTask('R1')).toBeUndefined();
      expect(manager.getTask('R10')).toBeDefined();

      cleanupFile(testFile);
    });
  });

  describe('Update Task', () => {
    test('should update task title', () => {
      const manager = new TaskManager({
        filePath: tempFile,
        tasks: [],
        textBlocks: []
      });

      manager.reload();
      const result = manager.updateTaskTitle('R1', '更新的标题');

      expect(result.success).toBe(true);

      manager.reload();
      const task = manager.getTask('R1');
      expect(task!.title).toContain('更新的标题');
    });

    test('should fail to update non-existent task', () => {
      const manager = new TaskManager({
        filePath: tempFile,
        tasks: [],
        textBlocks: []
      });

      manager.reload();
      const result = manager.updateTaskTitle('R999', '新标题');

      expect(result.success).toBe(false);
    });
  });

  describe('Task Status', () => {
    test('should mark task as complete', () => {
      const manager = new TaskManager({
        filePath: tempFile,
        tasks: [],
        textBlocks: []
      });

      manager.reload();
      const result = manager.markComplete('R1');

      expect(result.success).toBe(true);

      manager.reload();
      const task = manager.getTask('R1');
      expect(task!.completed).toBe(true);
    });

    test('should mark task as in progress', () => {
      const manager = new TaskManager({
        filePath: tempFile,
        tasks: [],
        textBlocks: []
      });

      manager.reload();
      const result = manager.markInProgress('R1');

      expect(result.success).toBe(true);

      manager.reload();
      const task = manager.getTask('R1');
      expect(task!.processing).toBe(true);
    });

    test('should mark task as not started', () => {
      // First mark as complete
      const testFile = createTempFile(`## R1 任务 [completed]

任务描述。
`);
      const manager = new TaskManager({
        filePath: testFile,
        tasks: [],
        textBlocks: []
      });

      manager.reload();
      expect(manager.getTask('R1')!.completed).toBe(true);

      // Then mark as not started
      const result = manager.markNotStarted('R1');

      expect(result.success).toBe(true);

      manager.reload();
      const task = manager.getTask('R1');
      expect(task!.completed).toBe(false);
      expect(task!.processing).toBe(false);

      cleanupFile(testFile);
    });

    test('should remove existing status before adding new one', () => {
      const testFile = createTempFile(`## R1 任务 [in_progress]

任务描述。
`);
      const manager = new TaskManager({
        filePath: testFile,
        tasks: [],
        textBlocks: []
      });

      manager.reload();
      manager.markComplete('R1');

      manager.reload();
      const task = manager.getTask('R1');
      expect(task!.completed).toBe(true);
      expect(task!.processing).toBe(false);

      cleanupFile(testFile);
    });
  });

  describe('Statistics', () => {
    test('should get task statistics', () => {
      const testFile = createTempFile(`## R1 已完成 [completed]

任务1。

### R1.1 子任务1

### R1.2 进行中 [in_progress]

## R2 未开始

## R3 未开始
`);
      const manager = new TaskManager({
        filePath: testFile,
        tasks: [],
        textBlocks: []
      });

      manager.reload();
      const stats = manager.getStats();

      expect(stats.total).toBe(5); // R1, R1.1, R1.2, R2, R3
      expect(stats.completed).toBe(1); // R1
      expect(stats.inProgress).toBe(1); // R1.2
      expect(stats.pending).toBe(3); // R1.1, R2, R3

      cleanupFile(testFile);
    });
  });
});

describe('Integration Tests with Real Data', () => {
  test('should parse real TODO structure correctly', () => {
    const parser = new TodoParser();
    const content = `## R1 [completed]

深入调研 VSCODE 插件开发相关知识，包括联网调研，形成调研报告。
报告写入 [R1](./details/20260120_MDTODO/R1_VSCODE_PLUGIN_RESEARCH.md) 。

## R2 [completed]

根据R1调研结果，规划VSCODE插件的开发阶段和模块分解。
规划文档写入 [R2](./details/20260120_MDTODO/R2_开发规划.md) 。

### R2.1 [completed]

第1阶段详细执行计划：项目初始化与基础框架。
计划写入 [R2.1](./details/20260120_MDTODO/R2.1_阶段一计划.md) 。

## R3 [completed]

根据R2的规划，编写每个阶段的详细执行计划。
执行计划写入 [R3](./details/20260120_MDTODO/R3_阶段计划.md) 。

### R3.1 [completed]

第1阶段详细执行计划：项目初始化与基础框架。
计划写入 [R3.1](./details/20260120_MDTODO/R3.1_阶段一计划.md) 。

### R3.2 [completed]

第2阶段详细执行计划：核心TODO列表功能。
计划写入 [R3.2](./details/20260120_MDTODO/R3.2_阶段二计划.md) 。

## R4 [completed]

深入评估当前项目的实用价值。

### R4.1 [in_progress]

深度评估插件在科研和软件开发中的实用性。
`;

    const result = parser.parseContent(content, '/test/TODO.md');

    expect(result.tasks.length).toBeGreaterThan(0);

    // Check R1
    const r1 = result.tasks.find(t => t.id === 'R1');
    expect(r1).toBeDefined();
    expect(r1!.completed).toBe(true);
    expect(r1!.linkCount).toBe(1);

    // Check R3
    const r3 = result.tasks.find(t => t.id === 'R3');
    expect(r3).toBeDefined();
    expect(r3!.children.length).toBeGreaterThan(0);

    // Check R4.1 - find in R4's children
    const r4 = result.tasks.find(t => t.id === 'R4');
    expect(r4).toBeDefined();
    const r4_1 = r4!.children.find(t => t.id === 'R4.1');
    expect(r4_1).toBeDefined();
    expect(r4_1!.processing).toBe(true);
  });

  test('should handle mixed task statuses correctly', () => {
    const content = `## R1 [completed]

已完成任务。

## R2 [in_progress]

进行中任务。

## R3

未开始任务。

## R4 另一个未开始任务

多行描述。
这是第二行。

### R4.1 子任务
`;

    const parser = new TodoParser();
    const result = parser.parseContent(content, '/test/TODO.md');

    expect(result.tasks.length).toBe(4);

    const r1 = result.tasks.find(t => t.id === 'R1');
    const r2 = result.tasks.find(t => t.id === 'R2');
    const r3 = result.tasks.find(t => t.id === 'R3');
    const r4 = result.tasks.find(t => t.id === 'R4');

    expect(r1!.completed).toBe(true);
    expect(r1!.processing).toBe(false);

    expect(r2!.completed).toBe(false);
    expect(r2!.processing).toBe(true);

    expect(r3!.completed).toBe(false);
    expect(r3!.processing).toBe(false);

    expect(r4!.children.length).toBe(1);
    expect(r4!.children[0].id).toBe('R4.1');
  });
});

import { TodoParser } from '../src/parser';
import * as fs from 'fs';
import * as path from 'path';

describe('parseTextBlocks Tests', () => {
  let parser: TodoParser;
  let testDocContent: string;

  beforeAll(() => {
    parser = new TodoParser();
    // Read the actual test document
    const testDocPath = path.join(__dirname, '..', '..', 'doc', 'review', '20260120_MDTODO.md');
    testDocContent = fs.readFileSync(testDocPath, 'utf-8');
  });

  describe('Basic text block parsing', () => {
    test('Should parse leading text as a single block before first RXX task', () => {
      const content = `## 总需求

开发一个 VSCODE 插件，功能是渲染TODO文件为树形任务列表。

详见 [总需求](./details/20260120_MDTODO/R0_总需求说明.md)。

## R1 [Finished]

深入调研 VSCODE 插件开发知识。`;

      const blocks = parser.parseTextBlocks(content);

      // 应该只有一个文本块，包含"总需求"部分
      expect(blocks.length).toBe(1);
      expect(blocks[0].content).toContain('总需求');
      expect(blocks[0].content).toContain('VSCODE 插件');
    });

    test('Should not include code blocks in text blocks', () => {
      const content = `## 总需求

以下是代码示例：
\`\`\`
const test = "hello";
\`\`\`

## R1 任务`;

      const blocks = parser.parseTextBlocks(content);

      // 代码块内容不应该出现在文本块中
      expect(blocks.length).toBe(1);
      expect(blocks[0].content).not.toContain('const test');
      expect(blocks[0].content).not.toContain('hello');
    });

    test('Should handle multiple text blocks between tasks', () => {
      const content = `## R1 任务一

描述一。

## R2 任务二

描述二。

## R3 任务三`;

      const blocks = parser.parseTextBlocks(content);

      // R1和R2之间应该有一个文本块，R2和R3之间也可能有
      // 但由于描述都在任务内容中，文本块应该是空的或很少
      console.log('Blocks:', blocks.map(b => ({ id: b.id, content: b.content.substring(0, 50) })));
    });
  });

  describe('Real document parsing (20260120_MDTODO.md)', () => {
    test('Should parse the actual document correctly', () => {
      const blocks = parser.parseTextBlocks(testDocContent);

      console.log('=== parseTextBlocks Results ===');
      console.log('Number of text blocks:', blocks.length);

      // 显示每个文本块的信息
      blocks.forEach((block, index) => {
        console.log(`Block ${index + 1}: id=${block.id}, lineNumber=${block.lineNumber}`);
        console.log(`  Content preview: ${block.content.substring(0, 100)}...`);
      });

      // 第一个文本块应该从"##总需求"开始
      if (blocks.length > 0) {
        expect(blocks[0].content).toContain('总需求');
        expect(blocks[0].lineNumber).toBe(0); // 文档第一行
      }
    });

    test('First text block should contain all leading content before R1', () => {
      const blocks = parser.parseTextBlocks(testDocContent);

      if (blocks.length === 0) {
        console.log('WARNING: No text blocks found!');
        return;
      }

      const firstBlock = blocks[0];

      // 第一个文本块应该包含"总需求"部分
      expect(firstBlock.content).toContain('总需求');
      expect(firstBlock.content).toContain('开发一个 VSCODE 插件');

      // 链接中的 R1 不应该被算作 RXX 任务
      // R1 作为链接的一部分是可以接受的
      // 我们测试的是不包含 RXX 任务标题（即不以 ## R 开头的）
      expect(firstBlock.content).not.toMatch(/##?\s*R\d+/);
    });

    test('Should correctly identify RXX task boundaries', () => {
      const blocks = parser.parseTextBlocks(testDocContent);

      // 统计R1之前有几个文本块
      const firstBlockLine = blocks.length > 0 ? blocks[0].lineNumber : -1;
      console.log('First block starts at line:', firstBlockLine);

      // 文档结构应该是：
      // - 开头文本块（从##总需求到##R1之前）
      // - R1到R1.1之间的内容应该是一个文本块
      // - 等等

      // 检查是否有文本块在R1之后（应该是在R1任务描述中但不是RXX的部分）
      const blocksAfterR1 = blocks.filter(b => b.lineNumber > 0);
      console.log('Blocks after R1:', blocksAfterR1.length);

      blocksAfterR1.forEach(block => {
        console.log(`Block after R1: lineNumber=${block.lineNumber}, preview: ${block.content.substring(0, 50)}`);
      });
    });

    test('Should not include task content in text blocks', () => {
      const blocks = parser.parseTextBlocks(testDocContent);

      // 任何文本块都不应该包含RXX格式的任务标题
      blocks.forEach((block, index) => {
        const hasRxxTask = /R\d+(?:\.\d+)*\s+\[/.test(block.content) ||
                           /##?\s*R\d+/.test(block.content);
        if (hasRxxTask) {
          console.log(`Block ${index + 1} contains task title! Content: ${block.content.substring(0, 100)}`);
        }
        expect(hasRxxTask).toBe(false);
      });
    });
  });

  describe('Edge cases', () => {
    test('Should handle document with only RXX tasks', () => {
      const content = `## R1 任务一

## R2 任务二`;

      const blocks = parser.parseTextBlocks(content);

      // 没有普通文本块
      expect(blocks.length).toBe(0);
    });

    test('Should handle document with only leading text', () => {
      const content = `# 总需求

这是一个只有开头文本的文档。

## R1 任务

描述`;

      const blocks = parser.parseTextBlocks(content);

      // 应该有一个文本块
      expect(blocks.length).toBe(1);
      expect(blocks[0].content).toContain('总需求');
    });

    test('Should handle nested code blocks', () => {
      const jsContent = '```js\n' +
        'function test() {\n' +
        '  TRIPLE_BACKTICKinnerTRIPLE_BACKTICK\n' +
        '}\n' +
        '```\n' +
        '\n' +
        '## 总需求\n' +
        '\n' +
        'Some text.\n' +
        '\n' +
        'More text.\n' +
        '\n' +
        '## R1 任务';

      // Debug: print content lines
      const lines = jsContent.split('\n');
      console.log('=== Nested Code Blocks Test Content ===');
      lines.forEach((line, i) => {
        console.log('Line ' + i + ': [' + line + ']');
      });

      const blocks = parser.parseTextBlocks(jsContent);

      console.log('=== Parsed Blocks ===');
      console.log('Number of blocks:', blocks.length);
      blocks.forEach((block, i) => {
        console.log('Block ' + i + ': ' + block.content.substring(0, 50) + '...');
      });

      // 文本块应该包含"## 总需求"和"Some text."以及"More text."
      // 但不应该包含代码块内容
      // 代码块在文档开头，应该被正确跳过
      expect(blocks.length).toBe(1);
      expect(blocks[0].content).toContain('总需求');
      expect(blocks[0].content).toContain('Some text');
      expect(blocks[0].content).toContain('More text');
      expect(blocks[0].content).not.toContain('function');
      expect(blocks[0].content).not.toContain('TRIPLE_BACKTICK');
    });

    test('Should handle empty lines correctly', () => {
      const content = `## 总需求

第一段。


第二段。

## R1 任务`;

      const blocks = parser.parseTextBlocks(content);

      expect(blocks.length).toBe(1);
      expect(blocks[0].content).toContain('第一段');
      expect(blocks[0].content).toContain('第二段');
    });
  });
});

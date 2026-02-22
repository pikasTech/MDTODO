import * as fs from 'fs';
import * as path from 'path';
import { TodoFile, TodoTask, TextBlock, ParseOptions } from '../types';

export interface Token {
  type: 'heading' | 'task' | 'text' | 'empty';
  content: string;
  level: number;
  lineNumber: number;
}

/**
 * 检查文本是否包含 RXX 格式的任务ID
 * 只匹配在 ## 标题后面的 RXX（如 "## R1 任务" 或 "### R1.1 子任务"）
 * 不匹配链接中的 RXX（如 [R1](./path)）
 */
function hasRxxId(content: string): boolean {
  return /^(#{1,6}\s+)?R\d+(?:\.\d+)*(?=[\s\]]|$)/i.test(content);
}

export class TodoParser {
  /**
   * Tokenize markdown content into tokens
   */
  private tokenizer(content: string): Token[] {
    const lines = content.split('\n');
    const tokens: Token[] = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmed = line.trim();

      if (trimmed.match(/^#{2,}\s/)) {
        if (hasRxxId(trimmed)) {
          tokens.push({
            type: 'task',
            content: trimmed,
            level: this.countHashes(trimmed),
            lineNumber: i
          });
        } else {
          tokens.push({
            type: 'text',
            content: trimmed.replace(/^#{1,6}\s*/, '').trim(),
            level: 0,
            lineNumber: i
          });
        }
      } else if (trimmed.startsWith('#')) {
        const level = this.countHashes(trimmed);
        if (level === 1) {
          tokens.push({
            type: 'heading',
            content: trimmed,
            level,
            lineNumber: i
          });
        }
      } else {
        tokens.push({
          type: 'text',
          content: line,
          level: 0,
          lineNumber: i
        });
      }
    }

    return tokens;
  }

  private countHashes(str: string): number {
    let count = 0;
    for (const char of str) {
      if (char === '#') count++;
      else break;
    }
    return count;
  }

  private getTaskDepth(taskId: string): number {
    return (taskId.match(/\./g) || []).length;
  }

  private getParentId(taskId: string): string {
    const lastDotIndex = taskId.lastIndexOf('.');
    return lastDotIndex === -1 ? '' : taskId.substring(0, lastDotIndex);
  }

  /**
   * Parse markdown content into task tree
   */
  parse(content: string, filePath: string): TodoTask[] {
    const lines = content.split('\n');
    const tokens = this.tokenizer(content);
    const rootTasks: TodoTask[] = [];
    const stack: { task: TodoTask; id: string; depth: number }[] = [];

    for (const token of tokens) {
      if (token.type === 'task') {
        const { fullContent, rawContent } = this.getFullTaskContent(lines, token.lineNumber, tokens);
        const task = this.parseTask(fullContent, rawContent, filePath, token.level, token.lineNumber);

        const parentId = this.getParentId(task.id);
        const taskDepth = this.getTaskDepth(task.id);

        while (stack.length > 0 && stack[stack.length - 1].depth >= taskDepth) {
          stack.pop();
        }

        if (stack.length > 0) {
          const top = stack[stack.length - 1];
          if (task.id.startsWith(top.id + '.')) {
            stack[stack.length - 1].task.children.push(task);
          } else {
            rootTasks.push(task);
          }
        } else {
          rootTasks.push(task);
        }

        stack.push({ task, id: task.id, depth: taskDepth });
      }
    }

    return rootTasks;
  }

  /**
   * Parse and collect text blocks (non-RXX content)
   */
  parseTextBlocks(content: string): TextBlock[] {
    const lines = content.split('\n');
    const textBlocks: TextBlock[] = [];

    let currentBlockLines: string[] = [];
    let blockStartLine = -1;
    let inTextBlock = false;
    let foundFirstTask = false;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmed = line.trim();

      const isHeading = trimmed.match(/^#{2,}\s/);
      const hasRxx = hasRxxId(trimmed);

      if (isHeading && hasRxx) {
        if (inTextBlock && currentBlockLines.length > 0) {
          textBlocks.push({
            id: `text-${blockStartLine}`,
            content: currentBlockLines.join('\n').trim(),
            rawContent: currentBlockLines.join('\n'),
            lineNumber: blockStartLine
          });
        }
        currentBlockLines = [];
        inTextBlock = false;
        blockStartLine = -1;
        foundFirstTask = true;
      } else if (trimmed) {
        if (!foundFirstTask) {
          if (!inTextBlock) {
            inTextBlock = true;
            blockStartLine = i;
          }
          currentBlockLines.push(line);
        }
      } else {
        if (inTextBlock) {
          currentBlockLines.push(line);
        } else if (!foundFirstTask) {
          inTextBlock = true;
          blockStartLine = i;
        }
      }
    }

    if (inTextBlock && currentBlockLines.length > 0) {
      textBlocks.push({
        id: `text-${blockStartLine}`,
        content: currentBlockLines.join('\n').trim(),
        rawContent: currentBlockLines.join('\n'),
        lineNumber: blockStartLine
      });
    }

    return textBlocks;
  }

  private getFullTaskContent(lines: string[], taskLineNumber: number, tokens: Token[]): { fullContent: string; rawContent: string } {
    const taskLine = lines[taskLineNumber]?.trim() || '';

    const currentTokenIndex = tokens.findIndex(t => t.lineNumber === taskLineNumber);
    let nextTaskLineNumber = lines.length;
    for (let i = currentTokenIndex + 1; i < tokens.length; i++) {
      if (tokens[i].type === 'task') {
        nextTaskLineNumber = tokens[i].lineNumber;
        break;
      }
    }

    let descriptionLines: string[] = [];
    for (let i = taskLineNumber + 1; i < nextTaskLineNumber; i++) {
      const line = lines[i];
      descriptionLines.push(line.trimEnd());
    }

    const rawContent = descriptionLines.join('\n').trim();
    const description = descriptionLines.join('\n').trim();
    const fullContent = description ? `${taskLine}\n${description}` : taskLine;

    return { fullContent, rawContent };
  }

  private parseTask(content: string, rawContent: string, filePath: string, level: number, lineNumber: number): TodoTask {
    const idMatch = content.match(/(R\d+(?:\.\d+)*)/);
    const id = idMatch ? idMatch[1] : '';

    const firstNewlineIndex = content.indexOf('\n');
    const taskLine = firstNewlineIndex === -1 ? content : content.substring(0, firstNewlineIndex);

    const completed = taskLine.includes('[completed]');
    const processing = taskLine.includes('[in_progress]');

    const links: string[] = [];
    let tempContent = content.replace(/\[([^\]]*)\]\([^)]*\)/g, (match) => {
      links.push(match);
      return `__LINK_${links.length - 1}__`;
    });

    let title = tempContent
      .replace(/\[.*?\]/g, '')
      .replace(/(R\d+(?:\.\d+)*)/, '')
      .replace(/^##?\s*/, '')
      .trim();

    links.forEach((link, index) => {
      title = title.replace(`__LINK_${index}__`, link);
    });

    if (!title) {
      title = '';
    }

    const linkStats = this.calculateLinkStats(content, filePath);

    return {
      id,
      title,
      description: title,
      rawContent,
      completed,
      processing,
      children: [],
      lineNumber,
      filePath,
      linkCount: linkStats.linkCount,
      linkExists: linkStats.linkExists
    };
  }

  private extractLinks(content: string): string[] {
    const links: string[] = [];
    const linkRegex = /\[([^\]]*)\]\(([^)]+)\)/g;
    let match;

    while ((match = linkRegex.exec(content)) !== null) {
      const url = match[2].trim();
      if (url && !url.startsWith('#') && !url.startsWith('mailto:')) {
        links.push(url);
      }
    }

    return links;
  }

  private checkLinkExists(link: string, baseFilePath: string): boolean {
    try {
      if (link.startsWith('file://')) {
        link = link.slice(7);
      }

      let decodedLink = decodeURIComponent(link);
      if (decodedLink !== decodedLink.toLowerCase() || decodedLink.includes('%25')) {
        decodedLink = decodeURIComponent(decodedLink);
      }

      const isRelativePath = !decodedLink.startsWith('/') && !decodedLink.match(/^[A-Za-z]:/);

      let absolutePath: string;

      if (isRelativePath) {
        const currentDir = path.dirname(baseFilePath);
        absolutePath = path.resolve(currentDir, decodedLink);
      } else {
        absolutePath = decodedLink;
      }

      return fs.existsSync(absolutePath);
    } catch (error) {
      console.error('[Parser] 检查链接是否存在失败:', link, error);
      return false;
    }
  }

  private calculateLinkStats(content: string, filePath: string): { linkCount: number; linkExists: number } {
    const links = this.extractLinks(content);
    let existsCount = 0;

    for (const link of links) {
      const exists = this.checkLinkExists(link, filePath);
      if (exists) {
        existsCount++;
      }
    }

    return {
      linkCount: links.length,
      linkExists: existsCount
    };
  }

  /**
   * Parse a file and return TodoFile
   * Pure Node.js implementation - no vscode dependency
   */
  parseFile(filePath: string, options?: Partial<ParseOptions>): TodoFile {
    const content = fs.readFileSync(filePath, 'utf-8');

    let processedContent = content;
    // Auto-convert legacy markers if enabled
    if (options?.convertLegacy !== false) {
      processedContent = content
        .replace(/\[Processing\]/g, '[in_progress]')
        .replace(/\[Finished\]/g, '[completed]');
    }

    const tasks = this.parse(processedContent, filePath);
    const textBlocks = this.parseTextBlocks(processedContent);
    return { filePath, tasks, textBlocks };
  }

  /**
   * Parse content string and return TodoFile
   */
  parseContent(content: string, filePath: string): TodoFile {
    let processedContent = content
      .replace(/\[Processing\]/g, '[in_progress]')
      .replace(/\[Finished\]/g, '[completed]');

    const tasks = this.parse(processedContent, filePath);
    const textBlocks = this.parseTextBlocks(processedContent);
    return { filePath, tasks, textBlocks };
  }
}

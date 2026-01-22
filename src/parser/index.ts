import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { TodoTask, TodoFile, TextBlock } from '../types';

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
  // RXX 格式：R 后面跟数字，可能还有 . 和数字
  // 必须匹配：标题符号后面的 RXX（如 "## R1", "### R1.1"）
  // 或者行首直接是 RXX（如 "R1 任务"）
  // RXX 后面可以是：空格、]（用于 [Finished]）、或者行尾
  return /^(#{1,6}\s+)?R\d+(?:\.\d+)*(?=[\s\]]|$)/i.test(content);
}

export class TodoParser {
  private tokenizer(content: string): Token[] {
    const lines = content.split('\n');
    const tokens: Token[] = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmed = line.trim();

      // 检查是否是 ## 或 ### 或 #### 开头
      if (trimmed.match(/^#{2,}\s/)) {
        // 只有包含 RXX 格式的才标记为任务，否则标记为普通文本块
        if (hasRxxId(trimmed)) {
          tokens.push({
            type: 'task',
            content: trimmed,
            level: this.countHashes(trimmed),
            lineNumber: i
          });
        } else {
          // 不包含 RXX 的标题作为普通文本块处理
          tokens.push({
            type: 'text',
            content: trimmed.replace(/^#{1,6}\s*/, '').trim(), // 移除标题符号，保留内容
            level: 0,
            lineNumber: i
          });
        }
      } else if (trimmed.startsWith('#')) {
        // 只处理纯标题（单个 #）
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

  parse(content: string, filePath: string): TodoTask[] {
    const lines = content.split('\n');
    const tokens = this.tokenizer(content);
    const rootTasks: TodoTask[] = [];
    const stack: { task: TodoTask; level: number }[] = [];

    for (const token of tokens) {
      if (token.type === 'task') {
        // 获取任务ID行后面的内容作为标题（直到下一个任务或空行）
        // 【修复R23】同时获取原始内容用于编辑
        const { fullContent, rawContent } = this.getFullTaskContent(lines, token.lineNumber, tokens);
        const task = this.parseTask(fullContent, rawContent, filePath, token.level, token.lineNumber);

        while (stack.length > 0 && stack[stack.length - 1].level >= token.level) {
          stack.pop();
        }

        if (stack.length > 0) {
          stack[stack.length - 1].task.children.push(task);
        } else {
          rootTasks.push(task);
        }

        stack.push({ task, level: token.level });
      }
    }

    return rootTasks;
  }

  /**
   * 解析并收集普通文本块（非RXX格式的标题及其后续内容）
   * 将连续的普通文本内容合并为一个 TextBlock
   * 正确处理代码块，不会将代码块内容混入普通文本块
   * 空行保留在文本块中，不作为分隔符
   * 只识别任务标题之间的非RXX内容为文本块，不包括任务描述
   */
  parseTextBlocks(content: string): TextBlock[] {
    const lines = content.split('\n');
    const textBlocks: TextBlock[] = [];

    let currentBlockLines: string[] = [];
    let blockStartLine = -1;
    let inTextBlock = false;
    let inCodeBlock = false;  // 跟踪是否在代码块内
    let foundFirstTask = false;  // 标记是否遇到了第一个 RXX 任务

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmed = line.trim();

      // 检测代码块边界
      if (trimmed.startsWith('```')) {
        // 如果在代码块内，结束代码块；如果不在，开始代码块
        inCodeBlock = !inCodeBlock;
        // 代码块不作为普通文本内容
        continue;
      }

      // 如果在代码块内，跳过
      if (inCodeBlock) {
        continue;
      }

      // 检查是否是 ## 或 ### 或 #### 开头
      const isHeading = trimmed.match(/^#{2,}\s/);
      // 检查是否包含 RXX 格式（标题后面的 RXX）
      const hasRxx = hasRxxId(trimmed);

      // 如果是 RXX 任务标题
      if (isHeading && hasRxx) {
        // 如果在此之前已经在收集文本块，保存它
        if (inTextBlock && currentBlockLines.length > 0) {
          // 【R13.5】保存原始内容用于编辑
          textBlocks.push({
            id: `text-${blockStartLine}`,
            content: currentBlockLines.join('\n').trim(),
            rawContent: currentBlockLines.join('\n'),  // 保留原始换行和格式
            lineNumber: blockStartLine
          });
        }
        // 重置状态
        currentBlockLines = [];
        inTextBlock = false;
        blockStartLine = -1;
        foundFirstTask = true;
      }
      // 如果是普通文本行
      else if (trimmed) {
        // 只有在遇到第一个RXX任务之前的内容才作为文本块
        // 任务描述（第一个RXX任务之后的内容）不作为文本块
        if (!foundFirstTask) {
          if (!inTextBlock) {
            inTextBlock = true;
            blockStartLine = i;
          }
          currentBlockLines.push(line);
        }
      }
      // 空行：只有在收集文本块时才保留
      else {
        if (inTextBlock) {
          currentBlockLines.push(line);
        }
        // 如果不在文本块中，但遇到了空行，也开始一个文本块（内容可能从下一行开始）
        else if (!foundFirstTask && !inCodeBlock) {
          inTextBlock = true;
          blockStartLine = i;
        }
      }
    }

    // 处理最后一个文本块（如果不在代码块内且有内容）
    if (!inCodeBlock && inTextBlock && currentBlockLines.length > 0) {
      // 【R13.5】保存原始内容用于编辑
      textBlocks.push({
        id: `text-${blockStartLine}`,
        content: currentBlockLines.join('\n').trim(),
        rawContent: currentBlockLines.join('\n'),  // 保留原始换行和格式
        lineNumber: blockStartLine
      });
    }

    return textBlocks;
  }

  /**
   * 获取任务的完整内容（从当前任务行到下一个任务行之前的所有内容）
   * 【修复R22.4】保留空行以维持多行内容结构
   * 【修复R23】返回原始内容用于编辑
   */
  private getFullTaskContent(lines: string[], taskLineNumber: number, tokens: Token[]): { fullContent: string; rawContent: string } {
    const taskLine = lines[taskLineNumber]?.trim() || '';

    // 获取当前任务在tokens中的索引
    const currentTokenIndex = tokens.findIndex(t => t.lineNumber === taskLineNumber);
    // 获取下一个任务的行号
    let nextTaskLineNumber = lines.length;
    for (let i = currentTokenIndex + 1; i < tokens.length; i++) {
      if (tokens[i].type === 'task') {
        nextTaskLineNumber = tokens[i].lineNumber;
        break;
      }
    }

    // 获取当前任务行和下一个任务行之间的所有内容，保留空行以维持多行结构
    let descriptionLines: string[] = [];
    for (let i = taskLineNumber + 1; i < nextTaskLineNumber; i++) {
      const line = lines[i];
      // 保留所有行（包括空行），只去除行尾多余空白
      descriptionLines.push(line.trimEnd());
    }

    // 【修复R23】保存原始内容，用于编辑时显示（保留所有格式包括编号列表）
    const rawContent = descriptionLines.join('\n').trim();

    // 合并任务行和描述行
    const description = descriptionLines.join('\n').trim();
    const fullContent = description ? `${taskLine}\n${description}` : taskLine;

    return { fullContent, rawContent };
  }

  /**
   * 解析任务内容
   * 【修复R23】添加 rawContent 参数，用于编辑时保留原始格式
   */
  private parseTask(content: string, rawContent: string, filePath: string, level: number, lineNumber: number): TodoTask {
    // 提取任务ID
    const idMatch = content.match(/(R\d+(?:\.\d+)*)/);
    const id = idMatch ? idMatch[1] : '';

    // 只检测任务行（第一个换行符之前）中是否包含 [Finished] 和 [Processing]
    const firstNewlineIndex = content.indexOf('\n');
    const taskLine = firstNewlineIndex === -1 ? content : content.substring(0, firstNewlineIndex);

    // 判断是否完成
    const completed = taskLine.includes('[Finished]');
    // 判断是否执行中（只检测任务行，不检测描述行）
    const processing = taskLine.includes('[Processing]');

    // 提取标题：移除ID和[Finished]、[Processing]标记，保留其他markdown格式
    // 【修复R23】不移除换行符，保留多行内容用于编辑
    // 【修复R23.2】保留列表标记和其他markdown格式，在非编辑模式下使用marked渲染
    let title = content
      .replace(/\[Finished\]/g, '')  // 移除 [Finished]
      .replace(/\[Processing\]/g, '')  // 移除 [Processing]
      .replace(/(R\d+(?:\.\d+)*)/, '')  // 移除任务ID
      .replace(/^##?\s*/, '')  // 移除开头的 ##
      .replace(/`([^`]+)`/g, '$1')  // 移除行内代码标记
      .replace(/\*\*([^*]+)\*\*/g, '$1')  // 移除粗体
      .replace(/\*([^*]+)\*/g, '$1')  // 移除斜体
      .replace(/#{1,6}\s*/g, '')  // 移除所有等级的标题符号
      .trim();

    // 【修复R24】如果标题为空，保持为空字符串而不是使用ID
    // 新添加的任务没有内容，编辑框应该为空而不是显示编号
    if (!title) {
      title = '';
    }

    // 【实现R39】计算链接统计信息
    const linkStats = this.calculateLinkStats(content, filePath);

    return {
      id,
      title,
      description: title,
      rawContent,  // 【修复R23】保存原始内容用于编辑
      completed,
      processing,
      children: [],
      lineNumber,  // 使用传入的行号
      filePath,
      // 【实现R39】链接统计信息
      linkCount: linkStats.linkCount,
      linkExists: linkStats.linkExists
    };
  }

  /**
   * 【实现R39】从文本中提取所有 markdown 链接
   * 支持格式: [文本](链接地址)
   * 返回提取的链接数组（不含文本，只含地址）
   */
  private extractLinks(content: string): string[] {
    const links: string[] = [];
    // 匹配 markdown 链接: [text](url)
    // 考虑各种情况：可能有空格、换行、嵌套括号等
    const linkRegex = /\[([^\]]*)\]\(([^)]+)\)/g;
    let match;

    // 【R39 调试日志】生产环境应注释掉
    // console.log('[R39 Debug] extractLinks: content length =', content.length);
    // console.log('[R39 Debug] extractLinks: content =', content.substring(0, 200));

    while ((match = linkRegex.exec(content)) !== null) {
      const url = match[2].trim();
      // console.log('[R39 Debug] extractLinks: found link =', url);
      // 排除锚点链接（以 # 开头）和 mailto 链接
      if (url && !url.startsWith('#') && !url.startsWith('mailto:')) {
        links.push(url);
      }
    }

    // console.log('[R39 Debug] extractLinks: total links found =', links.length);
    return links;
  }

  /**
   * 【实现R39】检测链接是否指向真实存在的文件
   * 支持相对路径和绝对路径
   */
  private checkLinkExists(link: string, baseFilePath: string): boolean {
    try {
      // 处理 file:// URL 协议
      if (link.startsWith('file://')) {
        link = link.slice(7);
      }

      // 处理 URL 编码
      let decodedLink = decodeURIComponent(link);
      if (decodedLink !== decodedLink.toLowerCase() || decodedLink.includes('%25')) {
        decodedLink = decodeURIComponent(decodedLink);
      }

      // 判断是否为相对路径
      const isRelativePath = !decodedLink.startsWith('/') && !decodedLink.match(/^[A-Za-z]:/);

      let absolutePath: string;

      if (isRelativePath) {
        // 相对路径：基于当前文件路径解析
        const currentDir = path.dirname(baseFilePath);
        absolutePath = path.resolve(currentDir, decodedLink);
      } else {
        absolutePath = decodedLink;
      }

      // 检查文件是否存在
      return fs.existsSync(absolutePath);
    } catch (error) {
      console.error('[Parser] 检查链接是否存在失败:', link, error);
      return false;
    }
  }

  /**
   * 【实现R39】计算任务的链接统计信息
   */
  private calculateLinkStats(content: string, filePath: string): { linkCount: number; linkExists: number } {
    const links = this.extractLinks(content);
    let existsCount = 0;

    // 【R39 调试日志】生产环境应注释掉
    // console.log('[R39 Debug] calculateLinkStats: filePath =', filePath);
    // console.log('[R39 Debug] calculateLinkStats: links to check =', links);

    for (const link of links) {
      const exists = this.checkLinkExists(link, filePath);
      // console.log('[R39 Debug] calculateLinkStats: link =', link, ', exists =', exists);
      if (exists) {
        existsCount++;
      }
    }

    const result = {
      linkCount: links.length,
      linkExists: existsCount
    };
    // console.log('[R39 Debug] calculateLinkStats: result =', result);
    return result;
  }

  async parseFile(uri: vscode.Uri): Promise<TodoFile> {
    const data = await vscode.workspace.fs.readFile(uri);
    const decoder = new TextDecoder('utf-8');
    const content = decoder.decode(data);
    const tasks = this.parse(content, uri.fsPath);
    const textBlocks = this.parseTextBlocks(content);
    return { filePath: uri.fsPath, tasks, textBlocks };
  }
}

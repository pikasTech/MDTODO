#!/usr/bin/env node

import * as path from 'path';
import * as fs from 'fs';
import { Command, Option } from 'commander';
import { TodoParser } from './core/parser';
import { FileService } from './core/services/fileService';
import { TaskManager } from './core/managers/taskManager';
import { TodoTask } from './core/types';

interface CLIOptions {
  file?: string;
  json?: boolean;
}

class MDTODOCLI {
  private fileService: FileService;
  private parser: TodoParser;

  constructor() {
    this.fileService = new FileService();
    this.parser = new TodoParser();
  }

  /**
   * Load and parse TODO file
   */
  public loadFile(filePath: string): { manager: TaskManager; content: string } {
    if (!fs.existsSync(filePath)) {
      throw new Error(`文件不存在: ${filePath}`);
    }

    const content = this.fileService.readFile(filePath);
    const parseResult = this.parser.parseContent(content, filePath);
    const manager = new TaskManager({
      filePath,
      tasks: parseResult.tasks,
      textBlocks: parseResult.textBlocks || []
    });

    return { manager, content };
  }

  /**
   * Resolve file path from options or default
   */
  public resolveFilePath(fileOption?: string): string {
    if (fileOption) {
      return path.resolve(fileOption);
    }

    // Search for TODO file in current directory
    const files = this.fileService.findTodoFiles(process.cwd());
    if (files.length === 0) {
      throw new Error('未找到 TODO 文件，请使用 --file 选项指定文件路径');
    }

    if (files.length > 1) {
      console.warn('找到多个 TODO 文件，使用第一个:', files[0]);
    }

    return files[0];
  }

  /**
   * Print tasks tree
   */
  public printTasks(tasks: TodoTask[], indent: number): void {
    const prefix = '  '.repeat(indent);

    for (const task of tasks) {
      const status = task.completed ? '[x]' : task.processing ? '[-]' : '[ ]';
      console.log(`${prefix}${status} ${task.id} ${task.title}`);

      if (task.children.length > 0) {
        this.printTasks(task.children, indent + 1);
      }
    }
  }

  /**
   * Print task details
   */
  public printTaskDetails(task: TodoTask): void {
    console.log(`任务 ID: ${task.id}`);
    console.log(`标题: ${task.title}`);
    console.log(`状态: ${task.completed ? '已完成' : task.processing ? '进行中' : '待处理'}`);
    console.log(`行号: ${task.lineNumber + 1}`);
    console.log(`链接统计: ${task.linkExists}/${task.linkCount}`);

    if (task.children.length > 0) {
      console.log('\n子任务:');
      this.printTasks(task.children, 1);
    }
  }
}

/**
 * Create and configure the CLI program
 */
function createProgram(): Command {
  const program = new Command();

  program
    .name('mdtodo')
    .description('MDTODO CLI - 命令行任务管理工具')
    .version('1.0.0')
    .option('-f, --file <path>', '指定 TODO 文件路径')
    .option('--json', 'JSON 格式输出', false);

  // List command
  program
    .command('list')
    .description('列出所有任务')
    .action(async (options: CLIOptions, cmd: Command) => {
      const cli = new MDTODOCLI();
      const filePath = cli.resolveFilePath(cmd.parent?.opts().file);
      const { manager } = cli.loadFile(filePath);
      const tasks = manager.getTasks();

      if (cmd.parent?.opts().json) {
        console.log(JSON.stringify(tasks, null, 2));
        return;
      }

      cli.printTasks(tasks, 0);
      const stats = manager.getStats();
      console.log(`\n统计: 共 ${stats.total} 个任务，已完成 ${stats.completed}，进行中 ${stats.inProgress}，待处理 ${stats.pending}`);
    });

  // Get command
  program
    .command('get <id>')
    .description('获取指定任务详情')
    .action(async (id: string, options: CLIOptions, cmd: Command) => {
      const cli = new MDTODOCLI();
      const filePath = cli.resolveFilePath(cmd.parent?.opts().file);
      const { manager } = cli.loadFile(filePath);
      const task = manager.getTask(id);

      if (!task) {
        console.error(`错误: 未找到任务: ${id}`);
        process.exit(1);
      }

      if (cmd.parent?.opts().json) {
        console.log(JSON.stringify(task, null, 2));
        return;
      }

      cli.printTaskDetails(task);
    });

  // Add command
  program
    .command('add')
    .description('添加新任务')
    .action(async (options: CLIOptions, cmd: Command) => {
      const cli = new MDTODOCLI();
      const filePath = cli.resolveFilePath(cmd.parent?.opts().file);
      const { manager } = cli.loadFile(filePath);
      const result = manager.addTask();

      if (!result.success) {
        console.error(`错误: ${result.message}`);
        process.exit(1);
      }

      console.log(result.message);
    });

  // Add-sub command
  program
    .command('add-sub <parentId>')
    .description('添加子任务到指定任务')
    .action(async (parentId: string, options: CLIOptions, cmd: Command) => {
      const cli = new MDTODOCLI();
      const filePath = cli.resolveFilePath(cmd.parent?.opts().file);
      const { manager } = cli.loadFile(filePath);
      const result = manager.addSubTask(parentId);

      if (!result.success) {
        console.error(`错误: ${result.message}`);
        process.exit(1);
      }

      console.log(result.message);
    });

  // Delete command
  program
    .command('delete <id>')
    .alias('remove')
    .description('删除任务')
    .action(async (id: string, options: CLIOptions, cmd: Command) => {
      const cli = new MDTODOCLI();
      const filePath = cli.resolveFilePath(cmd.parent?.opts().file);
      const { manager } = cli.loadFile(filePath);
      const result = manager.deleteTask(id);

      if (!result.success) {
        console.error(`错误: ${result.message}`);
        process.exit(1);
      }

      console.log(result.message);
    });

  // Complete command
  program
    .command('complete <id>')
    .alias('done')
    .description('标记任务为已完成')
    .action(async (id: string, options: CLIOptions, cmd: Command) => {
      const cli = new MDTODOCLI();
      const filePath = cli.resolveFilePath(cmd.parent?.opts().file);
      const { manager } = cli.loadFile(filePath);
      const result = manager.markComplete(id);

      if (!result.success) {
        console.error(`错误: ${result.message}`);
        process.exit(1);
      }

      console.log(result.message);
    });

  // Start command
  program
    .command('start <id>')
    .description('标记任务为进行中')
    .action(async (id: string, options: CLIOptions, cmd: Command) => {
      const cli = new MDTODOCLI();
      const filePath = cli.resolveFilePath(cmd.parent?.opts().file);
      const { manager } = cli.loadFile(filePath);
      const result = manager.markInProgress(id);

      if (!result.success) {
        console.error(`错误: ${result.message}`);
        process.exit(1);
      }

      console.log(result.message);
    });

  // Update command
  program
    .command('update <id>')
    .description('更新任务标题')
    .argument('<title>', '新的任务标题')
    .action(async (id: string, title: string, options: CLIOptions, cmd: Command) => {
      const cli = new MDTODOCLI();
      const filePath = cli.resolveFilePath(cmd.parent?.opts().file);
      const { manager } = cli.loadFile(filePath);
      const result = manager.updateTaskTitle(id, title);

      if (!result.success) {
        console.error(`错误: ${result.message}`);
        process.exit(1);
      }

      console.log(result.message);
    });

  // Stats command
  program
    .command('stats')
    .description('显示任务统计')
    .action(async (options: CLIOptions, cmd: Command) => {
      const cli = new MDTODOCLI();
      const filePath = cli.resolveFilePath(cmd.parent?.opts().file);
      const { manager } = cli.loadFile(filePath);
      const stats = manager.getStats();

      if (cmd.parent?.opts().json) {
        console.log(JSON.stringify(stats, null, 2));
        return;
      }

      console.log('任务统计:');
      console.log(`  总任务数: ${stats.total}`);
      console.log(`  已完成: ${stats.completed}`);
      console.log(`  进行中: ${stats.inProgress}`);
      console.log(`  待处理: ${stats.pending}`);
    });

  return program;
}

/**
 * Main entry point
 */
async function main(): Promise<void> {
  const program = createProgram();

  try {
    program.parse(process.argv);
  } catch (error: any) {
    console.error(`错误: ${error.message}`);
    process.exit(1);
  }
}

main();

import * as vscode from 'vscode';
import { CommandGenerator } from '../src/providers/managers/commandGenerator';
import { TaskFileManager, generateReportTimestamp } from '../src/providers/managers/taskFileManager';

describe('R57 - Codex execution and report timestamps', () => {
  beforeEach(() => {
    (vscode.workspace.workspaceFolders as any) = [
      { uri: { fsPath: '/workspace' } }
    ];
  });

  afterEach(() => {
    jest.useRealTimers();
    (vscode.workspace.workspaceFolders as any) = undefined;
  });

  test('generateReportTimestamp includes seconds', () => {
    const timestamp = generateReportTimestamp(new Date(2026, 3, 12, 9, 8, 7));
    expect(timestamp).toBe('20260412_090807');
  });

  test('generateNewTaskContent uses second-level timestamp in report link', () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date(2026, 3, 12, 9, 8, 7));

    const manager = new TaskFileManager({
      currentFilePath: '/workspace/TODO.md',
      currentTasks: [],
      currentTextBlocks: [],
      onTasksChanged: () => {},
      onWebviewRefresh: () => {},
    });

    const content = manager.generateNewTaskContent('R1');

    expect(content).toContain('./details/TODO/20260412_090807_Task_Report.md');
  });

  test('CommandGenerator can generate a codex launch command', () => {
    const generator = new CommandGenerator({
      currentFilePath: '/workspace/TODO.md',
    });

    const result = generator.generateExecuteCommand('R1', {
      executionMode: 'codex',
    });

    expect(result).toEqual({
      command: 'codex --dangerously-bypass-approvals-and-sandbox "请执行 TODO.md 中的 R1 任务"',
      taskId: 'R1',
    });
  });
});

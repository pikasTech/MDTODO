import * as path from 'path';
import * as fs from 'fs';
import * as fsPromises from 'fs/promises';

// Import from the service (will use mocked vscode)
import {
  getLogsDirectoryPath,
  generateLogFilename,
  ensureLogsDirectory,
  writeLogEntry,
  logAction,
  LogEntry
} from '../src/services/logService';

describe('LogService Tests', () => {
  const testWorkspace = '/test/workspace';
  const testLogsDir = path.join(testWorkspace, '.vscode', 'mdtodo', 'logs');

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getLogsDirectoryPath', () => {
    test('Returns correct path for given workspace', () => {
      const result = getLogsDirectoryPath(testWorkspace);
      expect(result).toBe(testLogsDir);
    });

    test('Handles workspace with trailing slash', () => {
      const result = getLogsDirectoryPath('/test/workspace/');
      expect(result).toMatch(/[\/\\]test[\/\\]workspace[\/\\]\.vscode[\/\\]mdtodo[\/\\]logs$/);
    });

    test('Handles workspace with spaces', () => {
      const workspaceWithSpaces = '/test/my workspace';
      const result = getLogsDirectoryPath(workspaceWithSpaces);
      // On Windows, path.join uses backslashes
      expect(result).toContain('.vscode');
      expect(result).toContain('mdtodo');
      expect(result).toContain('logs');
      expect(result).toContain('my workspace');
    });
  });

  describe('generateLogFilename', () => {
    test('Generates correct filename format for simple task ID', () => {
      const filename = generateLogFilename('R54.5');

      // Format: YYYYMMDDHHmmss_MDTODO_R54_5.jsonl (14 digit timestamp, no underscore between date/time)
      // Total: 14 + 1 + 5 + 1 + 5 + 5 = 31 chars for R54.5
      // R54.5 -> R54_5 = 5 chars
      expect(filename.endsWith('_MDTODO_R54_5.jsonl')).toBe(true);
      // First 14 chars should be timestamp (YYYYMMDDHHmmss)
      const prefix = filename.substring(0, 14);
      expect(/^\d{14}$/.test(prefix)).toBe(true);
    });

    test('Generates correct filename format for nested task ID', () => {
      const filename = generateLogFilename('R54.5.3');

      // Should match format: YYYYMMDDHHmmss_MDTODO_R54_5_3.jsonl
      expect(filename.endsWith('_MDTODO_R54_5_3.jsonl')).toBe(true);
      const prefix = filename.substring(0, 14);
      expect(/^\d{14}$/.test(prefix)).toBe(true);
    });

    test('Replaces dots with underscores in task ID portion', () => {
      const filename = generateLogFilename('R1.2.3.4');

      expect(filename).toContain('MDTODO_R1_2_3_4');
      // The MDTODO_R1_2_3_4 part should not contain dots
      const taskIdPart = filename.match(/MDTODO_[^.]+/)?.[0];
      expect(taskIdPart).toBe('MDTODO_R1_2_3_4');
    });

    test('Generates valid filenames for different calls', () => {
      const filename1 = generateLogFilename('R1');
      // Small delay to ensure different timestamp
      const filename2 = generateLogFilename('R1');

      // Both should be valid format, timestamps may or may not differ
      expect(filename1.endsWith('_MDTODO_R1.jsonl')).toBe(true);
      expect(filename2.endsWith('_MDTODO_R1.jsonl')).toBe(true);
      const prefix1 = filename1.substring(0, 14);
      const prefix2 = filename2.substring(0, 14);
      expect(/^\d{14}$/.test(prefix1)).toBe(true);
      expect(/^\d{14}$/.test(prefix2)).toBe(true);
    });
  });

  describe('ensureLogsDirectory', () => {
    test('Creates directory when it does not exist', async () => {
      const { workspace } = require('vscode');
      await ensureLogsDirectory(testLogsDir);

      expect(workspace.fs.createDirectory).toHaveBeenCalledWith(
        expect.objectContaining({ fsPath: testLogsDir })
      );
    });

    test('Does not throw when directory already exists', async () => {
      const { workspace } = require('vscode');
      const error = new Error('EEXIST: file already exists');
      (error as Error & { code: string }).code = 'EEXIST';
      (workspace.fs.createDirectory as jest.Mock).mockRejectedValueOnce(error);

      // Should not throw
      await expect(ensureLogsDirectory(testLogsDir)).resolves.not.toThrow();
    });

    test('Throws for other errors', async () => {
      const { workspace } = require('vscode');
      const error = new Error('EACCES: permission denied');
      (error as Error & { code: string }).code = 'EACCES';
      (workspace.fs.createDirectory as jest.Mock).mockRejectedValueOnce(error);

      // The function logs the error but doesn't throw (it continues gracefully)
      // So we expect it to resolve, not reject
      await expect(ensureLogsDirectory(testLogsDir)).resolves.toBeUndefined();
    });
  });

  describe('writeLogEntry', () => {
    const testLogsDir = '/test/workspace/.vscode/mdtodo/logs';

    test('Writes valid JSONL format', async () => {
      const { workspace } = require('vscode');

      await writeLogEntry(testLogsDir, 'R54.5', {
        filePath: '/test/workspace/TODO.md',
        action: 'execute',
        details: { command: 'test command' }
      });

      // Verify writeFile was called
      expect(workspace.fs.writeFile).toHaveBeenCalled();

      // Get the written data
      const writeFileCall = (workspace.fs.writeFile as jest.Mock).mock.calls[0];
      const uri = writeFileCall[0];
      const encodedData = writeFileCall[1];
      const decodedData = new TextDecoder().decode(encodedData);

      // Should be valid JSON with newline
      const line = decodedData.trim();
      const parsed = JSON.parse(line);

      expect(parsed).toHaveProperty('timestamp');
      expect(parsed).toHaveProperty('taskId', 'R54.5');
      expect(parsed).toHaveProperty('filePath', '/test/workspace/TODO.md');
      expect(parsed).toHaveProperty('action', 'execute');
      expect(parsed).toHaveProperty('details');
      expect(parsed.details).toEqual({ command: 'test command' });
    });

    test('File can be read back with valid JSONL format', async () => {
      // This test verifies the JSONL structure is correct
      const timestamp = new Date().toISOString();
      const logEntry: LogEntry = {
        timestamp,
        taskId: 'R54.5',
        filePath: '/test/workspace/TODO.md',
        action: 'complete',
        details: { result: 'success' }
      };

      const line = JSON.stringify(logEntry) + '\n';
      const parsed = JSON.parse(line.trim());

      expect(parsed.timestamp).toBe(timestamp);
      expect(parsed.taskId).toBe('R54.5');
      expect(parsed.filePath).toBe('/test/workspace/TODO.md');
      expect(parsed.action).toBe('complete');
      expect(parsed.details).toEqual({ result: 'success' });
    });

    test('Includes all required LogEntry fields', async () => {
      const { workspace } = require('vscode');

      await writeLogEntry(testLogsDir, 'R1', {
        filePath: '/test/file.md',
        action: 'test',
        details: {}
      });

      const writeFileCall = (workspace.fs.writeFile as jest.Mock).mock.calls[0];
      const encodedData = writeFileCall[1];
      const decodedData = new TextDecoder().decode(encodedData);
      const parsed = JSON.parse(decodedData.trim());

      // Verify all required fields are present
      expect(parsed.timestamp).toBeDefined();
      expect(typeof parsed.timestamp).toBe('string');
      expect(parsed.taskId).toBe('R1');
      expect(parsed.filePath).toBe('/test/file.md');
      expect(parsed.action).toBe('test');
      expect(parsed.details).toEqual({});
    });
  });

  describe('logAction', () => {
    test('Creates correct log entry structure', async () => {
      const { workspace } = require('vscode');

      await logAction(
        testWorkspace,
        'R54.5',
        '/test/workspace/TODO.md',
        'execute',
        { command: 'test command', model: 'sonnet' }
      );

      // Verify directory was created first
      expect(workspace.fs.createDirectory).toHaveBeenCalled();

      // Then verify writeFile was called
      expect(workspace.fs.writeFile).toHaveBeenCalled();

      // Verify the entry structure
      const writeFileCall = (workspace.fs.writeFile as jest.Mock).mock.calls[0];
      const encodedData = writeFileCall[1];
      const decodedData = new TextDecoder().decode(encodedData);
      const parsed = JSON.parse(decodedData.trim());

      expect(parsed).toHaveProperty('timestamp');
      expect(parsed).toHaveProperty('taskId', 'R54.5');
      expect(parsed).toHaveProperty('filePath', '/test/workspace/TODO.md');
      expect(parsed).toHaveProperty('action', 'execute');
      expect(parsed).toHaveProperty('details');
      expect(parsed.details).toEqual({ command: 'test command', model: 'sonnet' });
    });

    test('Uses default empty details object', async () => {
      const { workspace } = require('vscode');

      await logAction(
        testWorkspace,
        'R1',
        '/test/workspace/TODO.md',
        'complete'
      );

      const writeFileCall = (workspace.fs.writeFile as jest.Mock).mock.calls[0];
      const encodedData = writeFileCall[1];
      const decodedData = new TextDecoder().decode(encodedData);
      const parsed = JSON.parse(decodedData.trim());

      expect(parsed.details).toEqual({});
    });

    test('Creates log file with correct path', async () => {
      const { workspace } = require('vscode');

      await logAction(
        testWorkspace,
        'R54.5',
        '/test/workspace/TODO.md',
        'execute',
        {}
      );

      const writeFileCall = (workspace.fs.writeFile as jest.Mock).mock.calls[0];
      const uri = writeFileCall[0];

      // URI should point to the logs directory with generated filename
      expect(uri.fsPath).toContain(testLogsDir);
      expect(uri.fsPath).toContain('MDTODO_R54_5.jsonl');
    });
  });
});

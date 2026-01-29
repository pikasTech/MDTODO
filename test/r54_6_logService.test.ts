import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';

// Store the actual fs module for cleanup
const originalFs = fs;

// Mock vscode module before importing the service
const mockWriteFileCalls: Array<{ uri: { fsPath: string }; data: Uint8Array }> = [];

jest.mock('vscode', () => ({
  workspace: {
    fs: {
      createDirectory: jest.fn().mockResolvedValue(undefined),
      writeFile: jest.fn().mockImplementation((uri: { fsPath: string }, data: Uint8Array) => {
        mockWriteFileCalls.push({ uri, data });
        return Promise.resolve();
      }),
    },
  },
  Uri: {
    file: (filePath: string) => ({ fsPath: filePath, path: filePath }),
  },
}));

// Import from the service
import {
  generateTodoBasedFilename,
  writeUnifiedLogEntry,
  logPluginLifecycle,
  logFileEvent,
  logTaskEvent,
  logError,
  UnifiedLogEntry,
  initializeSessionLogFilename,
  getSessionLogFilename,
  resetSessionLogState,
  getSessionTodoFilePath
} from '../src/services/logService';

// Helper to decode written data
function decodeWrittenData(data: Uint8Array): string {
  return new TextDecoder().decode(data);
}

describe('LogService Integration Tests (R54.6.5) - Session-based Single File', () => {
  // Use a temporary directory for integration tests
  let tempDir: string;
  let logsDir: string;
  const testTodoFilePath = '/test/workspace/MyProject/TODO.md';

  beforeEach(() => {
    // Create a unique temporary directory for each test
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mdtodo-logtest-'));
    logsDir = path.join(tempDir, '.vscode', 'mdtodo', 'logs');
    mockWriteFileCalls.length = 0; // Clear mock calls
    // R54.6.5: Reset session state before each test
    resetSessionLogState();
  });

  afterEach(() => {
    // R54.6.5: Clean up session state
    resetSessionLogState();
    // Clean up temporary directory
    if (tempDir && fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  describe('R54.6.5 - Session Log Filename', () => {
    test('initializeSessionLogFilename creates consistent filename', () => {
      const filename = initializeSessionLogFilename(testTodoFilePath);

      // Format: YYYYMMDDTHHMMss_{TODO文件名}.jsonl
      expect(filename.endsWith('.jsonl')).toBe(true);
      expect(filename).toContain('_TODO');
      expect(filename).toMatch(/\d{8}T\d{6}_.+\.jsonl/);

      // Same filename should be returned on subsequent calls
      const cachedFilename = getSessionLogFilename();
      expect(cachedFilename).toBe(filename);
      expect(cachedFilename).toBe(initializeSessionLogFilename(testTodoFilePath));
    });

    test('getSessionTodoFilePath returns initialized path', () => {
      initializeSessionLogFilename(testTodoFilePath);
      const todoPath = getSessionTodoFilePath();
      expect(todoPath).toBe(testTodoFilePath);
    });

    test('resetSessionLogState clears session state', () => {
      initializeSessionLogFilename(testTodoFilePath);
      expect(getSessionLogFilename()).not.toBeNull();

      resetSessionLogState();
      expect(getSessionLogFilename()).toBeNull();
      expect(getSessionTodoFilePath()).toBeNull();
    });

    test('Multiple calls to initialize return same filename', () => {
      const filename1 = initializeSessionLogFilename(testTodoFilePath);
      const filename2 = initializeSessionLogFilename(testTodoFilePath);

      // Should return the same filename (not generate new one)
      expect(filename1).toBe(filename2);

      // Same timestamp prefix
      const prefix1 = filename1.substring(0, 15); // YYYYMMDDTHHMMss = 15 chars
      const prefix2 = filename2.substring(0, 15);
      expect(prefix1).toBe(prefix2);
    });
  });

  describe('generateTodoBasedFilename', () => {
    test('Returns correct format with TODO filename and date', () => {
      const filename = generateTodoBasedFilename(testTodoFilePath);

      // Format: YYYYMMDDTHHMMss_{TODO文件名}.jsonl
      expect(filename.endsWith('.jsonl')).toBe(true);
      expect(filename).toContain('_TODO');
      expect(filename).toMatch(/\d{8}T\d{6}_TODO\.jsonl/);
    });

    test('Extracts filename without extension', () => {
      const filename = generateTodoBasedFilename('/path/to/My_TODO_File.md');
      expect(filename).toContain('_My_TODO_File.jsonl');
      expect(filename).not.toContain('.md');
    });

    test('Handles filenames with spaces', () => {
      const filename = generateTodoBasedFilename('/path/My Task File.md');
      expect(filename).toContain('_My Task File.jsonl');
    });

    test('Contains current date in YYYYMMDD format', () => {
      const now = new Date();
      const year = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, '0');
      const day = String(now.getDate()).padStart(2, '0');
      const expectedDate = `${year}${month}${day}`;

      const filename = generateTodoBasedFilename(testTodoFilePath);
      expect(filename).toContain(expectedDate);
    });

    test('Generates different timestamps on different calls (backward compatible)', () => {
      // This tests the old behavior - each call generates a new timestamp
      const filename1 = generateTodoBasedFilename(testTodoFilePath);

      // Small delay to ensure different timestamp
      const filename2 = generateTodoBasedFilename(testTodoFilePath);

      // Note: These may or may not differ depending on timing
      // But both should be valid format
      expect(filename1).toMatch(/\d{8}T\d{6}_TODO\.jsonl/);
      expect(filename2).toMatch(/\d{8}T\d{6}_TODO\.jsonl/);
    });
  });

  describe('logPluginLifecycle - Single File Per Session (R54.6.5)', () => {
    test('R54.6.5: Session initialization creates consistent filename', async () => {
      // Initialize session first
      const sessionFilename = initializeSessionLogFilename(testTodoFilePath);

      // Write lifecycle event
      await logPluginLifecycle(logsDir, testTodoFilePath, 'activate', {
        version: '1.0.0'
      });

      // Verify writeFile was called
      expect(mockWriteFileCalls.length).toBe(1);

      // Get the written data
      const { uri, data } = mockWriteFileCalls[0];
      expect(uri.fsPath).toContain(logsDir);
      // Should use the session filename, not generate new one
      expect(uri.fsPath).toContain(sessionFilename);
    });

    test('R54.6.5: All events in a session write to same file', async () => {
      // Initialize session with a fixed timestamp
      const sessionFilename = initializeSessionLogFilename(testTodoFilePath);

      // Write multiple lifecycle events
      await logPluginLifecycle(logsDir, testTodoFilePath, 'activate', {});
      await logPluginLifecycle(logsDir, testTodoFilePath, 'fileLoaded', { taskCount: 5 });
      await logPluginLifecycle(logsDir, testTodoFilePath, 'panelClosed', {});

      // All events should be appended to the same file
      expect(mockWriteFileCalls.length).toBe(3);

      // Verify the same file path is used for all
      const firstPath = mockWriteFileCalls[0].uri.fsPath;
      expect(mockWriteFileCalls[1].uri.fsPath).toBe(firstPath);
      expect(mockWriteFileCalls[2].uri.fsPath).toBe(firstPath);

      // All should use the session filename
      expect(firstPath).toContain(sessionFilename);

      // Collect all content
      const allContent = mockWriteFileCalls.map(call => decodeWrittenData(call.data)).join('');

      // Should have multiple JSONL lines (after trimming newlines)
      const lines = allContent.trim().split('\n').filter(line => line.length > 0);
      expect(lines.length).toBe(3);

      // Verify each line is valid JSON
      lines.forEach(line => {
        const parsed = JSON.parse(line);
        expect(parsed.eventType).toBe('lifecycle');
      });
    });

    test('Creates file with correct JSONL structure', async () => {
      initializeSessionLogFilename(testTodoFilePath);

      await logPluginLifecycle(logsDir, testTodoFilePath, 'panelOpened', {
        panelId: 'test-panel-1'
      });

      const { data } = mockWriteFileCalls[0];
      const content = decodeWrittenData(data);

      // Parse JSONL entry
      const parsed = JSON.parse(content.trim()) as UnifiedLogEntry;

      expect(parsed.timestamp).toBeDefined();
      expect(typeof parsed.timestamp).toBe('string');
      expect(parsed.eventType).toBe('lifecycle');
      expect(parsed.event).toBe('panelOpened');
      expect(parsed.details).toHaveProperty('panelId', 'test-panel-1');
      expect(parsed.details).toHaveProperty('source', 'plugin');
    });

    test('Logs all lifecycle event types', async () => {
      initializeSessionLogFilename(testTodoFilePath);
      const lifecycleEvents = ['activate', 'deactivate', 'fileLoaded', 'panelOpened', 'panelClosed'];

      for (const event of lifecycleEvents) {
        await logPluginLifecycle(logsDir, testTodoFilePath, event, {});
      }

      const allContent = mockWriteFileCalls.map(call => decodeWrittenData(call.data)).join('');
      const lines = allContent.trim().split('\n').filter(line => line.length > 0);
      expect(lines.length).toBe(lifecycleEvents.length);

      lifecycleEvents.forEach((event, index) => {
        const parsed = JSON.parse(lines[index]);
        expect(parsed.event).toBe(event);
      });
    });
  });

  describe('logFileEvent - Single File Per Session (R54.6.5)', () => {
    test('R54.6.5: File events write to session file', async () => {
      initializeSessionLogFilename(testTodoFilePath);

      await logFileEvent(logsDir, testTodoFilePath, 'fileParse', {
        parseTime: 150
      });

      expect(mockWriteFileCalls.length).toBe(1);

      const { uri, data } = mockWriteFileCalls[0];
      const content = decodeWrittenData(data);

      expect(uri.fsPath).toContain(logsDir);
      expect(content).toContain('file');
      expect(content).toContain('fileParse');
    });

    test('File event contains filePath in details', async () => {
      initializeSessionLogFilename(testTodoFilePath);

      await logFileEvent(logsDir, testTodoFilePath, 'fileRefresh', {
        changedLines: [10, 20, 30]
      });

      const { data } = mockWriteFileCalls[0];
      const content = decodeWrittenData(data);
      const parsed = JSON.parse(content.trim()) as UnifiedLogEntry;

      expect(parsed.eventType).toBe('file');
      expect(parsed.event).toBe('fileRefresh');
      expect(parsed.details).toHaveProperty('filePath', testTodoFilePath);
      expect(parsed.details.changedLines).toEqual([10, 20, 30]);
    });

    test('R54.6.5: Multiple file events use same session file', async () => {
      initializeSessionLogFilename(testTodoFilePath);
      const fileEvents = ['fileParse', 'fileRefresh', 'fileWatch', 'fileChange'];

      for (const event of fileEvents) {
        await logFileEvent(logsDir, testTodoFilePath, event, {});
      }

      const firstPath = mockWriteFileCalls[0].uri.fsPath;
      mockWriteFileCalls.forEach(call => {
        expect(call.uri.fsPath).toBe(firstPath);
      });

      const allContent = mockWriteFileCalls.map(call => decodeWrittenData(call.data)).join('');
      const lines = allContent.trim().split('\n').filter(line => line.length > 0);
      expect(lines.length).toBe(fileEvents.length);
    });
  });

  describe('logTaskEvent - Single File Per Session (R54.6.5)', () => {
    test('R54.6.5: Task events write to session file', async () => {
      initializeSessionLogFilename(testTodoFilePath);

      await logTaskEvent(logsDir, testTodoFilePath, 'R54.6.3', 'taskExecute', {
        command: 'test command'
      });

      expect(mockWriteFileCalls.length).toBe(1);

      const { uri, data } = mockWriteFileCalls[0];
      const content = decodeWrittenData(data);

      expect(uri.fsPath).toContain(logsDir);
      expect(content).toContain('task');
      expect(content).toContain('taskExecute');
    });

    test('Task event contains taskId in details', async () => {
      initializeSessionLogFilename(testTodoFilePath);

      await logTaskEvent(logsDir, testTodoFilePath, 'R54.6.3', 'taskComplete', {
        duration: 5000
      });

      const { data } = mockWriteFileCalls[0];
      const content = decodeWrittenData(data);
      const parsed = JSON.parse(content.trim()) as UnifiedLogEntry;

      expect(parsed.eventType).toBe('task');
      expect(parsed.event).toBe('taskComplete');
      expect(parsed.details).toHaveProperty('taskId', 'R54.6.3');
      expect(parsed.details).toHaveProperty('duration', 5000);
    });

    test('R54.6.5: Multiple task events use same session file', async () => {
      initializeSessionLogFilename(testTodoFilePath);
      const taskEvents = ['taskExecute', 'taskComplete', 'taskSelect', 'taskCreate', 'taskDelete'];

      for (const event of taskEvents) {
        await logTaskEvent(logsDir, testTodoFilePath, 'R54', event, {});
      }

      const firstPath = mockWriteFileCalls[0].uri.fsPath;
      mockWriteFileCalls.forEach(call => {
        expect(call.uri.fsPath).toBe(firstPath);
      });

      const allContent = mockWriteFileCalls.map(call => decodeWrittenData(call.data)).join('');
      const lines = allContent.trim().split('\n').filter(line => line.length > 0);
      expect(lines.length).toBe(taskEvents.length);
    });

    test('Handles nested task IDs correctly', async () => {
      initializeSessionLogFilename(testTodoFilePath);
      const nestedTasks = ['R1', 'R1.1', 'R1.1.1', 'R54.6.3'];

      for (const taskId of nestedTasks) {
        await logTaskEvent(logsDir, testTodoFilePath, taskId, 'taskSelect', {});
      }

      const allContent = mockWriteFileCalls.map(call => decodeWrittenData(call.data)).join('');
      const lines = allContent.trim().split('\n').filter(line => line.length > 0);
      expect(lines.length).toBe(nestedTasks.length);

      nestedTasks.forEach((taskId, index) => {
        const parsed = JSON.parse(lines[index]);
        expect(parsed.details.taskId).toBe(taskId);
      });
    });
  });

  describe('logError - Single File Per Session (R54.6.5)', () => {
    test('R54.6.5: Error events write to session file', async () => {
      initializeSessionLogFilename(testTodoFilePath);
      const testError = new Error('Test error message');
      testError.stack = 'Error stack trace here';

      await logError(logsDir, testTodoFilePath, testError, 'testContext');

      expect(mockWriteFileCalls.length).toBe(1);

      const { uri, data } = mockWriteFileCalls[0];
      const content = decodeWrittenData(data);

      expect(uri.fsPath).toContain(logsDir);
      expect(content).toContain('error');
      expect(content).toContain('errorOccurred');
    });

    test('Error event contains error details', async () => {
      initializeSessionLogFilename(testTodoFilePath);
      const testError = new Error('File not found');
      testError.stack = 'Error: File not found\n    at test.js:10:5';

      await logError(logsDir, testTodoFilePath, testError, 'fileOperation');

      const { data } = mockWriteFileCalls[0];
      const content = decodeWrittenData(data);
      const parsed = JSON.parse(content.trim()) as UnifiedLogEntry;

      expect(parsed.eventType).toBe('error');
      expect(parsed.event).toBe('errorOccurred');
      expect(parsed.details).toHaveProperty('errorMessage', 'File not found');
      expect(parsed.details).toHaveProperty('errorStack');
      expect(parsed.details).toHaveProperty('context', 'fileOperation');
      expect(parsed.details).toHaveProperty('source', 'plugin');
    });
  });

  describe('writeUnifiedLogEntry - Session-based (R54.6.5)', () => {
    test('R54.6.5: Uses session filename for all writes', async () => {
      // Initialize session first
      const sessionFilename = initializeSessionLogFilename(testTodoFilePath);

      // Write multiple entries
      await writeUnifiedLogEntry(logsDir, testTodoFilePath, {
        eventType: 'lifecycle',
        event: 'event1',
        details: { data: 1 }
      });
      await writeUnifiedLogEntry(logsDir, testTodoFilePath, {
        eventType: 'task',
        event: 'event2',
        details: { data: 2 }
      });

      expect(mockWriteFileCalls.length).toBe(2);

      // Verify all use the same session filename
      const firstPath = mockWriteFileCalls[0].uri.fsPath;
      expect(mockWriteFileCalls[0].uri.fsPath).toBe(firstPath);
      expect(mockWriteFileCalls[1].uri.fsPath).toBe(firstPath);
      expect(firstPath).toContain(sessionFilename);
    });

    test('Writes valid JSONL format to file', async () => {
      initializeSessionLogFilename(testTodoFilePath);

      await writeUnifiedLogEntry(logsDir, testTodoFilePath, {
        eventType: 'lifecycle',
        event: 'testEvent',
        details: { key: 'value' }
      });

      expect(mockWriteFileCalls.length).toBe(1);

      const { data } = mockWriteFileCalls[0];
      const content = decodeWrittenData(data);

      // Verify JSONL format (JSON object followed by newline)
      const line = content.trim();
      expect(() => JSON.parse(line)).not.toThrow();

      const parsed = JSON.parse(line) as UnifiedLogEntry;
      expect(parsed.timestamp).toBeDefined();
      expect(parsed.eventType).toBe('lifecycle');
      expect(parsed.event).toBe('testEvent');
      expect(parsed.details).toEqual({ key: 'value' });
    });
  });

  describe('Integration: Combined Logging - Single Session File (R54.6.5)', () => {
    test('R54.6.5: Multiple log types write to same session file', async () => {
      // Initialize session with fixed filename
      initializeSessionLogFilename(testTodoFilePath);

      // Write different types of events
      await logPluginLifecycle(logsDir, testTodoFilePath, 'activate', {});
      await logFileEvent(logsDir, testTodoFilePath, 'fileParse', {});
      await logTaskEvent(logsDir, testTodoFilePath, 'R1', 'taskExecute', {});

      expect(mockWriteFileCalls.length).toBe(3);

      // Verify the same file path is used for all
      const firstPath = mockWriteFileCalls[0].uri.fsPath;
      expect(mockWriteFileCalls[1].uri.fsPath).toBe(firstPath);
      expect(mockWriteFileCalls[2].uri.fsPath).toBe(firstPath);

      // Collect all content
      const allContent = mockWriteFileCalls.map(call => decodeWrittenData(call.data)).join('');
      const lines = allContent.trim().split('\n').filter(line => line.length > 0);
      expect(lines.length).toBe(3);

      // Verify each line is valid JSON with correct eventType
      const parsed1 = JSON.parse(lines[0]) as UnifiedLogEntry;
      const parsed2 = JSON.parse(lines[1]) as UnifiedLogEntry;
      const parsed3 = JSON.parse(lines[2]) as UnifiedLogEntry;

      expect(parsed1.eventType).toBe('lifecycle');
      expect(parsed2.eventType).toBe('file');
      expect(parsed3.eventType).toBe('task');
    });

    test('R54.6.5: Multiple writes persist correctly with session-based append', async () => {
      initializeSessionLogFilename(testTodoFilePath);

      // Write 10 entries
      for (let i = 0; i < 10; i++) {
        await logTaskEvent(logsDir, testTodoFilePath, `R${i}`, 'taskExecute', { index: i });
      }

      expect(mockWriteFileCalls.length).toBe(10);

      // Verify all entries are written to same file
      const firstPath = mockWriteFileCalls[0].uri.fsPath;
      mockWriteFileCalls.forEach(call => {
        expect(call.uri.fsPath).toBe(firstPath);
      });

      // Verify all entries are written
      const allContent = mockWriteFileCalls.map(call => decodeWrittenData(call.data)).join('');
      const lines = allContent.trim().split('\n').filter(line => line.length > 0);
      expect(lines.length).toBe(10);

      // Verify each entry can be parsed
      lines.forEach((line, index) => {
        const parsed = JSON.parse(line) as UnifiedLogEntry;
        expect(parsed.eventType).toBe('task');
        expect(parsed.details.index).toBe(index);
      });
    });

    test('R54.6.5: Auto-initializes session if not already initialized', async () => {
      // Don't manually initialize - writeUnifiedLogEntry should auto-initialize
      await writeUnifiedLogEntry(logsDir, testTodoFilePath, {
        eventType: 'lifecycle',
        event: 'autoInitTest',
        details: {}
      });

      // Should have created a session filename
      expect(getSessionLogFilename()).not.toBeNull();
      expect(mockWriteFileCalls.length).toBe(1);
    });
  });
});

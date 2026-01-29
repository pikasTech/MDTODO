import * as path from 'path';
import * as fs from 'fs';

// Mock child_process before importing ClaudeService
jest.mock('child_process', () => ({
  spawn: jest.fn().mockReturnValue({
    unref: jest.fn()
  })
}));

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
      readFile: jest.fn().mockResolvedValue(new Uint8Array(0)),
    },
    workspaceFolders: [{
      uri: { fsPath: '/test/workspace' }
    }],
  },
  Uri: {
    file: (filePath: string) => ({ fsPath: filePath, path: filePath }),
  },
  window: {
    createTerminal: jest.fn().mockReturnValue({
      show: jest.fn(),
      sendText: jest.fn()
    }),
    createOutputChannel: jest.fn().mockReturnValue({
      show: jest.fn(),
      appendLine: jest.fn()
    })
  }
}));

// Import from services
import {
  initializeSessionLogFilename,
  getSessionLogFilename,
  resetSessionLogState
} from '../src/services/logService';

// Import ClaudeService after mocking vscode
const { ClaudeService } = require('../src/services/claudeService');

// Helper to decode written data
function decodeWrittenData(data: Uint8Array): string {
  return new TextDecoder().decode(data);
}

describe('R54.6.6 - ClaudeService Unified Logging Tests', () => {
  let tempDir: string;
  let logsDir: string;
  const testTodoFilePath = '/test/workspace/MyProject/TODO.md';

  beforeEach(() => {
    // Create a unique temporary directory for each test
    tempDir = fs.mkdtempSync(path.join(process.cwd(), 'mdtodo-r54-6-6-'));
    logsDir = path.join(tempDir, '.vscode', 'mdtodo', 'logs');
    mockWriteFileCalls.length = 0;
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

  describe('R54.6.6 - ClaudeService uses unified session logging', () => {
    test('R54.6.6: executeTask logs to session file (not separate MDTODO_Rx_x.jsonl)', async () => {
      // Initialize session first (as done in extension.ts activate)
      const sessionFilename = initializeSessionLogFilename(testTodoFilePath);
      expect(sessionFilename).not.toBeNull();

      // Execute a task
      const claudeService = new ClaudeService();
      await claudeService.executeTask(testTodoFilePath, 'R54.6.6');

      // Verify writeFile was called
      expect(mockWriteFileCalls.length).toBeGreaterThanOrEqual(1);

      // Get the written data
      const { uri, data } = mockWriteFileCalls[0];

      // R54.6.6: Verify it uses the session filename, NOT the old MDTODO_Rx_x format
      // The path should end with the session filename (e.g., "20260129T152041_TODO.jsonl")
      expect(uri.fsPath.endsWith(sessionFilename)).toBe(true);
      // Should NOT contain the old format
      expect(uri.fsPath).not.toContain('_MDTODO_');

      const content = decodeWrittenData(data);
      expect(content).toContain('taskExecute');
      expect(content).toContain('R54.6.6');
    });

    test('R54.6.6: executeTaskInTerminal logs to session file', async () => {
      // Initialize session first
      const sessionFilename = initializeSessionLogFilename(testTodoFilePath);

      // Execute a task in terminal
      const claudeService = new ClaudeService();
      await claudeService.executeTaskInTerminal(testTodoFilePath, 'R54.6.6');

      // Verify writeFile was called
      expect(mockWriteFileCalls.length).toBeGreaterThanOrEqual(1);

      // Get the written data
      const { uri } = mockWriteFileCalls[0];

      // R54.6.6: Verify it uses the session filename
      expect(uri.fsPath).toContain(sessionFilename);
      expect(uri.fsPath).not.toContain('_MDTODO_');
    });

    test('R54.6.6: Multiple task executions write to same session file', async () => {
      // Initialize session first
      const sessionFilename = initializeSessionLogFilename(testTodoFilePath);

      const claudeService = new ClaudeService();

      // Execute multiple tasks
      await claudeService.executeTask(testTodoFilePath, 'R1');
      await claudeService.executeTask(testTodoFilePath, 'R2.1');
      await claudeService.executeTask(testTodoFilePath, 'R54.6.6');

      // All writes should use the same file
      expect(mockWriteFileCalls.length).toBe(3);

      const firstPath = mockWriteFileCalls[0].uri.fsPath;
      expect(mockWriteFileCalls[1].uri.fsPath).toBe(firstPath);
      expect(mockWriteFileCalls[2].uri.fsPath).toBe(firstPath);

      // All should use the session filename
      expect(firstPath).toContain(sessionFilename);
      expect(firstPath).not.toContain('_MDTODO_');

      // Verify all content is valid JSONL
      const allContent = mockWriteFileCalls.map(call => decodeWrittenData(call.data)).join('');
      const lines = allContent.trim().split('\n').filter(line => line.length > 0);
      expect(lines.length).toBe(3);

      lines.forEach(line => {
        const parsed = JSON.parse(line);
        expect(parsed.eventType).toBe('task');
        expect(parsed.event).toBe('taskExecute');
      });
    });

    test('R54.6.6: ClaudeService log entries have correct structure', async () => {
      initializeSessionLogFilename(testTodoFilePath);

      const claudeService = new ClaudeService();
      await claudeService.executeTask(testTodoFilePath, 'R54.6.6');

      const { data } = mockWriteFileCalls[0];
      const content = decodeWrittenData(data);
      const parsed = JSON.parse(content.trim());

      // Verify the unified log entry structure
      expect(parsed.timestamp).toBeDefined();
      expect(parsed.eventType).toBe('task');
      expect(parsed.event).toBe('taskExecute');
      expect(parsed.details).toHaveProperty('taskId', 'R54.6.6');
      expect(parsed.details).toHaveProperty('command');
      expect(parsed.details).toHaveProperty('mode', 'new_terminal');
    });

    test('R54.6.6: No duplicate log files generated for same session', async () => {
      initializeSessionLogFilename(testTodoFilePath);

      const claudeService = new ClaudeService();

      // Execute multiple different tasks
      await claudeService.executeTask(testTodoFilePath, 'R1');
      await claudeService.executeTask(testTodoFilePath, 'R2');
      await claudeService.executeTask(testTodoFilePath, 'R3');

      // Collect all unique file paths used
      const uniquePaths = new Set(mockWriteFileCalls.map(call => call.uri.fsPath));

      // R54.6.6: Should only use ONE file for all writes
      expect(uniquePaths.size).toBe(1);

      // The path should contain the session filename
      const [firstPath] = uniquePaths;
      expect(firstPath).toContain('_TODO.jsonl');
      expect(firstPath).not.toContain('_MDTODO_');
    });
  });
});

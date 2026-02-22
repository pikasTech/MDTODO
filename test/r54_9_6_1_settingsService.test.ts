import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';

// Store the actual fs module for cleanup
const originalFs = fs;

// Track mock calls
const mockReadFileCalls: Array<{ fsPath: string }> = [];
const mockWriteFileCalls: Array<{ uri: { fsPath: string }; data: Uint8Array }> = [];
const mockDirectoryCalls: Array<{ fsPath: string }> = [];

// Mock vscode module before importing the service
jest.mock('vscode', () => ({
  workspace: {
    fs: {
      createDirectory: jest.fn().mockImplementation((uri: { fsPath: string }) => {
        mockDirectoryCalls.push({ fsPath: uri.fsPath });
        return Promise.resolve();
      }),
      readFile: jest.fn().mockImplementation((uri: { fsPath: string }) => {
        mockReadFileCalls.push({ fsPath: uri.fsPath });
        // Return a valid JSON for existing files
        const testConfig = JSON.stringify({ executionMode: 'claude' });
        return Promise.resolve(new TextEncoder().encode(testConfig));
      }),
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
import { SettingsService, SettingsConfig } from '../src/services/settingsService';

describe('SettingsService Tests (R54.9.6.1) - Settings Read/Write', () => {
  // Use a temporary directory for integration tests
  let tempDir: string;
  let workspacePath: string;

  beforeEach(() => {
    // Create a unique temporary directory for each test
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mdtodo-settingstest-'));
    workspacePath = tempDir;
    mockReadFileCalls.length = 0;
    mockWriteFileCalls.length = 0;
    mockDirectoryCalls.length = 0;
  });

  afterEach(() => {
    // Clean up temporary directory
    if (tempDir && fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  describe('R54.9.3.1 - Settings File Operations', () => {
    test('readSettings returns default config when file does not exist', async () => {
      const vscode = require('vscode');
      // Reset and setup fresh mock for this test
      vscode.workspace.fs.readFile.mockReset();
      vscode.workspace.fs.readFile.mockRejectedValueOnce({ code: 'ENOENT' });

      const service = new SettingsService();
      const config = await service.readSettings(workspacePath);

      // Should return default config
      expect(config).toEqual({ executionMode: 'claude' });
      expect(vscode.workspace.fs.readFile).toHaveBeenCalledTimes(1);
    });

    test('writeSettings creates settings directory', async () => {
      const service = new SettingsService();
      await service.writeSettings(workspacePath, { executionMode: 'opencode' });

      // Should have created the .vscode/mdtodo directory
      const expectedDir = path.join(workspacePath, '.vscode', 'mdtodo');
      expect(mockDirectoryCalls.some(call => call.fsPath === expectedDir)).toBe(true);
    });

    test('writeSettings writes configuration to file', async () => {
      const service = new SettingsService();
      await service.writeSettings(workspacePath, { executionMode: 'opencode' });

      // Should have written to file
      expect(mockWriteFileCalls.length).toBe(1);

      // Verify the written content
      const { uri, data } = mockWriteFileCalls[0];
      const expectedPath = path.join(workspacePath, '.vscode', 'mdtodo', 'settings.json');
      expect(uri.fsPath).toBe(expectedPath);

      // Decode and verify JSON content
      const content = new TextDecoder().decode(data);
      const writtenConfig = JSON.parse(content);
      expect(writtenConfig).toEqual({ executionMode: 'opencode' });
    });

    test('writeSettings merges with existing config', async () => {
      const service = new SettingsService();

      // First write
      await service.writeSettings(workspacePath, { executionMode: 'opencode' });

      // Reset mock calls for second test
      mockWriteFileCalls.length = 0;

      // Mock readFile to return the existing config
      const vscode = require('vscode');
      vscode.workspace.fs.readFile.mockResolvedValueOnce(
        new TextEncoder().encode(JSON.stringify({ executionMode: 'opencode' }))
      );

      // Second write with different mode
      await service.writeSettings(workspacePath, { executionMode: 'claude' });

      expect(mockWriteFileCalls.length).toBe(1);
      const { data } = mockWriteFileCalls[0];
      const content = new TextDecoder().decode(data);
      const writtenConfig = JSON.parse(content);
      expect(writtenConfig.executionMode).toBe('claude');
    });

    test('readSettings returns written configuration', async () => {
      const service = new SettingsService();

      // First write a config
      await service.writeSettings(workspacePath, { executionMode: 'opencode' });

      // Reset mocks for read test
      mockReadFileCalls.length = 0;
      const vscode = require('vscode');
      vscode.workspace.fs.readFile.mockResolvedValueOnce(
        new TextEncoder().encode(JSON.stringify({ executionMode: 'opencode' }))
      );

      // Then read it back
      const config = await service.readSettings(workspacePath);

      expect(config.executionMode).toBe('opencode');
    });

    test('readSettings handles invalid JSON gracefully', async () => {
      const vscode = require('vscode');
      // Mock readFile to return invalid JSON
      vscode.workspace.fs.readFile.mockResolvedValueOnce(
        new TextEncoder().encode('invalid json')
      );

      const service = new SettingsService();
      const config = await service.readSettings(workspacePath);

      // Should return default config when JSON is invalid
      expect(config).toEqual({ executionMode: 'claude' });
    });

    test('readSettings fills missing executionMode with default', async () => {
      const vscode = require('vscode');
      // Mock readFile to return config without executionMode
      vscode.workspace.fs.readFile.mockResolvedValueOnce(
        new TextEncoder().encode(JSON.stringify({ otherSetting: 'value' }))
      );

      const service = new SettingsService();
      const config = await service.readSettings(workspacePath);

      // Should use default executionMode
      expect(config.executionMode).toBe('claude');
    });
  });

  describe('R54.9.3.2 - Execution Mode Operations', () => {
    test('updateExecutionMode updates mode to opencode', async () => {
      const service = new SettingsService();
      await service.updateExecutionMode(workspacePath, 'opencode');

      expect(mockWriteFileCalls.length).toBe(1);
      const { data } = mockWriteFileCalls[0];
      const content = new TextDecoder().decode(data);
      const writtenConfig = JSON.parse(content);
      expect(writtenConfig.executionMode).toBe('opencode');
    });

    test('updateExecutionMode updates mode to claude', async () => {
      const service = new SettingsService();
      await service.updateExecutionMode(workspacePath, 'claude');

      expect(mockWriteFileCalls.length).toBe(1);
      const { data } = mockWriteFileCalls[0];
      const content = new TextDecoder().decode(data);
      const writtenConfig = JSON.parse(content);
      expect(writtenConfig.executionMode).toBe('claude');
    });

    test('getExecutionMode returns current mode', async () => {
      const vscode = require('vscode');
      // Mock readFile to return specific config
      vscode.workspace.fs.readFile.mockResolvedValueOnce(
        new TextEncoder().encode(JSON.stringify({ executionMode: 'opencode' }))
      );

      const service = new SettingsService();
      const mode = await service.getExecutionMode(workspacePath);

      expect(mode).toBe('opencode');
    });

    test('getExecutionMode returns default mode when file not found', async () => {
      const vscode = require('vscode');
      vscode.workspace.fs.readFile.mockRejectedValueOnce({ code: 'ENOENT' });

      const service = new SettingsService();
      const mode = await service.getExecutionMode(workspacePath);

      expect(mode).toBe('claude');
    });

    test('updateExecutionMode followed by getExecutionMode maintains consistency', async () => {
      const service = new SettingsService();

      // Update mode to opencode
      await service.updateExecutionMode(workspacePath, 'opencode');

      // Reset mocks for read test
      mockReadFileCalls.length = 0;
      const vscode = require('vscode');
      vscode.workspace.fs.readFile.mockResolvedValueOnce(
        new TextEncoder().encode(JSON.stringify({ executionMode: 'opencode' }))
      );

      // Get mode should return opencode
      const mode = await service.getExecutionMode(workspacePath);
      expect(mode).toBe('opencode');
    });
  });

  describe('SettingsConfig Interface', () => {
    test('SettingsConfig interface accepts valid modes', async () => {
      const validConfig: SettingsConfig = {
        executionMode: 'claude'
      };

      const vscode = require('vscode');
      vscode.workspace.fs.readFile.mockResolvedValueOnce(
        new TextEncoder().encode(JSON.stringify(validConfig))
      );

      const service = new SettingsService();
      const config = await service.readSettings(workspacePath);

      expect(config.executionMode).toBe('claude');
    });
  });
});

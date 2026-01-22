// Mock vscode module for testing
export const workspace = {
  fs: {
    readFile: jest.fn(),
    writeFile: jest.fn()
  },
  findFiles: jest.fn(),
  createFileSystemWatcher: jest.fn()
};

export const Uri = {
  file: jest.fn((path: string) => ({ fsPath: path })),
  parse: jest.fn()
};

export const EventEmitter = jest.fn().mockImplementation(() => ({
  event: jest.fn(),
  fire: jest.fn()
}));

export const Disposable = jest.fn().mockImplementation(() => ({
  dispose: jest.fn()
}));

// Mock other vscode exports as needed
export default {
  workspace,
  Uri,
  EventEmitter,
  Disposable
};

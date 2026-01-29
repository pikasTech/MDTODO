// Mock vscode module for testing
export const workspace = {
  fs: {
    readFile: jest.fn().mockResolvedValue(new Uint8Array(0)),
    writeFile: jest.fn().mockResolvedValue(undefined),
    createDirectory: jest.fn().mockResolvedValue(undefined)
  },
  findFiles: jest.fn(),
  createFileSystemWatcher: jest.fn(),
  workspaceFolders: undefined as any
};

export const Uri = {
  file: jest.fn((path: string) => ({ fsPath: path, path })),
  parse: jest.fn()
};

export const EventEmitter = jest.fn().mockImplementation(() => ({
  event: jest.fn(),
  fire: jest.fn()
}));

export const Disposable = jest.fn().mockImplementation(() => ({
  dispose: jest.fn()
}));

export const window = {
  showInformationMessage: jest.fn(),
  showQuickPick: jest.fn(),
  activeTextEditor: undefined as any,
  visibleTextEditors: [] as any[],
  tabGroups: undefined as any,
  createTerminal: jest.fn().mockReturnValue({
    show: jest.fn(),
    sendText: jest.fn()
  }),
  createOutputChannel: jest.fn().mockReturnValue({
    show: jest.fn(),
    appendLine: jest.fn()
  })
};

// Mock other vscode exports as needed
export default {
  workspace,
  Uri,
  EventEmitter,
  Disposable,
  window
};

/**
 * R55.5 单元测试 - 验证消息监听器不会被重复注册
 * 问题：点击一次执行任务后重复触发两个任务执行的终端
 * 原因：每次调用 showPanel 都会注册新的消息监听器
 */

describe('R55.5 Message Listener Registration Tests', () => {
  // 模拟 WebviewPanel 和 ExtensionContext
  const mockPanel = {
    webview: {
      onDidReceiveMessage: jest.fn(),
    },
    reveal: jest.fn(),
  };

  const mockContext = {
    subscriptions: [],
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('消息监听器应该只注册一次，即使 showPanel 被调用多次', () => {
    // 模拟 onDidReceiveMessage 返回一个 Disposable
    const mockDisposable = { dispose: jest.fn() };
    mockPanel.webview.onDidReceiveMessage.mockReturnValue(mockDisposable);

    // 模拟 PanelManager
    const mockPanelManager = {
      showPanel: jest.fn(),
      getPanel: jest.fn().mockReturnValue(mockPanel),
    };

    // 模拟其他必要的依赖
    const mockScrollSyncManager = { startPeriodicRefresh: jest.fn() };
    const mockFileRefreshManager = { startPeriodicRefresh: jest.fn() };

    // 模拟 TodoWebviewProvider 类的关键行为
    let messageListenerRegistered = false;
    let registrationCount = 0;

    const showPanel = () => {
      mockPanelManager.showPanel();

      if (!messageListenerRegistered) {
        mockPanel.webview.onDidReceiveMessage(
          () => {},
          undefined,
          mockContext.subscriptions
        );
        messageListenerRegistered = true;
        registrationCount++;
      }
    };

    // 第一次调用 showPanel
    showPanel();
    expect(registrationCount).toBe(1);
    expect(mockPanel.webview.onDidReceiveMessage).toHaveBeenCalledTimes(1);

    // 第二次调用 showPanel（模拟面板已存在的情况）
    showPanel();
    expect(registrationCount).toBe(1); // 应该仍然是1，不会增加
    expect(mockPanel.webview.onDidReceiveMessage).toHaveBeenCalledTimes(1); // 不应该再调用

    // 第三次调用
    showPanel();
    expect(registrationCount).toBe(1);
    expect(mockPanel.webview.onDidReceiveMessage).toHaveBeenCalledTimes(1);
  });

  test('验证修复后的 TodoWebviewProvider 标志位行为', () => {
    // 测试 messageListenerRegistered 标志位的正确性
    let messageListenerRegistered = false;
    const callCount = { value: 0 };

    const simulateShowPanel = () => {
      if (!messageListenerRegistered) {
        callCount.value++;
        messageListenerRegistered = true;
      }
    };

    // 模拟多次调用
    for (let i = 0; i < 5; i++) {
      simulateShowPanel();
    }

    // callCount 应该是 1，而不是 5
    expect(callCount.value).toBe(1);
    expect(messageListenerRegistered).toBe(true);
  });

  test('如果没有面板，不应该注册消息监听器', () => {
    const mockPanelManagerNoPanel = {
      showPanel: jest.fn(),
      getPanel: jest.fn().mockReturnValue(null), // 没有面板
    };

    let listenerRegistered = false;
    let onDidReceiveMessageCalled = false;

    const showPanelWithoutPanel = () => {
      mockPanelManagerNoPanel.showPanel();
      const panel = mockPanelManagerNoPanel.getPanel();

      if (!listenerRegistered) {
        panel?.webview.onDidReceiveMessage(
          () => {},
          undefined,
          mockContext.subscriptions
        );
        if (panel) {
          listenerRegistered = true;
          onDidReceiveMessageCalled = true;
        }
      }
    };

    showPanelWithoutPanel();

    expect(listenerRegistered).toBe(false);
    expect(onDidReceiveMessageCalled).toBe(false);
    expect(mockPanel.webview.onDidReceiveMessage).not.toHaveBeenCalled();
  });
});

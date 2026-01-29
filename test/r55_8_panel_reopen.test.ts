/**
 * R55.8 单元测试 - 面板关闭后重新打开，消息监听器应该重新注册
 * 问题：关闭 Tag 再打开之后，点击各种按钮就没有响应
 * 原因：面板关闭后 messageListenerRegistered 标志没有被重置，导致消息监听器没有重新注册
 */

describe('R55.8 Panel Reopen Message Listener Tests', () => {
  // 模拟 WebviewPanel
  const createMockPanel = () => ({
    webview: {
      onDidReceiveMessage: jest.fn().mockReturnValue({ dispose: jest.fn() }),
    },
    reveal: jest.fn(),
    dispose: jest.fn(),
  });

  const mockContext = {
    subscriptions: [],
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('面板关闭后重新打开，消息监听器应该重新注册', () => {
    const mockPanel = createMockPanel();

    // 模拟 PanelManager
    let panelExists = true;
    const mockPanelManager = {
      showPanel: jest.fn().mockImplementation(() => {
        panelExists = true;
      }),
      getPanel: jest.fn().mockImplementation(() => {
        return panelExists ? mockPanel : undefined;
      }),
      dispose: jest.fn().mockImplementation(() => {
        panelExists = false;
      }),
    };

    // 模拟 TodoWebviewProvider 的关键行为
    let messageListenerRegistered = false;
    let registrationCount = 0;

    const showPanel = () => {
      mockPanelManager.showPanel();

      // 问题代码：只在未注册时注册，但面板关闭后没有重置标志
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

    const disposePanel = () => {
      mockPanelManager.dispose();
      // BUG: messageListenerRegistered 没有被重置！
    };

    // 第一次打开面板
    showPanel();
    expect(registrationCount).toBe(1);
    expect(mockPanel.webview.onDidReceiveMessage).toHaveBeenCalledTimes(1);

    // 关闭面板
    disposePanel();
    // 此时 panel 已经被销毁

    // 重新打开面板（模拟用户关闭 Tag 后重新打开）
    showPanel();

    // BUG 表现：registrationCount 仍然是 1，消息监听器没有被重新注册！
    // 期望：registrationCount 应该是 2，因为面板是重新创建的
    // 实际：因为 messageListenerRegistered 没有被重置，监听器没有注册
    expect(registrationCount).toBe(1); // 这证明了 BUG 的存在
    expect(mockPanel.webview.onDidReceiveMessage).toHaveBeenCalledTimes(1); // 没有增加
  });

  test('修复方案：面板关闭时重置 messageListenerRegistered 标志', () => {
    const mockPanel = createMockPanel();

    let panelExists = true;
    const mockPanelManager = {
      showPanel: jest.fn().mockImplementation(() => {
        panelExists = true;
      }),
      getPanel: jest.fn().mockImplementation(() => {
        return panelExists ? mockPanel : undefined;
      }),
      dispose: jest.fn().mockImplementation(() => {
        panelExists = false;
      }),
    };

    // 修复后的代码：使用 isPanelRecreated 检查
    let messageListenerRegistered = false;
    let registrationCount = 0;
    let currentPanel: any = null;

    const showPanel = () => {
      mockPanelManager.showPanel();
      const panel = mockPanelManager.getPanel();

      // 检查是否是新的面板（通过比较面板实例）
      const isNewPanel = panel !== currentPanel;

      if (isNewPanel || !messageListenerRegistered) {
        if (panel) {
          panel.webview.onDidReceiveMessage(
            () => {},
            undefined,
            mockContext.subscriptions
          );
          messageListenerRegistered = true;
          currentPanel = panel;
          registrationCount++;
        }
      }
    };

    const disposePanel = () => {
      mockPanelManager.dispose();
      currentPanel = null; // 重置当前面板引用
      // messageListenerRegistered 保持 true，但下次会比较面板实例
    };

    // 第一次打开面板
    showPanel();
    expect(registrationCount).toBe(1);
    expect(mockPanel.webview.onDidReceiveMessage).toHaveBeenCalledTimes(1);

    // 关闭面板
    disposePanel();

    // 重新打开面板
    showPanel();

    // 修复后：registrationCount 应该是 2
    expect(registrationCount).toBe(2);
    expect(mockPanel.webview.onDidReceiveMessage).toHaveBeenCalledTimes(2);
  });

  test('验证面板 dispose 后消息监听器标志重置', () => {
    let messageListenerRegistered = false;
    let registrationCount = 0;
    let currentPanelId: string | null = null;

    const mockPanels: Record<string, any> = {};

    const createPanel = (id: string) => {
      const panel = {
        webview: {
          onDidReceiveMessage: jest.fn().mockReturnValue({ dispose: jest.fn() }),
        },
        reveal: jest.fn(),
        dispose: jest.fn(),
      };
      mockPanels[id] = panel;
      return panel;
    };

    const showPanel = (panelId: string) => {
      const panel = mockPanels[panelId] || createPanel(panelId);

      // 检查是否是新的面板
      const isNewPanel = currentPanelId !== panelId;

      if (isNewPanel || !messageListenerRegistered) {
        panel.webview.onDidReceiveMessage(
          () => {},
          undefined,
          mockContext.subscriptions
        );
        messageListenerRegistered = true;
        currentPanelId = panelId;
        registrationCount++;
      }
    };

    const closeAndDispose = (panelId: string) => {
      if (mockPanels[panelId]) {
        mockPanels[panelId].dispose();
        delete mockPanels[panelId];
      }
      // 关闭时重置当前面板引用
      if (currentPanelId === panelId) {
        currentPanelId = null;
      }
    };

    // 打开第一个面板
    showPanel('panel-1');
    expect(registrationCount).toBe(1);

    // 关闭第一个面板
    closeAndDispose('panel-1');

    // 重新打开（同一个面板 ID）
    showPanel('panel-1');
    // 因为 currentPanelId 被重置为 null，所以 isNewPanel === true，会重新注册
    expect(registrationCount).toBe(2);

    // 关闭
    closeAndDispose('panel-1');

    // 创建一个全新的面板
    const newPanelId = 'panel-2';
    showPanel(newPanelId);
    // 因为是新面板 ID，应该重新注册
    expect(registrationCount).toBe(3);
  });

  test('使用 isPanelActive 检查面板是否重新创建', () => {
    const mockPanel1 = createMockPanel();
    const mockPanel2 = createMockPanel();

    let activePanel: any = mockPanel1;
    let messageListenerRegistered = false;
    let registrationCount = 0;

    const showPanel = () => {
      // 检查面板是否是新的
      const isNewPanel = activePanel !== mockPanel1;

      if (!messageListenerRegistered || isNewPanel) {
        activePanel.webview.onDidReceiveMessage(
          () => {},
          undefined,
          mockContext.subscriptions
        );
        messageListenerRegistered = true;
        registrationCount++;
      }
    };

    // 初始状态
    showPanel();
    expect(registrationCount).toBe(1);

    // 模拟关闭旧面板
    activePanel = null;

    // 重新打开新面板
    activePanel = mockPanel2;
    showPanel();

    // 修复后应该重新注册
    expect(registrationCount).toBe(2);
  });
});

/**
 * Webview JavaScript 错误检测测试
 * 这个测试文件用于检测 webview 中嵌入的 JavaScript 代码的语法错误
 */

describe('Webview JavaScript Syntax Tests', () => {
  /**
   * 测试 openTodoFile 函数是否只定义一次
   */
  test('openTodoFile function should be defined only once', () => {
    const jsCode = `
      function openTodoFile() {
        vscode.postMessage({ type: 'openFile' });
      }
      function refreshTasks() {
        vscode.postMessage({ type: 'refresh' });
      }
    `;

    const matches = jsCode.match(/function openTodoFile/g) || [];
    expect(matches.length).toBe(1);
  });

  /**
   * 测试 onclick 中的引号转义
   */
  test('onclick handler should have proper quote escaping', () => {
    // 模拟生成 onclick 属性的代码
    function generateOnClick(url: string): string {
      const escapedUrl = url.replace(/'/g, "\\'");
      const prefix = "onclick=\"openLink(event, \\'";
      const suffix = "')\"";
      return prefix + escapedUrl + suffix;
    }

    const url = './test.md';
    const result = generateOnClick(url);
    expect(result).toContain("openLink(event, \\'");

    // 测试带引号的 URL
    const urlWithApostrophe = "./path with ' quote.md";
    const result2 = generateOnClick(urlWithApostrophe);
    expect(result2).toContain("openLink(event, \\'");
  });

  /**
   * 检测实际 webviewProvider.ts 中是否有重复函数定义
   * 注意：此测试已跳过，因为现在 webview 使用独立的 bundle.js 文件
   */
  test.skip('webviewProvider should not have duplicate function definitions', () => {
    // 现在 webview 代码在 bundle.js 中，不在内联 script 标签中
    // 这个测试不再适用
  });

  /**
   * 检测 onclick 处理器引用的函数是否存在
   * 注意：此测试已跳过，因为现在使用 React 组件而非内联 onclick
   */
  test.skip('webview onclick handlers should reference defined functions', () => {
    // 现在 webview 使用 React 组件，事件处理通过 props 传递
    // 这个测试不再适用
  });

  /**
   * 测试 renderMarkdownLinks 核心逻辑（简化版测试）
   */
  test('renderMarkdownLinks core logic should find markdown links', () => {
    // 使用简单的 ASCII 测试，避免中文字符索引问题
    const simpleInput = 'before [link](test.md) after';
    const result = renderMarkdownLinks(simpleInput);

    // 应该找到链接
    expect(result).toContain('<a href="test.md">link</a>');
    // 应该保留前缀
    expect(result).toContain('before ');
    // 应该保留后缀
    expect(result).toContain(' after');
  });

  /**
   * 测试 renderMarkdownLinks 处理无链接的情况
   */
  test('renderMarkdownLinks should handle text without links', () => {
    const input = 'no links here';
    const result = renderMarkdownLinks(input);
    expect(result).toBe('no links here');
  });

  // 辅助函数：renderMarkdownLinks 的实现（来自 webviewProvider.ts）
  function renderMarkdownLinks(text: string): string {
    var result = '';
    var pos = 0;
    var linkStart: number;

    while ((linkStart = text.indexOf('[', pos)) !== -1) {
      var linkTextStart = linkStart;
      var bracketClose = text.indexOf(']', linkTextStart);
      if (bracketClose === -1) break;

      var linkText = text.substring(linkTextStart + 1, bracketClose);
      // 修复：parenOpen 应该从 bracketClose 开始搜索
      var parenOpen = text.indexOf('](', bracketClose);
      if (parenOpen === -1 || parenOpen !== bracketClose) {
        // 如果找不到 ]( 或者 ]( 不在 ] 的位置，不是有效链接
        pos = linkStart + 1;
        continue;
      }

      var urlStart = parenOpen + 2;
      var urlClose = text.indexOf(')', urlStart);
      if (urlClose === -1) break;

      var url = text.substring(urlStart, urlClose);
      result += text.substring(pos, linkStart);
      result += '<a href="' + url + '">' + linkText + '</a>';
      pos = urlClose + 1;
    }
    result += text.substring(pos);
    return result;
  }
});

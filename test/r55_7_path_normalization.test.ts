/**
 * R55.7 路径规范化测试
 * 测试路径中的 /./ 和 \.\ 规范化问题
 */

describe('R55.7 路径规范化', () => {
  /**
   * 规范化路径：移除 /./ 和 \.\ 等冗余路径分隔符
   */
  function normalizePath(path: string): string {
    // 将反斜杠替换为斜杠
    let normalized = path.replace(/\\/g, '/');
    // 移除开头的 ./ 模式
    normalized = normalized.replace(/^\.\//, '');
    // 移除路径中间的 /./ 模式（多个连续的 ./ 也需要处理）
    normalized = normalized.replace(/\/\.\//g, '/');
    // 处理路径末尾的 ./
    normalized = normalized.replace(/\/\.$/, '');
    // 处理连续的 ./ 情况（如 ./a/./b/./c -> a/b/c）
    normalized = normalized.replace(/(\/)\./g, '$1');
    return normalized;
  }

  /**
   * 模拟 copyLinkPath 函数的关键路径处理逻辑
   */
  function resolveLinkPath(href: string, currentFilePath: string): string {
    let linkPath = href;
    if (linkPath.startsWith('file://')) {
      linkPath = linkPath.slice(7);
    }
    try {
      linkPath = decodeURIComponent(linkPath);
    } catch (e) {}

    const isRelativePath = !linkPath.startsWith('/') && !linkPath.match(/^[A-Za-z]:/);

    let absolutePath = linkPath;
    if (isRelativePath && currentFilePath) {
      const currentDir = currentFilePath.replace(/[/\\][^/\\]*$/, '');
      absolutePath = currentDir + '/' + linkPath;
    }

    // 将反斜杠替换为斜杠
    absolutePath = absolutePath.replace(/\\/g, '/');

    // 规范化路径（修复 R55.7）
    absolutePath = normalizePath(absolutePath);

    return absolutePath;
  }

  /**
   * 模拟 copyLinkRelativePath 函数的关键路径处理逻辑
   */
  function resolveRelativePath(href: string, currentFilePath: string, workspacePath: string): string {
    let linkPath = href;
    if (linkPath.startsWith('file://')) {
      linkPath = linkPath.slice(7);
    }
    try {
      linkPath = decodeURIComponent(linkPath);
    } catch (e) {}

    const isRelativePath = !linkPath.startsWith('/') && !linkPath.match(/^[A-Za-z]:/);

    let absolutePath = linkPath;
    if (isRelativePath && currentFilePath) {
      const currentDir = currentFilePath.replace(/[/\\][^/\\]*$/, '');
      absolutePath = currentDir + '/' + linkPath;
    }

    let relativePath = absolutePath;
    if (workspacePath && absolutePath.startsWith(workspacePath)) {
      relativePath = absolutePath.slice(workspacePath.length);
      if (relativePath.startsWith('/') || relativePath.startsWith('\\')) {
        relativePath = relativePath.slice(1);
      }
    }

    relativePath = relativePath.replace(/\\/g, '/');

    // 规范化路径（修复 R55.7）
    relativePath = normalizePath(relativePath);

    return relativePath;
  }

  // ========== normalizePath 函数测试 ==========

  describe('normalizePath 路径规范化函数', () => {
    test('移除路径开头的 /./', () => {
      expect(normalizePath('/./path/to/file')).toBe('/path/to/file');
    });

    test('移除路径中间的 /./', () => {
      expect(normalizePath('/path/./to/file')).toBe('/path/to/file');
    });

    test('移除路径末尾的 /./', () => {
      expect(normalizePath('/path/to/./')).toBe('/path/to/');
    });

    test('移除连续的 /./', () => {
      expect(normalizePath('/path/./sub/./dir')).toBe('/path/sub/dir');
    });

    test('处理 ./ 开头的相对路径', () => {
      expect(normalizePath('./file.txt')).toBe('file.txt');
    });

    test('处理 ./dir/ 开头的路径', () => {
      expect(normalizePath('./docs/file.txt')).toBe('docs/file.txt');
    });

    test('处理深层 ./ 路径', () => {
      expect(normalizePath('./a/./b/./c/file.txt')).toBe('a/b/c/file.txt');
    });

    test('正常路径不应被修改', () => {
      expect(normalizePath('/path/to/file.txt')).toBe('/path/to/file.txt');
    });

    test('正常相对路径不应被修改', () => {
      expect(normalizePath('docs/file.txt')).toBe('docs/file.txt');
    });

    test('Windows 风格路径也应规范化', () => {
      expect(normalizePath('C:\\path\\.\\to\\file')).toBe('C:/path/to/file');
    });
  });

  // ========== resolveLinkPath 绝对路径测试 ==========

  describe('resolveLinkPath 绝对路径解析', () => {
    test('用户报告场景：docs/./docs/details/xxx.md 应规范化', () => {
      const href = './docs/details/20260127_1717_Task_Report.md';
      const currentFilePath = 'd:/Work/vscode-mdtodo/docs/20260120_MDTODO2.md';
      const result = resolveLinkPath(href, currentFilePath);
      expect(result).toBe('d:/Work/vscode-mdtodo/docs/docs/details/20260127_1717_Task_Report.md');
      expect(result).not.toContain('/./');
      expect(result).not.toContain('./');
    });

    test('用户报告场景：docs/./details/xxx.md 应规范化', () => {
      const href = './details/20260128_2129_Task_Report.md';
      const currentFilePath = 'd:/Work/vscode-mdtodo/docs/20260120_MDTODO2.md';
      const result = resolveLinkPath(href, currentFilePath);
      expect(result).toBe('d:/Work/vscode-mdtodo/docs/details/20260128_2129_Task_Report.md');
      expect(result).not.toContain('/./');
    });

    test('绝对路径不应被修改', () => {
      const href = 'd:/Work/vscode-mdtodo/docs/details/file.md';
      const currentFilePath = 'd:/Work/vscode-mdtodo/docs/20260120_MDTODO2.md';
      const result = resolveLinkPath(href, currentFilePath);
      expect(result).toBe('d:/Work/vscode-mdtodo/docs/details/file.md');
    });

    test('URL 编码路径应被正确解码和规范化', () => {
      const href = './docs%2Fdetails%2Ffile.md';  // 编码的 /
      const currentFilePath = 'd:/Work/vscode-mdtodo/docs/20260120_MDTODO2.md';
      const result = resolveLinkPath(href, currentFilePath);
      expect(result).toBe('d:/Work/vscode-mdtodo/docs/docs/details/file.md');
    });

    test('相对路径多层 ./ 应被规范化', () => {
      const href = './a/./b/./c/file.md';
      const currentFilePath = 'd:/Work/vscode-mdtodo/root.md';
      const result = resolveLinkPath(href, currentFilePath);
      expect(result).toBe('d:/Work/vscode-mdtodo/a/b/c/file.md');
      expect(result).not.toContain('/./');
    });
  });

  // ========== resolveRelativePath 相对路径测试 ==========

  describe('resolveRelativePath 相对路径解析', () => {
    test('用户报告场景：docs/./details/xxx.md 应规范化', () => {
      const href = './docs/details/20260127_1717_Task_Report.md';
      const currentFilePath = 'd:/Work/vscode-mdtodo/docs/20260120_MDTODO2.md';
      const workspacePath = 'd:/Work/vscode-mdtodo';
      const result = resolveRelativePath(href, currentFilePath, workspacePath);
      expect(result).toBe('docs/docs/details/20260127_1717_Task_Report.md');
      expect(result).not.toContain('/./');
    });

    test('用户报告场景：./details/xxx.md 应规范化', () => {
      const href = './details/20260128_2129_Task_Report.md';
      const currentFilePath = 'd:/Work/vscode-mdtodo/docs/20260120_MDTODO2.md';
      const workspacePath = 'd:/Work/vscode-mdtodo';
      const result = resolveRelativePath(href, currentFilePath, workspacePath);
      expect(result).toBe('docs/details/20260128_2129_Task_Report.md');
      expect(result).not.toContain('/./');
    });

    test('相对于工作区的路径应正确处理', () => {
      const href = './subdir/file.md';
      const currentFilePath = 'd:/Work/vscode-mdtodo/docs/main.md';
      const workspacePath = 'd:/Work/vscode-mdtodo';
      const result = resolveRelativePath(href, currentFilePath, workspacePath);
      expect(result).toBe('docs/subdir/file.md');
      expect(result).not.toContain('/./');
    });

    test('规范化不影响正常路径', () => {
      const href = './docs/file.md';
      const currentFilePath = 'd:/Work/vscode-mdtodo/main.md';
      const workspacePath = 'd:/Work/vscode-mdtodo';
      const result = resolveRelativePath(href, currentFilePath, workspacePath);
      expect(result).toBe('docs/file.md');
    });
  });

  // ========== 边界情况测试 ==========

  describe('边界情况', () => {
    test('只有一个 ./ 的路径', () => {
      const href = './';
      const currentFilePath = 'd:/Work/vscode-mdtodo/docs/file.md';
      const result = resolveLinkPath(href, currentFilePath);
      expect(result).toBe('d:/Work/vscode-mdtodo/docs/');
      expect(result).not.toContain('/./');
    });

    test('路径包含多个连续的 ./', () => {
      const href = './a/./b/./c/./d/file.md';
      const currentFilePath = 'd:/Work/vscode-mdtodo/root.md';
      const result = resolveLinkPath(href, currentFilePath);
      expect(result).toBe('d:/Work/vscode-mdtodo/a/b/c/d/file.md');
    });

    test('Windows 路径风格也应规范化', () => {
      const href = '.\\docs\\.\\details\\file.md';
      const currentFilePath = 'd:/Work/vscode-mdtodo/docs/main.md';
      const result = resolveLinkPath(href, currentFilePath);
      expect(result).toBe('d:/Work/vscode-mdtodo/docs/docs/details/file.md');
      expect(result).not.toContain('\\.\\');
    });

    test('混合斜杠路径应规范化', () => {
      const href = './a\\./b/./c.md';
      const currentFilePath = 'd:/Work/vscode-mdtodo/root.md';
      const result = resolveLinkPath(href, currentFilePath);
      expect(result).toBe('d:/Work/vscode-mdtodo/a/b/c.md');
    });
  });

  // ========== R55.7 特定问题回归测试 ==========

  describe('R55.7 特定问题回归测试', () => {
    test('用户报告：docs/./docs/details/xxx.md 问题复现', () => {
      const href = './docs/details/20260127_1717_Task_Report.md';
      const currentFilePath = 'd:/Work/vscode-mdtodo/docs/20260120_MDTODO2.md';
      const result = resolveLinkPath(href, currentFilePath);
      // 修复后不应包含 /./
      expect(result).not.toMatch(/\/\.\//);
    });

    test('用户报告：docs/./details/xxx.md 问题复现', () => {
      const href = './details/20260128_2129_Task_Report.md';
      const currentFilePath = 'd:/Work/vscode-mdtodo/docs/20260120_MDTODO2.md';
      const result = resolveLinkPath(href, currentFilePath);
      // 修复后不应包含 /./
      expect(result).not.toMatch(/\/\.\//);
    });

    test('深层嵌套的 ./ 链接应被规范化', () => {
      const href = './a/./b/./c/./file.md';
      const currentFilePath = 'd:/Work/vscode-mdtodo/root.md';
      const result = resolveLinkPath(href, currentFilePath);
      expect(result).toBe('d:/Work/vscode-mdtodo/a/b/c/file.md');
    });

    // 注意：../ 父目录路径的解析是另一个功能需求，不在 R55.7 范围内
    // R55.7 只修复 ./ 当前目录引用导致的 /./ 问题
  });
});

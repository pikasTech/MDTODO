import { Task, TextBlock } from '../components/types';

// 复制链接绝对路径到剪贴板
export const copyLinkPath = async (
  href: string,
  currentFilePath: string,
  closeMenu: () => void
): Promise<void> => {
  // 解析链接路径
  let linkPath = href;
  if (linkPath.startsWith('file://')) {
    linkPath = linkPath.slice(7);
  }
  // 解码 URL 编码的路径
  try {
    linkPath = decodeURIComponent(linkPath);
  } catch (e) {
    // 如果解码失败，保持原样
  }

  // 判断是否为相对路径（不以 / 开头，且不是 Windows 盘符）
  const isRelativePath = !linkPath.startsWith('/') && !linkPath.match(/^[A-Za-z]:/);

  let absolutePath = linkPath;
  if (isRelativePath && currentFilePath) {
    // 相对路径：基于当前文件路径解析为绝对路径
    const currentDir = currentFilePath.replace(/[/\\][^/\\]*$/, '');
    absolutePath = currentDir + '/' + linkPath;
  }

  // 将反斜杠替换为斜杠，保持路径格式一致性
  absolutePath = absolutePath.replace(/\\/g, '/');

  try {
    await navigator.clipboard.writeText(absolutePath);
    console.log('链接绝对路径已复制到剪贴板:', absolutePath);
  } catch (err) {
    console.error('复制失败:', err);
  }

  closeMenu();
};

// 复制链接相对路径到剪贴板（相对于 VSCode 工作区）
export const copyLinkRelativePath = async (
  href: string,
  currentFilePath: string,
  workspacePath: string,
  closeMenu: () => void
): Promise<void> => {
  // 解析链接路径
  let linkPath = href;
  if (linkPath.startsWith('file://')) {
    linkPath = linkPath.slice(7);
  }
  // 解码 URL 编码的路径
  try {
    linkPath = decodeURIComponent(linkPath);
  } catch (e) {
    // 如果解码失败，保持原样
  }

  // 判断是否为相对路径（不以 / 开头，且不是 Windows 盘符）
  const isRelativePath = !linkPath.startsWith('/') && !linkPath.match(/^[A-Za-z]:/);

  let absolutePath = linkPath;
  if (isRelativePath && currentFilePath) {
    // 相对路径：基于当前文件路径解析为绝对路径
    const currentDir = currentFilePath.replace(/[/\\][^/\\]*$/, '');
    absolutePath = currentDir + '/' + linkPath;
  }

  // 计算相对于工作区的相对路径
  let relativePath = absolutePath;
  if (workspacePath && absolutePath.startsWith(workspacePath)) {
    // 去除工作区前缀，得到相对于工作区的路径
    relativePath = absolutePath.slice(workspacePath.length);
    // 去除开头的斜杠
    if (relativePath.startsWith('/') || relativePath.startsWith('\\')) {
      relativePath = relativePath.slice(1);
    }
  }

  // 将反斜杠替换为斜杠，保持路径格式一致性
  relativePath = relativePath.replace(/\\/g, '/');

  try {
    await navigator.clipboard.writeText(relativePath);
    console.log('链接相对路径已复制到剪贴板:', relativePath);
  } catch (err) {
    console.error('复制失败:', err);
  }

  closeMenu();
};

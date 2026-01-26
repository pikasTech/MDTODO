import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import { spawn } from 'child_process';

/**
 * Typora 服务类
 * 负责使用 Typora 打开 md 文件
 */
export class TyporaService {
  /**
   * 使用 Typora 打开 md 文件
   * 【实现R42】如果文件不存在，弹出对话框询问是否创建
   */
  async openWithTypora(filePath: string): Promise<void> {
    try {
      // 【实现R42】检查文件是否存在，如果不存在则询问是否创建
      if (!fs.existsSync(filePath)) {
        // 弹出对话框询问是否创建文件
        const choice = await vscode.window.showWarningMessage(
          `文件不存在: ${filePath}`,
          { modal: true },
          '创建文件并打开',
          '取消'
        );

        if (choice === '创建文件并打开') {
          try {
            // 创建空文件
            const dir = path.dirname(filePath);
            if (!fs.existsSync(dir)) {
              fs.mkdirSync(dir, { recursive: true });
            }
            fs.writeFileSync(filePath, '', 'utf-8');
            console.log('[MDTODO] 已创建文件:', filePath);
          } catch (createError) {
            vscode.window.showErrorMessage(`创建文件失败: ${createError}`);
            return;
          }
        } else {
          // 用户选择取消，不执行任何操作
          console.log('[MDTODO] 用户取消创建文件');
          return;
        }
      }

      // 获取平台信息
      const platform = process.platform;
      let typoraPath: string | null = null;

      if (platform === 'win32') {
        // Windows: 查找常见的 Typora 安装路径
        const possiblePaths = [
          'C:\\Program Files\\Typora\\Typora.exe',
          'C:\\Program Files (x86)\\Typora\\Typora.exe',
          path.join(process.env.LOCALAPPDATA || '', 'Programs\\Typora\\Typora.exe'),
        ];

        for (const p of possiblePaths) {
          if (fs.existsSync(p)) {
            typoraPath = p;
            break;
          }
        }

        if (typoraPath) {
          // Windows 直接启动 Typora，避免黑窗
          spawn(typoraPath, [filePath], {
            detached: true,
            stdio: 'ignore',
            windowsHide: true
          });
          console.log('[MDTODO] 已使用 Typora 打开:', filePath);
        } else {
          // 如果找不到 Typora，回退到 VSCode
          vscode.window.showWarningMessage('未找到 Typora，使用 VSCode 打开');
          const uri = vscode.Uri.file(filePath);
          await vscode.window.showTextDocument(uri);
        }
      } else if (platform === 'darwin') {
        // macOS
        spawn('open', ['-a', 'Typora', filePath], {
          detached: true,
          stdio: 'ignore'
        });
        console.log('[MDTODO] 已使用 Typora 打开:', filePath);
      } else {
        // Linux
        spawn('typora', [filePath], {
          detached: true,
          stdio: 'ignore'
        });
        console.log('[MDTODO] 已使用 Typora 打开:', filePath);
      }
    } catch (error) {
      console.error('[MDTODO] 使用 Typora 打开失败:', error);
      // 回退到 VSCode
      const uri = vscode.Uri.file(filePath);
      await vscode.window.showTextDocument(uri);
    }
  }
}

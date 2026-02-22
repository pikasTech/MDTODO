import * as vscode from 'vscode';
import * as path from 'path';

// ============================================
// 设置服务 - R54.9.3.1
// 管理 .vscode/mdtodo/settings.json 文件的读取/写入
// ============================================

/**
 * 设置配置接口
 */
export interface SettingsConfig {
  executionMode: 'claude' | 'opencode';
}

/**
 * 默认配置
 */
const DEFAULT_CONFIG: SettingsConfig = {
  executionMode: 'claude',
};

/**
 * 【R54.9.3.1】设置服务类
 * 提供 settings.json 文件的读取/写入功能
 */
export class SettingsService {
  /**
   * 获取设置文件路径
   * @param workspacePath 工作区根路径
   * @returns 设置文件的完整路径
   */
  private getSettingsFilePath(workspacePath: string): string {
    return path.join(workspacePath, '.vscode', 'mdtodo', 'settings.json');
  }

  /**
   * 确保设置目录存在
   * @param workspacePath 工作区根路径
   * @returns Promise that resolves when directory is created
   */
  async ensureSettingsDirectory(workspacePath: string): Promise<void> {
    const settingsDir = path.join(workspacePath, '.vscode', 'mdtodo');
    try {
      await vscode.workspace.fs.createDirectory(vscode.Uri.file(settingsDir));
      console.log(`[SettingsService] Created settings directory: ${settingsDir}`);
    } catch (error: unknown) {
      const err = error as Error & { code?: string };
      if (err.code !== 'EEXIST') {
        console.error(`[SettingsService] Failed to create settings directory: ${settingsDir}`, error);
      }
    }
  }

  /**
   * 读取设置文件
   * @param workspacePath 工作区根路径
   * @returns Promise that resolves to SettingsConfig
   */
  async readSettings(workspacePath: string): Promise<SettingsConfig> {
    const settingsPath = this.getSettingsFilePath(workspacePath);
    const uri = vscode.Uri.file(settingsPath);

    try {
      const content = await vscode.workspace.fs.readFile(uri);
      const text = new TextDecoder().decode(content);
      const config = JSON.parse(text) as SettingsConfig;

      // 验证并返回配置
      return {
        executionMode: config.executionMode || DEFAULT_CONFIG.executionMode,
      };
    } catch (error: unknown) {
      const err = error as Error & { code?: string };
      if (err.code === 'ENOENT' || err.name === 'RangeError') {
        // 文件不存在或JSON解析错误，返回默认配置
        return DEFAULT_CONFIG;
      }
      console.error(`[SettingsService] Failed to read settings: ${settingsPath}`, error);
      return DEFAULT_CONFIG;
    }
  }

  /**
   * 写入设置文件
   * @param workspacePath 工作区根路径
   * @param config 要写入的配置
   * @returns Promise that resolves when the config is written
   */
  async writeSettings(
    workspacePath: string,
    config: Partial<SettingsConfig>
  ): Promise<void> {
    // 确保目录存在
    await this.ensureSettingsDirectory(workspacePath);

    const settingsPath = this.getSettingsFilePath(workspacePath);

    // 读取现有配置
    const existingConfig = await this.readSettings(workspacePath);

    // 合并配置
    const mergedConfig: SettingsConfig = {
      executionMode: config.executionMode ?? existingConfig.executionMode,
    };

    const uri = vscode.Uri.file(settingsPath);
    const content = JSON.stringify(mergedConfig, null, 2);

    try {
      await vscode.workspace.fs.writeFile(uri, new TextEncoder().encode(content));
      console.log(`[SettingsService] Written settings to: ${settingsPath}`);
      console.log(`[SettingsService] Config:`, mergedConfig);
    } catch (error) {
      console.error(`[SettingsService] Failed to write settings: ${settingsPath}`, error);
      throw error;
    }
  }

  /**
   * 更新执行模式设置
   * @param workspacePath 工作区根路径
   * @param mode 新的执行模式 ('claude' | 'opencode')
   * @returns Promise that resolves when the mode is updated
   */
  async updateExecutionMode(
    workspacePath: string,
    mode: 'claude' | 'opencode'
  ): Promise<void> {
    await this.writeSettings(workspacePath, { executionMode: mode });
  }

  /**
   * 获取当前执行模式
   * @param workspacePath 工作区根路径
   * @returns Promise that resolves to current execution mode
   */
  async getExecutionMode(
    workspacePath: string
  ): Promise<'claude' | 'opencode'> {
    const config = await this.readSettings(workspacePath);
    return config.executionMode;
  }
}

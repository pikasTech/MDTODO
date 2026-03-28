import * as fs from 'fs';
import * as path from 'path';

export interface SettingsConfig {
  executionMode: 'claude' | 'opencode';
  model?: string;
}

const DEFAULT_CONFIG: SettingsConfig = {
  executionMode: 'opencode',
  model: undefined,
};

export class SettingsService {
  private configPath: string;

  constructor(workspacePath?: string) {
    const basePath = workspacePath || process.cwd();
    this.configPath = path.join(basePath, '.vscode', 'mdtodo', 'settings.json');
  }

  async readSettings(): Promise<SettingsConfig> {
    try {
      const content = fs.readFileSync(this.configPath, 'utf-8');
      const config = JSON.parse(content) as SettingsConfig;
      return {
        executionMode: config.executionMode || DEFAULT_CONFIG.executionMode,
        model: config.model,
      };
    } catch (error: any) {
      if (error.code === 'ENOENT' || error.name === 'SyntaxError') {
        return DEFAULT_CONFIG;
      }
      throw error;
    }
  }

  async writeSettings(config: Partial<SettingsConfig>): Promise<void> {
    const existingConfig = await this.readSettings();
    const mergedConfig: SettingsConfig = {
      executionMode: config.executionMode ?? existingConfig.executionMode,
      model: config.model ?? existingConfig.model,
    };

    const dir = path.dirname(this.configPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    fs.writeFileSync(this.configPath, JSON.stringify(mergedConfig, null, 2), 'utf-8');
  }

  async updateExecutionMode(mode: 'claude' | 'opencode'): Promise<void> {
    await this.writeSettings({ executionMode: mode });
  }

  async updateModel(model: string): Promise<void> {
    await this.writeSettings({ model });
  }

  async getExecutionMode(): Promise<'claude' | 'opencode'> {
    const config = await this.readSettings();
    return config.executionMode;
  }

  async getModel(): Promise<string | undefined> {
    const config = await this.readSettings();
    return config.model;
  }

  getConfigPath(): string {
    return this.configPath;
  }
}
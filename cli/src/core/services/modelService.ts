import { spawn } from 'child_process';
import * as path from 'path';

export interface ModelInfo {
  id: string;
  name: string;
  provider: string;
}

export class ModelService {
  public async listModels(): Promise<ModelInfo[]> {
    return new Promise((resolve, reject) => {
      const proc = spawn('opencode', ['models'], {
        shell: true,
        windowsHide: true,
      });

      let stdout = '';
      let stderr = '';

      proc.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      proc.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      proc.on('close', (code) => {
        if (code !== 0) {
          reject(new Error(`opencode models failed: ${stderr}`));
          return;
        }

        const lines = stdout.trim().split('\n');
        const models: ModelInfo[] = [];

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed) continue;

          const parts = trimmed.split('/');
          if (parts.length >= 2) {
            const provider = parts[0];
            const modelId = parts[1];
            models.push({
              id: trimmed,
              name: modelId.replace(/-/g, ' '),
              provider: provider,
            });
          } else {
            models.push({
              id: trimmed,
              name: trimmed,
              provider: 'unknown',
            });
          }
        }

        resolve(models);
      });

      proc.on('error', (err) => {
        reject(new Error(`Failed to spawn opencode: ${err.message}`));
      });
    });
  }
}
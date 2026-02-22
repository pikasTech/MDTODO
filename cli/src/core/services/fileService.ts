import * as fs from 'fs';
import * as path from 'path';

export interface ReadFileOptions {
  encoding?: BufferEncoding;
}

export interface WriteFileOptions {
  encoding?: BufferEncoding;
  mode?: fs.Mode;
  flag?: string;
}

export class FileService {
  /**
   * Read file content
   */
  readFile(filePath: string, options?: ReadFileOptions): string {
    console.log(`[FileService] readFile: ${filePath}`);
    try {
      const encoding = options?.encoding || 'utf-8';
      const content = fs.readFileSync(filePath, encoding);
      console.log(`[FileService] readFile 成功: ${filePath}, 内容长度: ${content.length}`);
      return content;
    } catch (error) {
      console.error(`[FileService] readFile 失败: ${filePath}`, error);
      throw error;
    }
  }

  /**
   * Write file content
   */
  writeFile(filePath: string, content: string, options?: WriteFileOptions): void {
    console.log(`[FileService] writeFile 开始: ${filePath}, 内容长度: ${content.length}`);
    try {
      const dir = path.dirname(filePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(filePath, content, options);
      console.log(`[FileService] writeFile 成功: ${filePath}`);
    } catch (error) {
      console.error(`[FileService] writeFile 失败: ${filePath}`, error);
      throw error;
    }
  }

  /**
   * Append to file
   */
  appendFile(filePath: string, content: string): void {
    console.log(`[FileService] appendFile: ${filePath}`);
    try {
      fs.appendFileSync(filePath, content);
      console.log(`[FileService] appendFile 成功: ${filePath}`);
    } catch (error) {
      console.error(`[FileService] appendFile 失败: ${filePath}`, error);
      throw error;
    }
  }

  /**
   * Check if file exists
   */
  exists(filePath: string): boolean {
    return fs.existsSync(filePath);
  }

  /**
   * Delete file
   */
  delete(filePath: string): void {
    console.log(`[FileService] delete: ${filePath}`);
    try {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        console.log(`[FileService] delete 成功: ${filePath}`);
      }
    } catch (error) {
      console.error(`[FileService] delete 失败: ${filePath}`, error);
      throw error;
    }
  }

  /**
   * Get file stats
   */
  stat(filePath: string): fs.Stats {
    return fs.statSync(filePath);
  }

  /**
   * Read directory
   */
  readDir(dirPath: string): string[] {
    return fs.readdirSync(dirPath);
  }

  /**
   * Create directory
   */
  mkdir(dirPath: string, recursive?: boolean): void {
    fs.mkdirSync(dirPath, { recursive: recursive ?? true });
  }

  /**
   * Find TODO files matching pattern
   * Pure Node.js implementation using glob pattern
   */
  findTodoFiles(baseDir: string, pattern: string = '**/*TODO*.md'): string[] {
    const results: string[] = [];

    const searchDir = (dir: string): void => {
      if (!fs.existsSync(dir)) return;

      const entries = fs.readdirSync(dir, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);

        if (entry.isDirectory()) {
          // Skip node_modules and .git
          if (entry.name !== 'node_modules' && entry.name !== '.git') {
            searchDir(fullPath);
          }
        } else if (entry.isFile()) {
          // Match TODO pattern
          if (entry.name.match(/TODO.*\.md$/i)) {
            results.push(fullPath);
          }
        }
      }
    };

    searchDir(baseDir);
    return results;
  }
}

export interface TodoTask {
  id: string;           // 任务编号，如 "R1", "R2.1"
  title: string;        // 任务标题（用于显示，经过格式化处理）
  description: string;  // 任务描述（不含链接部分）
  rawContent: string;   // 原始内容（用于编辑，保留所有格式包括编号列表）
  completed: boolean;   // 完成状态
  processing: boolean;  // 执行中状态
  children: TodoTask[]; // 子任务列表
  parent?: TodoTask;    // 父任务引用
  lineNumber: number;   // 在文件中的行号
  filePath: string;     // 所属文件路径
  // 【实现R39】链接统计信息
  linkCount: number;    // 任务中提到的链接总数
  linkExists: number;   // 存在的链接数量
}

export interface TextBlock {
  id: string;           // 文本块唯一标识
  content: string;      // 文本块内容（用于显示，经过格式化处理）
  rawContent: string;   // 原始内容（用于编辑，保留所有格式）
  lineNumber: number;   // 在文件中的行号
}

export interface TodoFile {
  filePath: string;
  tasks: TodoTask[];
  textBlocks?: TextBlock[]; // 非RXX的普通文本块
}

import { Task } from '../components/types';

// 获取所有任务的ID列表
export const getAllTaskIds = (taskList: Task[]): string[] => {
  let result: string[] = [];
  for (const task of taskList) {
    result.push(task.id);
    if (task.children && task.children.length > 0) {
      result = result.concat(getAllTaskIds(task.children));
    }
  }
  return result;
};

// 获取所有任务的扁平列表
export const getAllTasks = (taskList: Task[]): Task[] => {
  let result: Task[] = [];
  for (const task of taskList) {
    result.push(task);
    if (task.children && task.children.length > 0) {
      result = result.concat(getAllTasks(task.children));
    }
  }
  return result;
};

// 根据ID查找任务
export const findTaskById = (taskList: Task[], taskId: string): Task | undefined => {
  for (const task of taskList) {
    if (task.id === taskId) {
      return task;
    }
    if (task.children && task.children.length > 0) {
      const found = findTaskById(task.children, taskId);
      if (found) return found;
    }
  }
  return undefined;
};

// 从文件路径提取文件名（不带 .md 后缀）
export const getFileName = (path: string): string => {
  if (!path) return 'MDTODO 任务管理';
  // 提取文件名并去掉 .md 后缀
  const fileName = path.split('/').pop()?.split('\\').pop() || '';
  return fileName.replace(/\.md$/i, '') || 'MDTODO 任务管理';
};

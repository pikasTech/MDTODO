import { Task } from '../components/types';

// 筛选任务：支持状态筛选和关键词搜索
// filterType: 'all' | 'active' | 'hide-completed' | 'processing'
export const filterTasks = (taskList: Task[], filterType: string, searchKeyword: string): Task[] => {
  return taskList
    .map(task => {
      // 递归筛选子任务
      const filteredChildren = task.children ? filterTasks(task.children, filterType, searchKeyword) : [];
      const matchingTask = {
        ...task,
        children: filteredChildren.length > 0 ? filteredChildren : undefined
      };

      // 检查当前任务是否匹配筛选条件
      // active = 未完成 且 未执行中
      // hide-completed = 隐藏已完成（显示未完成任务和进行中任务）
      // processing = 执行中 且 未完成
      const isActive = !matchingTask.completed && !matchingTask.processing;
      const matchesStatus = filterType === 'all' ||
        (filterType === 'active' && isActive) ||
        (filterType === 'hide-completed' && !matchingTask.completed) ||
        (filterType === 'processing' && matchingTask.processing && !matchingTask.completed);

      const matchesKeyword = searchKeyword.trim() === '' ||
        matchingTask.title.toLowerCase().includes(searchKeyword.toLowerCase()) ||
        matchingTask.id.toLowerCase().includes(searchKeyword.toLowerCase());

      // 如果任务本身匹配，或者有子任务匹配，则保留
      if ((matchesStatus && matchesKeyword) || filteredChildren.length > 0) {
        return matchingTask;
      }
      return null;
    })
    .filter((task): task is Task => task !== null);
};

// 获取所有任务的扁平列表
export const getFilteredStats = (filteredTasks: Task[]) => {
  const allFilteredTasks = getAllTasks(filteredTasks);
  return {
    total: allFilteredTasks.length,
    completed: allFilteredTasks.filter((t) => t.completed).length
  };
};

// 辅助函数：获取所有任务的扁平列表
const getAllTasks = (taskList: Task[]): Task[] => {
  let result: Task[] = [];
  for (const task of taskList) {
    result.push(task);
    if (task.children && task.children.length > 0) {
      result = result.concat(getAllTasks(task.children));
    }
  }
  return result;
};

import type { Task } from '@/types';
import { TaskStatus } from '@/types';
import TaskItem from './TaskItem';

interface TaskListProps {
  tasks: Task[];
  onStatusChange: (id: number, status: TaskStatus) => void;
  onTaskClick: (task: Task) => void;
  isUpdating?: boolean;
}

export default function TaskList({ tasks, onStatusChange, onTaskClick, isUpdating }: TaskListProps) {
  if (tasks.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <p className="text-gray-500">No tasks found</p>
        <p className="text-sm text-gray-400 mt-2">
          Use Cmd+K to create your first task
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {tasks.map((task) => (
        <TaskItem
          key={task.id}
          task={task}
          onStatusChange={onStatusChange}
          onClick={() => onTaskClick(task)}
          isUpdating={isUpdating}
        />
      ))}
    </div>
  );
}

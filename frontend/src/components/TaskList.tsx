import type { Task } from '@/types';
import { TaskStatus } from '@/types';
import TaskItem from './TaskItem';

interface TaskListProps {
  tasks: Task[];
  onStatusChange: (id: number, status: TaskStatus) => void;
  onTaskClick: (task: Task) => void;
  onDelete?: (id: number) => void;
  isUpdating?: boolean;
  searchQuery?: string;
}

export default function TaskList({ tasks, onStatusChange, onTaskClick, onDelete, isUpdating, searchQuery }: TaskListProps) {
  if (tasks.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <svg
          className="w-16 h-16 text-gray-300 mb-4"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
          />
        </svg>
        <p className="text-gray-500 text-lg mb-2">
          {searchQuery
            ? `No tasks match "${searchQuery}"`
            : 'No tasks yet'}
        </p>
        <p className="text-gray-400 text-sm">
          {searchQuery
            ? 'Try a different search term'
            : 'Use Cmd+K to create your first task'}
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
          onDelete={onDelete}
          isUpdating={isUpdating}
        />
      ))}
    </div>
  );
}

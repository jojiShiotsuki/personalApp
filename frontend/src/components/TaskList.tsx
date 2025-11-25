import type { Task, Goal } from '@/types';
import { TaskStatus } from '@/types';
import TaskItem from './TaskItem';
import { CheckSquare } from 'lucide-react';
import { cn } from '@/lib/utils';

interface TaskListProps {
  tasks: Task[];
  onStatusChange: (id: number, status: TaskStatus) => void;
  onTaskClick: (task: Task) => void;
  onDelete?: (id: number) => void;
  isUpdating?: boolean;
  searchQuery?: string;
  selectedTaskIds?: Set<number>;
  onToggleSelect?: (id: number) => void;
  goals?: Goal[];
}

export default function TaskList({ tasks, onStatusChange, onTaskClick, onDelete, isUpdating, searchQuery, selectedTaskIds, onToggleSelect, goals }: TaskListProps) {
  if (tasks.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16">
        {/* Icon with gradient background */}
        <div className={cn(
          'w-24 h-24 mb-6',
          'rounded-full',
          'bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20',
          'flex items-center justify-center',
          'shadow-inner'
        )}>
          <CheckSquare className="w-12 h-12 text-blue-400 dark:text-blue-500" />
        </div>

        {/* Heading */}
        <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
          {searchQuery ? 'No matching tasks' : 'No tasks yet'}
        </h3>

        {/* Description */}
        <p className="text-gray-500 dark:text-gray-400 text-center max-w-md mb-6 leading-relaxed">
          {searchQuery
            ? `No tasks match "${searchQuery}". Try a different search term.`
            : 'Create your first task to get started on your productivity journey.'}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {tasks.map((task) => (
        <TaskItem
          key={task.id}
          task={task}
          onStatusChange={onStatusChange}
          onClick={() => onTaskClick(task)}
          onDelete={onDelete}
          isUpdating={isUpdating}
          isSelected={selectedTaskIds?.has(task.id)}
          onToggleSelect={onToggleSelect}
          goals={goals}
        />
      ))}
    </div>
  );
}

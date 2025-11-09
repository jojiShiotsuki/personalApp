import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import { goalApi } from '@/lib/api';
import type { Goal, GoalCreate, GoalUpdate, KeyResult } from '@/types';
import { Quarter, Month, GoalPriority } from '@/types';
import { ChevronDown, ChevronRight, Plus, Target, Trash2, Edit, Calendar } from 'lucide-react';
import { cn } from '@/lib/utils';

// Quarter to months mapping
const QUARTER_MONTHS: Record<Quarter, Month[]> = {
  [Quarter.Q1]: [Month.JANUARY, Month.FEBRUARY, Month.MARCH],
  [Quarter.Q2]: [Month.APRIL, Month.MAY, Month.JUNE],
  [Quarter.Q3]: [Month.JULY, Month.AUGUST, Month.SEPTEMBER],
  [Quarter.Q4]: [Month.OCTOBER, Month.NOVEMBER, Month.DECEMBER],
};

const priorityConfig = {
  [GoalPriority.HIGH]: {
    badge: 'bg-red-100 text-red-700 border-red-200',
    label: 'High'
  },
  [GoalPriority.MEDIUM]: {
    badge: 'bg-blue-100 text-blue-700 border-blue-200',
    label: 'Medium'
  },
  [GoalPriority.LOW]: {
    badge: 'bg-gray-100 text-gray-600 border-gray-200',
    label: 'Low'
  }
};

export default function Goals() {
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [expandedQuarters, setExpandedQuarters] = useState<Set<Quarter>>(new Set([Quarter.Q1]));
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingGoal, setEditingGoal] = useState<Goal | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);

  const queryClient = useQueryClient();

  // Form state
  const [formData, setFormData] = useState<GoalCreate>({
    title: '',
    description: '',
    quarter: Quarter.Q1,
    month: Month.JANUARY,
    year: selectedYear,
    target_date: '',
    progress: 0,
    priority: GoalPriority.MEDIUM,
    key_results: [],
  });

  // Fetch goals
  const { data: goals = [], isLoading } = useQuery({
    queryKey: ['goals', selectedYear],
    queryFn: () => goalApi.getAll(undefined, selectedYear),
  });

  // Create mutation
  const createMutation = useMutation({
    mutationFn: goalApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['goals'] });
      setIsModalOpen(false);
      resetForm();
    },
  });

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: GoalUpdate }) => goalApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['goals'] });
      setIsModalOpen(false);
      setEditingGoal(null);
      resetForm();
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: goalApi.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['goals'] });
      setDeleteConfirmId(null);
    },
  });

  const resetForm = () => {
    setFormData({
      title: '',
      description: '',
      quarter: Quarter.Q1,
      month: Month.JANUARY,
      year: selectedYear,
      target_date: '',
      progress: 0,
      priority: GoalPriority.MEDIUM,
      key_results: [],
    });
    setEditingGoal(null);
  };

  const handleNewGoal = (quarter: Quarter, month: Month) => {
    setFormData({
      ...formData,
      quarter,
      month,
      year: selectedYear,
    });
    setIsModalOpen(true);
  };

  const handleEditGoal = (goal: Goal) => {
    setEditingGoal(goal);
    setFormData({
      title: goal.title,
      description: goal.description || '',
      quarter: goal.quarter,
      month: goal.month,
      year: goal.year,
      target_date: goal.target_date || '',
      progress: goal.progress,
      priority: goal.priority,
      key_results: goal.key_results || [],
    });
    setIsModalOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingGoal) {
      updateMutation.mutate({ id: editingGoal.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const handleDelete = (id: number) => {
    if (confirm('Delete this goal?')) {
      deleteMutation.mutate(id);
    }
  };

  const toggleQuarter = (quarter: Quarter) => {
    const newExpanded = new Set(expandedQuarters);
    if (newExpanded.has(quarter)) {
      newExpanded.delete(quarter);
    } else {
      newExpanded.add(quarter);
    }
    setExpandedQuarters(newExpanded);
  };

  const handleDragEnd = (result: DropResult) => {
    const { destination, source, draggableId } = result;

    if (!destination) return;
    if (destination.droppableId === source.droppableId) return;

    const goalId = parseInt(draggableId.split('-')[1]);
    const goal = goals.find(g => g.id === goalId);
    if (!goal) return;

    // Parse destination: "Q1-January"
    const [destQuarter, destMonth] = destination.droppableId.split('-') as [Quarter, Month];

    updateMutation.mutate({
      id: goalId,
      data: {
        quarter: destQuarter,
        month: destMonth,
      },
    });
  };

  const addKeyResult = () => {
    const newKeyResult: KeyResult = {
      id: Date.now().toString(),
      title: '',
      completed: false,
    };
    setFormData({
      ...formData,
      key_results: [...(formData.key_results || []), newKeyResult],
    });
  };

  const updateKeyResult = (id: string, field: keyof KeyResult, value: any) => {
    setFormData({
      ...formData,
      key_results: formData.key_results?.map(kr =>
        kr.id === id ? { ...kr, [field]: value } : kr
      ),
    });
  };

  const removeKeyResult = (id: string) => {
    setFormData({
      ...formData,
      key_results: formData.key_results?.filter(kr => kr.id !== id),
    });
  };

  // Quick add goal - defaults to current quarter/month
  const handleQuickAdd = () => {
    const now = new Date();
    const currentMonth = now.getMonth(); // 0-11

    // Determine quarter and month
    let quarter: Quarter;
    let month: Month;

    if (currentMonth < 3) {
      quarter = Quarter.Q1;
      month = [Month.JANUARY, Month.FEBRUARY, Month.MARCH][currentMonth];
    } else if (currentMonth < 6) {
      quarter = Quarter.Q2;
      month = [Month.APRIL, Month.MAY, Month.JUNE][currentMonth - 3];
    } else if (currentMonth < 9) {
      quarter = Quarter.Q3;
      month = [Month.JULY, Month.AUGUST, Month.SEPTEMBER][currentMonth - 6];
    } else {
      quarter = Quarter.Q4;
      month = [Month.OCTOBER, Month.NOVEMBER, Month.DECEMBER][currentMonth - 9];
    }

    handleNewGoal(quarter, month);
  };

  // Keyboard shortcut: Ctrl+G or Cmd+G to quickly add goal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'g') {
        e.preventDefault();
        handleQuickAdd();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedYear]);

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Goals</h1>
          <p className="text-gray-500 mt-1">Track quarterly and monthly objectives</p>
        </div>

        {/* Year selector and Quick Add */}
        <div className="flex items-center gap-4">
          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(parseInt(e.target.value))}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {[currentYear - 1, currentYear, currentYear + 1].map(year => (
              <option key={year} value={year}>{year}</option>
            ))}
          </select>

          <button
            onClick={handleQuickAdd}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors shadow-md"
          >
            <Plus className="w-5 h-5" />
            New Goal
            <span className="text-xs opacity-75 ml-1">(Ctrl+G)</span>
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <div className="text-gray-500">Loading goals...</div>
        </div>
      ) : (
        <DragDropContext onDragEnd={handleDragEnd}>
          <div className="space-y-6">
            {/* Quarters */}
            {Object.values(Quarter).map((quarter) => {
              const isExpanded = expandedQuarters.has(quarter);
              const quarterGoals = goals.filter(g => g.quarter === quarter);

              return (
                <div key={quarter} className="bg-white rounded-lg shadow">
                  {/* Quarter Header */}
                  <button
                    onClick={() => toggleQuarter(quarter)}
                    className="w-full flex items-center justify-between p-6 hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      {isExpanded ? (
                        <ChevronDown className="w-5 h-5 text-gray-600" />
                      ) : (
                        <ChevronRight className="w-5 h-5 text-gray-600" />
                      )}
                      <Target className="w-6 h-6 text-blue-600" />
                      <h2 className="text-xl font-semibold text-gray-900">{quarter}</h2>
                      <span className="text-sm text-gray-500">({quarterGoals.length} goals)</span>
                    </div>
                  </button>

                  {/* Quarter Content - Months */}
                  {isExpanded && (
                    <div className="border-t border-gray-200 p-6 space-y-6">
                      {QUARTER_MONTHS[quarter].map((month) => {
                        const monthGoals = goals.filter(
                          g => g.quarter === quarter && g.month === month
                        );
                        const droppableId = `${quarter}-${month}`;

                        return (
                          <div key={month} className="bg-gray-50 rounded-lg p-4">
                            {/* Month Header */}
                            <div className="flex items-center justify-between mb-4">
                              <div className="flex items-center gap-2">
                                <Calendar className="w-5 h-5 text-gray-600" />
                                <h3 className="text-lg font-semibold text-gray-800">{month}</h3>
                                <span className="text-sm text-gray-500">({monthGoals.length})</span>
                              </div>
                              <button
                                onClick={() => handleNewGoal(quarter, month)}
                                className="flex items-center gap-1 px-3 py-1.5 text-sm text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                              >
                                <Plus className="w-4 h-4" />
                                Add Goal
                              </button>
                            </div>

                            {/* Month Goals */}
                            <Droppable droppableId={droppableId}>
                              {(provided, snapshot) => (
                                <div
                                  ref={provided.innerRef}
                                  {...provided.droppableProps}
                                  className={cn(
                                    'min-h-[100px] space-y-3',
                                    snapshot.isDraggingOver && 'bg-blue-50 rounded-lg'
                                  )}
                                >
                                  {monthGoals.length === 0 ? (
                                    <div className="flex items-center justify-center h-24 text-gray-400 text-sm">
                                      No goals for {month}
                                    </div>
                                  ) : (
                                    monthGoals.map((goal, index) => (
                                      <Draggable
                                        key={goal.id}
                                        draggableId={`goal-${goal.id}`}
                                        index={index}
                                      >
                                        {(provided, snapshot) => (
                                          <div
                                            ref={provided.innerRef}
                                            {...provided.draggableProps}
                                            {...provided.dragHandleProps}
                                            className={cn(
                                              'bg-white p-4 rounded-lg border-2 border-gray-200',
                                              'hover:shadow-md transition-shadow cursor-move',
                                              snapshot.isDragging && 'shadow-xl border-blue-400'
                                            )}
                                          >
                                            {/* Goal Header */}
                                            <div className="flex items-start justify-between mb-2">
                                              <h4 className="font-semibold text-gray-900 flex-1">
                                                {goal.title}
                                              </h4>
                                              <div className="flex items-center gap-1">
                                                <button
                                                  onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleEditGoal(goal);
                                                  }}
                                                  className="p-1 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded"
                                                >
                                                  <Edit className="w-4 h-4" />
                                                </button>
                                                <button
                                                  onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleDelete(goal.id);
                                                  }}
                                                  className="p-1 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded"
                                                >
                                                  <Trash2 className="w-4 h-4" />
                                                </button>
                                              </div>
                                            </div>

                                            {goal.description && (
                                              <p className="text-sm text-gray-600 mb-3">{goal.description}</p>
                                            )}

                                            {/* Goal Details */}
                                            <div className="flex items-center gap-3 flex-wrap">
                                              {/* Priority */}
                                              <span className={cn(
                                                'text-xs px-2 py-1 rounded-full border',
                                                priorityConfig[goal.priority].badge
                                              )}>
                                                {priorityConfig[goal.priority].label}
                                              </span>

                                              {/* Progress */}
                                              <div className="flex items-center gap-2">
                                                <div className="w-32 h-2 bg-gray-200 rounded-full overflow-hidden">
                                                  <div
                                                    className="h-full bg-green-500 transition-all"
                                                    style={{ width: `${goal.progress}%` }}
                                                  />
                                                </div>
                                                <span className="text-xs text-gray-600">{goal.progress}%</span>
                                              </div>

                                              {/* Target Date */}
                                              {goal.target_date && (
                                                <span className="text-xs text-gray-500 flex items-center gap-1">
                                                  <Calendar className="w-3 h-3" />
                                                  {goal.target_date}
                                                </span>
                                              )}
                                            </div>

                                            {/* Key Results */}
                                            {goal.key_results && goal.key_results.length > 0 && (
                                              <div className="mt-3 space-y-1">
                                                {goal.key_results.map((kr) => (
                                                  <div key={kr.id} className="flex items-center gap-2 text-sm">
                                                    <input
                                                      type="checkbox"
                                                      checked={kr.completed}
                                                      readOnly
                                                      className="w-4 h-4 rounded"
                                                    />
                                                    <span className={cn(
                                                      'text-gray-700',
                                                      kr.completed && 'line-through text-gray-400'
                                                    )}>
                                                      {kr.title}
                                                    </span>
                                                  </div>
                                                ))}
                                              </div>
                                            )}
                                          </div>
                                        )}
                                      </Draggable>
                                    ))
                                  )}
                                  {provided.placeholder}
                                </div>
                              )}
                            </Droppable>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </DragDropContext>
      )}

      {/* Goal Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-2xl font-bold text-gray-900">
                {editingGoal ? 'Edit Goal' : 'New Goal'}
              </h2>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-6">
              {/* Title */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Title *
                </label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Description
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows={3}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Quarter and Month */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Quarter *
                  </label>
                  <select
                    value={formData.quarter}
                    onChange={(e) => {
                      const newQuarter = e.target.value as Quarter;
                      setFormData({
                        ...formData,
                        quarter: newQuarter,
                        month: QUARTER_MONTHS[newQuarter][0],
                      });
                    }}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {Object.values(Quarter).map(q => (
                      <option key={q} value={q}>{q}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Month *
                  </label>
                  <select
                    value={formData.month}
                    onChange={(e) => setFormData({ ...formData, month: e.target.value as Month })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {QUARTER_MONTHS[formData.quarter].map(m => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Target Date and Priority */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Target Date
                  </label>
                  <input
                    type="date"
                    value={formData.target_date}
                    onChange={(e) => setFormData({ ...formData, target_date: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Priority
                  </label>
                  <select
                    value={formData.priority}
                    onChange={(e) => setFormData({ ...formData, priority: e.target.value as GoalPriority })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {Object.values(GoalPriority).map(p => (
                      <option key={p} value={p}>{priorityConfig[p].label}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Progress */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Progress: {formData.progress}%
                </label>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={formData.progress}
                  onChange={(e) => setFormData({ ...formData, progress: parseInt(e.target.value) })}
                  className="w-full"
                />
              </div>

              {/* Key Results */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm font-medium text-gray-700">
                    Key Results
                  </label>
                  <button
                    type="button"
                    onClick={addKeyResult}
                    className="text-sm text-blue-600 hover:text-blue-700"
                  >
                    + Add Key Result
                  </button>
                </div>
                <div className="space-y-2">
                  {formData.key_results?.map((kr) => (
                    <div key={kr.id} className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={kr.completed}
                        onChange={(e) => updateKeyResult(kr.id, 'completed', e.target.checked)}
                        className="w-4 h-4 rounded"
                      />
                      <input
                        type="text"
                        value={kr.title}
                        onChange={(e) => updateKeyResult(kr.id, 'title', e.target.value)}
                        placeholder="Key result title"
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                      <button
                        type="button"
                        onClick={() => removeKeyResult(kr.id)}
                        className="p-2 text-gray-500 hover:text-red-600"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-3 pt-4 border-t">
                <button
                  type="button"
                  onClick={() => {
                    setIsModalOpen(false);
                    resetForm();
                  }}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createMutation.isPending || updateMutation.isPending}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  {editingGoal ? 'Update Goal' : 'Create Goal'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Floating Action Button */}
      <button
        onClick={handleQuickAdd}
        className="fixed bottom-8 right-8 w-16 h-16 bg-blue-600 text-white rounded-full shadow-2xl hover:bg-blue-700 hover:scale-110 transition-all duration-200 flex items-center justify-center z-40 group"
        title="Quick Add Goal (Ctrl+G)"
      >
        <Plus className="w-8 h-8" />
        <span className="absolute -top-12 right-0 bg-gray-900 text-white text-xs px-3 py-2 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
          Quick Add Goal (Ctrl+G)
        </span>
      </button>
    </div>
  );
}

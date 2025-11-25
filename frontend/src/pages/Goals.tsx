import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import { goalApi } from '@/lib/api';
import type { Goal, GoalCreate, GoalUpdate, KeyResult } from '@/types';
import { Quarter, Month, GoalPriority } from '@/types';
import { ChevronDown, ChevronRight, Plus, Target, Trash2, Edit, Calendar, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import QuickAddGoalModal from '@/components/QuickAddGoalModal';
import ConfirmModal from '@/components/ConfirmModal';
import { toast } from 'sonner';

// Quarter to months mapping
const QUARTER_MONTHS: Record<Quarter, Month[]> = {
  [Quarter.Q1]: [Month.JANUARY, Month.FEBRUARY, Month.MARCH],
  [Quarter.Q2]: [Month.APRIL, Month.MAY, Month.JUNE],
  [Quarter.Q3]: [Month.JULY, Month.AUGUST, Month.SEPTEMBER],
  [Quarter.Q4]: [Month.OCTOBER, Month.NOVEMBER, Month.DECEMBER],
};

const priorityConfig = {
  [GoalPriority.HIGH]: {
    badge: 'bg-rose-50 dark:bg-rose-900/20 text-rose-600 dark:text-rose-400 border-rose-200 dark:border-rose-800',
    label: 'High'
  },
  [GoalPriority.MEDIUM]: {
    badge: 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-800',
    label: 'Medium'
  },
  [GoalPriority.LOW]: {
    badge: 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-700',
    label: 'Low'
  }
};

export default function Goals() {
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [expandedQuarters, setExpandedQuarters] = useState<Set<Quarter>>(new Set([Quarter.Q1]));
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isQuickAddOpen, setIsQuickAddOpen] = useState(false);
  const [editingGoal, setEditingGoal] = useState<Goal | null>(null);
  const [goalToDelete, setGoalToDelete] = useState<number | null>(null);

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
      toast.success('Goal created successfully');
    },
    onError: (error) => {
      console.error('Failed to create goal:', error);
      toast.error('Failed to create goal');
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
      toast.success('Goal updated successfully');
    },
    onError: (error) => {
      console.error('Failed to update goal:', error);
      toast.error('Failed to update goal');
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: goalApi.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['goals'] });
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
    
    // Clean data
    const dataToSubmit = {
      ...formData,
      target_date: formData.target_date || undefined,
      key_results: formData.key_results?.length ? formData.key_results : undefined,
    };

    if (editingGoal) {
      updateMutation.mutate({ id: editingGoal.id, data: dataToSubmit });
    } else {
      createMutation.mutate(dataToSubmit);
    }
  };

  const handleDelete = (id: number) => {
    setGoalToDelete(id);
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

  const updateKeyResult = (id: string, field: keyof KeyResult, value: string | boolean) => {
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

  // Quick add goal - opens natural language modal
  const handleQuickAdd = () => {
    setIsQuickAddOpen(true);
  };

  const handleQuickAddSuccess = (count: number) => {
    queryClient.invalidateQueries({ queryKey: ['goals'] });
    toast.success(`Created ${count} goal${count !== 1 ? 's' : ''} successfully!`);
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
  }, []);

  return (
    <div className="h-full flex flex-col bg-gray-50 dark:bg-gray-900 transition-colors duration-200 overflow-hidden">
      {/* Header */}
      <div className="bg-white/50 dark:bg-gray-800/50 backdrop-blur-sm border-b border-gray-200/60 dark:border-gray-700 px-8 py-6 sticky top-0 z-10 transition-colors duration-200">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900 dark:text-white tracking-tight">Goals</h1>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Track quarterly and monthly objectives</p>
          </div>

          {/* Year selector and Quick Add */}
          <div className="flex items-center gap-4">
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(parseInt(e.target.value))}
              className="px-4 py-2.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all duration-200 text-sm font-medium text-gray-900 dark:text-white"
            >
              {[currentYear - 1, currentYear, currentYear + 1].map(year => (
                <option key={year} value={year}>{year}</option>
              ))}
            </select>

            <button
              onClick={handleQuickAdd}
              className="flex items-center px-4 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700 transition-all duration-200 shadow-sm hover:shadow-md text-sm font-medium"
              title="Quick Add (Ctrl+G)"
            >
              <Target className="w-4 h-4 mr-2 text-blue-600 dark:text-blue-400" />
              Quick Add
            </button>

            <button
              onClick={() => {
                setEditingGoal(null);
                resetForm();
                setIsModalOpen(true);
              }}
              className="group flex items-center px-4 py-2 bg-blue-600 dark:bg-blue-500 text-white rounded-xl hover:bg-blue-700 dark:hover:bg-blue-600 transition-all duration-200 shadow-sm hover:shadow-md text-sm font-medium"
            >
              <Plus className="w-5 h-5 mr-2 transition-transform duration-200 group-hover:rotate-90" />
              New Goal
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-8">
      {isLoading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      ) : (
        <DragDropContext onDragEnd={handleDragEnd}>
          <div className="space-y-6 animate-in fade-in duration-500">
            {/* Quarters */}
            {Object.values(Quarter).map((quarter) => {
              const isExpanded = expandedQuarters.has(quarter);
              const quarterGoals = goals.filter(g => g.quarter === quarter);

              return (
                <div key={quarter} className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200/60 dark:border-gray-700 overflow-hidden transition-all duration-200">
                  {/* Quarter Header */}
                  <button
                    onClick={() => toggleQuarter(quarter)}
                    className="w-full flex items-center justify-between p-6 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      {isExpanded ? (
                        <ChevronDown className="w-5 h-5 text-gray-500 dark:text-gray-400" />
                      ) : (
                        <ChevronRight className="w-5 h-5 text-gray-500 dark:text-gray-400" />
                      )}
                      <div className="w-10 h-10 rounded-lg bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center text-blue-600 dark:text-blue-400">
                        <Target className="w-5 h-5" />
                      </div>
                      <div className="text-left">
                        <h2 className="text-lg font-bold text-gray-900 dark:text-white">{quarter}</h2>
                        <p className="text-sm text-gray-500 dark:text-gray-400">{quarterGoals.length} goals</p>
                      </div>
                    </div>
                  </button>

                  {/* Quarter Content - Months */}
                  {isExpanded && (
                    <div className="border-t border-gray-200/60 dark:border-gray-700 p-6 bg-gray-50/30 dark:bg-gray-900/30">
                      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                      {QUARTER_MONTHS[quarter].map((month) => {
                        const monthGoals = goals.filter(
                          g => g.quarter === quarter && g.month === month
                        );
                        const droppableId = `${quarter}-${month}`;

                        return (
                          <div key={month} className="flex flex-col h-full">
                            {/* Month Header */}
                            <div className="flex items-center justify-between mb-4 px-1">
                              <div className="flex items-center gap-2">
                                <Calendar className="w-4 h-4 text-gray-500 dark:text-gray-400" />
                                <h3 className="font-bold text-gray-900 dark:text-white">{month}</h3>
                                <span className="text-xs font-medium bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 px-2 py-0.5 rounded-full">
                                  {monthGoals.length}
                                </span>
                              </div>
                              <button
                                onClick={() => handleNewGoal(quarter, month)}
                                className="p-1 text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors"
                                title="Add Goal"
                              >
                                <Plus className="w-4 h-4" />
                              </button>
                            </div>

                            {/* Month Goals */}
                            <Droppable droppableId={droppableId}>
                              {(provided, snapshot) => (
                                <div
                                  ref={provided.innerRef}
                                  {...provided.droppableProps}
                                  className={cn(
                                    'flex-1 min-h-[150px] space-y-3 rounded-xl transition-colors',
                                    snapshot.isDraggingOver ? 'bg-blue-50/50 dark:bg-blue-900/20 ring-2 ring-blue-200 dark:ring-blue-800 ring-inset' : ''
                                  )}
                                >
                                  {monthGoals.length === 0 ? (
                                    <div className="flex flex-col items-center justify-center h-32 border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-xl text-center p-4">
                                      <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">No goals set</p>
                                      <button
                                        onClick={() => handleNewGoal(quarter, month)}
                                        className="text-xs font-medium text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:underline"
                                      >
                                        Add one now
                                      </button>
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
                                              'bg-white dark:bg-gray-800 p-4 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm group',
                                              'hover:shadow-md hover:border-gray-300 dark:hover:border-gray-600 transition-all duration-200',
                                              snapshot.isDragging && 'shadow-xl rotate-2 scale-105 z-50 ring-2 ring-blue-500 ring-opacity-50'
                                            )}
                                          >
                                            {/* Goal Header */}
                                            <div className="flex items-start justify-between mb-3">
                                              <h4 className="font-bold text-gray-900 dark:text-white text-sm leading-snug flex-1 pr-2">
                                                {goal.title}
                                              </h4>
                                              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <button
                                                  onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleEditGoal(goal);
                                                  }}
                                                  className="p-1.5 text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors"
                                                >
                                                  <Edit className="w-3.5 h-3.5" />
                                                </button>
                                                <button
                                                  onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleDelete(goal.id);
                                                  }}
                                                  className="p-1.5 text-gray-400 hover:text-rose-600 dark:text-gray-500 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded-md transition-colors"
                                                >
                                                  <Trash2 className="w-3.5 h-3.5" />
                                                </button>
                                              </div>
                                            </div>

                                            {goal.description && (
                                              <p className="text-xs text-gray-500 dark:text-gray-400 mb-4 line-clamp-2">{goal.description}</p>
                                            )}

                                            {/* Goal Details */}
                                            <div className="flex items-center gap-2 flex-wrap mb-3">
                                              {/* Priority */}
                                              <span className={cn(
                                                'text-[10px] font-bold px-2 py-0.5 rounded-full border uppercase tracking-wide',
                                                priorityConfig[goal.priority].badge
                                              )}>
                                                {priorityConfig[goal.priority].label}
                                              </span>

                                              {/* Target Date */}
                                              {goal.target_date && (
                                                <span className="text-[10px] font-medium text-gray-500 dark:text-gray-400 flex items-center gap-1 bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded-full border border-gray-200 dark:border-gray-600">
                                                  <Calendar className="w-3 h-3" />
                                                  {new Date(goal.target_date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                                                </span>
                                              )}
                                            </div>

                                            {/* Key Results */}
                                            {goal.key_results && goal.key_results.length > 0 && (
                                              <div className="pt-3 border-t border-gray-100 dark:border-gray-700 space-y-2">
                                                {goal.key_results.map((kr) => (
                                                  <div key={kr.id} className="flex items-start gap-2 text-xs group/kr">
                                                    <div className={cn(
                                                      "w-4 h-4 rounded border flex items-center justify-center mt-0.5 flex-shrink-0 transition-colors",
                                                      kr.completed ? "bg-emerald-50 border-emerald-200 text-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-400 dark:border-emerald-800" : "border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800"
                                                    )}>
                                                      {kr.completed && <CheckCircle2 className="w-3 h-3" />}
                                                    </div>
                                                    <span className={cn(
                                                      'text-gray-600 dark:text-gray-300 leading-tight transition-colors',
                                                      kr.completed && 'line-through text-gray-400 dark:text-gray-500'
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
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </DragDropContext>
      )}
      </div>

      {/* Goal Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                {editingGoal ? 'Edit Goal' : 'New Goal'}
              </h2>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-6">
              {/* Title */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Title *
                </label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className="w-full px-4 py-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-white"
                  required
                />
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Description
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows={3}
                  className="w-full px-4 py-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-white"
                />
              </div>

              {/* Quarter and Month */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
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
                    className="w-full px-4 py-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-white"
                  >
                    {Object.values(Quarter).map(q => (
                      <option key={q} value={q}>{q}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Month *
                  </label>
                  <select
                    value={formData.month}
                    onChange={(e) => setFormData({ ...formData, month: e.target.value as Month })}
                    className="w-full px-4 py-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-white"
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
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Target Date
                  </label>
                  <input
                    type="date"
                    value={formData.target_date}
                    onChange={(e) => setFormData({ ...formData, target_date: e.target.value })}
                    className="w-full px-4 py-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Priority
                  </label>
                  <select
                    value={formData.priority}
                    onChange={(e) => setFormData({ ...formData, priority: e.target.value as GoalPriority })}
                    className="w-full px-4 py-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-white"
                  >
                    {Object.values(GoalPriority).map(p => (
                      <option key={p} value={p}>{priorityConfig[p].label}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Progress */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Progress: {formData.progress}%
                </label>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={formData.progress}
                  onChange={(e) => setFormData({ ...formData, progress: parseInt(e.target.value) })}
                  className="w-full accent-blue-600 dark:accent-blue-500"
                />
              </div>

              {/* Key Results */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Key Results
                  </label>
                  <button
                    type="button"
                    onClick={addKeyResult}
                    className="text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
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
                        className="w-4 h-4 rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500"
                      />
                      <input
                        type="text"
                        value={kr.title}
                        onChange={(e) => updateKeyResult(kr.id, 'title', e.target.value)}
                        placeholder="Key result title"
                        className="flex-1 px-3 py-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-white"
                      />
                      <button
                        type="button"
                        onClick={() => removeKeyResult(kr.id)}
                        className="p-2 text-gray-400 hover:text-rose-600 dark:text-gray-500 dark:hover:text-rose-400"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
                <button
                  type="button"
                  onClick={() => {
                    setIsModalOpen(false);
                    resetForm();
                  }}
                  className="flex-1 px-4 py-2 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createMutation.isPending || updateMutation.isPending}
                  className="flex-1 px-4 py-2 bg-blue-600 dark:bg-blue-500 text-white rounded-lg hover:bg-blue-700 dark:hover:bg-blue-600 disabled:opacity-50 transition-colors"
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
        className="fixed bottom-8 right-8 w-16 h-16 bg-blue-600 dark:bg-blue-500 text-white rounded-full shadow-2xl hover:bg-blue-700 dark:hover:bg-blue-600 transition-all duration-200 flex items-center justify-center z-40 group"
        title="Quick Add Goal (Ctrl+G)"
      >
        <Plus className="w-8 h-8" />
        <span className="absolute -top-12 right-0 bg-gray-900 dark:bg-white text-white dark:text-gray-900 text-xs px-3 py-2 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap shadow-lg">
          Quick Add Goal (Ctrl+G)
        </span>
      </button>

      {/* Quick Add Modal */}
      <QuickAddGoalModal
        isOpen={isQuickAddOpen}
        onClose={() => setIsQuickAddOpen(false)}
        onSuccess={handleQuickAddSuccess}
      />

      <ConfirmModal
        isOpen={goalToDelete !== null}
        onClose={() => setGoalToDelete(null)}
        onConfirm={() => {
          if (goalToDelete !== null) {
            deleteMutation.mutate(goalToDelete);
          }
          setGoalToDelete(null);
        }}
        title="Delete Goal"
        message="Are you sure you want to delete this goal? This action cannot be undone."
        confirmText="Delete"
        variant="danger"
      />
    </div>
  );
}

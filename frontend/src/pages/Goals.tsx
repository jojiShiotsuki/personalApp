import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import { goalApi } from '@/lib/api';
import type { Goal, GoalCreate, GoalUpdate, KeyResult } from '@/types';
import { Quarter, Month, GoalPriority } from '@/types';
import { ChevronDown, ChevronRight, Plus, Target, Trash2, Edit, Calendar, CheckCircle2, Crosshair, X } from 'lucide-react';
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
    badge: 'bg-[--exec-danger-bg] text-[--exec-danger] border-[--exec-danger]/20',
    label: 'High'
  },
  [GoalPriority.MEDIUM]: {
    badge: 'bg-[--exec-info-bg] text-[--exec-info] border-[--exec-info]/20',
    label: 'Medium'
  },
  [GoalPriority.LOW]: {
    badge: 'bg-[--exec-surface-alt] text-[--exec-text-muted] border-[--exec-border]',
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
      toast.success('Goal deleted');
    },
    onError: () => {
      toast.error('Failed to delete goal. Please try again.');
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
    <div className="min-h-full bg-[--exec-bg] grain">
      {/* Hero Header */}
      <header className="relative overflow-hidden">
        {/* Gradient background */}
        <div className="absolute inset-0 bg-gradient-to-br from-[--exec-surface] via-[--exec-surface] to-[--exec-accent-bg-subtle]" />

        {/* Decorative elements */}
        <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-bl from-[--exec-accent]/5 to-transparent rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-1/3 w-64 h-64 bg-gradient-to-t from-[--exec-sage]/5 to-transparent rounded-full blur-2xl" />

        <div className="relative px-8 pt-8 pb-6">
          {/* Breadcrumb chip */}
          <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-[--exec-surface-alt] rounded-full mb-4 animate-fade-slide-up">
            <Crosshair className="w-3.5 h-3.5 text-[--exec-accent]" />
            <span className="text-xs font-medium text-[--exec-text-secondary]">Planning</span>
          </div>

          <div className="flex items-end justify-between">
            <div>
              <h1 className="text-4xl font-bold text-[--exec-text] tracking-tight animate-fade-slide-up delay-1" style={{ fontFamily: 'var(--font-display)' }}>
                Your <span className="text-[--exec-accent]">Goals</span>
              </h1>
              <p className="text-[--exec-text-secondary] mt-2 text-lg animate-fade-slide-up delay-2">
                Track quarterly and monthly objectives
              </p>
            </div>

            {/* Year selector and Quick Add */}
            <div className="flex items-center gap-3 animate-fade-slide-up delay-3">
              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(parseInt(e.target.value))}
                className="px-4 py-2.5 bg-[--exec-surface] border border-[--exec-border] rounded-xl focus:outline-none focus:ring-2 focus:ring-[--exec-accent]/20 focus:border-[--exec-accent] transition-all duration-200 text-sm font-medium text-[--exec-text] cursor-pointer"
              >
                {[currentYear - 1, currentYear, currentYear + 1].map(year => (
                  <option key={year} value={year}>{year}</option>
                ))}
              </select>

              <button
                onClick={handleQuickAdd}
                className="flex items-center px-4 py-2.5 bg-[--exec-surface] border border-[--exec-border] text-[--exec-text-secondary] rounded-xl hover:bg-[--exec-surface-alt] hover:border-[--exec-accent] hover:text-[--exec-accent] transition-all duration-200 text-sm font-medium"
                title="Quick Add (Ctrl+G)"
              >
                <Target className="w-4 h-4 mr-2 text-[--exec-accent]" />
                Quick Add
              </button>

              <button
                onClick={() => {
                  setEditingGoal(null);
                  resetForm();
                  setIsModalOpen(true);
                }}
                className="group flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-[--exec-accent] to-[--exec-accent-dark] text-white rounded-2xl hover:shadow-lg hover:shadow-[--exec-accent]/25 hover:-translate-y-0.5 transition-all duration-200 font-semibold"
              >
                <Plus className="w-5 h-5 transition-transform duration-200 group-hover:rotate-90" />
                New Goal
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Content */}
      <div className="px-8 py-6">
      {isLoading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[--exec-accent]"></div>
        </div>
      ) : (
        <DragDropContext onDragEnd={handleDragEnd}>
          <div className="space-y-6">
            {/* Quarters */}
            {Object.values(Quarter).map((quarter, qIdx) => {
              const isExpanded = expandedQuarters.has(quarter);
              const quarterGoals = goals.filter(g => g.quarter === quarter);

              return (
                <div
                  key={quarter}
                  className="bento-card-static overflow-hidden animate-fade-slide-up"
                  style={{ animationDelay: `${(qIdx + 4) * 50}ms` }}
                >
                  {/* Quarter Header */}
                  <button
                    onClick={() => toggleQuarter(quarter)}
                    className="w-full flex items-center justify-between p-6 hover:bg-[--exec-surface-alt] transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      {isExpanded ? (
                        <ChevronDown className="w-5 h-5 text-[--exec-text-muted]" />
                      ) : (
                        <ChevronRight className="w-5 h-5 text-[--exec-text-muted]" />
                      )}
                      <div className="w-10 h-10 rounded-xl bg-[--exec-accent-bg] flex items-center justify-center text-[--exec-accent]">
                        <Target className="w-5 h-5" />
                      </div>
                      <div className="text-left">
                        <h2 className="text-lg font-bold text-[--exec-text]" style={{ fontFamily: 'var(--font-display)' }}>{quarter}</h2>
                        <p className="text-sm text-[--exec-text-muted]">{quarterGoals.length} goals</p>
                      </div>
                    </div>
                    <span className="text-xs font-bold bg-[--exec-surface-alt] text-[--exec-text-secondary] px-3 py-1.5 rounded-full">
                      {quarterGoals.length} {quarterGoals.length === 1 ? 'goal' : 'goals'}
                    </span>
                  </button>

                  {/* Quarter Content - Months */}
                  {isExpanded && (
                    <div className="border-t border-[--exec-border-subtle] p-6 bg-[--exec-surface-alt]/30">
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
                                <Calendar className="w-4 h-4 text-[--exec-text-muted]" />
                                <h3 className="font-bold text-[--exec-text]">{month}</h3>
                                <span className="text-xs font-bold bg-[--exec-surface-alt] text-[--exec-text-muted] px-2 py-0.5 rounded-full">
                                  {monthGoals.length}
                                </span>
                              </div>
                              <button
                                onClick={() => handleNewGoal(quarter, month)}
                                className="p-1.5 text-[--exec-text-muted] hover:text-[--exec-accent] hover:bg-[--exec-accent-bg] rounded-lg transition-colors"
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
                                    snapshot.isDraggingOver ? 'bg-[--exec-accent-bg]/50 ring-2 ring-[--exec-accent]/30 ring-inset' : ''
                                  )}
                                >
                                  {monthGoals.length === 0 ? (
                                    <div className="flex flex-col items-center justify-center h-32 border-2 border-dashed border-[--exec-border] rounded-xl text-center p-4">
                                      <p className="text-sm text-[--exec-text-muted] mb-2">No goals set</p>
                                      <button
                                        onClick={() => handleNewGoal(quarter, month)}
                                        className="text-xs font-medium text-[--exec-text-muted] hover:text-[--exec-accent] hover:underline"
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
                                              'bg-[--exec-surface] p-4 rounded-xl border border-[--exec-border-subtle] group',
                                              'hover:shadow-md hover:border-[--exec-accent]/30 transition-all duration-200',
                                              snapshot.isDragging && 'shadow-xl rotate-2 scale-105 z-50 ring-2 ring-[--exec-accent] ring-opacity-50'
                                            )}
                                          >
                                            {/* Goal Header */}
                                            <div className="flex items-start justify-between mb-3">
                                              <h4 className="font-bold text-[--exec-text] text-sm leading-snug flex-1 pr-2">
                                                {goal.title}
                                              </h4>
                                              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <button
                                                  onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleEditGoal(goal);
                                                  }}
                                                  className="p-1.5 text-[--exec-text-muted] hover:text-[--exec-accent] hover:bg-[--exec-accent-bg] rounded-md transition-colors"
                                                >
                                                  <Edit className="w-3.5 h-3.5" />
                                                </button>
                                                <button
                                                  onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleDelete(goal.id);
                                                  }}
                                                  className="p-1.5 text-[--exec-text-muted] hover:text-[--exec-danger] hover:bg-[--exec-danger-bg] rounded-md transition-colors"
                                                >
                                                  <Trash2 className="w-3.5 h-3.5" />
                                                </button>
                                              </div>
                                            </div>

                                            {goal.description && (
                                              <p className="text-xs text-[--exec-text-muted] mb-4 line-clamp-2">{goal.description}</p>
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
                                                <span className="text-[10px] font-medium text-[--exec-text-muted] flex items-center gap-1 bg-[--exec-surface-alt] px-2 py-0.5 rounded-full border border-[--exec-border]">
                                                  <Calendar className="w-3 h-3" />
                                                  {new Date(goal.target_date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                                                </span>
                                              )}
                                            </div>

                                            {/* Key Results */}
                                            {goal.key_results && goal.key_results.length > 0 && (
                                              <div className="pt-3 border-t border-[--exec-border-subtle] space-y-2">
                                                {goal.key_results.map((kr) => (
                                                  <div key={kr.id} className="flex items-start gap-2 text-xs group/kr">
                                                    <div className={cn(
                                                      "w-4 h-4 rounded border flex items-center justify-center mt-0.5 flex-shrink-0 transition-colors",
                                                      kr.completed ? "bg-[--exec-success-bg] border-[--exec-success]/30 text-[--exec-success]" : "border-[--exec-border] bg-[--exec-surface]"
                                                    )}>
                                                      {kr.completed && <CheckCircle2 className="w-3 h-3" />}
                                                    </div>
                                                    <span className={cn(
                                                      'text-[--exec-text-secondary] leading-tight transition-colors',
                                                      kr.completed && 'line-through text-[--exec-text-muted]'
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
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-[--exec-surface] rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto border border-[--exec-border-subtle]">
            <div className="flex items-center justify-between p-6 border-b border-[--exec-border-subtle]">
              <h2 className="text-2xl font-bold text-[--exec-text]" style={{ fontFamily: 'var(--font-display)' }}>
                {editingGoal ? 'Edit Goal' : 'New Goal'}
              </h2>
              <button
                onClick={() => {
                  setIsModalOpen(false);
                  resetForm();
                }}
                className="p-2 text-[--exec-text-muted] hover:text-[--exec-text] hover:bg-[--exec-surface-alt] rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-6">
              {/* Title */}
              <div>
                <label className="block text-sm font-semibold text-[--exec-text] mb-2">
                  Title *
                </label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className="w-full px-4 py-3 bg-[--exec-surface-alt] border border-[--exec-border] rounded-xl focus:outline-none focus:ring-2 focus:ring-[--exec-accent]/20 focus:border-[--exec-accent] text-[--exec-text] transition-all duration-200"
                  required
                />
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-semibold text-[--exec-text] mb-2">
                  Description
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows={3}
                  className="w-full px-4 py-3 bg-[--exec-surface-alt] border border-[--exec-border] rounded-xl focus:outline-none focus:ring-2 focus:ring-[--exec-accent]/20 focus:border-[--exec-accent] text-[--exec-text] transition-all duration-200 resize-none"
                />
              </div>

              {/* Quarter and Month */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-[--exec-text] mb-2">
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
                    className="w-full px-4 py-3 bg-[--exec-surface-alt] border border-[--exec-border] rounded-xl focus:outline-none focus:ring-2 focus:ring-[--exec-accent]/20 focus:border-[--exec-accent] text-[--exec-text] transition-all duration-200 cursor-pointer"
                  >
                    {Object.values(Quarter).map(q => (
                      <option key={q} value={q}>{q}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-[--exec-text] mb-2">
                    Month *
                  </label>
                  <select
                    value={formData.month}
                    onChange={(e) => setFormData({ ...formData, month: e.target.value as Month })}
                    className="w-full px-4 py-3 bg-[--exec-surface-alt] border border-[--exec-border] rounded-xl focus:outline-none focus:ring-2 focus:ring-[--exec-accent]/20 focus:border-[--exec-accent] text-[--exec-text] transition-all duration-200 cursor-pointer"
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
                  <label className="block text-sm font-semibold text-[--exec-text] mb-2">
                    Target Date
                  </label>
                  <input
                    type="date"
                    value={formData.target_date}
                    onChange={(e) => setFormData({ ...formData, target_date: e.target.value })}
                    className="w-full px-4 py-3 bg-[--exec-surface-alt] border border-[--exec-border] rounded-xl focus:outline-none focus:ring-2 focus:ring-[--exec-accent]/20 focus:border-[--exec-accent] text-[--exec-text] transition-all duration-200"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-[--exec-text] mb-2">
                    Priority
                  </label>
                  <select
                    value={formData.priority}
                    onChange={(e) => setFormData({ ...formData, priority: e.target.value as GoalPriority })}
                    className="w-full px-4 py-3 bg-[--exec-surface-alt] border border-[--exec-border] rounded-xl focus:outline-none focus:ring-2 focus:ring-[--exec-accent]/20 focus:border-[--exec-accent] text-[--exec-text] transition-all duration-200 cursor-pointer"
                  >
                    {Object.values(GoalPriority).map(p => (
                      <option key={p} value={p}>{priorityConfig[p].label}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Progress */}
              <div>
                <div className="flex justify-between items-center mb-2">
                  <label className="block text-sm font-semibold text-[--exec-text]">
                    Progress
                  </label>
                  <span className="text-sm font-bold text-[--exec-accent]" style={{ fontFamily: 'var(--font-display)' }}>{formData.progress}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={formData.progress}
                  onChange={(e) => setFormData({ ...formData, progress: parseInt(e.target.value) })}
                  className="w-full accent-[--exec-accent]"
                />
              </div>

              {/* Key Results */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <label className="block text-sm font-semibold text-[--exec-text]">
                    Key Results
                  </label>
                  <button
                    type="button"
                    onClick={addKeyResult}
                    className="text-sm font-medium text-[--exec-accent] hover:text-[--exec-accent-dark]"
                  >
                    + Add Key Result
                  </button>
                </div>
                <div className="space-y-3">
                  {formData.key_results?.map((kr) => (
                    <div key={kr.id} className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        checked={kr.completed}
                        onChange={(e) => updateKeyResult(kr.id, 'completed', e.target.checked)}
                        className="w-5 h-5 rounded border-[--exec-border] text-[--exec-accent] focus:ring-[--exec-accent]/20"
                      />
                      <input
                        type="text"
                        value={kr.title}
                        onChange={(e) => updateKeyResult(kr.id, 'title', e.target.value)}
                        placeholder="Key result title"
                        className="flex-1 px-4 py-2.5 bg-[--exec-surface-alt] border border-[--exec-border] rounded-xl focus:outline-none focus:ring-2 focus:ring-[--exec-accent]/20 focus:border-[--exec-accent] text-[--exec-text] transition-all duration-200"
                      />
                      <button
                        type="button"
                        onClick={() => removeKeyResult(kr.id)}
                        className="p-2 text-[--exec-text-muted] hover:text-[--exec-danger] hover:bg-[--exec-danger-bg] rounded-lg transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-3 pt-4 border-t border-[--exec-border-subtle]">
                <button
                  type="button"
                  onClick={() => {
                    setIsModalOpen(false);
                    resetForm();
                  }}
                  className="flex-1 px-4 py-3 border border-[--exec-border] text-[--exec-text-secondary] rounded-xl hover:bg-[--exec-surface-alt] transition-all duration-200 font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createMutation.isPending || updateMutation.isPending}
                  className="flex-1 px-4 py-3 bg-gradient-to-r from-[--exec-accent] to-[--exec-accent-dark] text-white rounded-xl hover:shadow-lg hover:shadow-[--exec-accent]/25 disabled:opacity-50 transition-all duration-200 font-semibold"
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
        className="fixed bottom-8 right-8 w-16 h-16 bg-gradient-to-r from-[--exec-accent] to-[--exec-accent-dark] text-white rounded-full shadow-2xl hover:shadow-[--exec-accent]/40 hover:-translate-y-1 transition-all duration-200 flex items-center justify-center z-40 group"
        title="Quick Add Goal (Ctrl+G)"
      >
        <Plus className="w-8 h-8 group-hover:rotate-90 transition-transform duration-200" />
        <span className="absolute -top-12 right-0 bg-[--exec-surface] text-[--exec-text] text-xs px-3 py-2 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap shadow-lg border border-[--exec-border-subtle]">
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

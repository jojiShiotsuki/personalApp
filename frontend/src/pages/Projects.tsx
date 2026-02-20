import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Search, Folder, Briefcase, FileText, LayoutGrid, Kanban, Tag } from 'lucide-react';
import { projectApi } from '@/lib/api';
import { ProjectCreate } from '@/types';
import ProjectCard from '@/components/ProjectCard';
import ProjectModal from '@/components/ProjectModal';
import ManageTemplatesModal from '@/components/ManageTemplatesModal';
import ProjectDeliveryBoard from '@/components/ProjectDeliveryBoard';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

const SERVICE_FILTERS = [
  { value: 'wordpress', label: 'WordPress' },
  { value: 'ghl', label: 'GHL' },
  { value: 'graphic_design', label: 'Design' },
  { value: 'seo', label: 'SEO' },
];

export default function Projects() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isTemplatesOpen, setIsTemplatesOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [serviceFilter, setServiceFilter] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'grid' | 'board'>('board');
  const queryClient = useQueryClient();

  // Fetch projects
  const { data: projects = [], isLoading, isError } = useQuery({
    queryKey: ['projects'],
    queryFn: projectApi.getAll,
  });

  // Create mutation
  const createMutation = useMutation({
    mutationFn: projectApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      setIsModalOpen(false);
      toast.success('Project created successfully');
    },
    onError: () => {
      toast.error('Failed to create project');
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: projectApi.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      toast.success('Project deleted');
    },
    onError: () => {
      toast.error('Failed to delete project');
    },
  });

  const handleCreate = (data: ProjectCreate) => {
    createMutation.mutate(data);
  };

  const handleDelete = (id: number) => {
    deleteMutation.mutate(id);
  };

  // Filter projects by search query and service type
  const filteredProjects = projects.filter((project) => {
    const matchesSearch =
      project.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      project.description?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesService = !serviceFilter || project.service_type === serviceFilter;
    return matchesSearch && matchesService;
  });

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
            <Briefcase className="w-3.5 h-3.5 text-[--exec-accent]" />
            <span className="text-xs font-medium text-[--exec-text-secondary]">Studio</span>
          </div>

          <div className="flex items-end justify-between">
            <div>
              <h1 className="text-4xl font-bold text-[--exec-text] tracking-tight animate-fade-slide-up delay-1" style={{ fontFamily: 'var(--font-display)' }}>
                Your <span className="text-[--exec-accent]">Projects</span>
              </h1>
              <p className="text-[--exec-text-secondary] mt-2 text-lg animate-fade-slide-up delay-2">
                Manage and track your projects
              </p>
            </div>

            <div className="flex items-center gap-3 animate-fade-slide-up delay-3">
              {/* View toggle */}
              <div className="flex items-center bg-[--exec-surface-alt] border border-[--exec-border] rounded-xl p-1">
                <button
                  onClick={() => setViewMode('grid')}
                  className={cn(
                    'p-2 rounded-lg transition-all duration-200',
                    viewMode === 'grid'
                      ? 'bg-[--exec-surface] text-[--exec-text] shadow-sm'
                      : 'text-[--exec-text-muted] hover:text-[--exec-text]'
                  )}
                  title="Grid view"
                >
                  <LayoutGrid className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setViewMode('board')}
                  className={cn(
                    'p-2 rounded-lg transition-all duration-200',
                    viewMode === 'board'
                      ? 'bg-[--exec-surface] text-[--exec-text] shadow-sm'
                      : 'text-[--exec-text-muted] hover:text-[--exec-text]'
                  )}
                  title="Board view"
                >
                  <Kanban className="w-4 h-4" />
                </button>
              </div>
              <button
                onClick={() => setIsTemplatesOpen(true)}
                className="flex items-center gap-2 px-4 py-2.5 bg-[--exec-surface-alt] border border-[--exec-border] text-[--exec-text-secondary] rounded-2xl hover:bg-[--exec-surface] hover:text-[--exec-text] hover:border-[--exec-accent]/30 transition-all duration-200 font-medium text-sm"
              >
                <FileText className="w-4 h-4" />
                Templates
              </button>
              <button
                onClick={() => setIsModalOpen(true)}
                className="group flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-[--exec-accent] to-[--exec-accent-dark] text-white rounded-2xl hover:shadow-lg hover:shadow-[--exec-accent]/25 hover:-translate-y-0.5 transition-all duration-200 font-semibold"
              >
                <Plus className="w-5 h-5 transition-transform duration-200 group-hover:rotate-90" />
                New Project
              </button>
            </div>
          </div>

          {/* Search Bar + Service Filters */}
          <div className="mt-6 flex items-center gap-4 animate-fade-slide-up delay-4">
            <div className="relative max-w-md flex-1">
              <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-[--exec-text-muted] w-5 h-5" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search projects..."
                aria-label="Search projects"
                className="w-full pl-12 pr-4 py-3 bg-[--exec-surface] border border-[--exec-border] rounded-2xl focus:outline-none focus:ring-2 focus:ring-[--exec-accent]/20 focus:border-[--exec-accent] transition-all duration-200 text-[--exec-text] placeholder:text-[--exec-text-muted]"
              />
            </div>
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setServiceFilter(null)}
                className={cn(
                  'px-3 py-1.5 text-xs font-medium rounded-lg transition-all duration-200',
                  !serviceFilter
                    ? 'bg-[--exec-accent]/15 text-[--exec-accent] border border-[--exec-accent]/30'
                    : 'text-[--exec-text-muted] hover:text-[--exec-text] hover:bg-[--exec-surface-alt]'
                )}
              >
                All
              </button>
              {SERVICE_FILTERS.map(sf => (
                <button
                  key={sf.value}
                  onClick={() => setServiceFilter(serviceFilter === sf.value ? null : sf.value)}
                  className={cn(
                    'px-3 py-1.5 text-xs font-medium rounded-lg transition-all duration-200',
                    serviceFilter === sf.value
                      ? 'bg-[--exec-accent]/15 text-[--exec-accent] border border-[--exec-accent]/30'
                      : 'text-[--exec-text-muted] hover:text-[--exec-text] hover:bg-[--exec-surface-alt]'
                  )}
                >
                  {sf.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </header>

      {/* Projects Grid */}
      <div className="px-8 py-6">
        {isLoading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[--exec-accent]"></div>
          </div>
        ) : isError ? (
          <div className="bento-card-static p-12 text-center">
            <p className="text-[--exec-danger] mb-4">Failed to load projects</p>
            <button
              onClick={() => window.location.reload()}
              className="text-[--exec-text-muted] hover:text-[--exec-accent] underline"
            >
              Try again
            </button>
          </div>
        ) : viewMode === 'board' ? (
          <div style={{ height: 'calc(100vh - 280px)' }}>
            <ProjectDeliveryBoard projects={filteredProjects} />
          </div>
        ) : filteredProjects.length === 0 ? (
          <div className="bento-card-static p-16 text-center animate-fade-slide-up delay-5">
            <div className="w-20 h-20 bg-[--exec-surface-alt] rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Folder className="w-10 h-10 text-[--exec-text-muted]" />
            </div>
            <h3 className="text-xl font-bold text-[--exec-text] mb-2" style={{ fontFamily: 'var(--font-display)' }}>
              {searchQuery ? 'No projects found' : 'No projects yet'}
            </h3>
            <p className="text-[--exec-text-muted] max-w-sm mx-auto mb-6">
              {searchQuery ? `No projects match "${searchQuery}"` : "Create your first project to start tracking your work."}
            </p>
            {!searchQuery && (
              <button
                onClick={() => setIsModalOpen(true)}
                className="px-5 py-2.5 bg-gradient-to-r from-[--exec-accent] to-[--exec-accent-dark] text-white rounded-xl hover:shadow-lg hover:shadow-[--exec-accent]/25 transition-all duration-200 font-semibold"
              >
                Create Project
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
            {filteredProjects.map((project, idx) => (
              <div key={project.id} className="animate-fade-slide-up" style={{ animationDelay: `${(idx + 5) * 50}ms` }}>
                <ProjectCard project={project} onDelete={handleDelete} />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Create Modal */}
      <ProjectModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSubmit={handleCreate}
      />

      {/* Manage Templates Modal */}
      <ManageTemplatesModal
        isOpen={isTemplatesOpen}
        onClose={() => setIsTemplatesOpen(false)}
      />
    </div>
  );
}

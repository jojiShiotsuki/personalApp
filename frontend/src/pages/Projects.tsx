import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Search } from 'lucide-react';
import { projectApi } from '@/lib/api';
import { ProjectCreate } from '@/types';
import ProjectCard from '@/components/ProjectCard';
import ProjectModal from '@/components/ProjectModal';
import { toast } from 'sonner';

export default function Projects() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
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

  const handleCreate = (data: ProjectCreate) => {
    createMutation.mutate(data);
  };

  // Filter projects by search query
  const filteredProjects = projects.filter(
    (project) =>
      project.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      project.description?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-8 py-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Projects</h1>
            <p className="mt-1 text-sm text-gray-500">
              Manage your projects and track progress
            </p>
          </div>
          <button
            onClick={() => setIsModalOpen(true)}
            className="group flex items-center px-4 py-2 bg-slate-600 text-white rounded-lg hover:bg-slate-700 transition-all duration-200 shadow-sm hover:shadow"
          >
            <Plus className="w-5 h-5 mr-2 transition-transform duration-200 group-hover:rotate-90" />
            New Project
          </button>
        </div>
      </div>

      {/* Search Bar */}
      <div className="bg-white border-b border-gray-200 px-8 py-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search projects..."
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-500"
          />
        </div>
      </div>

      {/* Projects Grid */}
      <div className="flex-1 overflow-auto px-8 py-6">
      {isLoading ? (
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-slate-600 mb-4"></div>
          <p className="text-gray-500">Loading projects...</p>
        </div>
      ) : isError ? (
        <div className="text-center py-12">
          <p className="text-red-500 mb-4">Failed to load projects</p>
          <button
            onClick={() => window.location.reload()}
            className="text-slate-600 hover:text-slate-700"
          >
            Try again
          </button>
        </div>
      ) : filteredProjects.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-gray-500 mb-4">
            {searchQuery ? 'No projects found' : 'No projects yet'}
          </p>
          {!searchQuery && (
            <button
              onClick={() => setIsModalOpen(true)}
              className="text-slate-600 hover:text-slate-700"
            >
              Create your first project
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredProjects.map((project) => (
            <ProjectCard key={project.id} project={project} />
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
    </div>
  );
}

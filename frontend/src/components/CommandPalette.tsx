import { useState, useMemo } from 'react';
import { Command } from 'cmdk';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { contactApi, taskApi, dealApi, projectApi } from '@/lib/api';
import {
  LayoutDashboard,
  CheckSquare,
  Users,
  DollarSign,
  Folder,
  Download,
  Calendar,
  Plus,
  Search,
  User,
} from 'lucide-react';

interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onQuickAdd: () => void;
}

export default function CommandPalette({ open, onOpenChange, onQuickAdd }: CommandPaletteProps) {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');

  const shouldSearch = search.trim().length >= 2;
  const searchTerm = search.trim().toLowerCase();

  const { data: contacts = [] } = useQuery({
    queryKey: ['search-contacts', searchTerm],
    queryFn: () => contactApi.getAll(searchTerm),
    enabled: open && shouldSearch,
    staleTime: 30000,
  });

  const { data: tasks = [] } = useQuery({
    queryKey: ['search-tasks'],
    queryFn: () => taskApi.getAll(),
    enabled: open && shouldSearch,
    staleTime: 30000,
  });

  const { data: deals = [] } = useQuery({
    queryKey: ['search-deals'],
    queryFn: () => dealApi.getAll(),
    enabled: open && shouldSearch,
    staleTime: 30000,
  });

  const { data: projects = [] } = useQuery({
    queryKey: ['search-projects'],
    queryFn: () => projectApi.getAll(),
    enabled: open && shouldSearch,
    staleTime: 30000,
  });

  const filteredTasks = useMemo(() => {
    if (!shouldSearch) return [];
    return tasks.filter(t => t.title.toLowerCase().includes(searchTerm)).slice(0, 5);
  }, [tasks, searchTerm, shouldSearch]);

  const filteredDeals = useMemo(() => {
    if (!shouldSearch) return [];
    return deals.filter(d => d.title.toLowerCase().includes(searchTerm)).slice(0, 5);
  }, [deals, searchTerm, shouldSearch]);

  const filteredProjects = useMemo(() => {
    if (!shouldSearch) return [];
    return projects.filter(p => p.name.toLowerCase().includes(searchTerm)).slice(0, 5);
  }, [projects, searchTerm, shouldSearch]);

  const filteredContacts = useMemo(() => {
    if (!shouldSearch) return [];
    return contacts.slice(0, 5);
  }, [contacts, shouldSearch]);

  const hasResults = filteredContacts.length > 0 || filteredTasks.length > 0 || filteredDeals.length > 0 || filteredProjects.length > 0;

  const runCommand = (command: () => void) => {
    command();
    setTimeout(() => {
      onOpenChange(false);
      setSearch('');
    }, 50);
  };

  return (
    <Command.Dialog
      open={open}
      onOpenChange={(v) => {
        onOpenChange(v);
        if (!v) setSearch('');
      }}
      label="Global Command Menu"
      onClick={(e) => {
        if (e.target === e.currentTarget) onOpenChange(false);
      }}
    >
      <div className="flex items-center border-b border-gray-200 px-3" cmdk-input-wrapper="">
        <Search className="w-5 h-5 text-gray-400 mr-2" />
        <Command.Input
          value={search}
          onValueChange={setSearch}
          placeholder="Search contacts, tasks, deals, or navigate..."
        />
      </div>

      <Command.List>
        <Command.Empty>No results found.</Command.Empty>

        {shouldSearch && hasResults && (
          <>
            {filteredContacts.length > 0 && (
              <Command.Group heading="Contacts">
                {filteredContacts.map(contact => (
                  <Command.Item
                    key={`contact-${contact.id}`}
                    value={`contact ${contact.name} ${contact.email || ''} ${contact.company || ''}`}
                    onSelect={() => runCommand(() => navigate('/contacts'))}
                  >
                    <User className="w-4 h-4 mr-2 text-blue-400" />
                    <div className="flex flex-col">
                      <span>{contact.name}</span>
                      {contact.company && (
                        <span className="text-xs text-gray-400">{contact.company}</span>
                      )}
                    </div>
                  </Command.Item>
                ))}
              </Command.Group>
            )}

            {filteredTasks.length > 0 && (
              <Command.Group heading="Tasks">
                {filteredTasks.map(task => (
                  <Command.Item
                    key={`task-${task.id}`}
                    value={`task ${task.title}`}
                    onSelect={() => runCommand(() => navigate('/tasks'))}
                  >
                    <CheckSquare className="w-4 h-4 mr-2 text-green-400" />
                    <div className="flex flex-col">
                      <span>{task.title}</span>
                      {task.due_date && (
                        <span className="text-xs text-gray-400">Due: {task.due_date}</span>
                      )}
                    </div>
                  </Command.Item>
                ))}
              </Command.Group>
            )}

            {filteredDeals.length > 0 && (
              <Command.Group heading="Deals">
                {filteredDeals.map(deal => (
                  <Command.Item
                    key={`deal-${deal.id}`}
                    value={`deal ${deal.title}`}
                    onSelect={() => runCommand(() => navigate('/deals'))}
                  >
                    <DollarSign className="w-4 h-4 mr-2 text-amber-400" />
                    <div className="flex flex-col">
                      <span>{deal.title}</span>
                      <span className="text-xs text-gray-400">{deal.stage}{deal.value ? ` — $${deal.value.toLocaleString()}` : ''}</span>
                    </div>
                  </Command.Item>
                ))}
              </Command.Group>
            )}

            {filteredProjects.length > 0 && (
              <Command.Group heading="Projects">
                {filteredProjects.map(project => (
                  <Command.Item
                    key={`project-${project.id}`}
                    value={`project ${project.name}`}
                    onSelect={() => runCommand(() => navigate(`/projects/${project.id}`))}
                  >
                    <Folder className="w-4 h-4 mr-2 text-purple-400" />
                    <span>{project.name}</span>
                  </Command.Item>
                ))}
              </Command.Group>
            )}
          </>
        )}

        <Command.Group heading="Actions">
          <Command.Item value="quick add task create new" onSelect={() => runCommand(onQuickAdd)}>
            <Plus className="w-4 h-4 mr-2" />
            Quick Add Task
          </Command.Item>
        </Command.Group>

        <Command.Group heading="Navigation">
          <Command.Item value="dashboard home" onSelect={() => runCommand(() => navigate('/'))}>
            <LayoutDashboard className="w-4 h-4 mr-2" />
            Dashboard
          </Command.Item>
          <Command.Item value="tasks todo list" onSelect={() => runCommand(() => navigate('/tasks'))}>
            <CheckSquare className="w-4 h-4 mr-2" />
            Tasks
          </Command.Item>
          <Command.Item value="social calendar content media" onSelect={() => runCommand(() => navigate('/social-calendar'))}>
            <Calendar className="w-4 h-4 mr-2" />
            Social Calendar
          </Command.Item>
          <Command.Item value="projects folders" onSelect={() => runCommand(() => navigate('/projects'))}>
            <Folder className="w-4 h-4 mr-2" />
            Projects
          </Command.Item>
          <Command.Item value="deals crm sales pipeline" onSelect={() => runCommand(() => navigate('/deals'))}>
            <DollarSign className="w-4 h-4 mr-2" />
            Deals
          </Command.Item>
          <Command.Item value="contacts people crm" onSelect={() => runCommand(() => navigate('/contacts'))}>
            <Users className="w-4 h-4 mr-2" />
            Contacts
          </Command.Item>
          <Command.Item value="export data backup" onSelect={() => runCommand(() => navigate('/export'))}>
            <Download className="w-4 h-4 mr-2" />
            Export Data
          </Command.Item>
        </Command.Group>
      </Command.List>

      <div className="border-t border-gray-200 p-2 text-xs text-gray-400 flex justify-between items-center">
        <span>Use arrow keys to navigate</span>
        <div className="flex gap-1">
          <kbd className="bg-gray-100 border border-gray-300 rounded px-1">esc</kbd> to close
        </div>
      </div>
    </Command.Dialog>
  );
}

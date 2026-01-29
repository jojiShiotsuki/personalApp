import { useState } from 'react';
import { Command } from 'cmdk';
import { useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  CheckSquare,
  Users,
  DollarSign,
  Target,
  Folder,
  Download,
  Calendar,
  Plus,
  Search,
} from 'lucide-react';

interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onQuickAdd: () => void;
}

export default function CommandPalette({ open, onOpenChange, onQuickAdd }: CommandPaletteProps) {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');

  // Toggle with Ctrl+K is handled in App.tsx, but we can also close with Esc here automatically by Dialog

  const runCommand = (command: () => void) => {
    command();
    // Small delay to ensure state updates before closing
    setTimeout(() => onOpenChange(false), 50);
  };

  return (
    <Command.Dialog
      open={open}
      onOpenChange={onOpenChange}
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
          placeholder="Type a command or search..." 
        />
      </div>
      
      <Command.List>
        <Command.Empty>No results found.</Command.Empty>

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
          <Command.Item value="goals targets okr" onSelect={() => runCommand(() => navigate('/goals'))}>
            <Target className="w-4 h-4 mr-2" />
            Goals
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

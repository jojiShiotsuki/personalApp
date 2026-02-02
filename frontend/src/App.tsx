import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Tasks from './pages/Tasks';
import Contacts from './pages/Contacts';
import Deals from './pages/Deals';
import Goals from './pages/Goals';
import Projects from './pages/Projects';
import ProjectDetail from './pages/ProjectDetail';
import Export from './pages/Export';
import SocialCalendar from './pages/SocialCalendar';
import Time from './pages/Time';
import Outreach from './pages/Outreach';
import ColdOutreach from './pages/ColdOutreach';
import Services from './pages/Services';
import Settings from './pages/Settings';
import QuickAddModal from './components/QuickAddModal';
import CommandPalette from './components/CommandPalette';
import { ThemeProvider } from './components/ThemeProvider';
import { TimerProvider } from './contexts/TimerContext';

function App() {
  const [isQuickAddOpen, setIsQuickAddOpen] = useState(false);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const queryClient = useQueryClient();

  // Global Ctrl+K / Cmd+K keyboard listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setIsCommandPaletteOpen((prev) => !prev);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleQuickAddSuccess = (count: number) => {
    queryClient.invalidateQueries({ queryKey: ['tasks'] });
    toast.success(`Created ${count} task${count !== 1 ? 's' : ''} successfully!`);
  };

  return (
    <ThemeProvider>
      <BrowserRouter>
        <TimerProvider>
            <Layout>
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/tasks" element={<Tasks />} />
              <Route path="/contacts" element={<Contacts />} />
              <Route path="/deals" element={<Deals />} />
              <Route path="/goals" element={<Goals />} />
              <Route path="/projects" element={<Projects />} />
              <Route path="/projects/:id" element={<ProjectDetail />} />
              <Route path="/export" element={<Export />} />
              <Route path="/social-calendar" element={<SocialCalendar />} />
              <Route path="/time" element={<Time />} />
              <Route path="/outreach" element={<Outreach />} />
              <Route path="/cold-outreach" element={<ColdOutreach />} />
              <Route path="/settings" element={<Settings />} />
              <Route path="/services" element={<Services />} />
            </Routes>
          </Layout>
          <CommandPalette
            open={isCommandPaletteOpen}
            onOpenChange={setIsCommandPaletteOpen}
            onQuickAdd={() => setIsQuickAddOpen(true)}
          />
          <QuickAddModal
            isOpen={isQuickAddOpen}
            onClose={() => setIsQuickAddOpen(false)}
            onSuccess={handleQuickAddSuccess}
          />
        </TimerProvider>
      </BrowserRouter>
    </ThemeProvider>
  );
}

export default App;

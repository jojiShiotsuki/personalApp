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
import Export from './pages/Export';
import QuickAddModal from './components/QuickAddModal';

function App() {
  const [isQuickAddOpen, setIsQuickAddOpen] = useState(false);
  const queryClient = useQueryClient();

  // Global Ctrl+K / Cmd+K keyboard listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setIsQuickAddOpen(true);
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
    <BrowserRouter>
      <Layout>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/tasks" element={<Tasks />} />
          <Route path="/contacts" element={<Contacts />} />
          <Route path="/deals" element={<Deals />} />
          <Route path="/goals" element={<Goals />} />
          <Route path="/projects" element={<Projects />} />
          <Route path="/export" element={<Export />} />
        </Routes>
      </Layout>
      <QuickAddModal
        isOpen={isQuickAddOpen}
        onClose={() => setIsQuickAddOpen(false)}
        onSuccess={handleQuickAddSuccess}
      />
    </BrowserRouter>
  );
}

export default App;

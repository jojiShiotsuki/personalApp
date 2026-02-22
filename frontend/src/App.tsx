import { useState, useEffect, lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import Layout from './components/Layout';
import Login from './pages/Login';

// Lazy-loaded pages
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Tasks = lazy(() => import('./pages/Tasks'));
const Contacts = lazy(() => import('./pages/Contacts'));
const Deals = lazy(() => import('./pages/Deals'));
const Goals = lazy(() => import('./pages/Goals'));
const Projects = lazy(() => import('./pages/Projects'));
const ProjectDetail = lazy(() => import('./pages/ProjectDetail'));
const Export = lazy(() => import('./pages/Export'));
const SocialCalendar = lazy(() => import('./pages/SocialCalendar'));
const Time = lazy(() => import('./pages/Time'));
const OutreachHub = lazy(() => import('./pages/OutreachHub'));
const Services = lazy(() => import('./pages/Services'));
const Settings = lazy(() => import('./pages/Settings'));
const Sprint = lazy(() => import('./pages/Sprint'));
import QuickAddModal from './components/QuickAddModal';
import CommandPalette from './components/CommandPalette';
import ShortcutsModal from './components/ShortcutsModal';
import { ThemeProvider } from './components/ThemeProvider';
import { TimerProvider } from './contexts/TimerContext';
import { AuthProvider, useAuth } from './contexts/AuthContext';

const NAV_SHORTCUTS: Record<string, string> = {
  '1': '/',
  '2': '/tasks',
  '3': '/sprint',
  '4': '/contacts',
  '5': '/deals',
  '6': '/projects',
  '7': '/goals',
  '8': '/time',
  '9': '/settings',
};

function AuthenticatedApp() {
  const [isQuickAddOpen, setIsQuickAddOpen] = useState(false);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  // Global keyboard shortcuts listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const isInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable;

      // Ctrl+K — command palette
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setIsCommandPaletteOpen((prev) => !prev);
        return;
      }

      // Ctrl+N — quick add task
      if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
        e.preventDefault();
        setIsQuickAddOpen(true);
        return;
      }

      // Skip remaining shortcuts if focused on an input
      if (isInput) return;

      // ? — show shortcuts
      if (e.key === '?' && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        setShowShortcuts((prev) => !prev);
        return;
      }

      // / — focus search (open command palette)
      if (e.key === '/' && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        setIsCommandPaletteOpen(true);
        return;
      }

      // Alt+1 through Alt+9 — navigate
      if (e.altKey && NAV_SHORTCUTS[e.key]) {
        e.preventDefault();
        navigate(NAV_SHORTCUTS[e.key]);
        return;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [navigate]);

  const handleQuickAddSuccess = (count: number) => {
    queryClient.invalidateQueries({ queryKey: ['tasks'] });
    toast.success(`Created ${count} task${count !== 1 ? 's' : ''} successfully!`);
  };

  return (
    <TimerProvider>
      <Layout>
        <Suspense fallback={<div className="min-h-screen bg-[--exec-bg] flex items-center justify-center"><div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-[--exec-accent]" /></div>}>
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
          <Route path="/outreach" element={<OutreachHub />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/services" element={<Services />} />
          <Route path="/sprint" element={<Sprint />} />
          <Route path="/login" element={<Navigate to="/" replace />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        </Suspense>
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
      <ShortcutsModal
        open={showShortcuts}
        onClose={() => setShowShortcuts(false)}
      />
    </TimerProvider>
  );
}

function AppRoutes() {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[--exec-bg] flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-[--exec-accent] mb-4" />
          <p className="text-[--exec-text-muted] text-sm">Loading...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    );
  }

  return <AuthenticatedApp />;
}

function App() {
  return (
    <ThemeProvider>
      <BrowserRouter>
        <AuthProvider>
          <AppRoutes />
        </AuthProvider>
      </BrowserRouter>
    </ThemeProvider>
  );
}

export default App;

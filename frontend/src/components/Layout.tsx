import { ReactNode, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  CheckSquare,
  Users,
  Briefcase,
  Target,
  Download,
  Folder,
  Calendar,
  Clock,
  Send,
  RefreshCw,
  Settings,
  ChevronLeft,
  ChevronRight,
  ArrowUpRight,
  Sun,
  Moon,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTheme } from './ThemeProvider';

import FloatingTimer from './FloatingTimer';

interface LayoutProps {
  children: ReactNode;
}

const navigationGroups = [
  {
    label: 'Command',
    items: [
      { name: 'Dashboard', href: '/', icon: LayoutDashboard, accent: true },
      { name: 'Tasks', href: '/tasks', icon: CheckSquare },
    ],
  },
  {
    label: 'Clients',
    items: [
      { name: 'Contacts', href: '/contacts', icon: Users },
      { name: 'Deals', href: '/deals', icon: Briefcase },
      { name: 'Services', href: '/services', icon: RefreshCw },
      { name: 'Outreach', href: '/outreach', icon: Send },
    ],
  },
  {
    label: 'Studio',
    items: [
      { name: 'Projects', href: '/projects', icon: Folder },
      { name: 'Goals', href: '/goals', icon: Target },
      { name: 'Time', href: '/time', icon: Clock },
      { name: 'Content', href: '/social-calendar', icon: Calendar },
    ],
  },
];

const bottomNav = [
  { name: 'Export', href: '/export', icon: Download },
  { name: 'Settings', href: '/settings', icon: Settings },
];

export default function Layout({ children }: LayoutProps) {
  const location = useLocation();
  const [isExpanded, setIsExpanded] = useState(true);
  const { theme, toggleTheme } = useTheme();

  const toggleSidebar = () => {
    setIsExpanded(!isExpanded);
  };

  return (
    <div className="flex h-screen bg-[--exec-bg]">
      {/* Indie Command Center Sidebar */}
      <aside
        className={cn(
          "relative flex flex-col h-full transition-sidebar overflow-hidden",
          "bg-[--sidebar-bg]",
          isExpanded ? "sidebar-expanded" : "sidebar-collapsed"
        )}
      >
        {/* Brand Mark */}
        <div className={cn(
          "flex items-center h-[72px]",
          isExpanded ? "px-6" : "px-0 justify-center"
        )}>
          <Link to="/" className="group">
            {isExpanded ? (
              <div className="flex flex-col">
                <span className="text-xl font-bold text-white tracking-tight group-hover:text-[--exec-accent] transition-colors" style={{ fontFamily: 'var(--font-display)' }}>
                  Vertex
                </span>
                <span className="text-[10px] text-[--sidebar-text] uppercase tracking-widest">
                  Command
                </span>
              </div>
            ) : (
              <span className="text-xl font-bold text-white group-hover:text-[--exec-accent] transition-colors" style={{ fontFamily: 'var(--font-display)' }}>
                V
              </span>
            )}
          </Link>
        </div>

        {/* Navigation */}
        <nav className="flex-1 py-2 overflow-y-auto overflow-x-hidden">
          {navigationGroups.map((group, groupIndex) => (
            <div key={group.label} className={cn("mb-1", groupIndex > 0 && "mt-4")}>
              {/* Group Label */}
              {isExpanded && (
                <div className="flex items-center px-6 mb-2">
                  <p className="text-[10px] font-semibold text-[--sidebar-text] uppercase tracking-[0.2em]">
                    {group.label}
                  </p>
                  <div className="flex-1 ml-3 h-px bg-gradient-to-r from-[--sidebar-border] to-transparent" />
                </div>
              )}

              {/* Group Items */}
              <div className={cn("space-y-0.5", isExpanded ? "px-3" : "px-2")}>
                {group.items.map((item) => {
                  const isActive = location.pathname === item.href;
                  return (
                    <Link
                      key={item.name}
                      to={item.href}
                      className={cn(
                        "group relative flex items-center rounded-xl transition-all duration-200",
                        isExpanded ? "px-4 py-3 gap-3" : "p-3 justify-center",
                        isActive
                          ? "text-white bg-stone-600"
                          : "text-[--sidebar-text] hover:bg-stone-600"
                      )}
                      title={!isExpanded ? item.name : undefined}
                    >
                      {/* Active left indicator */}
                      {isActive && (
                        <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-6 bg-[--exec-accent] rounded-r-full" />
                      )}

                      <item.icon className={cn(
                        "w-[18px] h-[18px] shrink-0 transition-all duration-200",
                        isActive ? "text-[--exec-accent]" : "group-hover:text-[--exec-accent]"
                      )} strokeWidth={isActive ? 2.5 : 2} />

                      {isExpanded && (
                        <span className={cn(
                          "text-sm font-medium transition-colors",
                          isActive ? "text-white" : ""
                        )}>
                          {item.name}
                        </span>
                      )}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* Bottom Section */}
        <div className={cn("mt-auto", isExpanded ? "px-3" : "px-2")}>
          {/* Bottom Nav */}
          <div className="py-3 border-t border-[--sidebar-border]">
            <div className="space-y-0.5">
              {bottomNav.map((item) => {
                const isActive = location.pathname === item.href;
                return (
                  <Link
                    key={item.name}
                    to={item.href}
                    className={cn(
                      "group relative flex items-center rounded-xl transition-all duration-200",
                      isExpanded ? "px-4 py-2.5 gap-3" : "p-3 justify-center",
                      isActive
                        ? "text-white bg-stone-600"
                        : "text-[--sidebar-text] hover:bg-stone-600"
                    )}
                    title={!isExpanded ? item.name : undefined}
                  >
                    <item.icon className={cn(
                      "w-[18px] h-[18px] shrink-0 transition-all duration-200",
                      isActive ? "text-[--exec-accent]" : "group-hover:text-[--exec-accent]"
                    )} />
                    {isExpanded && (
                      <span className="text-sm font-medium">{item.name}</span>
                    )}
                  </Link>
                );
              })}
            </div>
          </div>

          {/* User Profile */}
          <div className={cn(
            "py-4 border-t border-[--sidebar-border]",
            isExpanded ? "px-3" : "px-2"
          )}>
            <div className={cn(
              "group flex items-center gap-3 rounded-xl transition-all duration-200",
              isExpanded ? "p-2 hover:bg-stone-600 cursor-pointer" : "justify-center"
            )}>
              <div className="relative">
                <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-[--exec-sage] to-[--exec-sage-light] flex items-center justify-center">
                  <span className="text-sm font-bold text-white">J</span>
                </div>
                {/* Online indicator */}
                <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-[--exec-success] border-2 border-[--sidebar-bg]" />
              </div>
              {isExpanded && (
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white truncate">
                    Joji
                  </p>
                  <p className="text-xs text-[--sidebar-text] truncate">
                    Freelancer Pro
                  </p>
                </div>
              )}
              {isExpanded && (
                <ArrowUpRight className="w-4 h-4 text-[--sidebar-text] opacity-0 group-hover:opacity-100 transition-opacity" />
              )}
            </div>

            {/* Controls */}
            <div className={cn(
              "flex items-center gap-1.5 mt-3",
              isExpanded ? "justify-start" : "justify-center flex-col"
            )}>
              {/* Theme Toggle */}
              <button
                onClick={toggleTheme}
                className={cn(
                  "p-2 rounded-lg transition-all duration-200",
                  "text-[--sidebar-text]",
                  "hover:text-white hover:bg-stone-600"
                )}
                title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
              >
                {theme === 'dark' ? (
                  <Sun className="w-4 h-4" />
                ) : (
                  <Moon className="w-4 h-4" />
                )}
              </button>

              {/* Collapse Sidebar */}
              <button
                onClick={toggleSidebar}
                className={cn(
                  "p-2 rounded-lg transition-all duration-200",
                  "text-[--sidebar-text]",
                  "hover:text-white hover:bg-stone-600"
                )}
                title={isExpanded ? 'Collapse sidebar' : 'Expand sidebar'}
              >
                {isExpanded ? <ChevronLeft className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
              </button>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto bg-[--exec-bg]">
        {children}
      </main>

      {/* Floating Timer Widget */}
      <FloatingTimer />
    </div>
  );
}

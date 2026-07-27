import { useEffect, useState, useRef } from 'react';
import type { ViewName, Task } from '../types';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { useTasks } from '../context/TasksContext';
import { Dashboard } from './Dashboard';
import { TaskList } from './TaskList';
import { CalendarView } from './CalendarView';
import { TaskModal } from './TaskModal';
import { AgentPanel } from './AgentPanel';
import { exportTasksCSV, exportTasksPDF } from '../lib/export';
import { ensureNotificationPermission, notifyDueSoon, notificationsSupported } from '../lib/notify';
import { isToday, isOverdue } from '../lib/dates';
import {
  LayoutDashboard, ListTodo, CalendarDays, Plus, Sun, Moon, LogOut,
  Bell, Download, Menu, X, CheckCircle2, ChevronDown, Bot,
} from 'lucide-react';

export function AppShell() {
  const { user, signOut } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { tasks } = useTasks();
  const [view, setView] = useState<ViewName>('dashboard');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Task | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [notifEnabled, setNotifEnabled] = useState(false);
  const [bellOpen, setBellOpen] = useState(false);
  const [agentOpen, setAgentOpen] = useState(false);
  const remindedRef = useRef<Set<string>>(new Set());

  // Reminder engine — checks every 30s for tasks due within the next hour
  useEffect(() => {
    if (!notificationsSupported()) return;
    setNotifEnabled(Notification.permission === 'granted');
    const check = () => {
      const now = Date.now();
      tasks.forEach((t) => {
        if (t.status === 'completed' || !t.due_date) return;
        const due = new Date(t.due_date).getTime();
        const diff = due - now;
        // notify when due within the next 60 min and not yet reminded
        if (diff > 0 && diff <= 60 * 60 * 1000 && !remindedRef.current.has(t.id)) {
          remindedRef.current.add(t.id);
          const mins = Math.max(1, Math.round(diff / 60000));
          notifyDueSoon(t.title, `Due in about ${mins} minute${mins > 1 ? 's' : ''}.`);
        }
        // clear reminded set once past due so re-scheduling re-notifies
        if (diff < -10 * 60 * 1000) remindedRef.current.delete(t.id);
      });
    };
    check();
    const id = setInterval(check, 30000);
    return () => clearInterval(id);
  }, [tasks]);

  const reminders = tasks.filter((t) => {
    if (t.status === 'completed' || !t.due_date) return false;
    const diff = new Date(t.due_date).getTime() - Date.now();
    return diff <= 24 * 60 * 60 * 1000;
  });

  const overdueCount = tasks.filter((t) => isOverdue(t.due_date, t.status)).length;
  const todayCount = tasks.filter((t) => isToday(t.due_date) && t.status !== 'completed').length;

  const openNew = () => {
    setEditing(null);
    setModalOpen(true);
  };
  const openEdit = (task: Task) => {
    setEditing(task);
    setModalOpen(true);
  };

  const navItems: { id: ViewName; label: string; icon: React.ReactNode; badge?: number }[] = [
    { id: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard className="w-5 h-5" /> },
    { id: 'tasks', label: 'Tasks', icon: <ListTodo className="w-5 h-5" />, badge: todayCount || undefined },
    { id: 'calendar', label: 'Calendar', icon: <CalendarDays className="w-5 h-5" />, badge: overdueCount || undefined },
  ];

  const handleEnableNotifs = async () => {
    const ok = await ensureNotificationPermission();
    setNotifEnabled(ok);
  };

  return (
    <div className="app-bg min-h-screen flex">
      {/* Sidebar */}
      <aside
        className={`fixed lg:sticky top-0 left-0 z-40 h-screen w-64 shrink-0 glass-strong border-r border-ink-200/50 dark:border-ink-700/40 flex flex-col transition-transform duration-300 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}
      >
        <div className="p-5 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-brand-500 to-accent-500 grid place-items-center shadow-glow">
              <CheckCircle2 className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="font-display text-sm font-bold text-ink-900 dark:text-white leading-tight">AI-Powered Smart<br />Task Scheduler</h1>
            </div>
          </div>
          <button onClick={() => setSidebarOpen(false)} className="lg:hidden text-ink-500" aria-label="Close menu">
            <X className="w-5 h-5" />
          </button>
        </div>

        <nav className="flex-1 px-3 space-y-1 mt-2">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => {
                setView(item.id);
                setSidebarOpen(false);
              }}
              className={`w-full flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium transition group ${view === item.id ? 'bg-gradient-to-r from-brand-500/15 to-accent-500/10 text-brand-700 dark:text-brand-300 shadow-sm' : 'text-ink-600 dark:text-ink-300 hover:bg-ink-500/8'}`}
            >
              <span className={view === item.id ? 'text-brand-600 dark:text-brand-400' : 'text-ink-400 group-hover:text-ink-600 dark:group-hover:text-ink-200'}>{item.icon}</span>
              {item.label}
              {item.badge ? (
                <span className={`ml-auto rounded-full text-[10px] font-bold px-1.5 py-0.5 ${item.id === 'calendar' ? 'bg-danger-500 text-white' : 'bg-brand-500 text-white'}`}>{item.badge}</span>
              ) : null}
            </button>
          ))}
        </nav>

        <div className="p-3 space-y-2">
          {/* AI Agent launcher */}
          <button
            onClick={() => setAgentOpen(true)}
            className="w-full rounded-xl bg-gradient-to-r from-brand-600 via-brand-500 to-accent-500 hover:from-brand-500 hover:via-brand-400 hover:to-accent-400 text-white font-semibold text-sm py-2.5 flex items-center justify-center gap-1.5 shadow-glow transition active:scale-95 relative overflow-hidden group"
          >
            <Bot className="w-4 h-4" /> Ask AI Agent
          </button>

          <button
            onClick={openNew}
            className="w-full rounded-xl border border-ink-200 dark:border-ink-700 hover:border-brand-400/40 text-ink-600 dark:text-ink-300 font-medium text-sm py-2.5 flex items-center justify-center gap-1.5 transition"
          >
            <Plus className="w-4 h-4" /> New task
          </button>

          {/* Export menu */}
          <div className="relative">
            <button
              onClick={() => setExportOpen((o) => !o)}
              className="w-full rounded-xl border border-ink-200 dark:border-ink-700 hover:border-brand-400/40 text-ink-600 dark:text-ink-300 font-medium text-sm py-2.5 flex items-center justify-center gap-1.5 transition"
            >
              <Download className="w-4 h-4" /> Export
              <ChevronDown className={`w-3.5 h-3.5 transition ${exportOpen ? 'rotate-180' : ''}`} />
            </button>
            {exportOpen && (
              <div className="absolute bottom-full left-0 right-0 mb-1 rounded-xl glass-strong shadow-glass border border-ink-200/60 dark:border-ink-700/40 p-1.5 animate-fade-in-scale">
                <button onClick={() => { exportTasksCSV(tasks); setExportOpen(false); }} className="w-full text-left rounded-lg px-3 py-2 text-xs font-medium text-ink-700 dark:text-ink-200 hover:bg-brand-500/10 transition">
                  Export as CSV
                </button>
                <button onClick={() => { exportTasksPDF(tasks); setExportOpen(false); }} className="w-full text-left rounded-lg px-3 py-2 text-xs font-medium text-ink-700 dark:text-ink-200 hover:bg-brand-500/10 transition">
                  Export as PDF
                </button>
              </div>
            )}
          </div>
        </div>

        {/* User */}
        <div className="p-3 border-t border-ink-200/50 dark:border-ink-700/40">
          <div className="flex items-center gap-3 rounded-xl p-2">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-brand-500/20 to-accent-500/20 grid place-items-center text-brand-700 dark:text-brand-300 font-bold text-sm shrink-0">
              {(user?.email ?? 'U').charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-ink-900 dark:text-white truncate">{user?.email ?? 'User'}</p>
              <p className="text-[10px] text-ink-500 dark:text-ink-400">Personal plan</p>
            </div>
            <button onClick={signOut} className="text-ink-400 hover:text-danger-500 transition" aria-label="Sign out">
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Mobile overlay */}
      {sidebarOpen && <div className="fixed inset-0 z-30 bg-ink-950/40 backdrop-blur-sm lg:hidden" onClick={() => setSidebarOpen(false)} />}

      {/* Main */}
      <div className="flex-1 min-w-0 flex flex-col">
        {/* Topbar */}
        <header className="sticky top-0 z-20 glass border-b border-ink-200/50 dark:border-ink-700/40 px-4 sm:px-6 py-3 flex items-center gap-3">
          <button onClick={() => setSidebarOpen(true)} className="lg:hidden text-ink-600 dark:text-ink-300" aria-label="Open menu">
            <Menu className="w-5 h-5" />
          </button>
          <div className="flex-1 min-w-0">
            <h2 className="font-display text-lg font-bold text-ink-900 dark:text-white capitalize">{view === 'dashboard' ? 'Dashboard' : view === 'tasks' ? 'My Tasks' : 'Calendar'}</h2>
            <p className="text-xs text-ink-500 dark:text-ink-400 hidden sm:block">
              {new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}
            </p>
          </div>

          {/* Reminders bell */}
          <div className="relative">
            <button
              onClick={() => setBellOpen((o) => !o)}
              className="relative w-10 h-10 rounded-xl hover:bg-ink-500/10 grid place-items-center text-ink-600 dark:text-ink-300 transition"
              aria-label="Reminders"
            >
              <Bell className="w-5 h-5" />
              {reminders.length > 0 && (
                <span className="absolute top-1.5 right-1.5 w-4 h-4 rounded-full bg-danger-500 text-white text-[9px] font-bold grid place-items-center animate-fade-in">{reminders.length}</span>
              )}
            </button>
            {bellOpen && (
              <>
                <div className="fixed inset-0 z-30" onClick={() => setBellOpen(false)} />
                <div className="absolute right-0 mt-2 w-80 max-w-[calc(100vw-2rem)] rounded-2xl glass-strong shadow-glass border border-ink-200/60 dark:border-ink-700/40 p-4 z-40 animate-fade-in-scale">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-display font-bold text-sm text-ink-900 dark:text-white">Reminders</h3>
                    {!notifEnabled && notificationsSupported() && (
                      <button onClick={handleEnableNotifs} className="text-[10px] font-semibold text-brand-600 dark:text-brand-400 hover:underline">Enable alerts</button>
                    )}
                  </div>
                  {reminders.length === 0 ? (
                    <p className="text-sm text-ink-400 dark:text-ink-500 text-center py-6">You're all caught up!</p>
                  ) : (
                    <div className="space-y-2 max-h-72 overflow-y-auto">
                      {reminders.slice(0, 8).map((t) => {
                        const overdue = isOverdue(t.due_date, t.status);
                        return (
                          <button key={t.id} onClick={() => { openEdit(t); setBellOpen(false); }} className="w-full text-left rounded-xl p-2.5 bg-white/50 dark:bg-ink-900/30 hover:bg-brand-500/8 border border-ink-200/60 dark:border-ink-700/40 transition">
                            <p className="text-xs font-medium text-ink-900 dark:text-white truncate">{t.title}</p>
                            <p className={`text-[10px] mt-0.5 ${overdue ? 'text-danger-500' : 'text-ink-500 dark:text-ink-400'}`}>
                              {overdue ? 'Overdue' : 'Due soon'} · {new Date(t.due_date!).toLocaleString([], { hour: 'numeric', minute: '2-digit', month: 'short', day: 'numeric' })}
                            </p>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>

          {/* Theme toggle */}
          <button
            onClick={toggleTheme}
            className="w-10 h-10 rounded-xl hover:bg-ink-500/10 grid place-items-center text-ink-600 dark:text-ink-300 transition"
            aria-label="Toggle theme"
          >
            {theme === 'light' ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5" />}
          </button>

          {/* AI Agent (desktop) */}
          <button
            onClick={() => setAgentOpen(true)}
            className="hidden sm:flex rounded-xl bg-gradient-to-r from-brand-600 via-brand-500 to-accent-500 hover:from-brand-500 hover:via-brand-400 hover:to-accent-400 text-white font-semibold text-sm px-4 py-2.5 items-center gap-1.5 shadow-glow transition active:scale-95"
          >
            <Bot className="w-4 h-4" /> AI Agent
          </button>

          {/* New task (desktop) */}
          <button onClick={openNew} className="hidden sm:flex rounded-xl border border-ink-200 dark:border-ink-700 hover:border-brand-400/40 text-ink-600 dark:text-ink-300 font-semibold text-sm px-4 py-2.5 items-center gap-1.5 transition">
            <Plus className="w-4 h-4" /> New
          </button>
        </header>

        {/* Content */}
        <main className="flex-1 p-4 sm:p-6 max-w-7xl w-full mx-auto">
          {view === 'dashboard' && <Dashboard onEditTask={openEdit} onGoToTasks={() => setView('tasks')} />}
          {view === 'tasks' && <TaskList onNewTask={openNew} onEditTask={openEdit} />}
          {view === 'calendar' && <CalendarView onNewTask={openNew} onEditTask={openEdit} />}
        </main>

        <footer className="px-6 py-4 text-center text-xs text-ink-400 dark:text-ink-600">
          © 2026 AI-Powered Smart Task Scheduler. All rights reserved.
        </footer>
      </div>

      {/* Floating agent button (mobile + quick access) */}
      <button
        onClick={() => setAgentOpen(true)}
        className="fixed bottom-5 right-5 z-30 w-14 h-14 rounded-2xl bg-gradient-to-br from-brand-600 to-accent-500 hover:from-brand-500 hover:to-accent-400 text-white grid place-items-center shadow-glow transition active:scale-90 group sm:hidden"
        aria-label="Open AI Agent"
      >
        <Bot className="w-6 h-6" />
        <span className="absolute inset-0 rounded-2xl border-2 border-brand-400 animate-pulse-ring" />
      </button>

      <TaskModal open={modalOpen} onClose={() => setModalOpen(false)} editing={editing} />
      <AgentPanel open={agentOpen} onClose={() => setAgentOpen(false)} />
    </div>
  );
}

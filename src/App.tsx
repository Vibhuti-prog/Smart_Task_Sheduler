import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { TasksProvider } from './context/TasksContext';
import { AuthScreen } from './components/AuthScreen';
import { AppShell } from './components/AppShell';
import { Spinner } from './components/Skeletons';

function Gate() {
  const { session, loading } = useAuth();

  if (loading) {
    return (
      <div className="app-bg min-h-screen grid place-items-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-brand-500 to-accent-500 grid place-items-center shadow-glow animate-float">
            <Spinner className="w-7 h-7 text-white" />
          </div>
          <p className="text-ink-500 dark:text-ink-400 text-sm font-medium">Loading…</p>
        </div>
      </div>
    );
  }

  if (!session) return <AuthScreen />;

  return (
    <TasksProvider>
      <AppShell />
    </TasksProvider>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <Gate />
      </AuthProvider>
    </ThemeProvider>
  );
}

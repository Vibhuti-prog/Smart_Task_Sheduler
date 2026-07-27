import {
  createContext,
  useContext,
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { supabase } from '../lib/supabase';
import type { Task, TaskInput, TaskStatus } from '../types';
import { useAuth } from './AuthContext';

interface TasksContextValue {
  tasks: Task[];
  loading: boolean;
  error: string | null;
  createTask: (input: TaskInput) => Promise<Task | null>;
  updateTask: (id: string, patch: Partial<TaskInput> & { status?: TaskStatus }) => Promise<void>;
  deleteTask: (id: string) => Promise<void>;
  reorderTasks: (orderedIds: string[]) => Promise<void>;
  toggleComplete: (task: Task) => Promise<void>;
  refresh: () => Promise<void>;
}

const TasksContext = createContext<TasksContextValue | undefined>(undefined);

export function TasksProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  const fetchTasks = useCallback(async () => {
    if (!user) {
      setTasks([]);
      return;
    }
    setLoading(true);
    setError(null);
    const { data, error: err } = await supabase
      .from('tasks')
      .select('*')
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: false });
    if (err) {
      setError(err.message);
    } else {
      setTasks(data as Task[]);
    }
    setLoading(false);
  }, [user]);

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  // Realtime sync across devices/tabs
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel('tasks-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'tasks', filter: `user_id=eq.${user.id}` },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            setTasks((prev) => {
              if (prev.some((t) => t.id === (payload.new as Task).id)) return prev;
              return [...prev, payload.new as Task];
            });
          } else if (payload.eventType === 'UPDATE') {
            setTasks((prev) => prev.map((t) => (t.id === (payload.new as Task).id ? (payload.new as Task) : t)));
          } else if (payload.eventType === 'DELETE') {
            setTasks((prev) => prev.filter((t) => t.id !== (payload.old as Task).id));
          }
        },
      )
      .subscribe();
    channelRef.current = channel;
    return () => {
      supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, [user]);

  const createTask = useCallback(
    async (input: TaskInput): Promise<Task | null> => {
      const { data, error: err } = await supabase
        .from('tasks')
        .insert(input)
        .select()
        .maybeSingle();
      if (err) {
        setError(err.message);
        return null;
      }
      if (data) {
        setTasks((prev) => {
          if (prev.some((t) => t.id === (data as Task).id)) return prev;
          return [...prev, data as Task];
        });
      }
      return data as Task;
    },
    [],
  );

  const updateTask = useCallback(
    async (id: string, patch: Partial<TaskInput> & { status?: TaskStatus }) => {
      const { error: err } = await supabase.from('tasks').update(patch).eq('id', id);
      if (err) setError(err.message);
    },
    [],
  );

  const deleteTask = useCallback(async (id: string) => {
    const { error: err } = await supabase.from('tasks').delete().eq('id', id);
    if (err) setError(err.message);
  }, []);

  const reorderTasks = useCallback(async (orderedIds: string[]) => {
    // Optimistic local update
    setTasks((prev) => {
      const map = new Map(prev.map((t) => [t.id, t]));
      const reordered: Task[] = [];
      orderedIds.forEach((id, idx) => {
        const t = map.get(id);
        if (t) reordered.push({ ...t, sort_order: idx });
      });
      prev.forEach((t) => {
        if (!orderedIds.includes(t.id)) reordered.push(t);
      });
      return reordered;
    });
    const updates = orderedIds.map((id, idx) =>
      supabase.from('tasks').update({ sort_order: idx }).eq('id', id),
    );
    await Promise.all(updates);
  }, []);

  const toggleComplete = useCallback(
    async (task: Task) => {
      const isDone = task.status === 'completed';
      const patch = {
        status: (isDone ? 'todo' : 'completed') as TaskStatus,
        completed_at: isDone ? null : new Date().toISOString(),
      } as const;
      setTasks((prev) =>
        prev.map((t) => (t.id === task.id ? { ...t, ...patch } : t)),
      );
      const { error: err } = await supabase
        .from('tasks')
        .update(patch)
        .eq('id', task.id);
      if (err) {
        setError(err.message);
        fetchTasks();
      }
    },
    [fetchTasks],
  );

  const refresh = useCallback(async () => {
    await fetchTasks();
  }, [fetchTasks]);

  return (
    <TasksContext.Provider
      value={{ tasks, loading, error, createTask, updateTask, deleteTask, reorderTasks, toggleComplete, refresh }}
    >
      {children}
    </TasksContext.Provider>
  );
}

export function useTasks(): TasksContextValue {
  const ctx = useContext(TasksContext);
  if (!ctx) throw new Error('useTasks must be used within TasksProvider');
  return ctx;
}

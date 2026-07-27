import { useMemo, useState } from 'react';
import type { Task, Priority, TaskStatus } from '../types';
import { useTasks } from '../context/TasksContext';
import { TaskItem } from './TaskItem';
import { SkeletonCard } from './Skeletons';
import { Search, SlidersHorizontal, ArrowUpDown, Plus, Inbox, X } from 'lucide-react';

interface Props {
  onNewTask: () => void;
  onEditTask: (task: Task) => void;
}

type SortKey = 'smart' | 'due' | 'priority' | 'created' | 'title';
type StatusFilter = 'all' | TaskStatus | 'overdue';

const PRIORITY_RANK: Record<Priority, number> = { high: 0, medium: 1, low: 2 };

export function TaskList({ onNewTask, onEditTask }: Props) {
  const { tasks, loading, reorderTasks } = useTasks();
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [priorityFilter, setPriorityFilter] = useState<'all' | Priority>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [sort, setSort] = useState<SortKey>('smart');
  const [showFilters, setShowFilters] = useState(false);
  const [dragId, setDragId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);

  const categories = useMemo(
    () => Array.from(new Set(tasks.map((t) => t.category).filter(Boolean))) as string[],
    [tasks],
  );

  const filtered = useMemo(() => {
    let list = tasks.filter((t) => {
      if (query) {
        const q = query.toLowerCase();
        const hit =
          t.title.toLowerCase().includes(q) ||
          (t.description ?? '').toLowerCase().includes(q) ||
          t.tags.some((tag) => tag.toLowerCase().includes(q)) ||
          (t.category ?? '').toLowerCase().includes(q);
        if (!hit) return false;
      }
      if (statusFilter !== 'all') {
        if (statusFilter === 'overdue') {
          if (!(t.due_date && t.status !== 'completed' && new Date(t.due_date) < new Date())) return false;
        } else if (t.status !== statusFilter) return false;
      }
      if (priorityFilter !== 'all' && t.priority !== priorityFilter) return false;
      if (categoryFilter !== 'all' && t.category !== categoryFilter) return false;
      return true;
    });

    const sortFns: Record<SortKey, (a: Task, b: Task) => number> = {
      smart: (a, b) => scoreOf(b) - scoreOf(a) || a.sort_order - b.sort_order,
      due: (a, b) => {
        if (!a.due_date) return 1;
        if (!b.due_date) return -1;
        return new Date(a.due_date).getTime() - new Date(b.due_date).getTime();
      },
      priority: (a, b) => PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority],
      created: (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
      title: (a, b) => a.title.localeCompare(b.title),
    };
    list = [...list].sort(sortFns[sort]);
    return list;
  }, [tasks, query, statusFilter, priorityFilter, categoryFilter, sort]);

  const handleDrop = () => {
    if (!dragId || !overId || dragId === overId) {
      setDragId(null);
      setOverId(null);
      return;
    }
    const ordered = filtered.map((t) => t.id);
    const from = ordered.indexOf(dragId);
    const to = ordered.indexOf(overId);
    if (from === -1 || to === -1) {
      setDragId(null);
      setOverId(null);
      return;
    }
    ordered.splice(from, 1);
    ordered.splice(to, 0, dragId);
    reorderTasks(ordered);
    setDragId(null);
    setOverId(null);
  };

  const activeFilterCount =
    (statusFilter !== 'all' ? 1 : 0) +
    (priorityFilter !== 'all' ? 1 : 0) +
    (categoryFilter !== 'all' ? 1 : 0);

  return (
    <div className="space-y-5">
      {/* Toolbar */}
      <div className="rounded-2xl glass-panel p-4 space-y-3">
        <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-ink-400" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search tasks, tags, categories..."
              className="w-full rounded-xl bg-white/60 dark:bg-ink-900/40 border border-ink-200 dark:border-ink-700 pl-11 pr-9 py-2.5 text-sm text-ink-900 dark:text-white placeholder:text-ink-400 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 outline-none transition"
            />
            {query && (
              <button onClick={() => setQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-400 hover:text-ink-600">
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setShowFilters((s) => !s)}
              className={`rounded-xl border px-3.5 py-2.5 text-sm font-medium flex items-center gap-1.5 transition ${showFilters ? 'bg-brand-500/12 border-brand-500/30 text-brand-700 dark:text-brand-300' : 'bg-white/60 dark:bg-ink-900/40 border-ink-200 dark:border-ink-700 text-ink-600 dark:text-ink-300 hover:border-brand-400/40'}`}
            >
              <SlidersHorizontal className="w-4 h-4" /> Filters
              {activeFilterCount > 0 && <span className="ml-0.5 rounded-full bg-brand-500 text-white text-[10px] w-4 h-4 grid place-items-center font-bold">{activeFilterCount}</span>}
            </button>
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as SortKey)}
              className="rounded-xl bg-white/60 dark:bg-ink-900/40 border border-ink-200 dark:border-ink-700 px-3 py-2.5 text-sm text-ink-600 dark:text-ink-300 focus:border-brand-500 outline-none transition"
              aria-label="Sort by"
            >
              <option value="smart">Smart priority</option>
              <option value="due">Due date</option>
              <option value="priority">Priority</option>
              <option value="created">Newest</option>
              <option value="title">Title A–Z</option>
            </select>
            <button
              onClick={onNewTask}
              className="rounded-xl bg-gradient-to-r from-brand-600 to-accent-500 hover:from-brand-500 hover:to-accent-400 text-white font-semibold text-sm px-4 py-2.5 flex items-center gap-1.5 shadow-glow transition active:scale-95"
            >
              <Plus className="w-4 h-4" /> New
            </button>
          </div>
        </div>

        {showFilters && (
          <div className="flex flex-wrap gap-2 pt-1 animate-fade-in">
            <FilterPill label="Status" options={['all', 'todo', 'in_progress', 'completed', 'overdue']} value={statusFilter} onChange={(v) => setStatusFilter(v as StatusFilter)} format={(v) => v === 'all' ? 'All status' : v === 'in_progress' ? 'In progress' : v.charAt(0).toUpperCase() + v.slice(1)} />
            <FilterPill label="Priority" options={['all', 'high', 'medium', 'low']} value={priorityFilter} onChange={(v) => setPriorityFilter(v as 'all' | Priority)} format={(v) => v === 'all' ? 'All priority' : v.charAt(0).toUpperCase() + v.slice(1)} />
            {categories.length > 0 && (
              <FilterPill label="Category" options={['all', ...categories]} value={categoryFilter} onChange={setCategoryFilter} format={(v) => v === 'all' ? 'All categories' : v} />
            )}
          </div>
        )}
      </div>

      <div className="flex items-center justify-between text-xs text-ink-500 dark:text-ink-400 px-1">
        <span className="inline-flex items-center gap-1.5"><ArrowUpDown className="w-3.5 h-3.5" /> Drag to reorder • {filtered.length} task{filtered.length !== 1 ? 's' : ''}</span>
      </div>

      {/* List */}
      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => <SkeletonCard key={i} />)}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState onNewTask={onNewTask} hasQuery={!!query || activeFilterCount > 0} />
      ) : (
        <div className="space-y-3">
          {filtered.map((task) => (
            <TaskItem
              key={task.id}
              task={task}
              onEdit={onEditTask}
              onDragStart={setDragId}
              onDragOver={setOverId}
              onDrop={handleDrop}
              isDragging={dragId === task.id}
              isDragOver={overId === task.id}
              draggable={sort === 'smart'}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function scoreOf(t: Task): number {
  let s = 0;
  const d = t.due_date ? (new Date(t.due_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24) : null;
  if (t.status === 'completed') return -10;
  if (d !== null) {
    if (d < 0) s += 50;
    else if (d <= 1) s += 40;
    else if (d <= 3) s += 25;
    else if (d <= 7) s += 12;
  }
  s += PRIORITY_RANK[t.priority] === 0 ? 30 : PRIORITY_RANK[t.priority] === 1 ? 18 : 8;
  if (t.status === 'in_progress') s += 8;
  return s;
}

function FilterPill({ label, options, value, onChange, format }: { label: string; options: string[]; value: string; onChange: (v: string) => void; format: (v: string) => string }) {
  return (
    <select
      aria-label={label}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="rounded-lg bg-white/60 dark:bg-ink-900/40 border border-ink-200 dark:border-ink-700 px-3 py-1.5 text-xs font-medium text-ink-600 dark:text-ink-300 focus:border-brand-500 outline-none transition"
    >
      {options.map((o) => <option key={o} value={o}>{format(o)}</option>)}
    </select>
  );
}

function EmptyState({ onNewTask, hasQuery }: { onNewTask: () => void; hasQuery: boolean }) {
  return (
    <div className="rounded-2xl glass-panel p-12 text-center animate-fade-in">
      <div className="w-16 h-16 rounded-2xl bg-brand-500/10 grid place-items-center mx-auto mb-4">
        <Inbox className="w-8 h-8 text-brand-500" />
      </div>
      <h3 className="font-display font-bold text-ink-900 dark:text-white">{hasQuery ? 'No tasks match' : 'No tasks yet'}</h3>
      <p className="text-sm text-ink-500 dark:text-ink-400 mt-1.5 max-w-xs mx-auto">
        {hasQuery ? 'Try adjusting your search or filters.' : 'Create your first task to get organized and let AI prioritize it for you.'}
      </p>
      {!hasQuery && (
        <button onClick={onNewTask} className="mt-5 rounded-xl bg-gradient-to-r from-brand-600 to-accent-500 text-white font-semibold text-sm px-5 py-2.5 shadow-glow inline-flex items-center gap-1.5 active:scale-95 transition">
          <Plus className="w-4 h-4" /> Create task
        </button>
      )}
    </div>
  );
}

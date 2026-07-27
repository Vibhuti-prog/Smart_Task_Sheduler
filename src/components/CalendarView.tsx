import { useMemo, useState } from 'react';
import type { Task } from '../types';
import { useTasks } from '../context/TasksContext';
import { monthMatrix, monthName, weekdayShort, isSameDay, addMonths, startOfWeek, addDays, isToday, isOverdue } from '../lib/dates';
import { PriorityBadge } from './Badges';
import { ChevronLeft, ChevronRight, Plus, Clock } from 'lucide-react';

interface Props {
  onNewTask: () => void;
  onEditTask: (task: Task) => void;
}

type Mode = 'month' | 'week';

export function CalendarView({ onNewTask, onEditTask }: Props) {
  const { tasks } = useTasks();
  const [cursor, setCursor] = useState(new Date());
  const [mode, setMode] = useState<Mode>('month');
  const [selected, setSelected] = useState<Date>(new Date());

  const year = cursor.getFullYear();
  const month = cursor.getMonth();

  const weeks = useMemo(() => monthMatrix(year, month), [year, month]);
  const weekStart = useMemo(() => startOfWeek(cursor), [cursor]);
  const weekDays = useMemo(() => Array.from({ length: 7 }).map((_, i) => addDays(weekStart, i)), [weekStart]);

  const cells = mode === 'month' ? weeks.flat() : weekDays;

  const tasksByDay = useMemo(() => {
    const map = new Map<string, Task[]>();
    for (const t of tasks) {
      if (!t.due_date) continue;
      const key = new Date(t.due_date).toDateString();
      const arr = map.get(key) ?? [];
      arr.push(t);
      map.set(key, arr);
    }
    return map;
  }, [tasks]);

  const selectedTasks = useMemo(
    () => (tasksByDay.get(selected.toDateString()) ?? []).sort((a, b) => {
      if (!a.due_date) return 1;
      if (!b.due_date) return -1;
      return new Date(a.due_date).getTime() - new Date(b.due_date).getTime();
    }),
    [tasksByDay, selected],
  );

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="rounded-2xl glass-panel p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <h2 className="font-display text-lg font-bold text-ink-900 dark:text-white">
            {monthName(month)} {year}
          </h2>
          <div className="flex rounded-lg bg-ink-500/8 dark:bg-ink-900/40 p-0.5 border border-ink-200 dark:border-ink-700">
            <button onClick={() => setMode('month')} className={`rounded-md px-3 py-1 text-xs font-semibold transition ${mode === 'month' ? 'bg-white dark:bg-ink-700 text-ink-900 dark:text-white shadow-sm' : 'text-ink-500 dark:text-ink-400'}`}>Month</button>
            <button onClick={() => setMode('week')} className={`rounded-md px-3 py-1 text-xs font-semibold transition ${mode === 'week' ? 'bg-white dark:bg-ink-700 text-ink-900 dark:text-white shadow-sm' : 'text-ink-500 dark:text-ink-400'}`}>Week</button>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setCursor(new Date())} className="rounded-lg border border-ink-200 dark:border-ink-700 px-3 py-1.5 text-xs font-medium text-ink-600 dark:text-ink-300 hover:border-brand-400/40 transition">Today</button>
          <button onClick={() => setCursor((c) => addMonths(c, -1))} className="w-8 h-8 rounded-lg border border-ink-200 dark:border-ink-700 grid place-items-center text-ink-600 dark:text-ink-300 hover:border-brand-400/40 transition" aria-label="Previous"><ChevronLeft className="w-4 h-4" /></button>
          <button onClick={() => setCursor((c) => addMonths(c, 1))} className="w-8 h-8 rounded-lg border border-ink-200 dark:border-ink-700 grid place-items-center text-ink-600 dark:text-ink-300 hover:border-brand-400/40 transition" aria-label="Next"><ChevronRight className="w-4 h-4" /></button>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-5">
        {/* Calendar grid */}
        <div className="lg:col-span-2 rounded-2xl glass-panel p-4">
          <div className="grid grid-cols-7 mb-2">
            {Array.from({ length: 7 }).map((_, i) => (
              <div key={i} className="text-center text-[11px] font-semibold text-ink-500 dark:text-ink-400 uppercase py-1">
                {weekdayShort(addDays(startOfWeek(new Date()), i))}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1.5">
            {cells.map((d, i) => {
              const inMonth = mode === 'week' || d.getMonth() === month;
              const dayTasks = tasksByDay.get(d.toDateString()) ?? [];
              const today = isToday(d.toISOString());
              const isSelected = isSameDay(d, selected);
              return (
                <button
                  key={i}
                  onClick={() => setSelected(d)}
                  className={`relative min-h-[64px] sm:min-h-[84px] rounded-xl p-1.5 sm:p-2 text-left border transition group ${inMonth ? 'bg-white/40 dark:bg-ink-900/25 border-ink-200/60 dark:border-ink-700/40 hover:border-brand-400/50 hover:bg-brand-500/5' : 'bg-transparent border-transparent text-ink-300 dark:text-ink-700'} ${isSelected ? 'ring-2 ring-brand-500 border-brand-500' : ''}`}
                >
                  <div className="flex items-center justify-between">
                    <span className={`text-xs font-semibold ${today ? 'w-5 h-5 rounded-full bg-brand-600 text-white grid place-items-center' : inMonth ? 'text-ink-700 dark:text-ink-200' : 'text-ink-400 dark:text-ink-600'}`}>
                      {d.getDate()}
                    </span>
                    {dayTasks.length > 0 && inMonth && (
                      <span className="text-[9px] font-bold text-brand-600 dark:text-brand-400">{dayTasks.length}</span>
                    )}
                  </div>
                  <div className="mt-1 space-y-0.5">
                    {dayTasks.slice(0, 3).map((t) => (
                      <div
                        key={t.id}
                        className={`text-[9px] sm:text-[10px] truncate rounded px-1 py-0.5 font-medium ${t.priority === 'high' ? 'bg-danger-500/15 text-danger-600 dark:text-danger-400' : t.priority === 'medium' ? 'bg-warning-500/15 text-warning-600 dark:text-warning-400' : 'bg-success-500/15 text-success-600 dark:text-success-400'} ${t.status === 'completed' ? 'line-through opacity-50' : ''}`}
                      >
                        {t.title}
                      </div>
                    ))}
                    {dayTasks.length > 3 && <div className="text-[9px] text-ink-400 px-1">+{dayTasks.length - 3} more</div>}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Day detail */}
        <div className="rounded-2xl glass-panel p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-display font-bold text-ink-900 dark:text-white">
                {selected.toLocaleDateString(undefined, { weekday: 'long' })}
              </h3>
              <p className="text-xs text-ink-500 dark:text-ink-400">
                {selected.toLocaleDateString(undefined, { month: 'long', day: 'numeric' })}
              </p>
            </div>
            <button onClick={onNewTask} className="w-8 h-8 rounded-lg bg-brand-600 hover:bg-brand-500 text-white grid place-items-center transition active:scale-95" aria-label="New task">
              <Plus className="w-4 h-4" />
            </button>
          </div>

          {selectedTasks.length === 0 ? (
            <div className="text-center py-10">
              <div className="w-12 h-12 rounded-xl bg-ink-500/8 grid place-items-center mx-auto mb-3">
                <Clock className="w-6 h-6 text-ink-400" />
              </div>
              <p className="text-sm text-ink-500 dark:text-ink-400">No tasks scheduled.</p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {selectedTasks.map((t) => {
                const overdue = isOverdue(t.due_date, t.status);
                return (
                  <button
                    key={t.id}
                    onClick={() => onEditTask(t)}
                    className="w-full text-left rounded-xl p-3 bg-white/50 dark:bg-ink-900/30 hover:bg-brand-500/8 border border-ink-200/60 dark:border-ink-700/40 transition"
                  >
                    <div className="flex items-center gap-2">
                      <span className={`w-1.5 h-1.5 rounded-full ${t.priority === 'high' ? 'bg-danger-500' : t.priority === 'medium' ? 'bg-warning-500' : 'bg-success-500'}`} />
                      <span className={`text-sm font-medium text-ink-900 dark:text-white flex-1 truncate ${t.status === 'completed' ? 'line-through opacity-50' : ''}`}>
                        {t.title}
                      </span>
                      <span className={`text-[10px] font-semibold ${overdue ? 'text-danger-500' : 'text-ink-400'}`}>
                        {new Date(t.due_date!).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}
                      </span>
                    </div>
                    <div className="mt-1.5 pl-3.5">
                      <PriorityBadge priority={t.priority} size="xs" />
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

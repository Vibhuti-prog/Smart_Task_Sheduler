import type { Priority, TaskStatus } from '../types';
import { Flame, ArrowUp, ArrowDown, Circle, Clock, CheckCircle2 } from 'lucide-react';

export function PriorityBadge({ priority, size = 'sm' }: { priority: Priority; size?: 'sm' | 'xs' }) {
  const map = {
    high: { cls: 'bg-danger-500/12 text-danger-600 dark:text-danger-400 border-danger-500/25', icon: <Flame className="w-3 h-3" />, label: 'High' },
    medium: { cls: 'bg-warning-500/12 text-warning-600 dark:text-warning-400 border-warning-500/25', icon: <ArrowUp className="w-3 h-3" />, label: 'Medium' },
    low: { cls: 'bg-success-500/12 text-success-600 dark:text-success-400 border-success-500/25', icon: <ArrowDown className="w-3 h-3" />, label: 'Low' },
  } as const;
  const s = map[priority];
  const pad = size === 'xs' ? 'px-2 py-0.5 text-[10px]' : 'px-2.5 py-1 text-xs';
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border font-semibold ${s.cls} ${pad}`}>
      {s.icon}
      {s.label}
    </span>
  );
}

export function StatusBadge({ status }: { status: TaskStatus }) {
  const map = {
    todo: { cls: 'bg-ink-500/10 text-ink-600 dark:text-ink-300 border-ink-400/20', icon: <Circle className="w-3 h-3" />, label: 'To do' },
    in_progress: { cls: 'bg-brand-500/12 text-brand-600 dark:text-brand-400 border-brand-500/25', icon: <Clock className="w-3 h-3" />, label: 'In progress' },
    completed: { cls: 'bg-success-500/12 text-success-600 dark:text-success-400 border-success-500/25', icon: <CheckCircle2 className="w-3 h-3" />, label: 'Done' },
  } as const;
  const s = map[status];
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border font-semibold px-2.5 py-1 text-xs ${s.cls}`}>
      {s.icon}
      {s.label}
    </span>
  );
}

export function TagChip({ tag }: { tag: string }) {
  return (
    <span className="inline-flex items-center rounded-md bg-ink-500/10 text-ink-600 dark:text-ink-300 px-1.5 py-0.5 text-[10px] font-medium">
      #{tag}
    </span>
  );
}

export function CategoryDot({ category }: { category: string | null }) {
  if (!category) return null;
  const colors: Record<string, string> = {
    Work: 'bg-brand-500',
    Personal: 'bg-accent-500',
    Study: 'bg-success-500',
    Health: 'bg-danger-500',
    Errands: 'bg-warning-500',
  };
  const c = colors[category] ?? 'bg-ink-400';
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-medium text-ink-600 dark:text-ink-300">
      <span className={`w-2 h-2 rounded-full ${c}`} />
      {category}
    </span>
  );
}

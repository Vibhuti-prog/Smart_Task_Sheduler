import { useState } from 'react';
import type { Task } from '../types';
import { useTasks } from '../context/TasksContext';
import { PriorityBadge, StatusBadge, TagChip, CategoryDot } from './Badges';
import { relativeLabel, isOverdue, formatTime, daysUntil } from '../lib/dates';
import { CheckCircle2, Circle, Clock, Pencil, GripVertical, AlertTriangle, Repeat } from 'lucide-react';

interface Props {
  task: Task;
  onEdit: (task: Task) => void;
  onDragStart: (id: string) => void;
  onDragOver: (id: string) => void;
  onDrop: () => void;
  isDragging: boolean;
  isDragOver: boolean;
  draggable: boolean;
}

export function TaskItem({ task, onEdit, onDragStart, onDragOver, onDrop, isDragging, isDragOver, draggable }: Props) {
  const { toggleComplete } = useTasks();
  const [checking, setChecking] = useState(false);
  const done = task.status === 'completed';
  const overdue = isOverdue(task.due_date, task.status);
  const d = daysUntil(task.due_date);

  const handleToggle = async () => {
    setChecking(true);
    await toggleComplete(task);
    setChecking(false);
  };

  return (
    <div
      draggable={draggable}
      onDragStart={() => onDragStart(task.id)}
      onDragOver={(e) => {
        e.preventDefault();
        onDragOver(task.id);
      }}
      onDrop={(e) => {
        e.preventDefault();
        onDrop();
      }}
      className={`group rounded-2xl glass-panel p-4 border transition-all duration-200 hover:shadow-glass-sm hover:border-brand-400/40 ${isDragging ? 'dragging' : ''} ${isDragOver ? 'drag-over' : ''} ${done ? 'opacity-60' : ''}`}
    >
      <div className="flex items-start gap-3">
        {draggable && (
          <span className="opacity-0 group-hover:opacity-60 transition cursor-grab active:cursor-grabbing text-ink-400 mt-1" aria-hidden>
            <GripVertical className="w-4 h-4" />
          </span>
        )}

        <button
          onClick={handleToggle}
          disabled={checking}
          className="mt-0.5 shrink-0 transition-transform active:scale-90"
          aria-label={done ? 'Mark as not done' : 'Mark as done'}
        >
          {done ? (
            <CheckCircle2 className="w-5.5 h-5.5 text-success-500 animate-check-pop" />
          ) : (
            <Circle className="w-5.5 h-5.5 text-ink-300 dark:text-ink-600 hover:text-brand-500 transition" />
          )}
        </button>

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <h3 className={`font-semibold text-sm leading-snug text-ink-900 dark:text-white ${done ? 'line-through text-ink-400 dark:text-ink-500' : ''}`}>
              {task.title}
            </h3>
            <button
              onClick={() => onEdit(task)}
              className="opacity-0 group-hover:opacity-100 transition text-ink-400 hover:text-brand-600 dark:hover:text-brand-400 shrink-0"
              aria-label="Edit task"
            >
              <Pencil className="w-4 h-4" />
            </button>
          </div>

          {task.description && (
            <p className="text-xs text-ink-500 dark:text-ink-400 mt-1 line-clamp-2">{task.description}</p>
          )}

          <div className="flex flex-wrap items-center gap-2 mt-2.5">
            <PriorityBadge priority={task.priority} size="xs" />
            <StatusBadge status={task.status} />
            <CategoryDot category={task.category} />
            {task.due_date && (
              <span className={`inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-md ${overdue ? 'bg-danger-500/12 text-danger-600 dark:text-danger-400' : d === 0 ? 'bg-warning-500/12 text-warning-600 dark:text-warning-400' : 'bg-ink-500/8 text-ink-500 dark:text-ink-400'}`}>
                {overdue ? <AlertTriangle className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
                {relativeLabel(task.due_date)}{formatTime(task.due_date) ? ` · ${formatTime(task.due_date)}` : ''}
              </span>
            )}
            {task.recurrence !== 'none' && (
              <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-md bg-accent-500/12 text-accent-600 dark:text-accent-400">
                <Repeat className="w-3 h-3" />{task.recurrence}
              </span>
            )}
            {task.tags.map((t) => <TagChip key={t} tag={t} />)}
          </div>
        </div>
      </div>
    </div>
  );
}

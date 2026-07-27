import { useEffect, useMemo, useState } from 'react';
import type { Task, TaskInput, Priority, Recurrence, TaskStatus } from '../types';
import { parseNaturalLanguage } from '../lib/nlp';
import { estimateMinutes } from '../lib/ai';
import { toLocalInputValue, fromLocalInputValue } from '../lib/dates';
import { useTasks } from '../context/TasksContext';
import { Sparkles, X, Wand2, Trash2, Loader2, Calendar, Tag, Flag, Repeat, Clock, Folder } from 'lucide-react';

interface Props {
  open: boolean;
  onClose: () => void;
  editing?: Task | null;
}

const CATEGORIES = ['Work', 'Personal', 'Study', 'Health', 'Errands'];

export function TaskModal({ open, onClose, editing }: Props) {
  const { createTask, updateTask, deleteTask } = useTasks();
  const [nlp, setNlp] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<Priority>('medium');
  const [status, setStatus] = useState<TaskStatus>('todo');
  const [category, setCategory] = useState<string>('');
  const [tagsInput, setTagsInput] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [estimatedMinutes, setEstimatedMinutes] = useState<number | ''>('');
  const [recurrence, setRecurrence] = useState<Recurrence>('none');
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isEdit = !!editing;

  useEffect(() => {
    if (!open) return;
    if (editing) {
      setTitle(editing.title);
      setDescription(editing.description ?? '');
      setPriority(editing.priority);
      setStatus(editing.status);
      setCategory(editing.category ?? '');
      setTagsInput(editing.tags.join(', '));
      setDueDate(toLocalInputValue(editing.due_date));
      setEstimatedMinutes(editing.estimated_minutes ?? '');
      setRecurrence(editing.recurrence);
      setNlp('');
    } else {
      setTitle('');
      setDescription('');
      setPriority('medium');
      setStatus('todo');
      setCategory('');
      setTagsInput('');
      setDueDate('');
      setEstimatedMinutes('');
      setRecurrence('none');
      setNlp('');
    }
    setError(null);
  }, [open, editing]);

  const parsedPreview = useMemo(() => (nlp.trim() ? parseNaturalLanguage(nlp) : null), [nlp]);

  const applyNLP = () => {
    if (!parsedPreview) return;
    setTitle(parsedPreview.title);
    if (parsedPreview.priority) setPriority(parsedPreview.priority);
    if (parsedPreview.category) setCategory(parsedPreview.category);
    if (parsedPreview.dueDate) setDueDate(toLocalInputValue(parsedPreview.dueDate.toISOString()));
    if (parsedPreview.tags.length) {
      const existing = tagsInput.split(',').map((t) => t.trim()).filter(Boolean);
      setTagsInput(Array.from(new Set([...existing, ...parsedPreview.tags])).join(', '));
    }
    setEstimatedMinutes(estimateMinutes(parsedPreview.title, ''));
    setNlp('');
  };

  const handleSave = async () => {
    setError(null);
    if (!title.trim()) {
      setError('Title is required.');
      return;
    }
    setSaving(true);
    const tags = tagsInput.split(',').map((t) => t.trim().replace(/^#/, '')).filter(Boolean);
    const payload: TaskInput = {
      title: title.trim(),
      description: description.trim() || null,
      status,
      priority,
      category: category || null,
      tags,
      due_date: dueDate ? fromLocalInputValue(dueDate) : null,
      estimated_minutes: estimatedMinutes === '' ? null : Number(estimatedMinutes),
      recurrence,
    };
    try {
      if (isEdit && editing) {
        await updateTask(editing.id, payload);
      } else {
        await createTask(payload);
      }
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save task.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!editing) return;
    setDeleting(true);
    await deleteTask(editing.id);
    setDeleting(false);
    onClose();
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="task-modal-title"
    >
      <div className="absolute inset-0 bg-ink-950/40 backdrop-blur-sm animate-fade-in" onClick={onClose} />
      <div className="relative w-full max-w-2xl rounded-3xl glass-strong shadow-glass max-h-[92vh] overflow-y-auto animate-fade-in-scale">
        <div className="sticky top-0 z-10 glass-strong px-6 py-4 flex items-center justify-between border-b border-ink-200/60 dark:border-ink-700/40">
          <h2 id="task-modal-title" className="font-display text-lg font-bold text-ink-900 dark:text-white">
            {isEdit ? 'Edit task' : 'New task'}
          </h2>
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-xl hover:bg-ink-500/10 grid place-items-center text-ink-500 dark:text-ink-400 transition"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-5">
          {/* NLP input */}
          <div className="rounded-2xl bg-gradient-to-br from-brand-500/8 to-accent-500/8 border border-brand-500/20 p-4">
            <label className="flex items-center gap-2 text-xs font-semibold text-brand-700 dark:text-brand-300 uppercase tracking-wide">
              <Wand2 className="w-3.5 h-3.5" /> Natural language
            </label>
            <div className="mt-2 flex gap-2">
              <input
                value={nlp}
                onChange={(e) => setNlp(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), applyNLP())}
                placeholder='e.g. "Remind me to submit assignment tomorrow at 10 AM #urgent"'
                className="flex-1 rounded-xl bg-white/70 dark:bg-ink-900/50 border border-ink-200 dark:border-ink-700 px-3.5 py-2.5 text-sm text-ink-900 dark:text-white placeholder:text-ink-400 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 outline-none transition"
              />
              <button
                onClick={applyNLP}
                disabled={!parsedPreview}
                className="rounded-xl bg-brand-600 hover:bg-brand-500 text-white font-semibold text-sm px-4 flex items-center gap-1.5 transition disabled:opacity-40 disabled:cursor-not-allowed active:scale-95"
              >
                <Sparkles className="w-4 h-4" /> Fill
              </button>
            </div>
            {parsedPreview && (
              <div className="mt-2.5 flex flex-wrap gap-1.5 text-xs animate-fade-in">
                <span className="text-ink-500 dark:text-ink-400">Preview:</span>
                {parsedPreview.priority && <span className="rounded-md bg-brand-500/15 text-brand-700 dark:text-brand-300 px-2 py-0.5 font-medium">{parsedPreview.priority} priority</span>}
                {parsedPreview.category && <span className="rounded-md bg-accent-500/15 text-accent-600 dark:text-accent-400 px-2 py-0.5 font-medium">{parsedPreview.category}</span>}
                {parsedPreview.dueDate && <span className="rounded-md bg-success-500/15 text-success-600 dark:text-success-400 px-2 py-0.5 font-medium">{parsedPreview.dueDate.toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</span>}
                {parsedPreview.tags.map((t) => <span key={t} className="rounded-md bg-ink-500/15 text-ink-600 dark:text-ink-300 px-2 py-0.5 font-medium">#{t}</span>)}
              </div>
            )}
          </div>

          <FieldRow label="Title" required>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="What needs to be done?"
              className="input"
              autoFocus
            />
          </FieldRow>

          <FieldRow label="Description">
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Add details, links, or notes..."
              rows={2}
              className="input resize-none"
            />
          </FieldRow>

          <div className="grid sm:grid-cols-2 gap-4">
            <FieldRow label="Due date">
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-400 pointer-events-none" />
                <input type="datetime-local" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className="input pl-10" />
              </div>
            </FieldRow>
            <FieldRow label="Estimated time (min)">
              <div className="relative">
                <Clock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-400 pointer-events-none" />
                <input type="number" min={5} step={5} value={estimatedMinutes} onChange={(e) => setEstimatedMinutes(e.target.value === '' ? '' : Number(e.target.value))} placeholder="30" className="input pl-10" />
              </div>
            </FieldRow>
          </div>

          <div className="grid sm:grid-cols-3 gap-4">
            <FieldRow label="Priority" icon={<Flag className="w-3.5 h-3.5" />}>
              <SegmentedControl
                value={priority}
                options={[{ v: 'high', l: 'High' }, { v: 'medium', l: 'Med' }, { v: 'low', l: 'Low' }]}
                onChange={(v) => setPriority(v as Priority)}
              />
            </FieldRow>
            <FieldRow label="Status">
              <SegmentedControl
                value={status}
                options={[{ v: 'todo', l: 'To do' }, { v: 'in_progress', l: 'Active' }, { v: 'completed', l: 'Done' }]}
                onChange={(v) => setStatus(v as TaskStatus)}
              />
            </FieldRow>
            <FieldRow label="Repeat" icon={<Repeat className="w-3.5 h-3.5" />}>
              <select value={recurrence} onChange={(e) => setRecurrence(e.target.value as Recurrence)} className="input">
                <option value="none">No repeat</option>
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
              </select>
            </FieldRow>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <FieldRow label="Category" icon={<Folder className="w-3.5 h-3.5" />}>
              <select value={category} onChange={(e) => setCategory(e.target.value)} className="input">
                <option value="">None</option>
                {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </FieldRow>
            <FieldRow label="Tags" icon={<Tag className="w-3.5 h-3.5" />}>
              <input value={tagsInput} onChange={(e) => setTagsInput(e.target.value)} placeholder="work, urgent (comma separated)" className="input" />
            </FieldRow>
          </div>

          {error && (
            <div className="rounded-xl bg-danger-500/10 border border-danger-500/30 px-4 py-2.5 text-sm text-danger-600 dark:text-danger-400 animate-fade-in">
              {error}
            </div>
          )}
        </div>

        <div className="sticky bottom-0 glass-strong px-6 py-4 border-t border-ink-200/60 dark:border-ink-700/40 flex items-center justify-between gap-3">
          {isEdit ? (
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="rounded-xl bg-danger-500/10 hover:bg-danger-500/20 text-danger-600 dark:text-danger-400 font-semibold text-sm px-4 py-2.5 flex items-center gap-1.5 transition disabled:opacity-50"
            >
              {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
              Delete
            </button>
          ) : (
            <span />
          )}
          <div className="flex gap-2.5">
            <button onClick={onClose} className="rounded-xl hover:bg-ink-500/10 text-ink-600 dark:text-ink-300 font-semibold text-sm px-4 py-2.5 transition">
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="rounded-xl bg-gradient-to-r from-brand-600 to-accent-500 hover:from-brand-500 hover:to-accent-400 text-white font-semibold text-sm px-5 py-2.5 shadow-glow flex items-center gap-1.5 transition disabled:opacity-60 active:scale-95"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
              {isEdit ? 'Save changes' : 'Create task'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function FieldRow({ label, required, icon, children }: { label: string; required?: boolean; icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="flex items-center gap-1.5 text-xs font-semibold text-ink-600 dark:text-ink-300 mb-1.5 uppercase tracking-wide">
        {icon}
        {label}{required && <span className="text-danger-500">*</span>}
      </span>
      {children}
    </label>
  );
}

function SegmentedControl<T extends string>({ value, options, onChange }: { value: T; options: { v: T; l: string }[]; onChange: (v: T) => void }) {
  return (
    <div className="flex rounded-xl bg-ink-500/8 dark:bg-ink-900/40 p-1 border border-ink-200 dark:border-ink-700">
      {options.map((o) => (
        <button
          key={o.v}
          type="button"
          onClick={() => onChange(o.v)}
          className={`flex-1 rounded-lg py-1.5 text-xs font-semibold transition ${value === o.v ? 'bg-white dark:bg-ink-700 text-ink-900 dark:text-white shadow-sm' : 'text-ink-500 dark:text-ink-400 hover:text-ink-700 dark:hover:text-ink-200'}`}
        >
          {o.l}
        </button>
      ))}
    </div>
  );
}

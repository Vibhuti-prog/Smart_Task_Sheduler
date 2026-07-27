import { useMemo } from 'react';
import type { Task } from '../types';
import { useTasks } from '../context/TasksContext';
import { BarChart, DonutChart, LineChart } from './Charts';
import { SkeletonStat, SkeletonChart } from './Skeletons';
import { generateInsights, rankTasks, workloadForecast } from '../lib/ai';
import { isToday, isOverdue, isUpcoming, relativeLabel, isSameDay, addDays } from '../lib/dates';
import { PriorityBadge, CategoryDot } from './Badges';
import {
  CheckCircle2, Clock, AlertTriangle, CalendarDays, TrendingUp, TrendingDown,
  Flame, Calendar, Zap, Sparkles, ArrowRight, Brain, Target,
} from 'lucide-react';

interface Props {
  onEditTask: (task: Task) => void;
  onGoToTasks: () => void;
}

export function Dashboard({ onEditTask, onGoToTasks }: Props) {
  const { tasks, loading } = useTasks();

  const stats = useMemo(() => {
    const today = tasks.filter((t) => isToday(t.due_date) && t.status !== 'completed');
    const overdue = tasks.filter((t) => isOverdue(t.due_date, t.status));
    const upcoming = tasks.filter((t) => isUpcoming(t.due_date));
    const completed = tasks.filter((t) => t.status === 'completed');
    const completionRate = tasks.length > 0 ? Math.round((completed.length / tasks.length) * 100) : 0;
    return { today, overdue, upcoming, completed, completionRate, total: tasks.length };
  }, [tasks]);

  const insights = useMemo(() => generateInsights(tasks), [tasks]);
  const ranked = useMemo(() => rankTasks(tasks).slice(0, 4), [tasks]);
  const forecast = useMemo(() => workloadForecast(tasks, 7), [tasks]);

  const priorityDist = useMemo(() => {
    const active = tasks.filter((t) => t.status !== 'completed');
    return [
      { label: 'High', value: active.filter((t) => t.priority === 'high').length, color: '#ef4444' },
      { label: 'Medium', value: active.filter((t) => t.priority === 'medium').length, color: '#f59e0b' },
      { label: 'Low', value: active.filter((t) => t.priority === 'low').length, color: '#22c55e' },
    ];
  }, [tasks]);

  const completionTrend = useMemo(() => {
    const days: { label: string; value: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = addDays(new Date(), -i);
      const count = tasks.filter((t) => t.completed_at && isSameDay(new Date(t.completed_at), d)).length;
      days.push({ label: d.toLocaleDateString(undefined, { weekday: 'short' }).slice(0, 2), value: count });
    }
    return days;
  }, [tasks]);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => <SkeletonStat key={i} />)}
        </div>
        <div className="grid lg:grid-cols-3 gap-4">
          <SkeletonChart />
          <SkeletonChart />
          <SkeletonChart />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <StatCard icon={<CalendarDays className="w-5 h-5" />} label="Today" value={stats.today.length} sub="tasks due today" tone="brand" delay={0} />
        <StatCard icon={<AlertTriangle className="w-5 h-5" />} label="Overdue" value={stats.overdue.length} sub="needs attention" tone="danger" delay={60} />
        <StatCard icon={<Clock className="w-5 h-5" />} label="Upcoming" value={stats.upcoming.length} sub="next 7 days" tone="accent" delay={120} />
        <StatCard icon={<CheckCircle2 className="w-5 h-5" />} label="Completed" value={stats.completed.length} sub={`${stats.completionRate}% rate`} tone="success" delay={180} />
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        {/* AI Priorities */}
        <Panel title="AI priority focus" icon={<Brain className="w-4 h-4" />} badge="Smart" className="lg:col-span-1">
          {ranked.length === 0 ? (
            <EmptyMini text="No active tasks to rank." />
          ) : (
            <div className="space-y-2.5">
              {ranked.map((r, i) => {
                const task = tasks.find((t) => t.id === r.taskId);
                if (!task) return null;
                return (
                  <button
                    key={r.taskId}
                    onClick={() => onEditTask(task)}
                    className="w-full text-left rounded-xl p-3 bg-white/50 dark:bg-ink-900/30 hover:bg-brand-500/8 border border-ink-200/60 dark:border-ink-700/40 transition group"
                  >
                    <div className="flex items-start gap-2.5">
                      <span className={`shrink-0 w-6 h-6 rounded-lg grid place-items-center text-xs font-bold ${i === 0 ? 'bg-danger-500/15 text-danger-600 dark:text-danger-400' : i === 1 ? 'bg-warning-500/15 text-warning-600 dark:text-warning-400' : 'bg-ink-500/12 text-ink-500'}`}>
                        {i + 1}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-ink-900 dark:text-white truncate group-hover:text-brand-700 dark:group-hover:text-brand-300 transition">{task.title}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <PriorityBadge priority={r.recommendedPriority} size="xs" />
                          <span className="text-[10px] text-ink-500 dark:text-ink-400">{relativeLabel(task.due_date)}</span>
                        </div>
                        <p className="text-[10px] text-ink-400 dark:text-ink-500 mt-1 italic">{r.reason}</p>
                      </div>
                      <div className="shrink-0 text-right">
                        <div className="text-sm font-bold text-brand-600 dark:text-brand-400">{r.score}</div>
                        <div className="text-[9px] text-ink-400 uppercase">score</div>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </Panel>

        {/* Workload forecast */}
        <Panel title="7-day workload" icon={<TrendingUp className="w-4 h-4" />} className="lg:col-span-2">
          <BarChart
            data={forecast.map((d) => ({
              label: d.date.toLocaleDateString(undefined, { weekday: 'short' }).slice(0, 2),
              value: d.count,
              accent: isSameDay(d.date, new Date()),
            }))}
            unit=""
          />
          <div className="grid grid-cols-3 gap-3 mt-4 pt-4 border-t border-ink-200/50 dark:border-ink-700/40">
            <MiniStat label="Busiest day" value={(() => { const m = forecast.reduce((a, b) => (b.count > a.count ? b : a), forecast[0]); return m ? m.date.toLocaleDateString(undefined, { weekday: 'short' }) : '—'; })()} />
            <MiniStat label="Tasks this week" value={String(forecast.reduce((s, d) => s + d.count, 0))} />
            <MiniStat label="Est. hours" value={String(Math.round(forecast.reduce((s, d) => s + d.estimatedMinutes, 0) / 60))} />
          </div>
        </Panel>
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        {/* Insights */}
        <Panel title="Productivity insights" icon={<Sparkles className="w-4 h-4" />} badge="AI" className="lg:col-span-1">
          <div className="space-y-2.5">
            {insights.map((ins) => (
              <InsightCard key={ins.id} insight={ins} />
            ))}
          </div>
        </Panel>

        {/* Completion trend */}
        <Panel title="Completion trend" icon={<TrendingUp className="w-4 h-4" />} className="lg:col-span-1">
          <LineChart data={completionTrend} />
          <p className="text-xs text-ink-500 dark:text-ink-400 mt-3 pt-3 border-t border-ink-200/50 dark:border-ink-700/40">
            {completionTrend.reduce((s, d) => s + d.value, 0)} tasks completed in the last 7 days.
          </p>
        </Panel>

        {/* Priority distribution */}
        <Panel title="Priority mix" icon={<Target className="w-4 h-4" />} className="lg:col-span-1">
          <DonutChart data={priorityDist} />
        </Panel>
      </div>

      {/* Today's tasks quick list */}
      <Panel title="Today's tasks" icon={<CalendarDays className="w-4 h-4" />} action={<button onClick={onGoToTasks} className="text-xs font-semibold text-brand-600 dark:text-brand-400 hover:underline flex items-center gap-1">View all <ArrowRight className="w-3.5 h-3.5" /></button>}>
        {stats.today.length === 0 ? (
          <EmptyMini text="Nothing due today. Enjoy the breathing room!" />
        ) : (
          <div className="grid sm:grid-cols-2 gap-2.5">
            {stats.today.map((t) => (
              <button key={t.id} onClick={() => onEditTask(t)} className="text-left rounded-xl p-3 bg-white/50 dark:bg-ink-900/30 hover:bg-brand-500/8 border border-ink-200/60 dark:border-ink-700/40 transition flex items-center gap-3">
                <span className={`w-1 h-10 rounded-full ${t.priority === 'high' ? 'bg-danger-500' : t.priority === 'medium' ? 'bg-warning-500' : 'bg-success-500'}`} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-ink-900 dark:text-white truncate">{t.title}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <PriorityBadge priority={t.priority} size="xs" />
                    <CategoryDot category={t.category} />
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </Panel>
    </div>
  );
}

function StatCard({ icon, label, value, sub, tone, delay }: { icon: React.ReactNode; label: string; value: number; sub: string; tone: 'brand' | 'danger' | 'accent' | 'success'; delay: number }) {
  const tones = {
    brand: 'from-brand-500/15 to-brand-500/5 text-brand-600 dark:text-brand-400',
    danger: 'from-danger-500/15 to-danger-500/5 text-danger-600 dark:text-danger-400',
    accent: 'from-accent-500/15 to-accent-500/5 text-accent-600 dark:text-accent-400',
    success: 'from-success-500/15 to-success-500/5 text-success-600 dark:text-success-400',
  };
  return (
    <div className="rounded-2xl glass-panel p-4 sm:p-5 animate-slide-up" style={{ animationDelay: `${delay}ms` }}>
      <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${tones[tone]} grid place-items-center mb-3`}>
        {icon}
      </div>
      <div className="flex items-baseline gap-1.5">
        <span className="font-display text-3xl font-bold text-ink-900 dark:text-white tabular-nums">{value}</span>
      </div>
      <p className="text-sm font-semibold text-ink-700 dark:text-ink-200 mt-0.5">{label}</p>
      <p className="text-xs text-ink-500 dark:text-ink-400">{sub}</p>
    </div>
  );
}

function Panel({ title, icon, badge, action, children, className = '' }: { title: string; icon: React.ReactNode; badge?: string; action?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-2xl glass-panel p-5 animate-fade-in ${className}`}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <span className="text-brand-600 dark:text-brand-400">{icon}</span>
          <h3 className="font-display font-bold text-sm text-ink-900 dark:text-white">{title}</h3>
          {badge && <span className="rounded-full bg-gradient-to-r from-brand-500/20 to-accent-500/20 text-brand-700 dark:text-brand-300 text-[10px] font-bold px-2 py-0.5 uppercase tracking-wide">{badge}</span>}
        </div>
        {action}
      </div>
      {children}
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="font-display text-lg font-bold text-ink-900 dark:text-white">{value}</p>
      <p className="text-[11px] text-ink-500 dark:text-ink-400">{label}</p>
    </div>
  );
}

function InsightCard({ insight }: { insight: { icon: string; title: string; body: string; tone: 'good' | 'warn' | 'info' } }) {
  const tones = {
    good: 'bg-success-500/10 border-success-500/25 text-success-600 dark:text-success-400',
    warn: 'bg-danger-500/10 border-danger-500/25 text-danger-600 dark:text-danger-400',
    info: 'bg-brand-500/10 border-brand-500/25 text-brand-600 dark:text-brand-400',
  };
  const icons: Record<string, React.ReactNode> = {
    alert: <AlertTriangle className="w-4 h-4" />,
    'trending-up': <TrendingUp className="w-4 h-4" />,
    'trending-down': <TrendingDown className="w-4 h-4" />,
    calendar: <Calendar className="w-4 h-4" />,
    flame: <Flame className="w-4 h-4" />,
    clock: <Clock className="w-4 h-4" />,
    check: <CheckCircle2 className="w-4 h-4" />,
    zap: <Zap className="w-4 h-4" />,
  };
  return (
    <div className={`rounded-xl border p-3 ${tones[insight.tone]}`}>
      <div className="flex items-center gap-2 mb-1">
        {icons[insight.icon] ?? <Sparkles className="w-4 h-4" />}
        <p className="font-semibold text-xs">{insight.title}</p>
      </div>
      <p className="text-[11px] text-ink-600 dark:text-ink-300 leading-relaxed">{insight.body}</p>
    </div>
  );
}

function EmptyMini({ text }: { text: string }) {
  return <p className="text-sm text-ink-400 dark:text-ink-500 text-center py-6">{text}</p>;
}

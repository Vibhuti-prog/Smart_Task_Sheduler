import type { Task, Priority } from '../types';
import { daysUntil, isOverdue } from './dates';

// AI engine — fully client-side heuristics that power smart prioritization,
// workload analysis, and productivity insights. No external API required.

export interface AIScore {
  taskId: string;
  score: number; // 0..100, higher = more urgent
  reason: string;
  recommendedPriority: Priority;
}

const PRIORITY_WEIGHT: Record<Priority, number> = { high: 30, medium: 18, low: 8 };

export function computePriorityScore(task: Task): AIScore {
  let score = 0;
  const reasons: string[] = [];

  const d = daysUntil(task.due_date);
  if (isOverdue(task.due_date, task.status)) {
    score += 45;
    reasons.push('overdue');
  } else if (d !== null) {
    if (d <= 1) {
      score += 40;
      reasons.push(d <= 0 ? 'due today' : 'due tomorrow');
    } else if (d <= 3) {
      score += 28;
      reasons.push('due in a few days');
    } else if (d <= 7) {
      score += 16;
      reasons.push('due this week');
    } else {
      score += 6;
    }
  }

  score += PRIORITY_WEIGHT[task.priority];
  if (task.priority === 'high') reasons.push('marked high priority');

  if (task.status === 'in_progress') {
    score += 8;
    reasons.push('already in progress');
  }

  if (task.estimated_minutes && task.estimated_minutes > 120) {
    score += 6;
    reasons.push('long task — start early');
  }

  score = Math.min(100, Math.max(0, score));

  let recommendedPriority: Priority = 'medium';
  if (score >= 55) recommendedPriority = 'high';
  else if (score >= 30) recommendedPriority = 'medium';
  else recommendedPriority = 'low';

  return {
    taskId: task.id,
    score,
    reason: reasons.join(', ') || 'low urgency',
    recommendedPriority,
  };
}

export function rankTasks(tasks: Task[]): AIScore[] {
  return tasks
    .filter((t) => t.status !== 'completed')
    .map(computePriorityScore)
    .sort((a, b) => b.score - a.score);
}

export interface WorkloadDay {
  date: Date;
  count: number;
  estimatedMinutes: number;
}

export function workloadForecast(tasks: Task[], days = 7): WorkloadDay[] {
  const result: WorkloadDay[] = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  for (let i = 0; i < days; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() + i);
    const dayTasks = tasks.filter((t) => {
      if (!t.due_date || t.status === 'completed') return false;
      const due = new Date(t.due_date);
      return (
        due.getFullYear() === d.getFullYear() &&
        due.getMonth() === d.getMonth() &&
        due.getDate() === d.getDate()
      );
    });
    result.push({
      date: d,
      count: dayTasks.length,
      estimatedMinutes: dayTasks.reduce((s, t) => s + (t.estimated_minutes ?? 30), 0),
    });
  }
  return result;
}

export interface ProductivityInsight {
  id: string;
  icon: string;
  title: string;
  body: string;
  tone: 'good' | 'warn' | 'info';
}

export function generateInsights(tasks: Task[]): ProductivityInsight[] {
  const insights: ProductivityInsight[] = [];
  const active = tasks.filter((t) => t.status !== 'completed');
  const completed = tasks.filter((t) => t.status === 'completed');
  const overdue = tasks.filter((t) => isOverdue(t.due_date, t.status));

  const completionRate = tasks.length > 0 ? completed.length / tasks.length : 0;

  if (overdue.length > 0) {
    insights.push({
      id: 'overdue',
      icon: 'alert',
      title: `${overdue.length} overdue task${overdue.length > 1 ? 's' : ''}`,
      body: 'Reschedule or complete these to reduce stress. Overdue tasks often block your other work.',
      tone: 'warn',
    });
  }

  if (completionRate >= 0.7 && tasks.length > 3) {
    insights.push({
      id: 'streak',
      icon: 'trending-up',
      title: 'Strong completion rate',
      body: `You've completed ${Math.round(completionRate * 100)}% of your tasks. Keep up the momentum!`,
      tone: 'good',
    });
  } else if (completionRate < 0.3 && tasks.length > 3) {
    insights.push({
      id: 'low-rate',
      icon: 'trending-down',
      title: 'Completion rate is low',
      body: 'Try breaking large tasks into smaller steps, or move low-priority items to another day.',
      tone: 'warn',
    });
  }

  const forecast = workloadForecast(tasks, 7);
  const heavy = forecast.filter((d) => d.count >= 4);
  if (heavy.length > 0) {
    const day = heavy[0];
    insights.push({
      id: 'heavy-day',
      icon: 'calendar',
      title: `Heavy load on ${day.date.toLocaleDateString(undefined, { weekday: 'long' })}`,
      body: `${day.count} tasks due that day. Consider rescheduling a couple to lighter days for balance.`,
      tone: 'info',
    });
  }

  const highOpen = active.filter((t) => t.priority === 'high');
  if (highOpen.length > 3) {
    insights.push({
      id: 'high-count',
      icon: 'flame',
      title: `${highOpen.length} high-priority tasks open`,
      body: 'Too many high-priority items dilutes focus. Tackle the top 1–2 first, then re-scope the rest.',
      tone: 'warn',
    });
  }

  const noDue = active.filter((t) => !t.due_date);
  if (noDue.length > active.length * 0.5 && active.length > 2) {
    insights.push({
      id: 'no-due',
      icon: 'clock',
      title: 'Many tasks have no due date',
      body: 'Tasks without deadlines tend to slip. Add due dates so the scheduler can prioritize them.',
      tone: 'info',
    });
  }

  if (insights.length === 0) {
    insights.push({
      id: 'all-good',
      icon: 'check',
      title: 'You are on track',
      body: 'No pressing issues detected. Your workload is balanced and deadlines are under control.',
      tone: 'good',
    });
  }

  return insights.slice(0, 4);
}

export function estimateMinutes(title: string, description: string | null): number {
  const text = `${title} ${description ?? ''}`.toLowerCase();
  let base = 30;
  if (/meeting|call|standup/.test(text)) base = 30;
  if (/write|draft|essay|report|document/.test(text)) base = 90;
  if (/review|read/.test(text)) base = 45;
  if (/design|build|implement|develop|create/.test(text)) base = 120;
  if (/quick|short|brief|small/.test(text)) base = 15;
  if (/long|big|major|comprehensive/.test(text)) base = 180;
  return base;
}

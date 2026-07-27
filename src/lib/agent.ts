import { supabase } from './supabase';
import type { Task, AgentResponse, AgentMessage, AgentPreferences, AgentAction } from '../types';

const FUNCTION_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-agent`;

function getAuthHeaders(): Record<string, string> {
  const token = (supabase as any).auth?.session?.()?.access_token;
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
    ...(token ? { 'x-agent-token': token } : {}),
  };
}

export interface AgentContext {
  tasks: Task[];
  memory: AgentMessage[];
  preferences: AgentPreferences | null;
}

// Call the edge function with the user message, task list, memory, and prefs.
export async function askAgent(message: string, ctx: AgentContext): Promise<AgentResponse> {
  const res = await fetch(FUNCTION_URL, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({
      message,
      tasks: ctx.tasks.map(toDTO),
      memory: ctx.memory.slice(-12).map((m) => ({ role: m.role, content: m.content, created_at: m.created_at })),
      preferences: ctx.preferences,
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Agent request failed (${res.status})${text ? `: ${text}` : ''}`);
  }

  const data = await res.json();
  if (!data || typeof data.reply !== 'string') {
    throw new Error('Agent returned an unexpected response.');
  }
  return {
    reply: data.reply,
    reasoning: Array.isArray(data.reasoning) ? data.reasoning : [],
    actions: Array.isArray(data.actions) ? data.actions : [],
    mode: data.mode === 'openai' ? 'openai' : 'heuristic',
  };
}

function toDTO(t: Task) {
  return {
    id: t.id,
    title: t.title,
    description: t.description,
    status: t.status,
    priority: t.priority,
    category: t.category,
    tags: t.tags,
    due_date: t.due_date,
    completed_at: t.completed_at,
    estimated_minutes: t.estimated_minutes,
    recurrence: t.recurrence,
    created_at: t.created_at,
    updated_at: t.updated_at,
  };
}

// ---- Memory persistence ----

export async function loadMemory(): Promise<AgentMessage[]> {
  const { data, error } = await supabase
    .from('agent_memory')
    .select('id, role, content, metadata, created_at')
    .order('created_at', { ascending: true })
    .limit(50);
  if (error) return [];
  return (data ?? []).map((r) => ({
    id: r.id,
    role: r.role,
    content: r.content,
    reasoning: r.metadata?.reasoning,
    actions: r.metadata?.actions,
    mode: r.metadata?.mode,
    created_at: r.created_at,
  }));
}

export async function saveMemory(role: 'user' | 'assistant', content: string, meta?: Partial<AgentResponse>): Promise<void> {
  await supabase.from('agent_memory').insert({
    role,
    content,
    metadata: meta ? { reasoning: meta.reasoning, actions: meta.actions, mode: meta.mode } : null,
  });
}

export async function clearMemory(): Promise<void> {
  await supabase.from('agent_memory').delete().neq('id', '00000000-0000-0000-0000-000000000000');
}

// ---- Preferences ----

export async function loadPreferences(): Promise<AgentPreferences | null> {
  const { data, error } = await supabase.from('agent_preferences').select('*').maybeSingle();
  if (error || !data) return null;
  return data as AgentPreferences;
}

export async function savePreferences(prefs: Partial<AgentPreferences>): Promise<void> {
  await supabase.from('agent_preferences').upsert(prefs);
}

// ---- Action execution ----

export interface ActionResult {
  action: AgentAction;
  ok: boolean;
  message: string;
}

export async function executeAction(action: AgentAction): Promise<ActionResult> {
  try {
    switch (action.type) {
      case 'create_task': {
        const payload: Record<string, unknown> = {
          title: action.title ?? 'Untitled task',
          status: 'todo',
          priority: action.priority ?? 'medium',
          category: action.category ?? null,
          tags: action.tags ?? [],
          due_date: action.dueDate ?? null,
          estimated_minutes: action.estimatedMinutes ?? null,
          recurrence: 'none',
        };
        const { error } = await supabase.from('tasks').insert(payload);
        if (error) throw error;
        return { action, ok: true, message: `Created "${action.title}"` };
      }
      case 'reschedule_task': {
        if (!action.taskId || !action.dueDate) throw new Error('Missing taskId or dueDate');
        const { error } = await supabase.from('tasks').update({ due_date: action.dueDate }).eq('id', action.taskId);
        if (error) throw error;
        return { action, ok: true, message: 'Rescheduled' };
      }
      case 'update_priority': {
        if (!action.taskId || !action.priority) throw new Error('Missing taskId or priority');
        const { error } = await supabase.from('tasks').update({ priority: action.priority }).eq('id', action.taskId);
        if (error) throw error;
        return { action, ok: true, message: `Priority set to ${action.priority}` };
      }
      case 'complete_task': {
        if (!action.taskId) throw new Error('Missing taskId');
        const { error } = await supabase
          .from('tasks')
          .update({ status: 'completed', completed_at: new Date().toISOString() })
          .eq('id', action.taskId);
        if (error) throw error;
        return { action, ok: true, message: 'Marked complete' };
      }
      case 'create_subtasks': {
        if (!action.taskId || !action.subtasks?.length) throw new Error('Missing subtasks');
        const { data: parent } = await supabase.from('tasks').select('*').eq('id', action.taskId).maybeSingle();
        if (!parent) throw new Error('Parent task not found');
        const rows = action.subtasks.map((title, i) => ({
          title,
          status: 'todo',
          priority: parent.priority,
          category: parent.category,
          tags: parent.tags,
          due_date: parent.due_date,
          estimated_minutes: 30,
          recurrence: 'none',
          sort_order: i,
        }));
        const { error } = await supabase.from('tasks').insert(rows);
        if (error) throw error;
        return { action, ok: true, message: `Created ${rows.length} subtasks` };
      }
      case 'set_preferences': {
        const patch: Partial<AgentPreferences> = {};
        if (action.workHoursStart) patch.work_hours_start = action.workHoursStart;
        if (action.workHoursEnd) patch.work_hours_end = action.workHoursEnd;
        if (action.breakPreference) patch.break_preference = action.breakPreference;
        if (action.focusStyle) patch.focus_style = action.focusStyle;
        await savePreferences(patch);
        return { action, ok: true, message: 'Preferences saved' };
      }
      default:
        return { action, ok: false, message: `Unknown action: ${action.type}` };
    }
  } catch (e) {
    return { action, ok: false, message: e instanceof Error ? e.message : 'Action failed' };
  }
}

export async function executeActions(actions: AgentAction[]): Promise<ActionResult[]> {
  const results: ActionResult[] = [];
  for (const a of actions) {
    results.push(await executeAction(a));
  }
  return results;
}

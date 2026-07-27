import { createClient } from 'npm:@supabase/supabase-js@2.57.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

interface TaskDTO {
  id: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  category: string | null;
  tags: string[];
  due_date: string | null;
  completed_at: string | null;
  estimated_minutes: number | null;
  recurrence: string;
  created_at: string;
  updated_at: string;
}

interface MemoryDTO {
  role: 'user' | 'assistant';
  content: string;
  created_at: string;
}

interface PreferencesDTO {
  work_hours_start: string;
  work_hours_end: string;
  break_preference: 'frequent' | 'balanced' | 'minimal';
  focus_style: 'morning' | 'afternoon' | 'evening' | 'flexible';
  notes: string | null;
}

interface AgentRequest {
  message: string;
  tasks: TaskDTO[];
  memory: MemoryDTO[];
  preferences: PreferencesDTO | null;
}

interface AgentAction {
  type: string;
  taskId?: string;
  title?: string;
  dueDate?: string;
  priority?: string;
  subtasks?: string[];
  category?: string;
  tags?: string[];
  estimatedMinutes?: number;
  workHoursStart?: string;
  workHoursEnd?: string;
  breakPreference?: string;
  focusStyle?: string;
}

interface AgentResult {
  reply: string;
  reasoning: string[];
  actions: AgentAction[];
  mode: 'openai' | 'heuristic';
}

const OPENAI_KEY = Deno.env.get('OPENAI_API_KEY') ?? '';

// ---------------------------------------------------------------------------
// Date helpers (Deno-side)
// ---------------------------------------------------------------------------
function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}
function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}
function daysUntil(iso: string | null): number | null {
  if (!iso) return null;
  const due = startOfDay(new Date(iso));
  const today = startOfDay(new Date());
  return Math.round((due.getTime() - today.getTime()) / 86400000);
}
function isOverdue(t: TaskDTO): boolean {
  if (!t.due_date || t.status === 'completed') return false;
  return new Date(t.due_date).getTime() < startOfDay(new Date()).getTime();
}
function relativeLabel(iso: string | null): string {
  if (!iso) return 'no due date';
  const d = daysUntil(iso);
  if (d === null) return 'no due date';
  if (d === 0) return 'today';
  if (d === 1) return 'tomorrow';
  if (d === -1) return 'yesterday';
  if (d > 1 && d < 7) return `in ${d} days`;
  if (d < 0 && d > -7) return `${Math.abs(d)} days ago`;
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}
function nextWeekdayTime(target: number, hour: number): Date {
  const now = new Date();
  const d = new Date(now);
  const cur = d.getDay();
  let diff = (target - cur + 7) % 7;
  if (diff === 0) diff = 7;
  d.setDate(d.getDate() + diff);
  d.setHours(hour, 0, 0, 0);
  return d;
}
function isoFromInput(value: string): string {
  return new Date(value).toISOString();
}

// ---------------------------------------------------------------------------
// OpenAI path
// ---------------------------------------------------------------------------
async function callOpenAI(req: AgentRequest): Promise<AgentResult> {
  const systemPrompt = `You are Flowboard's autonomous AI Productivity Agent. You help users plan, prioritize, and manage tasks.

You ALWAYS respond with valid JSON only (no markdown fences) in this exact shape:
{"reply": string, "reasoning": string[], "actions": AgentAction[]}

Rules:
- "reasoning" is an array of 2-6 short steps showing your multi-step thinking BEFORE the final plan. Each step is one sentence.
- "reply" is the natural-language answer shown to the user. Reference specific task titles.
- "actions" is an array of concrete actions the app will execute. Use these types:
  - {type:"create_task", title, dueDate (ISO), priority ("high"|"medium"|"low"), category, tags:[], estimatedMinutes}
  - {type:"create_subtasks", taskId, subtasks:[title,...]} — break a large task into steps
  - {type:"reschedule_task", taskId, dueDate (ISO)}
  - {type:"update_priority", taskId, priority}
  - {type:"complete_task", taskId}
  - {type:"set_preferences", workHoursStart, workHoursEnd, breakPreference, focusStyle}
- For "what should I work on now" / "most important today": recommend the top task and explain WHY (deadline, priority, dependencies).
- For "am I on track this week": summarize completion vs. upcoming due dates.
- Break large goals into subtasks when asked to plan.
- Detect overdue tasks and reschedule them to the next available lighter day.
- Suggest break times based on workload (use the user's break_preference).
- Generate end-of-day and weekly reports when asked.
- Use the conversation memory to recall prior preferences and recommendations.
- Never invent taskIds — only reference tasks from the provided list. To create new tasks, use create_task.
- Keep replies concise, warm, and actionable.`;

  const tasksSummary = req.tasks
    .slice(0, 50)
    .map((t) => ({
      id: t.id,
      title: t.title,
      status: t.status,
      priority: t.priority,
      due: t.due_date,
      relative: relativeLabel(t.due_date),
      category: t.category,
      est: t.estimated_minutes,
    }));

  const memorySummary = req.memory
    .slice(-12)
    .map((m) => `${m.role}: ${m.content.slice(0, 280)}`);

  const prefsText = req.preferences
    ? `Work hours ${req.preferences.work_hours_start}-${req.preferences.work_hours_end}, break style ${req.preferences.break_preference}, focus ${req.preferences.focus_style}, notes: ${req.preferences.notes ?? 'none'}`
    : 'No preferences set yet.';

  const userContent = `User message: "${req.message}"

Current tasks (${tasksSummary.length}):
${JSON.stringify(tasksSummary, null, 0)}

Recent conversation memory:
${memorySummary.length ? memorySummary.join('\n') : '(none)'}

User preferences: ${prefsText}

Respond with JSON only.`;

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${OPENAI_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userContent },
      ],
      temperature: 0.4,
      response_format: { type: 'json_object' },
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`OpenAI error ${res.status}: ${errText}`);
  }

  const data = await res.json();
  const raw = data.choices?.[0]?.message?.content ?? '{}';
  let parsed: AgentResult;
  try {
    parsed = JSON.parse(raw);
  } catch {
    parsed = { reply: raw, reasoning: [], actions: [], mode: 'openai' };
  }
  parsed.mode = 'openai';
  parsed.reasoning = Array.isArray(parsed.reasoning) ? parsed.reasoning : [];
  parsed.actions = Array.isArray(parsed.actions) ? parsed.actions : [];
  return parsed;
}

// ---------------------------------------------------------------------------
// Heuristic engine (fallback when no OpenAI key)
// ---------------------------------------------------------------------------
const PRIORITY_RANK: Record<string, number> = { high: 0, medium: 1, low: 2 };

function scoreTask(t: TaskDTO): { score: number; reasons: string[] } {
  let score = 0;
  const reasons: string[] = [];
  if (t.status === 'completed') return { score: -1, reasons: ['completed'] };
  const d = daysUntil(t.due_date);
  if (isOverdue(t)) {
    score += 50;
    reasons.push('overdue');
  } else if (d !== null) {
    if (d <= 0) { score += 45; reasons.push('due today'); }
    else if (d <= 1) { score += 40; reasons.push('due tomorrow'); }
    else if (d <= 3) { score += 26; reasons.push('due in a few days'); }
    else if (d <= 7) { score += 14; reasons.push('due this week'); }
    else score += 5;
  }
  if (t.priority === 'high') { score += 30; reasons.push('high priority'); }
  else if (t.priority === 'medium') { score += 18; reasons.push('medium priority'); }
  else score += 8;
  if (t.status === 'in_progress') { score += 10; reasons.push('already in progress'); }
  if (t.estimated_minutes && t.estimated_minutes > 120) { score += 6; reasons.push('long task'); }
  return { score, reasons };
}

function rankActive(tasks: TaskDTO[]): { task: TaskDTO; score: number; reasons: string[] }[] {
  return tasks
    .map((t) => ({ task: t, ...scoreTask(t) }))
    .filter((x) => x.score >= 0)
    .sort((a, b) => b.score - a.score);
}

function workloadByDay(tasks: TaskDTO[], days: number): { date: Date; minutes: number; count: number }[] {
  const out: { date: Date; minutes: number; count: number }[] = [];
  const today = startOfDay(new Date());
  for (let i = 0; i < days; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() + i);
    const dayTasks = tasks.filter((t) => {
      if (!t.due_date || t.status === 'completed') return false;
      const due = new Date(t.due_date);
      return due.getFullYear() === d.getFullYear() && due.getMonth() === d.getMonth() && due.getDate() === d.getDate();
    });
    out.push({ date: d, minutes: dayTasks.reduce((s, t) => s + (t.estimated_minutes ?? 30), 0), count: dayTasks.length });
  }
  return out;
}

function findLightestDay(tasks: TaskDTO[], fromOffset = 1, days = 14): Date {
  const wl = workloadByDay(tasks, days).slice(fromOffset);
  let best = wl[0];
  for (const d of wl) {
    if (d.minutes < best.minutes) best = d;
  }
  return best.date;
}

function defaultDueFromPref(pref: PreferencesDTO | null, offsetDays = 1): Date {
  const d = addDays(new Date(), offsetDays);
  const start = pref?.work_hours_start ?? '09:00';
  const [h, m] = start.split(':').map(Number);
  d.setHours(h, m, 0, 0);
  return d;
}

function detectIntent(msg: string): string {
  const m = msg.toLowerCase();
  if (/what.*(work on|do).*(now|next|today)|most important|focus on|priorit/.test(m)) return 'what_now';
  if (/on track|ahead|behind|this week|weekly status/.test(m)) return 'on_track';
  if (/plan.*(my )?(day|today|week|schedule)/.test(m)) return 'plan';
  if (/break|rest|overworked|tired|burnout/.test(m)) return 'breaks';
  if (/overdue|behind schedule|reschedule|catch up/.test(m)) return 'overdue';
  if (/report|summary|recap|wrap.?up|end.of.day|weekly report/.test(m)) return 'report';
  if (/break.*(down|into)|split|sub.?task|steps for|decompose/.test(m)) return 'breakdown';
  if (/productiv|pattern|habit|when.*best|analyz/.test(m)) return 'patterns';
  if (/prefer|like to|i (work|focus)|morning|evening/.test(m)) return 'preferences';
  if (/create|add|remind me|schedule|plan.*to/.test(m)) return 'create';
  return 'general';
}

function heuristicAgent(req: AgentRequest): AgentResult {
  const msg = req.message;
  const tasks = req.tasks;
  const intent = detectIntent(msg);
  const ranked = rankActive(tasks);
  const reasoning: string[] = [];
  const actions: AgentAction[] = [];
  let reply = '';

  reasoning.push(`Classified the request as "${intent}".`);
  reasoning.push(`Loaded ${tasks.length} tasks (${ranked.filter((r) => r.score >= 0).length} active, ${tasks.filter((t) => t.status === 'completed').length} completed).`);

  if (intent === 'what_now') {
    if (ranked.length === 0) {
      reply = "You're all caught up — there are no active tasks right now. This is a great moment to plan ahead or take a proper break. Want me to help set up your week?";
      reasoning.push('No active tasks found — recommending a rest/planning moment.');
    } else {
      const top = ranked[0];
      reply = `Work on **"${top.task.title}"** next. `;
      reply += `Here's why: ${top.reasons.join(', ')}. `;
      if (top.task.status === 'in_progress') reply += `It's already in progress, so picking it back up keeps your momentum. `;
      if (top.reasons.includes('overdue')) reply += `Since it's overdue, clearing it first removes a mental weight and unblocks the rest of your day. `;
      const second = ranked[1];
      if (second) reply += `After that, move to "${second.task.title}".`;
      reasoning.push(`Top candidate "${top.task.title}" scored ${top.score} (${top.reasons.join(', ')}).`);
      if (second) reasoning.push(`Second is "${second.task.title}" at score ${second.score}.`);
      reasoning.push('Recommended the highest-scored task and explained each contributing factor.');
    }
  } else if (intent === 'on_track') {
    const active = ranked.filter((r) => r.score >= 0);
    const completed = tasks.filter((t) => t.status === 'completed');
    const dueThisWeek = active.filter((r) => {
      const d = daysUntil(r.task.due_date);
      return d !== null && d <= 7;
    });
    const overdue = active.filter((r) => isOverdue(r.task));
    const total = tasks.length;
    const rate = total > 0 ? Math.round((completed.length / total) * 100) : 0;
    reply = overdue.length > 0
      ? `You're a bit behind: ${overdue.length} overdue task${overdue.length > 1 ? 's' : ''} and ${dueThisWeek.length} due this week. Completion rate is ${rate}%. Let's clear the overdue items first — say "reschedule overdue" and I'll rebalance them.`
      : dueThisWeek.length > 4
        ? `You have ${dueThisWeek.length} tasks due this week. That's a full plate but manageable — completion rate is ${rate}%. I'd suggest tackling the top 2 high-priority items today and spreading the rest.`
        : `You're on track. ${completed.length} done, ${active.length} active, ${dueThisWeek.length} due this week, ${rate}% completion rate. Steady progress — keep the rhythm.`;
    reasoning.push(`Analyzed ${completed.length} completed vs ${active.length} active.`);
    reasoning.push(`${overdue.length} overdue, ${dueThisWeek.length} due within 7 days.`);
    reasoning.push(`Computed completion rate ${rate}% and assessed weekly feasibility.`);
  } else if (intent === 'plan') {
    const dayPlan = msg.toLowerCase().includes('week');
    const horizon = dayPlan ? 7 : 1;
    const wl = workloadByDay(tasks, horizon + 2);
    reasoning.push(`Planning a ${dayPlan ? 'weekly' : 'daily'} schedule across ${horizon} day${dayPlan ? 's' : ''}.`);
    const slot = ranked.slice(0, dayPlan ? 7 : 3);
    if (slot.length === 0) {
      reply = "There's nothing active to schedule. Add a task (or describe a goal) and I'll plan it out for you.";
    } else {
      reply = dayPlan ? "Here's your proposed week:\n" : "Here's your plan for today:\n";
      const items = slot.map((r, i) => {
        const day = dayPlan ? ` — ${r.task.due_date ? relativeLabel(r.task.due_date) : 'unscheduled'}` : '';
        return `${i + 1}. ${r.task.title}${day} (${r.task.priority} priority)`;
      });
      reply += items.join('\n');
      reply += dayPlan
        ? "\n\nI sequenced these by urgency score so the most time-sensitive work lands earlier in the week."
        : "\n\nTackle them in this order — each was chosen because it has the nearest deadline or highest priority.";
      reasoning.push(`Ranked ${slot.length} active tasks and sequenced by score.`);
      reasoning.push('Mapped scores onto the requested time horizon.');
    }
  } else if (intent === 'breaks') {
    const wl = workloadByDay(tasks, 7);
    const totalMin = wl.reduce((s, d) => s + d.minutes, 0);
    const pref = req.preferences?.break_preference ?? 'balanced';
    const interval = pref === 'frequent' ? 45 : pref === 'minimal' ? 120 : 90;
    reasoning.push(`Summed weekly workload: ${totalMin} minutes across 7 days.`);
    reasoning.push(`Applied break preference "${pref}" → suggest a break every ${interval} min.`);
    const heavy = wl.filter((d) => d.minutes > 360);
    if (heavy.length > 0) {
      reply = `Your workload is heavy this week (${Math.round(totalMin / 60)}h estimated). With your "${pref}" break preference, I recommend a ${interval}-minute focus block followed by a 10–15 min break. ${heavy.length} day${heavy.length > 1 ? 's' : ''} exceed 6 hours of work — consider moving a task or two to lighter days. Want me to rebalance?`;
    } else {
      reply = `Your workload looks balanced (~${Math.round(totalMin / 60)}h this week). With your "${pref}" break preference, aim for ${interval}-minute focus blocks with 10-minute breaks. Your body will thank you — sustained focus drops sharply after 90 minutes without a break.`;
    }
  } else if (intent === 'overdue') {
    const overdue = tasks.filter((t) => isOverdue(t));
    if (overdue.length === 0) {
      reply = "Great news — you have no overdue tasks. Everything is on schedule.";
      reasoning.push('No overdue tasks detected.');
    } else {
      reasoning.push(`Found ${overdue.length} overdue task(s).`);
      const rescheduled: string[] = [];
      for (const t of overdue.slice(0, 6)) {
        const light = findLightestDay(tasks, 1, 14);
        const [h, m] = (req.preferences?.work_hours_start ?? '09:00').split(':').map(Number);
        light.setHours(h + 2, m, 0, 0);
        actions.push({ type: 'reschedule_task', taskId: t.id, dueDate: light.toISOString() });
        rescheduled.push(`"${t.title}" → ${light.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}`);
        reasoning.push(`Rescheduling "${t.title}" to the lightest day (${relativeLabel(light.toISOString())}).`);
      }
      reply = `I found ${overdue.length} overdue task${overdue.length > 1 ? 's' : ''} and rescheduled each to your lightest upcoming day${overdue.length > 1 ? 's' : ''}:\n${rescheduled.join('\n')}\n\nThis spreads the load so you're not cramming. You can adjust any of these after.`;
    }
  } else if (intent === 'breakdown') {
    const target = ranked.find((r) => r.task.title.toLowerCase().split(' ').some((w) => msg.toLowerCase().includes(w)))?.task ?? ranked[0]?.task;
    if (!target) {
      reply = "Which task would you like me to break down? Describe it or mention its title and I'll split it into steps.";
      reasoning.push('No matching active task found to break down.');
    } else {
      const subs = generateSubtasks(target.title, target.description);
      actions.push({ type: 'create_subtasks', taskId: target.id, subtasks: subs });
      reply = `I broke "${target.title}" into ${subs.length} smaller steps:\n${subs.map((s, i) => `${i + 1}. ${s}`).join('\n')}\n\nEach step is ~20–40 min so you get frequent wins and clear progress.`;
      reasoning.push(`Identified target task "${target.title}".`);
      reasoning.push(`Generated ${subs.length} subtasks using domain decomposition.`);
    }
  } else if (intent === 'patterns') {
    const completed = tasks.filter((t) => t.status === 'completed' && t.completed_at);
    const byHour: Record<number, number> = {};
    for (const t of completed) {
      const h = new Date(t.completed_at!).getHours();
      byHour[h] = (byHour[h] ?? 0) + 1;
    }
    const peakHour = Object.entries(byHour).sort((a, b) => b[1] - a[1])[0]?.[0];
    reasoning.push(`Analyzed ${completed.length} completion timestamps.`);
    reasoning.push(peakHour ? `Peak completion hour is ${peakHour}:00.` : 'Not enough completion data for time-of-day analysis.');
    const rate = tasks.length > 0 ? Math.round((completed.length / tasks.length) * 100) : 0;
    reply = peakHour
      ? `Based on your ${completed.length} completed tasks, you're most productive around ${peakHour}:00 — that's your focus window for high-priority work. Your completion rate is ${rate}%. I'd suggest scheduling hard tasks in that window and lighter work (admin, email) outside it.`
      : `You've completed ${completed.length} tasks (${rate}% rate). Once you complete a few more, I can detect your peak productivity hours and recommend when to schedule deep work. For now, keep logging completions so the pattern emerges.`;
  } else if (intent === 'preferences') {
    const m = msg;
    const startMatch = m.match(/(\d{1,2})\s*(am|pm)?.*start|from\s*(\d{1,2})/i);
    const focusMatch = m.match(/morning|afternoon|evening/i)?.[0]?.toLowerCase();
    const breakMatch = m.match(/frequent|balanced|minimal/i)?.[0]?.toLowerCase();
    const action: AgentAction = { type: 'set_preferences' };
    if (startMatch) action.workHoursStart = `${startMatch[1] ?? startMatch[3]}:00`;
    if (focusMatch) action.focusStyle = focusMatch;
    if (breakMatch) action.breakPreference = breakMatch;
    if (Object.keys(action).length > 1) {
      actions.push(action);
      reply = `Got it — I've updated your preferences${action.workHoursStart ? ` (work starts ${action.workHoursStart})` : ''}${action.focusStyle ? `, focus style ${action.focusStyle}` : ''}${action.breakPreference ? `, breaks ${action.breakPreference}` : ''}. I'll use these when planning your day and recommending break times.`;
      reasoning.push('Extracted preference signals from the message.');
      reasoning.push('Issued a set_preferences action to persist them.');
    } else {
      reply = "Tell me your preferences like: 'I work best in the morning, start at 9, prefer frequent breaks' and I'll remember them for future planning.";
      reasoning.push('No clear preference signals detected — asked for clarification.');
    }
  } else if (intent === 'create') {
    reply = `I can create that task for you. Use the "New task" button and try the natural-language field, or tell me the goal and I'll break it into scheduled steps. What's the goal you'd like planned?`;
    reasoning.push('Detected a creation intent — deferring to structured task creation flow.');
  } else if (intent === 'report') {
    const isWeekly = /week/.test(msg.toLowerCase());
    const completed = tasks.filter((t) => t.status === 'completed' && t.completed_at);
    const span = isWeekly ? 7 : 1;
    const since = addDays(new Date(), -span);
    const recent = completed.filter((t) => new Date(t.completed_at!) >= since);
    const active = tasks.filter((t) => t.status !== 'completed');
    const overdue = tasks.filter((t) => isOverdue(t));
    reasoning.push(`Generated ${isWeekly ? 'weekly' : 'end-of-day'} report: ${recent.length} completions in last ${span} day(s).`);
    reply = isWeekly ? `📊 Weekly Report\n\n` : `📋 End-of-Day Report\n\n`;
    reply += `Completed: ${recent.length} task${recent.length !== 1 ? 's' : ''}${isWeekly ? ' this week' : ' today'}\n`;
    reply += `Still active: ${active.length}\n`;
    reply += `Overdue: ${overdue.length}\n`;
    const rate = tasks.length > 0 ? Math.round((completed.length / tasks.length) * 100) : 0;
    reply += `Overall completion rate: ${rate}%\n\n`;
    if (recent.length > 0) reply += `Highlights: ${recent.slice(0, 5).map((t) => t.title).join(', ')}.\n`;
    if (overdue.length > 0) reply += `\n⚠️ ${overdue.length} overdue — say "reschedule overdue" and I'll rebalance them.`;
    else reply += `\n✅ No overdue tasks. You're in a good rhythm.`;
  } else {
    // general
    if (ranked.length > 0) {
      const top = ranked[0];
      reply = `Here's my take: your most pressing task is "${top.task.title}" (${top.reasons.join(', ')}). `;
      reply += `You can ask me to "plan my day", "reschedule overdue", "break down ${top.task.title}", or "generate a report". What would you like to do?`;
      reasoning.push(`No specific intent matched — offered the top-ranked task and suggested next commands.`);
    } else {
      reply = `I'm your AI productivity agent. I can plan your day, break down big goals into steps, reschedule overdue tasks, recommend breaks, generate reports, and answer "what should I work on now?". Try asking: "plan my week" or "am I on track?".`;
      reasoning.push('No active tasks and general intent — introduced capabilities.');
    }
  }

  return { reply, reasoning, actions, mode: 'heuristic' };
}

function generateSubtasks(title: string, description: string | null): string[] {
  const text = `${title} ${description ?? ''}`.toLowerCase();
  const subs: string[] = [];
  if (/write|draft|essay|report|article|blog/.test(text)) {
    subs.push('Outline the structure and key points', 'Write the first draft', 'Review and revise', 'Proofread and finalize');
  } else if (/design|build|develop|implement|create|prototype/.test(text)) {
    subs.push('Research and gather requirements', 'Sketch the approach', 'Build the core version', 'Test and refine');
  } else if (/study|review|exam|learn|read/.test(text)) {
    subs.push('Skim the material for an overview', 'Take notes on key concepts', 'Practice with questions', 'Review weak areas');
  } else if (/present|presentation|slides/.test(text)) {
    subs.push('Define the key message', 'Draft the slide outline', 'Build the slides', 'Rehearse the delivery');
  } else if (/launch|deploy|release|ship/.test(text)) {
    subs.push('Finalize and test the feature', 'Prepare release notes', 'Deploy to production', 'Verify the release');
  } else {
    subs.push('Define what "done" looks like', 'Gather what you need', 'Do the core work', 'Review and wrap up');
  }
  return subs;
}

// ---------------------------------------------------------------------------
// Main handler
// ---------------------------------------------------------------------------
Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    if (req.method !== 'POST') {
      return new Response(JSON.stringify({ error: 'Method not allowed' }), {
        status: 405,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const body = (await req.json()) as AgentRequest;
    if (!body.message || typeof body.message !== 'string') {
      return new Response(JSON.stringify({ error: 'message is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let result: AgentResult;
    if (OPENAI_KEY) {
      try {
        result = await callOpenAI(body);
      } catch (e) {
        // Fall back to heuristic if OpenAI fails
        result = heuristicAgent(body);
        result.reasoning.unshift(`OpenAI call failed (${e instanceof Error ? e.message : 'unknown'}); using built-in engine.`);
      }
    } else {
      result = heuristicAgent(body);
    }

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : 'Agent error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});

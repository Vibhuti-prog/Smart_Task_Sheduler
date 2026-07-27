export type TaskStatus = 'todo' | 'in_progress' | 'completed';
export type Priority = 'high' | 'medium' | 'low';
export type Recurrence = 'none' | 'daily' | 'weekly' | 'monthly';

export interface Task {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: Priority;
  category: string | null;
  tags: string[];
  due_date: string | null;
  completed_at: string | null;
  estimated_minutes: number | null;
  recurrence: Recurrence;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export type TaskInput = Omit<
  Task,
  'id' | 'user_id' | 'created_at' | 'updated_at' | 'completed_at' | 'sort_order'
> & {
  sort_order?: number;
};

export type ViewName = 'dashboard' | 'tasks' | 'calendar';

export interface ParsedTask {
  title: string;
  dueDate: Date | null;
  priority: Priority | null;
  category: string | null;
  tags: string[];
}

// ---- Agent types ----

export type AgentActionType =
  | 'create_task'
  | 'create_subtasks'
  | 'reschedule_task'
  | 'update_priority'
  | 'complete_task'
  | 'set_preferences';

export interface AgentAction {
  type: AgentActionType;
  taskId?: string;
  title?: string;
  dueDate?: string; // ISO
  priority?: Priority;
  subtasks?: string[];
  category?: string;
  tags?: string[];
  estimatedMinutes?: number;
  workHoursStart?: string;
  workHoursEnd?: string;
  breakPreference?: 'frequent' | 'balanced' | 'minimal';
  focusStyle?: 'morning' | 'afternoon' | 'evening' | 'flexible';
}

export interface AgentResponse {
  reply: string;
  reasoning: string[];
  actions: AgentAction[];
  mode: 'openai' | 'heuristic';
}

export interface AgentMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  reasoning?: string[];
  actions?: AgentAction[];
  mode?: 'openai' | 'heuristic';
  created_at: string;
}

export interface AgentPreferences {
  work_hours_start: string;
  work_hours_end: string;
  break_preference: 'frequent' | 'balanced' | 'minimal';
  focus_style: 'morning' | 'afternoon' | 'evening' | 'flexible';
  notes: string | null;
}

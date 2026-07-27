import { useEffect, useRef, useState, useCallback } from 'react';
import type { AgentMessage, AgentResponse, AgentPreferences } from '../types';
import { useTasks } from '../context/TasksContext';
import {
  askAgent, loadMemory, saveMemory, clearMemory,
  loadPreferences, executeActions, type ActionResult,
} from '../lib/agent';
import {
  X, Send, Sparkles, Loader2, Brain, Trash2, CheckCircle2, AlertCircle,
  Zap, Calendar, Clock, TrendingUp, Lightbulb, Bot, User as UserIcon, ChevronDown,
} from 'lucide-react';

interface Props {
  open: boolean;
  onClose: () => void;
}

const QUICK_COMMANDS = [
  { label: 'What should I work on now?', icon: <Zap className="w-3.5 h-3.5" /> },
  { label: 'Plan my day', icon: <Calendar className="w-3.5 h-3.5" /> },
  { label: 'Reschedule overdue tasks', icon: <Clock className="w-3.5 h-3.5" /> },
  { label: 'Am I on track this week?', icon: <TrendingUp className="w-3.5 h-3.5" /> },
  { label: 'Generate end-of-day report', icon: <TrendingUp className="w-3.5 h-3.5" /> },
  { label: 'Suggest break times', icon: <Lightbulb className="w-3.5 h-3.5" /> },
];

export function AgentPanel({ open, onClose }: Props) {
  const { tasks, refresh } = useTasks();
  const [messages, setMessages] = useState<AgentMessage[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preferences, setPreferences] = useState<AgentPreferences | null>(null);
  const [showReasoning, setShowReasoning] = useState<Record<string, boolean>>({});
  const scrollRef = useRef<HTMLDivElement>(null);

  const uid = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  // Load memory + preferences on open
  useEffect(() => {
    if (!open) return;
    (async () => {
      const [mem, prefs] = await Promise.all([loadMemory(), loadPreferences()]);
      setMessages(mem);
      setPreferences(prefs);
      if (mem.length === 0) {
        setMessages([{
          id: uid(),
          role: 'assistant',
          content: "Hi! I'm your AI productivity agent. I can plan your day, break down big goals, reschedule overdue work, recommend breaks, and answer questions like \"what should I work on now?\". I also remember our past conversations. What can I help with?",
          created_at: new Date().toISOString(),
        }]);
      }
    })();
  }, [open]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, busy]);

  const send = useCallback(async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || busy) return;
    setError(null);
    setInput('');

    const userMsg: AgentMessage = {
      id: uid(),
      role: 'user',
      content: trimmed,
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setBusy(true);

    try {
      await saveMemory('user', trimmed);

      const response: AgentResponse = await askAgent(trimmed, {
        tasks,
        memory: messages.filter((m) => m.role === 'user' || m.role === 'assistant'),
        preferences,
      });

      // Execute any actions the agent proposed
      let actionResults: ActionResult[] = [];
      if (response.actions.length > 0) {
        actionResults = await executeActions(response.actions);
        await refresh();
        if (actionResults.some((r) => r.ok)) {
          const okCount = actionResults.filter((r) => r.ok).length;
          const appliedNote = `\n\n✓ Applied ${okCount} action${okCount > 1 ? 's' : ''} to your tasks.`;
          response.reply += appliedNote;
        }
      }

      const assistantMsg: AgentMessage = {
        id: uid(),
        role: 'assistant',
        content: response.reply,
        reasoning: response.reasoning,
        actions: response.actions,
        mode: response.mode,
        created_at: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, assistantMsg]);
      await saveMemory('assistant', response.reply, response);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Something went wrong.';
      setError(msg);
      setMessages((prev) => [...prev, {
        id: uid(),
        role: 'assistant',
        content: `I hit a snag: ${msg}. Please try again.`,
        created_at: new Date().toISOString(),
      }]);
    } finally {
      setBusy(false);
    }
  }, [busy, tasks, messages, preferences, refresh]);

  const handleClear = async () => {
    await clearMemory();
    setMessages([{
      id: uid(),
      role: 'assistant',
      content: "Memory cleared. I've forgotten our previous conversations. How can I help you now?",
      created_at: new Date().toISOString(),
    }]);
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end" role="dialog" aria-modal="true" aria-label="AI Agent">
      <div className="absolute inset-0 bg-ink-950/40 backdrop-blur-sm animate-fade-in" onClick={onClose} />
      <div className="relative w-full max-w-md h-full glass-strong shadow-glass flex flex-col animate-slide-in-right border-l border-ink-200/50 dark:border-ink-700/40">
        {/* Header */}
        <div className="px-5 py-4 border-b border-ink-200/50 dark:border-ink-700/40 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-brand-500 to-accent-500 grid place-items-center shadow-glow relative">
              <Bot className="w-5 h-5 text-white" />
              {busy && <span className="absolute inset-0 rounded-2xl border-2 border-brand-400 animate-pulse-ring" />}
            </div>
            <div>
              <h2 className="font-display font-bold text-ink-900 dark:text-white text-sm flex items-center gap-1.5">
                AI Agent
                <span className="rounded-full bg-brand-500/15 text-brand-700 dark:text-brand-300 text-[9px] font-bold px-1.5 py-0.5 uppercase tracking-wide">Pro</span>
              </h2>
              <p className="text-[11px] text-ink-500 dark:text-ink-400">
                {preferences ? `Knows your ${preferences.focus_style} focus` : 'Autonomous planner'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button onClick={handleClear} disabled={busy} className="w-9 h-9 rounded-xl hover:bg-ink-500/10 grid place-items-center text-ink-500 dark:text-ink-400 transition disabled:opacity-40" aria-label="Clear memory" title="Clear conversation memory">
              <Trash2 className="w-4 h-4" />
            </button>
            <button onClick={onClose} className="w-9 h-9 rounded-xl hover:bg-ink-500/10 grid place-items-center text-ink-500 dark:text-ink-400 transition" aria-label="Close">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Messages */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-5 space-y-4">
          {messages.map((m) => (
            <MessageBubble
              key={m.id}
              message={m}
              showReasoning={!!showReasoning[m.id]}
              onToggleReasoning={() => setShowReasoning((s) => ({ ...s, [m.id]: !s[m.id] }))}
            />
          ))}
          {busy && (
            <div className="flex items-start gap-2.5 animate-fade-in">
              <div className="w-7 h-7 rounded-xl bg-gradient-to-br from-brand-500 to-accent-500 grid place-items-center shrink-0">
                <Loader2 className="w-4 h-4 text-white animate-spin" />
              </div>
              <div className="rounded-2xl rounded-tl-sm bg-white/60 dark:bg-ink-900/40 px-4 py-3 border border-ink-200/60 dark:border-ink-700/40">
                <div className="flex gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-brand-400 animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="w-1.5 h-1.5 rounded-full bg-brand-400 animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="w-1.5 h-1.5 rounded-full bg-brand-400 animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            </div>
          )}
          {error && (
            <div className="rounded-xl bg-danger-500/10 border border-danger-500/30 px-3.5 py-2.5 text-xs text-danger-600 dark:text-danger-400 flex items-center gap-2 animate-fade-in">
              <AlertCircle className="w-4 h-4 shrink-0" /> {error}
            </div>
          )}
        </div>

        {/* Quick commands */}
        {messages.length <= 2 && !busy && (
          <div className="px-4 pb-3 shrink-0">
            <p className="text-[10px] font-semibold text-ink-400 dark:text-ink-500 uppercase tracking-wide mb-2">Try asking</p>
            <div className="flex flex-wrap gap-1.5">
              {QUICK_COMMANDS.map((q) => (
                <button
                  key={q.label}
                  onClick={() => send(q.label)}
                  className="inline-flex items-center gap-1.5 rounded-full bg-brand-500/8 hover:bg-brand-500/15 border border-brand-500/20 text-brand-700 dark:text-brand-300 text-[11px] font-medium px-3 py-1.5 transition active:scale-95"
                >
                  {q.icon} {q.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Input */}
        <div className="px-4 py-3 border-t border-ink-200/50 dark:border-ink-700/40 shrink-0">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              send(input);
            }}
            className="flex items-end gap-2"
          >
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  send(input);
                }
              }}
              placeholder="Ask your agent anything…"
              rows={1}
              disabled={busy}
              className="flex-1 resize-none rounded-xl bg-white/60 dark:bg-ink-900/40 border border-ink-200 dark:border-ink-700 px-3.5 py-2.5 text-sm text-ink-900 dark:text-white placeholder:text-ink-400 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 outline-none transition max-h-24"
            />
            <button
              type="submit"
              disabled={busy || !input.trim()}
              className="w-10 h-10 rounded-xl bg-gradient-to-br from-brand-600 to-accent-500 hover:from-brand-500 hover:to-accent-400 text-white grid place-items-center shadow-glow transition disabled:opacity-40 disabled:cursor-not-allowed active:scale-90 shrink-0"
              aria-label="Send"
            >
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

function MessageBubble({
  message,
  showReasoning,
  onToggleReasoning,
}: {
  message: AgentMessage;
  showReasoning: boolean;
  onToggleReasoning: () => void;
}) {
  const isUser = message.role === 'user';
  const hasReasoning = !!message.reasoning && message.reasoning.length > 0;

  return (
    <div className={`flex items-start gap-2.5 animate-fade-in ${isUser ? 'flex-row-reverse' : ''}`}>
      <div className={`w-7 h-7 rounded-xl grid place-items-center shrink-0 ${isUser ? 'bg-ink-500/15 text-ink-600 dark:text-ink-300' : 'bg-gradient-to-br from-brand-500 to-accent-500 text-white shadow-glow'}`}>
        {isUser ? <UserIcon className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
      </div>
      <div className={`max-w-[85%] ${isUser ? 'items-end' : 'items-start'} flex flex-col`}>
        {hasReasoning && !isUser && (
          <button
            onClick={onToggleReasoning}
            className="inline-flex items-center gap-1 text-[10px] font-semibold text-brand-600 dark:text-brand-400 mb-1.5 hover:underline"
          >
            <Brain className="w-3 h-3" />
            {showReasoning ? 'Hide reasoning' : `Show reasoning (${message.reasoning!.length} steps)`}
            <ChevronDown className={`w-3 h-3 transition ${showReasoning ? 'rotate-180' : ''}`} />
          </button>
        )}
        {showReasoning && hasReasoning && !isUser && (
          <div className="rounded-xl bg-brand-500/8 border border-brand-500/20 px-3 py-2.5 mb-2 space-y-1.5 animate-fade-in">
            {message.reasoning!.map((step, i) => (
              <div key={i} className="flex items-start gap-2 text-[11px] text-ink-600 dark:text-ink-300">
                <span className="w-4 h-4 rounded-md bg-brand-500/15 text-brand-700 dark:text-brand-300 grid place-items-center text-[9px] font-bold shrink-0 mt-0.5">{i + 1}</span>
                <span className="leading-relaxed">{step}</span>
              </div>
            ))}
          </div>
        )}
        <div
          className={`rounded-2xl px-3.5 py-2.5 text-sm whitespace-pre-wrap leading-relaxed ${
            isUser
              ? 'rounded-tr-sm bg-gradient-to-br from-brand-600 to-brand-500 text-white'
              : 'rounded-tl-sm bg-white/70 dark:bg-ink-900/40 text-ink-900 dark:text-white border border-ink-200/60 dark:border-ink-700/40'
          }`}
        >
          {renderContent(message.content)}
        </div>
        {message.actions && message.actions.length > 0 && !isUser && (
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {message.actions.map((a, i) => (
              <span key={i} className="inline-flex items-center gap-1 rounded-md bg-success-500/12 text-success-600 dark:text-success-400 text-[10px] font-medium px-2 py-0.5">
                <CheckCircle2 className="w-3 h-3" />
                {actionLabel(a.type)}
              </span>
            ))}
          </div>
        )}
        {message.mode && !isUser && (
          <span className="text-[9px] text-ink-400 dark:text-ink-600 mt-1 flex items-center gap-1">
            <Sparkles className="w-2.5 h-2.5" />
            {message.mode === 'openai' ? 'OpenAI-powered' : 'Built-in reasoning engine'}
          </span>
        )}
      </div>
    </div>
  );
}

function actionLabel(type: string): string {
  const map: Record<string, string> = {
    create_task: 'Created task',
    create_subtasks: 'Broke into steps',
    reschedule_task: 'Rescheduled',
    update_priority: 'Updated priority',
    complete_task: 'Completed',
    set_preferences: 'Saved preferences',
  };
  return map[type] ?? type;
}

function renderContent(content: string): React.ReactNode {
  // Lightweight markdown: **bold** and line breaks
  const lines = content.split('\n');
  return lines.map((line, i) => {
    const parts = line.split(/(\*\*[^*]+\*\*)/g);
    return (
      <span key={i}>
        {parts.map((p, j) =>
          p.startsWith('**') && p.endsWith('**') ? (
            <strong key={j} className="font-semibold">{p.slice(2, -2)}</strong>
          ) : (
            <span key={j}>{p}</span>
          ),
        )}
        {i < lines.length - 1 && <br />}
      </span>
    );
  });
}

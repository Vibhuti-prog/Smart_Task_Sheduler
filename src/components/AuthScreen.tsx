import { useState, type FormEvent } from 'react';
import { useAuth } from '../context/AuthContext';
import { Sparkles, Mail, Lock, Loader2, ArrowRight, CalendarCheck, Brain, BarChart3 } from 'lucide-react';

export function AuthScreen() {
  const { signIn, signUp } = useAuth();
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    setLoading(true);
    const fn = mode === 'signin' ? signIn : signUp;
    const { error: err } = await fn(email.trim(), password);
    setLoading(false);
    if (err) {
      setError(err);
      return;
    }
    if (mode === 'signup') {
      setError(null);
      setEmail('');
      setPassword('');
      setMode('signin');
    }
  };

  return (
    <div className="app-bg min-h-screen flex items-center justify-center p-4 sm:p-6">
      <div className="w-full max-w-5xl grid lg:grid-cols-2 gap-6 lg:gap-8 items-stretch">
        {/* Brand panel */}
        <div className="hidden lg:flex flex-col justify-between rounded-4xl glass shadow-glass p-10 relative overflow-hidden animate-fade-in">
          <div className="absolute -top-24 -right-24 w-72 h-72 rounded-full bg-brand-500/20 blur-3xl animate-float" />
          <div className="absolute -bottom-24 -left-24 w-72 h-72 rounded-full bg-accent-500/20 blur-3xl animate-float" style={{ animationDelay: '1.5s' }} />
          <div className="relative">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-brand-500 to-accent-500 grid place-items-center shadow-glow">
                <CalendarCheck className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="font-display text-xl font-bold text-ink-900 dark:text-white leading-tight">AI-Powered Smart<br />Task Scheduler</h1>
                <p className="text-xs text-ink-500 dark:text-ink-400">by Vibhuti Singh</p>
              </div>
            </div>
            <h2 className="font-display text-3xl font-bold text-ink-900 dark:text-white mt-12 leading-tight">
              Plan smarter.<br />
              <span className="text-gradient">Ship calmer.</span>
            </h2>
            <p className="text-ink-600 dark:text-ink-300 mt-4 max-w-sm leading-relaxed">
              An intelligent scheduler that prioritizes your work by deadline, workload, and momentum — so you always know what to do next.
            </p>
          </div>
          <div className="relative space-y-4 mt-10">
            <FeatureRow icon={<Brain className="w-5 h-5" />} title="AI prioritization" desc="Auto-ranks tasks by urgency & effort" />
            <FeatureRow icon={<Sparkles className="w-5 h-5" />} title="Natural-language input" desc='"Submit assignment tomorrow at 10 AM"' />
            <FeatureRow icon={<BarChart3 className="w-5 h-5" />} title="Productivity insights" desc="Workload forecasts & completion trends" />
          </div>
        </div>

        {/* Form panel */}
        <div className="rounded-4xl glass-strong shadow-glass p-8 sm:p-10 flex flex-col justify-center animate-slide-up">
          <div className="lg:hidden flex items-center gap-3 mb-8">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-brand-500 to-accent-500 grid place-items-center shadow-glow">
              <CalendarCheck className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="font-display text-lg font-bold text-ink-900 dark:text-white leading-tight">AI-Powered Smart<br />Task Scheduler</h1>
              <p className="text-xs text-ink-500 dark:text-ink-400">by Vibhuti Singh</p>
            </div>
          </div>

          <h2 className="font-display text-2xl font-bold text-ink-900 dark:text-white">
            {mode === 'signin' ? 'Welcome back' : 'Create your account'}
          </h2>
          <p className="text-ink-500 dark:text-ink-400 mt-1.5 text-sm">
            {mode === 'signin' ? 'Sign in to access your tasks and dashboard.' : 'Start organizing your work in seconds.'}
          </p>

          <form onSubmit={handleSubmit} className="mt-7 space-y-4">
            <Field label="Email">
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-ink-400" />
                <input
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="w-full rounded-xl bg-white/60 dark:bg-ink-900/40 border border-ink-200 dark:border-ink-700 pl-11 pr-4 py-3 text-sm text-ink-900 dark:text-white placeholder:text-ink-400 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 outline-none transition"
                />
              </div>
            </Field>

            <Field label="Password">
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-ink-400" />
                <input
                  type={showPwd ? 'text' : 'password'}
                  required
                  autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full rounded-xl bg-white/60 dark:bg-ink-900/40 border border-ink-200 dark:border-ink-700 pl-11 pr-16 py-3 text-sm text-ink-900 dark:text-white placeholder:text-ink-400 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 outline-none transition"
                />
                <button
                  type="button"
                  onClick={() => setShowPwd((s) => !s)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-medium text-brand-600 dark:text-brand-400 hover:underline"
                >
                  {showPwd ? 'Hide' : 'Show'}
                </button>
              </div>
            </Field>

            {error && (
              <div className="rounded-xl bg-danger-500/10 border border-danger-500/30 px-4 py-3 text-sm text-danger-600 dark:text-danger-400 animate-fade-in">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl bg-gradient-to-r from-brand-600 to-accent-500 hover:from-brand-500 hover:to-accent-400 text-white font-semibold py-3 px-4 shadow-glow transition-all hover:shadow-glow-cyan flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed active:scale-[0.98]"
            >
              {loading ? (
                <Loader2 className="w-4.5 h-4.5 animate-spin" />
              ) : (
                <>
                  {mode === 'signin' ? 'Sign in' : 'Create account'}
                  <ArrowRight className="w-4.5 h-4.5" />
                </>
              )}
            </button>
          </form>

          <p className="mt-6 text-sm text-center text-ink-500 dark:text-ink-400">
            {mode === 'signin' ? "Don't have an account?" : 'Already have an account?'}{' '}
            <button
              type="button"
              onClick={() => {
                setMode(mode === 'signin' ? 'signup' : 'signin');
                setError(null);
              }}
              className="font-semibold text-brand-600 dark:text-brand-400 hover:underline"
            >
              {mode === 'signin' ? 'Sign up' : 'Sign in'}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-xs font-semibold text-ink-600 dark:text-ink-300 mb-1.5 uppercase tracking-wide">{label}</span>
      {children}
    </label>
  );
}

function FeatureRow({ icon, title, desc }: { icon: React.ReactNode; title: string; desc: string }) {
  return (
    <div className="flex items-start gap-3.5">
      <div className="w-10 h-10 rounded-xl bg-brand-500/10 text-brand-600 dark:text-brand-400 grid place-items-center shrink-0">
        {icon}
      </div>
      <div>
        <p className="font-semibold text-ink-900 dark:text-white text-sm">{title}</p>
        <p className="text-ink-500 dark:text-ink-400 text-xs mt-0.5">{desc}</p>
      </div>
    </div>
  );
}

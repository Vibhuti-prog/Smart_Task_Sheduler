export function SkeletonCard() {
  return (
    <div className="rounded-2xl glass-panel p-4 space-y-3">
      <div className="flex items-center gap-3">
        <div className="skeleton w-5 h-5 rounded-md" />
        <div className="skeleton h-4 w-2/3 rounded-md" />
      </div>
      <div className="skeleton h-3 w-1/3 rounded-md" />
      <div className="flex gap-2">
        <div className="skeleton h-5 w-16 rounded-full" />
        <div className="skeleton h-5 w-20 rounded-full" />
      </div>
    </div>
  );
}

export function SkeletonStat() {
  return (
    <div className="rounded-2xl glass-panel p-5 space-y-3">
      <div className="skeleton h-10 w-10 rounded-xl" />
      <div className="skeleton h-7 w-20 rounded-md" />
      <div className="skeleton h-3 w-24 rounded-md" />
    </div>
  );
}

export function SkeletonChart() {
  return (
    <div className="rounded-2xl glass-panel p-5 space-y-4">
      <div className="skeleton h-5 w-32 rounded-md" />
      <div className="skeleton h-40 w-full rounded-xl" />
    </div>
  );
}

export function Spinner({ className = '' }: { className?: string }) {
  return <div className={`animate-spin rounded-full border-2 border-current border-t-transparent ${className}`} />;
}

interface BarDatum {
  label: string;
  value: number;
  accent?: boolean;
}

export function BarChart({ data, height = 160, unit = '' }: { data: BarDatum[]; height?: number; unit?: string }) {
  const max = Math.max(1, ...data.map((d) => d.value));
  const barW = 100 / Math.max(1, data.length);
  return (
    <svg viewBox={`0 0 100 ${height / 2}`} preserveAspectRatio="none" className="w-full" style={{ height }}>
      {data.map((d, i) => {
        const h = (d.value / max) * (height / 2 - 14);
        const x = i * barW + barW * 0.18;
        const w = barW * 0.64;
        const y = height / 2 - h - 10;
        return (
          <g key={i}>
            <rect
              x={x}
              y={y}
              width={w}
              height={Math.max(0.5, h)}
              rx={1.2}
              className={d.accent ? 'fill-brand-500' : 'fill-brand-500/40'}
            >
              <animate attributeName="height" from="0" to={Math.max(0.5, h)} dur="0.6s" fill="freeze" />
              <animate attributeName="y" from={height / 2 - 10} to={y} dur="0.6s" fill="freeze" />
            </rect>
            <text x={x + w / 2} y={height / 2 - 2} textAnchor="middle" className="fill-ink-500 dark:fill-ink-400" style={{ fontSize: '3px' }}>
              {d.label}
            </text>
            {d.value > 0 && (
              <text x={x + w / 2} y={y - 1.5} textAnchor="middle" className="fill-ink-700 dark:fill-ink-200 font-semibold" style={{ fontSize: '3.2px' }}>
                {d.value}{unit}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}

interface DonutSlice {
  label: string;
  value: number;
  color: string;
}

export function DonutChart({ data, size = 160 }: { data: DonutSlice[]; size?: number }) {
  const total = data.reduce((s, d) => s + d.value, 0);
  const radius = 16;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;

  if (total === 0) {
    return (
      <div className="flex flex-col items-center justify-center" style={{ height: size }}>
        <div className="w-32 h-32 rounded-full border-8 border-ink-200/40 dark:border-ink-700/40" />
        <p className="text-ink-400 text-xs mt-3">No data yet</p>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-5">
      <svg viewBox="0 0 40 40" style={{ width: size, height: size }} className="-rotate-90">
        <circle cx="20" cy="20" r={radius} fill="none" strokeWidth="6" className="stroke-ink-200/40 dark:stroke-ink-700/40" />
        {data.map((d, i) => {
          const fraction = d.value / total;
          const dash = fraction * circumference;
          const seg = (
            <circle
              key={i}
              cx="20"
              cy="20"
              r={radius}
              fill="none"
              strokeWidth="6"
              stroke={d.color}
              strokeDasharray={`${dash} ${circumference - dash}`}
              strokeDashoffset={-offset}
              strokeLinecap="round"
            >
              <animate attributeName="stroke-dasharray" from={`0 ${circumference}`} to={`${dash} ${circumference - dash}`} dur="0.7s" fill="freeze" />
            </circle>
          );
          offset += dash;
          return seg;
        })}
      </svg>
      <div className="space-y-2">
        {data.map((d, i) => (
          <div key={i} className="flex items-center gap-2 text-xs">
            <span className="w-2.5 h-2.5 rounded-sm" style={{ background: d.color }} />
            <span className="text-ink-600 dark:text-ink-300">{d.label}</span>
            <span className="font-semibold text-ink-900 dark:text-white ml-auto">{d.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

interface LinePoint {
  label: string;
  value: number;
}

export function LineChart({ data, height = 150, color = '#3b82f6' }: { data: LinePoint[]; height?: number; color?: string }) {
  if (data.length === 0) return null;
  const max = Math.max(1, ...data.map((d) => d.value));
  const w = 100;
  const h = height / 2;
  const pad = 6;
  const stepX = data.length > 1 ? (w - pad * 2) / (data.length - 1) : 0;
  const points = data.map((d, i) => ({
    x: pad + i * stepX,
    y: h - pad - (d.value / max) * (h - pad * 2 - 6),
  }));
  const path = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
  const area = `${path} L ${points[points.length - 1].x} ${h - pad} L ${points[0].x} ${h - pad} Z`;

  return (
    <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className="w-full" style={{ height }}>
      <defs>
        <linearGradient id="lineGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.3" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill="url(#lineGrad)" />
      <path d={path} fill="none" stroke={color} strokeWidth="0.8" strokeLinecap="round" strokeLinejoin="round">
        <animate attributeName="stroke-dasharray" from={`0 1000`} to={`1000 0`} dur="1s" fill="freeze" />
      </path>
      {points.map((p, i) => (
        <g key={i}>
          <circle cx={p.x} cy={p.y} r="1" fill={color} />
          <text x={p.x} y={h - 1} textAnchor="middle" className="fill-ink-500 dark:fill-ink-400" style={{ fontSize: '3px' }}>
            {data[i].label}
          </text>
        </g>
      ))}
    </svg>
  );
}

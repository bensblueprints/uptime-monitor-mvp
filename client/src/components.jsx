import React from 'react';

export function StatusDot({ status, size = 'md' }) {
  const colors = {
    up: 'bg-emerald-400 shadow-emerald-400/50',
    down: 'bg-red-500 shadow-red-500/50',
    pending: 'bg-zinc-500 shadow-zinc-500/40'
  };
  const px = size === 'lg' ? 'h-3.5 w-3.5' : 'h-2.5 w-2.5';
  return (
    <span className="relative inline-flex">
      <span className={`${px} rounded-full ${colors[status] || colors.pending} shadow-[0_0_10px]`} />
      {status === 'up' && (
        <span className={`absolute inline-flex ${px} rounded-full bg-emerald-400 opacity-60 animate-ping`} />
      )}
    </span>
  );
}

export function UptimeBars({ bars, height = 'h-8' }) {
  return (
    <div className="flex items-end gap-[2px] w-full">
      {bars.map((b, i) => {
        let color = 'bg-zinc-800';
        if (b.pct !== null) {
          color =
            b.pct >= 99.5 ? 'bg-emerald-500' : b.pct >= 95 ? 'bg-amber-400' : 'bg-red-500';
        }
        return (
          <div
            key={i}
            title={`${b.date}: ${b.pct === null ? 'no data' : b.pct + '% uptime'}`}
            className={`flex-1 min-w-[2px] rounded-[1px] ${height} ${color} transition-colors hover:opacity-70`}
          />
        );
      })}
    </div>
  );
}

export function Sparkline({ checks, width = 600, height = 80 }) {
  const pts = checks.filter((c) => c.response_ms !== null);
  if (pts.length < 2)
    return <div className="text-sm text-zinc-500 py-6 text-center">Not enough data yet</div>;
  const max = Math.max(...pts.map((c) => c.response_ms), 1);
  const step = width / (pts.length - 1);
  const path = pts
    .map((c, i) => {
      const x = i * step;
      const y = height - (c.response_ms / max) * (height - 8) - 2;
      return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');
  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-24" preserveAspectRatio="none">
      <path
        d={`${path} L${width},${height} L0,${height} Z`}
        fill="url(#sparkfill)"
        stroke="none"
      />
      <path d={path} fill="none" stroke="#34d399" strokeWidth="2" vectorEffect="non-scaling-stroke" />
      <defs>
        <linearGradient id="sparkfill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#34d399" stopOpacity="0.25" />
          <stop offset="100%" stopColor="#34d399" stopOpacity="0" />
        </linearGradient>
      </defs>
    </svg>
  );
}

export function fmtAgo(ts) {
  if (!ts) return 'never';
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

export function fmtDuration(ms) {
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m ${s % 60}s`;
  const h = Math.floor(s / 3600);
  if (h < 24) return `${h}h ${Math.floor((s % 3600) / 60)}m`;
  return `${Math.floor(h / 24)}d ${h % 24}h`;
}

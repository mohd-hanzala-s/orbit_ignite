import { useId, useState } from 'react';
import { cn } from '@/lib/utils';

export const TONE_COLOR: Record<string, string> = {
  violet: 'var(--primary-2)', cyan: 'var(--accent)', amber: 'var(--warm)', pink: 'var(--pink)', emerald: 'var(--success)', blue: '#5b8cff', orange: '#ff8a4c',
};

/** Smooth multi-series area/line chart with hover crosshair. */
export function AreaChart({ data, series, height = 220, className }: { data: Record<string, any>[]; series: { key: string; label: string; color: string }[]; height?: number; className?: string }) {
  const id = useId().replace(/:/g, '');
  const [hover, setHover] = useState<number | null>(null);
  const W = 640, H = height, pad = { l: 30, r: 10, t: 10, b: 24 };
  const max = Math.max(4, ...data.flatMap((d) => series.map((s) => Number(d[s.key]) || 0)));
  const niceMax = Math.ceil(max / 4) * 4;
  const x = (i: number) => pad.l + (i / Math.max(1, data.length - 1)) * (W - pad.l - pad.r);
  const y = (v: number) => pad.t + (1 - v / niceMax) * (H - pad.t - pad.b);
  const path = (key: string) => {
    const pts = data.map((d, i) => [x(i), y(Number(d[key]) || 0)] as const);
    return pts.map(([px, py], i) => {
      if (i === 0) return `M${px},${py}`;
      const [qx, qy] = pts[i - 1];
      const cx = (px + qx) / 2;
      return `C${cx},${qy} ${cx},${py} ${px},${py}`;
    }).join(' ');
  };
  return (
    <div className={cn('relative w-full', className)}>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height }} onMouseLeave={() => setHover(null)} onMouseMove={(e) => {
        const r = e.currentTarget.getBoundingClientRect();
        const rel = ((e.clientX - r.left) / r.width) * W;
        setHover(Math.max(0, Math.min(data.length - 1, Math.round(((rel - pad.l) / (W - pad.l - pad.r)) * (data.length - 1)))));
      }} role="img" aria-label="Trend chart">
        <defs>{series.map((s) => <linearGradient key={s.key} id={`${id}${s.key}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={s.color} stopOpacity=".35" /><stop offset="1" stopColor={s.color} stopOpacity="0" /></linearGradient>)}</defs>
        {[0, 1, 2, 3, 4].map((i) => { const v = (niceMax / 4) * i; return <g key={i}><line x1={pad.l} x2={W - pad.r} y1={y(v)} y2={y(v)} stroke="var(--line)" strokeDasharray="3 5" /><text x={pad.l - 6} y={y(v) + 3.5} textAnchor="end" fontSize="10" fill="var(--subtle)">{v}</text></g>; })}
        {data.map((d, i) => (i % Math.ceil(data.length / 7) === 0 ? <text key={i} x={x(i)} y={H - 6} textAnchor="middle" fontSize="10" fill="var(--subtle)">{d.label}</text> : null))}
        {series.map((s) => <path key={s.key + 'a'} d={`${path(s.key)} L${x(data.length - 1)},${y(0)} L${x(0)},${y(0)} Z`} fill={`url(#${id}${s.key})`} />)}
        {series.map((s) => <path key={s.key} d={path(s.key)} fill="none" stroke={s.color} strokeWidth="2.2" strokeLinecap="round" />)}
        {hover != null && (
          <g>
            <line x1={x(hover)} x2={x(hover)} y1={pad.t} y2={H - pad.b} stroke="var(--line-2)" />
            {series.map((s) => <circle key={s.key} cx={x(hover)} cy={y(Number(data[hover][s.key]) || 0)} r="4" fill={s.color} stroke="var(--bg)" strokeWidth="2" />)}
          </g>
        )}
      </svg>
      {hover != null && (
        <div className="pointer-events-none absolute top-2 rounded-xl border border-line-2 bg-bg-2 px-3 py-2 text-xs shadow-xl dark:bg-[#12163a]" style={{ left: `clamp(8px, calc(${(x(hover) / W) * 100}% - 50px), calc(100% - 130px))` }}>
          <div className="mb-1 font-semibold">{data[hover].label}</div>
          {series.map((s) => <div key={s.key} className="flex items-center gap-2 text-muted"><span className="size-2 rounded-full" style={{ background: s.color }} />{s.label}: <b className="text-fg">{data[hover][s.key]}</b></div>)}
        </div>
      )}
      <div className="mt-2 flex gap-4 text-xs text-muted">{series.map((s) => <span key={s.key} className="flex items-center gap-1.5"><span className="size-2 rounded-full" style={{ background: s.color }} />{s.label}</span>)}</div>
    </div>
  );
}

export function BarChart({ data, height = 140, color = 'var(--primary-2)', unit = '' }: { data: { label: string; value: number; sub?: string }[]; height?: number; color?: string; unit?: string }) {
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <div className="flex items-end gap-2.5" style={{ height }}>
      {data.map((d, i) => (
        <div key={i} className="group flex h-full flex-1 flex-col items-center justify-end gap-2" title={`${d.label}: ${d.value}${unit}`}>
          <div className="text-[10px] font-medium tabular-nums text-muted opacity-0 transition-opacity group-hover:opacity-100">{d.value}{unit}</div>
          <div className="relative w-full flex-1">
            <div className="absolute bottom-0 w-full rounded-t-lg transition-all duration-700" style={{ height: `${Math.max(d.value ? 6 : 2, (d.value / max) * 100)}%`, background: d.value ? `linear-gradient(to top, color-mix(in oklab, ${color} 45%, transparent), ${color})` : 'var(--line-2)' }} />
          </div>
          <div className="text-[11px] text-subtle">{d.label}</div>
        </div>
      ))}
    </div>
  );
}

export function Donut({ data, size = 150, label }: { data: { name: string; value: number; color: string }[]; size?: number; label?: string }) {
  const total = data.reduce((a, d) => a + d.value, 0) || 1;
  const r = 52, c = 2 * Math.PI * r;
  let acc = 0;
  return (
    <div className="flex items-center gap-6">
      <svg width={size} height={size} viewBox="0 0 140 140" className="shrink-0" role="img" aria-label="Distribution chart">
        <g transform="rotate(-90 70 70)">
          <circle cx="70" cy="70" r={r} fill="none" stroke="var(--line)" strokeWidth="16" />
          {data.map((d) => { const len = (d.value / total) * c; const el = <circle key={d.name} cx="70" cy="70" r={r} fill="none" stroke={d.color} strokeWidth="16" strokeDasharray={`${Math.max(0, len - 2)} ${c}`} strokeDashoffset={-acc} strokeLinecap="butt" />; acc += len; return el; })}
        </g>
        <text x="70" y={label ? 68 : 72} textAnchor="middle" dominantBaseline="central" fontSize="24" fontWeight="700" fill="var(--fg)" fontFamily="var(--font-display)">{total}</text>
        {label && <text x="70" y="88" textAnchor="middle" fontSize="9" fill="var(--subtle)">{label}</text>}
      </svg>
      <ul className="min-w-0 space-y-2 text-sm">
        {data.map((d) => <li key={d.name} className="flex items-center gap-2"><span className="size-2.5 shrink-0 rounded-full" style={{ background: d.color }} /><span className="truncate text-muted">{d.name}</span><span className="ml-auto pl-3 font-semibold tabular-nums">{d.value}</span></li>)}
      </ul>
    </div>
  );
}

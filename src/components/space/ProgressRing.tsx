import { useId } from 'react';
import { cn } from '@/lib/utils';

/** Orbit-style progress ring with a little planet riding the arc. */
export function ProgressRing({ value, size = 56, stroke = 5, className, label = true, planet = true }: { value: number; size?: number; stroke?: number; className?: string; label?: boolean; planet?: boolean }) {
  const id = useId().replace(/:/g, '');
  const v = Math.max(0, Math.min(100, value));
  const r = (size - stroke) / 2 - (planet ? 2 : 0);
  const c = 2 * Math.PI * r;
  const angle = (v / 100) * 2 * Math.PI - Math.PI / 2;
  const cx = size / 2, cy = size / 2;
  return (
    <div className={cn('relative inline-grid shrink-0 place-items-center', className)} style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-0">
        <defs>
          <linearGradient id={id} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="var(--primary-2)" /><stop offset="1" stopColor="var(--accent)" /></linearGradient>
        </defs>
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="var(--line-2)" strokeWidth={stroke} />
        <circle cx={cx} cy={cy} r={r} fill="none" stroke={`url(#${id})`} strokeWidth={stroke} strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - v / 100)} transform={`rotate(-90 ${cx} ${cy})`} style={{ transition: 'stroke-dashoffset .8s cubic-bezier(.2,.8,.2,1)' }} />
        {planet && v > 0 && v < 100 && <circle cx={cx + r * Math.cos(angle)} cy={cy + r * Math.sin(angle)} r={stroke * 0.8} fill="var(--warm)" stroke="var(--bg)" strokeWidth="1.5" />}
      </svg>
      {label && <span className="absolute font-display text-[0.8em] font-semibold tabular-nums" style={{ fontSize: size * 0.26 }}>{Math.round(v)}%</span>}
    </div>
  );
}

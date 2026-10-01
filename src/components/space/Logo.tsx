import { useId } from 'react';
import { cn } from '@/lib/utils';

export function LogoMark({ size = 32, className }: { size?: number; className?: string }) {
  const id = useId().replace(/:/g, '');
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" className={className} aria-hidden>
      <defs>
        <linearGradient id={`${id}p`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#a78bff" />
          <stop offset="0.55" stopColor="#7c5cff" />
          <stop offset="1" stopColor="#22d3ee" />
        </linearGradient>
        <linearGradient id={`${id}r`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#22d3ee" />
          <stop offset="1" stopColor="#ff6aa8" />
        </linearGradient>
        <clipPath id={`${id}c`}><rect x="0" y="0" width="40" height="21" /></clipPath>
      </defs>
      <ellipse cx="20" cy="21" rx="18" ry="6.5" transform="rotate(-18 20 21)" fill="none" stroke={`url(#${id}r)`} strokeWidth="2" opacity=".55" />
      <circle cx="20" cy="20" r="10.5" fill={`url(#${id}p)`} />
      <path d="M12.5 17.5 q7 -4.5 15 -1" stroke="#fff" strokeOpacity=".35" strokeWidth="1.6" fill="none" strokeLinecap="round" />
      <ellipse cx="20" cy="21" rx="18" ry="6.5" transform="rotate(-18 20 21)" fill="none" stroke={`url(#${id}r)`} strokeWidth="2.4" clipPath="inset(50% 0 0 0)" style={{ clipPath: 'inset(52% 0 0 0)' }} />
      <circle cx="33.5" cy="10" r="2" fill="#ffb547" />
    </svg>
  );
}

export function Logo({ className, collapsed = false }: { className?: string; collapsed?: boolean }) {
  return (
    <div className={cn('flex items-center gap-2.5', className)}>
      <LogoMark size={34} />
      {!collapsed && (
        <div className="leading-none">
          <div className="font-display text-[17px] font-bold tracking-tight">Orbit <span className="text-gradient">Ignite</span></div>
          <div className="mt-1 text-[10px] font-medium uppercase tracking-[0.2em] text-subtle">Learning HQ</div>
        </div>
      )}
    </div>
  );
}

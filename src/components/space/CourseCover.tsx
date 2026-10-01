import { useId } from 'react';
import { cn } from '@/lib/utils';

// [sky from, sky to, planet light, planet dark, accent, ring]
const PALETTES: Record<string, [string, string, string, string, string, string]> = {
  nebula: ['#2a1a7a', '#0b0f2e', '#a78bff', '#4a2fd0', '#38d9f5', '#c9b8ff'],
  aurora: ['#07343f', '#0a1030', '#4cf0c0', '#127a8a', '#a78bff', '#9ff5de'],
  sunset: ['#5a1a4d', '#14102e', '#ffb06a', '#e5407f', '#ffd36a', '#ffc9a0'],
  ocean: ['#0a2a6b', '#07102e', '#4db5ff', '#1c4fd0', '#6ff2ff', '#b0e2ff'],
  ember: ['#5c1a1a', '#12081f', '#ff8a5c', '#d1291f', '#ffd36a', '#ffbfa0'],
  lunar: ['#2c3358', '#0d1128', '#e8eaff', '#8b92c4', '#a8b4ff', '#d6dcff'],
  nova: ['#4b1a7a', '#0d0a30', '#ff8fd0', '#8a2fd0', '#ffe27a', '#ffc2ee'],
  forest: ['#0e3b2c', '#07122a', '#7ff0a8', '#1f8a5a', '#d6ff7a', '#b8ffd0'],
};
export const THEME_NAMES = Object.keys(PALETTES);

function rng(seed: number) {
  let s = seed || 1;
  return () => ((s = (s * 16807) % 2147483647) / 2147483647);
}

/** Procedural space-scene cover art, unique per course but themed by palette. */
export function CourseCover({ theme = 'nebula', seed = 1, className, coverUrl, rounded = true }: { theme?: string; seed?: number; className?: string; coverUrl?: string | null; rounded?: boolean }) {
  const id = useId().replace(/:/g, '');
  if (coverUrl) return <img src={coverUrl} alt="" className={cn('h-full w-full object-cover', rounded && 'rounded-[inherit]', className)} />;
  const [a, b, pl, pd, ac, ring] = PALETTES[theme] ?? PALETTES.nebula;
  const r = rng(seed * 9301 + 49297);
  const layout = seed % 4;
  const stars = Array.from({ length: 34 }, () => ({ x: r() * 400, y: r() * 225, s: r() * 1.4 + 0.3, o: 0.3 + r() * 0.7 }));
  const px = [300, 120, 250, 90][layout];
  const py = [150, 175, 120, 130][layout];
  const pr = [70, 92, 56, 62][layout];
  const tilt = [-22, -12, 18, -28][layout];
  return (
    <svg viewBox="0 0 400 225" preserveAspectRatio="xMidYMid slice" className={cn('block h-full w-full', className)} aria-hidden>
      <defs>
        <linearGradient id={`${id}s`} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor={a} /><stop offset="1" stopColor={b} /></linearGradient>
        <radialGradient id={`${id}p`} cx="32%" cy="28%" r="85%"><stop offset="0" stopColor={pl} /><stop offset="0.7" stopColor={pd} /><stop offset="1" stopColor={b} /></radialGradient>
        <radialGradient id={`${id}g`} cx="50%" cy="50%" r="50%"><stop offset="0" stopColor={ac} stopOpacity=".55" /><stop offset="1" stopColor={ac} stopOpacity="0" /></radialGradient>
        <clipPath id={`${id}c`}><circle cx={px} cy={py} r={pr} /></clipPath>
      </defs>
      <rect width="400" height="225" fill={`url(#${id}s)`} />
      <circle cx={px - 30} cy={py - 40} r={pr * 2.2} fill={`url(#${id}g)`} />
      {stars.map((s, i) => <circle key={i} cx={s.x} cy={s.y} r={s.s} fill="#fff" opacity={s.o} />)}
      {/* far orbit */}
      <ellipse cx={px} cy={py} rx={pr * 2.4} ry={pr * 0.8} transform={`rotate(${tilt} ${px} ${py})`} fill="none" stroke={ring} strokeOpacity=".18" strokeWidth="1" strokeDasharray="3 5" />
      {/* ring back */}
      {layout !== 2 && <ellipse cx={px} cy={py} rx={pr * 1.7} ry={pr * 0.42} transform={`rotate(${tilt} ${px} ${py})`} fill="none" stroke={ring} strokeOpacity=".5" strokeWidth={pr * 0.1} />}
      {/* planet */}
      <circle cx={px} cy={py} r={pr} fill={`url(#${id}p)`} />
      <g clipPath={`url(#${id}c)`} opacity=".35">
        <ellipse cx={px} cy={py - pr * 0.35} rx={pr * 1.2} ry={pr * 0.09} fill="#fff" />
        <ellipse cx={px} cy={py + pr * 0.1} rx={pr * 1.2} ry={pr * 0.07} fill={b} />
        <ellipse cx={px} cy={py + pr * 0.42} rx={pr * 1.2} ry={pr * 0.1} fill="#fff" />
        <circle cx={px + pr * 0.4} cy={py - pr * 0.1} r={pr * 0.16} fill={b} opacity=".5" />
        <circle cx={px - pr * 0.35} cy={py + pr * 0.45} r={pr * 0.1} fill={b} opacity=".5" />
        <circle cx={px + pr * 0.9} cy={py + pr * 0.9} r={pr} fill="#000" opacity=".55" />
      </g>
      {/* ring front */}
      {layout !== 2 && (
        <path d={`M ${px - pr * 1.7} ${py} A ${pr * 1.7} ${pr * 0.42} 0 0 0 ${px + pr * 1.7} ${py}`} transform={`rotate(${tilt} ${px} ${py})`} fill="none" stroke={ring} strokeOpacity=".85" strokeWidth={pr * 0.1} />
      )}
      {/* moon */}
      <circle cx={layout === 1 ? 320 : 70} cy={layout === 0 ? 55 : 48} r={layout === 3 ? 14 : 9} fill={ac} opacity=".9" />
      <circle cx={(layout === 1 ? 320 : 70) - 3} cy={(layout === 0 ? 55 : 48) - 3} r="3" fill="#fff" opacity=".4" />
      {/* spark */}
      <path d="M355 40 l2 6 6 2 -6 2 -2 6 -2 -6 -6 -2 6 -2z" fill="#fff" opacity=".85" />
    </svg>
  );
}

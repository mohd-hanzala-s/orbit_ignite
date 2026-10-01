import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join('');

export function formatDuration(min: number) {
  if (!min) return '—';
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
}

export function formatSeconds(s: number) {
  s = Math.max(0, Math.floor(s));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return h ? `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}` : `${m}:${String(sec).padStart(2, '0')}`;
}

export function formatBytes(n: number) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 ** 2) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 ** 3) return `${(n / 1024 ** 2).toFixed(1)} MB`;
  return `${(n / 1024 ** 3).toFixed(2)} GB`;
}

export const dateFmt = (d?: string | null, opts: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric', year: 'numeric' }) => {
  if (!d) return '—';
  const date = new Date(/^\d{4}-\d{2}-\d{2}$/.test(d) ? d + 'T00:00:00' : d);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleDateString('en-US', opts);
};
export const dateTimeFmt = (d?: string | null) =>
  d ? new Date(d).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : '—';

export function timeAgo(d?: string | null) {
  if (!d) return '';
  const diff = (Date.now() - new Date(d).getTime()) / 1000;
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 86400 * 7) return `${Math.floor(diff / 86400)}d ago`;
  return dateFmt(d, { month: 'short', day: 'numeric' });
}

export function daysUntil(dateStr: string) {
  const end = new Date(dateStr + 'T23:59:59');
  return Math.ceil((end.getTime() - Date.now()) / 864e5);
}

export const pluralize = (n: number, one: string, many = one + 's') => `${n.toLocaleString()} ${n === 1 ? one : many}`;

export const greeting = () => {
  const h = new Date().getHours();
  return h < 5 ? 'Burning the midnight oil' : h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
};

export const AVATAR_TONES: Record<string, string> = {
  violet: 'from-violet-500 to-fuchsia-500',
  cyan: 'from-cyan-400 to-blue-500',
  amber: 'from-amber-400 to-orange-500',
  pink: 'from-pink-400 to-rose-500',
  emerald: 'from-emerald-400 to-teal-500',
  blue: 'from-blue-400 to-indigo-500',
  orange: 'from-orange-400 to-red-500',
};

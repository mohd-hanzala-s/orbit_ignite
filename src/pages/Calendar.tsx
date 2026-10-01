import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Video, CalendarClock, ExternalLink } from 'lucide-react';
import { useGet } from '@/lib/queries';
import { cn, dateTimeFmt, dateFmt } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge, EmptyState, PageHeader, Skeleton } from '@/components/ui/misc';

interface Ev { type: 'live' | 'due'; title: string; subtitle: string; at: string; durationMin?: number; link: string; joinUrl?: string; platform?: string; allDay?: boolean }
const key = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export default function CalendarPage() {
  const { data, isLoading } = useGet<Ev[]>('/me/calendar');
  const [cursor, setCursor] = useState(() => { const d = new Date(); d.setDate(1); return d; });
  const [selected, setSelected] = useState<string>(key(new Date()));
  const byDay = useMemo(() => { const m = new Map<string, Ev[]>(); for (const e of data ?? []) { const k = key(new Date(e.at)); m.set(k, [...(m.get(k) ?? []), e]); } return m; }, [data]);
  const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
  const startOffset = first.getDay();
  const days = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0).getDate();
  const cells = Array.from({ length: Math.ceil((startOffset + days) / 7) * 7 }, (_, i) => { const d = new Date(cursor.getFullYear(), cursor.getMonth(), i - startOffset + 1); return { d, inMonth: d.getMonth() === cursor.getMonth() }; });
  const today = key(new Date());
  const upcoming = (data ?? []).filter((e) => Date.parse(e.at) >= Date.now() - 36e5).slice(0, 8);
  const sel = byDay.get(selected) ?? [];
  const move = (n: number) => setCursor((c) => new Date(c.getFullYear(), c.getMonth() + n, 1));

  return (
    <div>
      <PageHeader eyebrow="Mission schedule" title="Calendar" description="Live sessions and course deadlines in one place." />
      {isLoading ? <Skeleton className="h-[520px]" /> : (
        <div className="grid gap-6 xl:grid-cols-[1fr_360px]">
          <section className="surface p-5">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-display text-xl font-semibold">{cursor.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</h2>
              <div className="flex gap-1"><Button variant="ghost" size="icon-sm" onClick={() => move(-1)} aria-label="Previous month"><ChevronLeft className="size-4" /></Button><Button variant="outline" size="sm" onClick={() => { const d = new Date(); d.setDate(1); setCursor(d); setSelected(today); }}>Today</Button><Button variant="ghost" size="icon-sm" onClick={() => move(1)} aria-label="Next month"><ChevronRight className="size-4" /></Button></div>
            </div>
            <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-semibold uppercase tracking-wider text-subtle">{['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => <div key={d} className="pb-2">{d}</div>)}</div>
            <div className="grid grid-cols-7 gap-1">
              {cells.map(({ d, inMonth }) => {
                const k = key(d); const evs = byDay.get(k) ?? [];
                return (
                  <button key={k} onClick={() => setSelected(k)} className={cn('relative flex min-h-[78px] flex-col items-start rounded-xl border p-2 text-left transition-colors', inMonth ? 'border-line bg-card/60 hover:border-primary/40' : 'border-transparent opacity-35', selected === k && 'border-primary bg-primary/10', k === today && 'ring-1 ring-accent/60')}>
                    <span className={cn('text-xs font-semibold', k === today ? 'grid size-5 place-items-center rounded-full bg-accent text-bg' : 'text-muted')}>{d.getDate()}</span>
                    <div className="mt-1 flex w-full flex-col gap-0.5">{evs.slice(0, 2).map((e, i) => <span key={i} className={cn('truncate rounded px-1 text-[10px] font-medium', e.type === 'live' ? 'bg-accent/20 text-accent' : 'bg-warm/20 text-warm')}>{e.title}</span>)}{evs.length > 2 && <span className="text-[10px] text-subtle">+{evs.length - 2} more</span>}</div>
                  </button>
                );
              })}
            </div>
          </section>
          <aside className="space-y-6">
            <section className="surface p-5">
              <h3 className="mb-3 font-display font-semibold">{dateFmt(selected, { weekday: 'long', month: 'long', day: 'numeric' })}</h3>
              {sel.length === 0 ? <p className="text-sm text-muted">Nothing scheduled.</p> : <ul className="space-y-3">{sel.map((e, i) => <EventRow key={i} e={e} />)}</ul>}
            </section>
            <section className="surface p-5">
              <h3 className="mb-3 font-display font-semibold">Coming up</h3>
              {upcoming.length === 0 ? <EmptyState compact mood="sleep" title="All clear" description="No upcoming sessions or deadlines." /> : <ul className="space-y-3">{upcoming.map((e, i) => <EventRow key={i} e={e} />)}</ul>}
            </section>
          </aside>
        </div>
      )}
    </div>
  );
}

function EventRow({ e }: { e: Ev }) {
  const Icon = e.type === 'live' ? Video : CalendarClock;
  return (
    <li className="rounded-xl border border-line bg-card-2/40 p-3.5">
      <div className="flex items-center gap-2"><Icon className={cn('size-4', e.type === 'live' ? 'text-accent' : 'text-warm')} /><Badge tone={e.type === 'live' ? 'info' : 'warn'}>{e.type === 'live' ? 'Live' : 'Deadline'}</Badge><span className="text-xs text-muted">{e.allDay ? dateFmt(e.at.slice(0, 10)) : dateTimeFmt(e.at)}</span></div>
      <Link to={e.link} className="mt-2 block text-sm font-semibold leading-snug hover:text-primary-2">{e.title}</Link>
      <div className="text-xs text-muted">{e.subtitle}{e.durationMin ? ` · ${e.durationMin} min` : ''}</div>
      {e.joinUrl && <a href={e.joinUrl} target="_blank" rel="noopener noreferrer" className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-primary-2 hover:underline">Join {e.platform || 'session'} <ExternalLink className="size-3" /></a>}
    </li>
  );
}

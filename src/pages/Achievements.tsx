import * as Icons from 'lucide-react';
import { motion } from 'motion/react';
import { Flame, Crown, Medal } from 'lucide-react';
import { useGet } from '@/lib/queries';
import type { BadgeInfo } from '@/lib/types';
import { cn, dateFmt, timeAgo } from '@/lib/utils';
import { Avatar, ErrorState, PageHeader, ProgressBar, Skeleton, Badge, StatCard } from '@/components/ui/misc';
import { Mascot } from '@/components/space/Mascot';
import { AnimatedNumber } from '@/components/mp/animated-number';
import { Tilt } from '@/components/mp/tilt';
import { TONE_COLOR } from '@/components/charts';

interface Ach { badges: BadgeInfo[]; recentXp: { amount: number; reason: string; createdAt: string }[]; level: number; floor: number; next: number; pct: number; xp: number; streak: number; longestStreak: number }
interface LB { rank: number; id: number; name: string; avatarColor: string; xp: number; streak: number; me: boolean }
const REASON: Record<string, string> = { lesson: 'Completed a lesson', quiz: 'Passed a quiz', 'quiz-perfect': 'Perfect quiz score', course: 'Finished a course', review: 'Reviewed a course', post: 'Posted in discussion' };

export default function Achievements() {
  const { data, error, refetch } = useGet<Ach>('/me/achievements');
  const { data: lb } = useGet<LB[]>('/leaderboard');
  if (error) return <ErrorState error={error} onRetry={refetch} />;
  if (!data) return <Skeleton className="h-[600px]" />;
  const earned = data.badges.filter((b) => b.earnedAt).length;
  return (
    <div className="space-y-8">
      <PageHeader eyebrow="Trophy room" title="Achievements" description="Earn XP for every lesson, quiz and course. Level up and collect badges along the way." />
      <section className="surface relative overflow-hidden p-7">
        <div className="pointer-events-none absolute -right-16 -top-16 size-72 rounded-full bg-warm/15 blur-3xl" />
        <div className="relative grid items-center gap-6 md:grid-cols-[auto_1fr_auto]">
          <div className="grid size-28 place-items-center rounded-full border-4 border-primary/50 bg-gradient-to-br from-primary/30 to-accent/20 shadow-glow"><div className="text-center"><div className="text-[11px] font-semibold uppercase tracking-widest text-muted">Level</div><div className="font-display text-5xl font-bold leading-none">{data.level}</div></div></div>
          <div>
            <div className="font-display text-3xl font-bold"><AnimatedNumber value={data.xp} /> <span className="text-lg font-medium text-muted">XP</span></div>
            <ProgressBar value={data.pct} className="mt-3 max-w-lg" height={10} />
            <div className="mt-2 text-sm text-muted">{(data.next - data.xp).toLocaleString()} XP until level {data.level + 1}</div>
          </div>
          <div className="hidden md:block"><Mascot mood="cheer" size={140} /></div>
        </div>
      </section>
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard tone="warm" icon={<Flame />} label="Current streak" value={<><AnimatedNumber value={data.streak} /> {data.streak === 1 ? 'day' : 'days'}</>} />
        <StatCard tone="pink" icon={<Crown />} label="Longest streak" value={<><AnimatedNumber value={data.longestStreak} /> {data.longestStreak === 1 ? 'day' : 'days'}</>} />
        <StatCard tone="accent" icon={<Medal />} label="Badges earned" value={<>{earned}<span className="text-lg text-muted">/{data.badges.length}</span></>} />
      </div>
      <section>
        <h2 className="mb-4 font-display text-xl font-semibold">Badges</h2>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {data.badges.map((b, i) => {
            const I = (Icons as any)[b.icon] ?? Icons.Star; const on = !!b.earnedAt;
            return (
              <motion.div key={b.key} initial={{ opacity: 0, scale: 0.94 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: i * 0.03 }}>
                <Tilt rotationFactor={on ? 10 : 0}>
                  <div className={cn('surface relative p-5 text-center', !on && 'opacity-55 grayscale')}>
                    <div className="mx-auto mb-3 grid size-16 place-items-center rounded-2xl" style={{ background: `color-mix(in oklab, ${TONE_COLOR[b.tone === 'emerald' ? 'emerald' : b.tone === 'amber' ? 'amber' : b.tone]} 20%, transparent)`, color: TONE_COLOR[b.tone], boxShadow: on ? `0 0 28px -6px ${TONE_COLOR[b.tone]}` : undefined }}><I className="size-8" /></div>
                    <div className="font-display font-semibold">{b.name}</div>
                    <p className="mt-1 text-xs text-muted">{b.description}</p>
                    <div className="mt-3 text-[11px] font-medium text-subtle">{on ? <span className="text-success">Earned {dateFmt(b.earnedAt)}</span> : 'Locked'}</div>
                  </div>
                </Tilt>
              </motion.div>
            );
          })}
        </div>
      </section>
      <div className="grid gap-6 lg:grid-cols-2">
        <section className="surface p-6">
          <h2 className="mb-4 font-display text-lg font-semibold">Leaderboard</h2>
          <ol className="space-y-1.5">
            {(lb ?? []).slice(0, 10).map((r) => (
              <li key={r.id} className={cn('flex items-center gap-3 rounded-xl px-3 py-2.5', r.me && 'bg-primary/12 ring-1 ring-primary/30')}>
                <span className={cn('grid size-7 place-items-center rounded-full text-xs font-bold', r.rank === 1 ? 'bg-warm text-black' : r.rank === 2 ? 'bg-slate-300 text-black' : r.rank === 3 ? 'bg-orange-400 text-black' : 'bg-card-2 text-muted')}>{r.rank}</span>
                <Avatar name={r.name} color={r.avatarColor} size={32} />
                <div className="min-w-0 flex-1 truncate text-sm font-medium">{r.name}{r.me && <span className="ml-2 text-xs text-primary-2">you</span>}</div>
                {r.streak > 1 && <Badge tone="warn"><Flame className="size-3" />{r.streak}</Badge>}
                <div className="font-display text-sm font-semibold tabular-nums">{r.xp.toLocaleString()} XP</div>
              </li>
            ))}
          </ol>
        </section>
        <section className="surface p-6">
          <h2 className="mb-4 font-display text-lg font-semibold">Recent XP</h2>
          {data.recentXp.length === 0 ? <p className="text-sm text-muted">Complete a lesson to earn your first XP.</p> : (
            <ul className="space-y-3">{data.recentXp.map((x, i) => <li key={i} className="flex items-center justify-between text-sm"><span className="text-muted">{REASON[x.reason] ?? x.reason}<span className="ml-2 text-xs text-subtle">{timeAgo(x.createdAt)}</span></span><span className="font-semibold text-success">+{x.amount} XP</span></li>)}</ul>
          )}
        </section>
      </div>
    </div>
  );
}

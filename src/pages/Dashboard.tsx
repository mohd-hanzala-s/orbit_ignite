import { Link } from 'react-router-dom';
import { motion } from 'motion/react';
import { Flame, Zap, GraduationCap, Clock, ArrowRight, CalendarClock, Megaphone, Video, Trophy, PlayCircle, Sparkles } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { useGet } from '@/lib/queries';
import type { Announcement, CourseCard } from '@/lib/types';
import { greeting, dateFmt, daysUntil, formatDuration, timeAgo, dateTimeFmt, pluralize } from '@/lib/utils';
import { Mascot } from '@/components/space/Mascot';
import { ProgressRing } from '@/components/space/ProgressRing';
import { CourseCover } from '@/components/space/CourseCover';
import { CourseCardView } from '@/components/CourseCardView';
import { BarChart } from '@/components/charts';
import { StatCard, Skeleton, ErrorState, Badge, EmptyState } from '@/components/ui/misc';
import { LinkButton } from '@/components/ui/button';
import { AnimatedNumber } from '@/components/mp/animated-number';
import { TextEffect } from '@/components/mp/text-effect';
import { TextLoop } from '@/components/mp/text-loop';
import { BorderTrail } from '@/components/mp/border-trail';
import { Tilt } from '@/components/mp/tilt';

interface Dash {
  stats: { xp: number; level: number; pct: number; next: number; streak: number; longestStreak: number; lessonsCompleted: number; coursesCompleted: number; coursesActive: number; hours: number; badges: number; totalBadges: number; rank: number };
  continueLearning: CourseCard[];
  week: { date: string; label: string; lessons: number; minutes: number }[];
  due: { courseId: number; title: string; theme: string; dueDate: string; progress: number }[];
  live: { lessonId: number; courseId: number; courseTitle: string; title: string; startsAt: string; durationMin: number; platform: string; joinUrl: string }[];
  announcements: Announcement[];
  recommended: CourseCard[];
}

const TIPS = ['Tip: press ⌘K to search anything.', 'Tip: notes you take are private to you.', 'Tip: keep a streak to unlock Hyperdrive.', 'Tip: J / K jumps between lessons.'];

export default function Dashboard() {
  const { user } = useAuth();
  const { data, isLoading, error, refetch } = useGet<Dash>('/me/dashboard');
  if (error) return <ErrorState error={error} onRetry={refetch} />;
  if (isLoading || !data || !user) return <div className="space-y-6"><Skeleton className="h-52" /><div className="grid grid-cols-2 gap-4 lg:grid-cols-4">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-36" />)}</div><Skeleton className="h-72" /></div>;
  const s = data.stats;
  const resume = data.continueLearning[0];
  const first = user.name.split(' ')[0];

  return (
    <div className="space-y-8">
      {/* hero */}
      <section className="surface relative overflow-hidden p-7 sm:p-9">
        <div className="pointer-events-none absolute -right-24 -top-24 size-80 rounded-full bg-primary/25 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 left-1/3 size-72 rounded-full bg-accent/10 blur-3xl" />
        <div className="relative grid items-center gap-6 md:grid-cols-[1fr_auto]">
          <div>
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-line-2 bg-card px-3 py-1 text-xs text-muted">
              <Sparkles className="size-3.5 text-warm" />
              <TextLoop interval={4}>{TIPS.map((t) => <span key={t}>{t}</span>)}</TextLoop>
            </div>
            <TextEffect as="h1" per="word" preset="fade-in-blur" className="font-display text-3xl font-bold tracking-tight sm:text-[40px] sm:leading-[1.1]">{`${greeting()}, ${first}!`}</TextEffect>
            <p className="mt-3 max-w-xl text-[15px] leading-relaxed text-muted">
              {s.streak > 0 ? <>You're on a <b className="text-warm">{s.streak}-day streak</b> 🔥 — </> : null}
              {resume ? <>pick up where you left off in <b className="text-fg">{resume.title}</b>.</> : <>ready to start your first mission? Explore the catalog.</>}
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              {resume ? (
                <LinkButton to={resume.enrollment?.lastLessonId ? `/courses/${resume.id}/learn/${resume.enrollment.lastLessonId}` : `/courses/${resume.id}/learn`} variant="primary" size="lg" icon={<PlayCircle className="size-5" />}>Resume mission</LinkButton>
              ) : null}
              <LinkButton to="/catalog" variant={resume ? 'secondary' : 'primary'} size="lg">Explore catalog <ArrowRight className="size-4" /></LinkButton>
            </div>
          </div>
          <div className="hidden md:block"><Tilt rotationFactor={8} isRevese><Mascot mood={s.streak >= 3 ? 'cheer' : 'wave'} size={190} /></Tilt></div>
        </div>
      </section>

      {/* stats */}
      <section className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard tone="primary" icon={<Zap />} label={`Level ${s.level} · ${s.pct}% to next`} value={<><AnimatedNumber value={s.xp} /> <span className="text-sm font-medium text-muted">XP</span></>} sub={`Rank #${s.rank} on the leaderboard`} />
        <StatCard tone="warm" icon={<Flame />} label="Day streak" value={<AnimatedNumber value={s.streak} />} sub={`Longest: ${pluralize(s.longestStreak, 'day')}`} />
        <StatCard tone="accent" icon={<GraduationCap />} label="Lessons completed" value={<AnimatedNumber value={s.lessonsCompleted} />} sub={`${pluralize(s.coursesCompleted, 'course')} finished · ${s.coursesActive} active`} />
        <StatCard tone="pink" icon={<Clock />} label="Hours learned" value={<AnimatedNumber value={s.hours} />} sub={<Link to="/achievements" className="inline-flex items-center gap-1 text-primary-2 hover:underline"><Trophy className="size-3" /> {s.badges}/{s.totalBadges} badges</Link>} />
      </section>

      <div className="grid grid-cols-[minmax(0,1fr)] gap-8 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="min-w-0 space-y-8">
          {/* continue */}
          <section>
            <div className="mb-4 flex items-center justify-between"><h2 className="font-display text-xl font-semibold">Continue learning</h2><Link to="/learning" className="flex items-center gap-1 text-sm font-medium text-primary-2 hover:underline">All missions <ArrowRight className="size-3.5" /></Link></div>
            {data.continueLearning.length === 0 ? (
              <div className="surface"><EmptyState title="No active missions yet" description="Pick a course from the catalog and your progress will show up here." mood="wave" action={<LinkButton to="/catalog" variant="primary">Browse courses</LinkButton>} /></div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                {data.continueLearning.slice(0, 4).map((c, i) => (
                  <motion.div key={c.id} className="min-w-0" initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }}>
                    <Link to={c.enrollment?.lastLessonId ? `/courses/${c.id}/learn/${c.enrollment.lastLessonId}` : `/courses/${c.id}/learn`} className="surface surface-hover group relative flex items-center gap-4 p-4">
                      {i === 0 && <BorderTrail className="bg-gradient-to-r from-primary via-accent to-pink" size={90} transition={{ duration: 6, repeat: Infinity, ease: 'linear' }} />}
                      <div className="size-20 shrink-0 overflow-hidden rounded-2xl"><CourseCover theme={c.theme} seed={c.id} coverUrl={c.coverUrl} /></div>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-[11px] font-semibold uppercase tracking-wider text-subtle">{c.category?.name}</div>
                        <div className="mt-0.5 line-clamp-2 font-display text-[15px] font-semibold leading-snug">{c.title}</div>
                        <div className="mt-1 text-xs text-muted">{formatDuration(c.durationMinutes)} · {c.lessonCount} lessons</div>
                      </div>
                      <ProgressRing value={c.enrollment?.progress ?? 0} size={52} />
                    </Link>
                  </motion.div>
                ))}
              </div>
            )}
          </section>

          {/* activity */}
          <section className="surface p-6">
            <div className="mb-5 flex items-center justify-between">
              <div><h2 className="font-display text-lg font-semibold">This week</h2><p className="text-sm text-muted">Minutes spent learning each day</p></div>
              <Badge tone="primary">{data.week.reduce((a, d) => a + d.lessons, 0)} lessons</Badge>
            </div>
            <BarChart data={data.week.map((d) => ({ label: d.label, value: d.minutes }))} unit="m" height={150} />
          </section>

          {/* recommended */}
          {data.recommended.length > 0 && (
            <section>
              <div className="mb-4 flex items-center justify-between"><h2 className="font-display text-xl font-semibold">Recommended for you</h2><Link to="/catalog" className="flex items-center gap-1 text-sm font-medium text-primary-2 hover:underline">See all <ArrowRight className="size-3.5" /></Link></div>
              <div className="grid gap-5 sm:grid-cols-2 2xl:grid-cols-2">{data.recommended.slice(0, 4).map((c, i) => <CourseCardView key={c.id} course={c} index={i} />)}</div>
            </section>
          )}
        </div>

        {/* right rail */}
        <aside className="space-y-6">
          <section className="surface p-5">
            <h3 className="mb-4 flex items-center gap-2 font-display font-semibold"><CalendarClock className="size-4 text-warm" /> Due soon</h3>
            {data.due.length === 0 ? <p className="text-sm text-muted">Nothing due. Nice and clear skies ☀️</p> : (
              <ul className="space-y-3">
                {data.due.map((d) => { const days = daysUntil(d.dueDate); return (
                  <li key={d.courseId}>
                    <Link to={`/courses/${d.courseId}`} className="flex items-center gap-3 rounded-xl p-2 transition-colors hover:bg-card-2">
                      <div className="size-11 shrink-0 overflow-hidden rounded-xl"><CourseCover theme={d.theme} seed={d.courseId} /></div>
                      <div className="min-w-0 flex-1"><div className="truncate text-sm font-medium">{d.title}</div><div className="text-xs text-muted">{d.progress}% done · {dateFmt(d.dueDate, { month: 'short', day: 'numeric' })}</div></div>
                      <Badge tone={days < 0 ? 'danger' : days <= 7 ? 'warn' : 'neutral'}>{days < 0 ? `${-days}d late` : days === 0 ? 'Today' : `${days}d`}</Badge>
                    </Link>
                  </li>
                ); })}
              </ul>
            )}
          </section>

          <section className="surface p-5">
            <div className="mb-4 flex items-center justify-between"><h3 className="flex items-center gap-2 font-display font-semibold"><Video className="size-4 text-accent" /> Live sessions</h3><Link to="/calendar" className="text-xs font-medium text-primary-2 hover:underline">Calendar</Link></div>
            {data.live.length === 0 ? <p className="text-sm text-muted">No upcoming live sessions.</p> : (
              <ul className="space-y-3">
                {data.live.map((l) => (
                  <li key={l.lessonId} className="rounded-xl border border-line bg-card-2/50 p-3.5">
                    <div className="text-xs font-semibold text-accent">{dateTimeFmt(l.startsAt)} · {l.durationMin} min</div>
                    <div className="mt-1 text-sm font-semibold leading-snug">{l.title}</div>
                    <div className="text-xs text-muted">{l.courseTitle}</div>
                    <Link to={`/courses/${l.courseId}/learn/${l.lessonId}`} className="mt-2.5 inline-flex items-center gap-1 text-xs font-semibold text-primary-2 hover:underline">Details <ArrowRight className="size-3" /></Link>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="surface p-5">
            <h3 className="mb-4 flex items-center gap-2 font-display font-semibold"><Megaphone className="size-4 text-pink" /> Announcements</h3>
            {data.announcements.length === 0 ? <p className="text-sm text-muted">No announcements.</p> : (
              <ul className="space-y-4">
                {data.announcements.map((a) => (
                  <li key={a.id}>
                    <div className="flex items-center gap-2"><div className="text-sm font-semibold">{a.title}</div>{a.pinned && <Badge tone="primary">Pinned</Badge>}</div>
                    <p className="mt-1 line-clamp-3 text-[13px] leading-relaxed text-muted">{a.body}</p>
                    <div className="mt-1 text-[11px] text-subtle">{a.author} · {timeAgo(a.createdAt)}</div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </aside>
      </div>
    </div>
  );
}

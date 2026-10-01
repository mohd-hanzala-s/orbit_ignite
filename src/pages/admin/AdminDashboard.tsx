import { Link } from 'react-router-dom';
import { Users, GraduationCap, CheckCircle2, Activity, ClipboardCheck, Award, Target, FileClock, ArrowRight, BookOpenCheck } from 'lucide-react';
import { useGet } from '@/lib/queries';
import { useAuth } from '@/lib/auth';
import { cn, timeAgo } from '@/lib/utils';
import { StatCard, PageHeader, Skeleton, ErrorState, Avatar, ProgressBar, EmptyState, Badge } from '@/components/ui/misc';
import { AreaChart, Donut, TONE_COLOR } from '@/components/charts';
import { CourseCover } from '@/components/space/CourseCover';
import { AnimatedNumber } from '@/components/mp/animated-number';
import { LinkButton } from '@/components/ui/button';

interface Stats {
  kpis: { learners: number; courses: number; draftCourses: number; enrollments: number; completions: number; completionRate: number; activeLearners: number; avgScore: number | null; pendingGrading: number; certificates: number };
  trend: { date: string; label: string; enrollments: number; completions: number }[];
  topCourses: { id: number; title: string; theme: string; enrolled: number; completed: number; avgProgress: number }[];
  categories: { name: string; color: string; value: number }[];
  recent: { id: number; action: string; user: string; avatarColor: string; entity: string | null; meta: Record<string, any>; createdAt: string }[];
}
export const ACTION_LABEL: Record<string, string> = {
  'auth.login': 'signed in', 'auth.register': 'joined the platform', 'course.enrolled': 'enrolled in a course', 'course.completed': 'completed a course', 'lesson.completed': 'completed a lesson', 'course.created': 'created a course',
  'course.published': 'published a course', 'course.draft': 'moved a course to draft', 'course.archived': 'archived a course', 'course.deleted': 'deleted a course', 'file.uploaded': 'uploaded a file', 'scorm.uploaded': 'uploaded a SCORM package',
  'user.created': 'created a user', 'user.updated': 'updated a user', 'user.deleted': 'deleted a user', 'user.imported': 'imported users', 'enrollment.assigned': 'assigned a course', 'assignment.submitted': 'submitted an assignment', 'settings.updated': 'updated settings',
};

export default function AdminDashboard() {
  const { user } = useAuth();
  const { data, error, refetch } = useGet<Stats>('/admin/stats');
  if (error) return <ErrorState error={error} onRetry={refetch} />;
  if (!data) return <div className="space-y-6"><Skeleton className="h-28" /><div className="grid grid-cols-2 gap-4 lg:grid-cols-4">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-36" />)}</div><Skeleton className="h-80" /></div>;
  const k = data.kpis;
  return (
    <div className="space-y-8">
      <PageHeader eyebrow="Mission Control" title={`Welcome back, ${user?.name.split(' ')[0]}`} description="Here's how learning is going across the platform." actions={<><LinkButton to="/admin/courses" variant="secondary">Manage courses</LinkButton><LinkButton to="/admin/reports" variant="primary">View reports</LinkButton></>} />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard tone="primary" icon={<Users />} label="Active learners" value={<AnimatedNumber value={k.learners} />} sub={`${k.activeLearners} active in the last 7 days`} />
        <StatCard tone="accent" icon={<GraduationCap />} label="Published courses" value={<AnimatedNumber value={k.courses} />} sub={`${k.draftCourses} in draft`} />
        <StatCard tone="success" icon={<CheckCircle2 />} label="Completion rate" value={<><AnimatedNumber value={k.completionRate} />%</>} sub={`${k.completions} of ${k.enrollments} enrollments`} />
        <StatCard tone="warm" icon={<Target />} label="Avg. quiz score" value={k.avgScore != null ? <><AnimatedNumber value={k.avgScore} />%</> : '—'} sub={`${k.certificates} certificates issued`} />
      </div>
      {k.pendingGrading > 0 && (
        <Link to="/admin/grading" className="surface surface-hover flex items-center gap-4 border-pink/30 p-4"><span className="grid size-11 place-items-center rounded-xl bg-pink/15 text-pink"><ClipboardCheck className="size-5" /></span><div className="flex-1"><div className="font-semibold">{k.pendingGrading} submission{k.pendingGrading > 1 ? 's' : ''} waiting for review</div><div className="text-sm text-muted">Learners are waiting for your feedback.</div></div><ArrowRight className="size-5 text-muted" /></Link>
      )}
      <div className="grid grid-cols-[minmax(0,1fr)] gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
        <section className="surface p-6">
          <div className="mb-4 flex items-center justify-between"><div><h2 className="font-display text-lg font-semibold">Enrollments & completions</h2><p className="text-sm text-muted">Last 30 days</p></div><Badge tone="primary"><Activity className="size-3" /> Live</Badge></div>
          <AreaChart data={data.trend} series={[{ key: 'enrollments', label: 'Enrollments', color: 'var(--primary-2)' }, { key: 'completions', label: 'Completions', color: 'var(--success)' }]} height={240} />
        </section>
        <section className="surface p-6">
          <h2 className="mb-5 font-display text-lg font-semibold">Enrollments by category</h2>
          {data.categories.length ? <Donut label="enrollments" data={data.categories.map((c) => ({ name: c.name, value: c.value, color: TONE_COLOR[c.color] ?? 'var(--primary-2)' }))} /> : <EmptyState compact title="No data yet" />}
        </section>
      </div>
      <div className="grid grid-cols-[minmax(0,1fr)] gap-6 xl:grid-cols-2">
        <section className="surface p-6">
          <div className="mb-4 flex items-center justify-between"><h2 className="font-display text-lg font-semibold">Top courses</h2><Link to="/admin/reports" className="text-sm font-medium text-primary-2 hover:underline">Full report</Link></div>
          <ul className="space-y-4">
            {data.topCourses.map((c) => (
              <li key={c.id}><Link to={`/admin/courses/${c.id}`} className="flex items-center gap-4 rounded-xl p-1.5 transition-colors hover:bg-card-2">
                <div className="size-12 shrink-0 overflow-hidden rounded-xl"><CourseCover theme={c.theme} seed={c.id} /></div>
                <div className="min-w-0 flex-1"><div className="truncate text-sm font-semibold">{c.title}</div><div className="mt-1.5 flex items-center gap-3"><ProgressBar value={c.avgProgress} height={5} /><span className="w-9 text-right text-xs tabular-nums text-muted">{c.avgProgress}%</span></div></div>
                <div className="text-right"><div className="font-display font-semibold tabular-nums">{c.enrolled}</div><div className="text-[11px] text-subtle">enrolled</div></div>
              </Link></li>
            ))}
          </ul>
        </section>
        <section className="surface p-6">
          <h2 className="mb-4 font-display text-lg font-semibold">{user?.role === 'admin' ? 'Recent activity' : 'Your courses at a glance'}</h2>
          {user?.role === 'admin' ? (
            <ul className="space-y-3.5">
              {data.recent.map((a) => (
                <li key={a.id} className="flex items-center gap-3"><Avatar name={a.user} color={a.avatarColor} size={32} /><div className="min-w-0 flex-1 text-sm"><b className="font-semibold">{a.user}</b> <span className="text-muted">{ACTION_LABEL[a.action] ?? a.action}</span>{a.meta?.title && <span className="text-muted"> · <span className="text-fg/80">{String(a.meta.title)}</span></span>}</div><span className="shrink-0 text-xs text-subtle">{timeAgo(a.createdAt)}</span></li>
              ))}
            </ul>
          ) : (
            <div className="grid grid-cols-2 gap-3">{[{ i: BookOpenCheck, l: 'Courses live', v: k.courses }, { i: Users, l: 'Learners', v: k.learners }, { i: FileClock, l: 'To grade', v: k.pendingGrading }, { i: Award, l: 'Certificates', v: k.certificates }].map((x) => <div key={x.l} className={cn('rounded-2xl border border-line bg-card-2/40 p-4')}><x.i className="mb-2 size-5 text-primary-2" /><div className="font-display text-2xl font-bold">{x.v}</div><div className="text-xs text-muted">{x.l}</div></div>)}</div>
          )}
        </section>
      </div>
    </div>
  );
}

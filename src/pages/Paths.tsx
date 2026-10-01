import { Link, useParams } from 'react-router-dom';
import { motion } from 'motion/react';
import { ArrowRight, CheckCircle2, Clock, Route as RouteIcon, Star } from 'lucide-react';
import { toast } from 'sonner';
import { useGet, useAct } from '@/lib/queries';
import { api } from '@/lib/api';
import type { PathDto } from '@/lib/types';
import { formatDuration, pluralize } from '@/lib/utils';
import { CourseCover } from '@/components/space/CourseCover';
import { ProgressRing } from '@/components/space/ProgressRing';
import { PageHeader, Skeleton, EmptyState, ErrorState, Badge } from '@/components/ui/misc';
import { Button, LinkButton } from '@/components/ui/button';
import { CourseCardView } from '@/components/CourseCardView';

export function PathsPage() {
  const { data, isLoading, error, refetch } = useGet<PathDto[]>('/paths');
  if (error) return <ErrorState error={error} onRetry={refetch} />;
  return (
    <div>
      <PageHeader eyebrow="Guided journeys" title="Constellations" description="Learning paths bundle courses into a curated route — join one and every course is added to your missions." />
      {isLoading ? <div className="grid gap-5 md:grid-cols-2">{[0, 1].map((i) => <Skeleton key={i} className="h-64" />)}</div> : !data?.length ? <div className="surface"><EmptyState title="No constellations yet" description="Your administrator hasn't published any learning paths." /></div> : (
        <div className="grid gap-5 md:grid-cols-2">
          {data.map((p, i) => (
            <motion.div key={p.id} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.07 }}>
              <Link to={`/paths/${p.id}`} className="surface surface-hover group relative block h-full overflow-hidden">
                <div className="absolute inset-0 opacity-50 transition-opacity group-hover:opacity-70"><CourseCover theme={p.theme} seed={p.id + 3} rounded={false} className="scale-110 blur-xl" /></div>
                <div className="absolute inset-0 bg-gradient-to-t from-bg via-bg/70 to-bg/20" />
                <div className="relative flex h-full min-h-[260px] flex-col p-6">
                  <div className="flex items-start justify-between"><Badge tone="primary"><RouteIcon className="size-3" /> Learning path</Badge>{p.enrolled && <ProgressRing value={p.progress} size={52} />}</div>
                  <div className="mt-auto pt-10">
                    <h2 className="font-display text-2xl font-bold tracking-tight">{p.title}</h2>
                    <p className="mt-2 line-clamp-2 text-sm text-muted">{p.description}</p>
                    <div className="mt-4 flex flex-wrap items-center gap-4 text-xs text-muted">
                      <span>{pluralize(p.courseCount, 'course')}</span><span className="flex items-center gap-1"><Clock className="size-3.5" />{formatDuration(p.durationMinutes)}</span>
                      {p.enrolled ? <span className="text-success">{p.completedCount}/{p.courseCount} complete</span> : <span className="ml-auto flex items-center gap-1 font-semibold text-primary-2">View path <ArrowRight className="size-3.5" /></span>}
                    </div>
                  </div>
                </div>
              </Link>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}

export function PathDetail() {
  const { id } = useParams();
  const { data: p, isLoading, error, refetch } = useGet<PathDto>(`/paths/${id}`);
  const join = useAct(() => api.post(`/paths/${id}/enroll`), { invalidate: [[`/paths/${id}`], ['/paths'], ['/courses'], ['/me/dashboard'], ['/me/learning']], onSuccess: () => toast.success('Constellation joined — all courses added to your missions!') });
  if (error) return <ErrorState error={error} onRetry={refetch} />;
  if (isLoading || !p) return <Skeleton className="h-96" />;
  return (
    <div className="space-y-8">
      <PageHeader back={{ to: '/paths', label: 'All constellations' }} eyebrow="Learning path" title={p.title} description={p.description} actions={p.enrolled ? <Badge tone="success"><CheckCircle2 className="size-3" /> Joined</Badge> : <Button variant="primary" size="lg" loading={join.isPending} onClick={() => join.mutate()}>Join this constellation</Button>} />
      <div className="surface flex flex-wrap items-center gap-8 p-6">
        <ProgressRing value={p.progress} size={84} stroke={7} />
        <div><div className="font-display text-2xl font-bold">{p.completedCount}/{p.courseCount}</div><div className="text-sm text-muted">courses completed</div></div>
        <div><div className="font-display text-2xl font-bold">{formatDuration(p.durationMinutes)}</div><div className="text-sm text-muted">total learning time</div></div>
        {p.completedCount === p.courseCount && p.courseCount > 0 && <LinkButton to="/certificates" className="ml-auto" variant="secondary" icon={<Star className="size-4 text-warm" />}>View certificates</LinkButton>}
      </div>
      <ol className="relative space-y-6 pl-0 sm:pl-12">
        <div className="absolute bottom-10 left-[19px] top-10 hidden w-px bg-gradient-to-b from-primary via-accent to-transparent sm:block" aria-hidden />
        {p.courses.map((c, i) => (
          <li key={c.id} className="relative">
            <span className={`absolute -left-12 top-8 hidden size-10 place-items-center rounded-full border-2 font-display text-sm font-bold sm:grid ${c.enrollment?.status === 'completed' ? 'border-success bg-success/20 text-success' : 'border-primary bg-bg text-primary-2'}`}>{c.enrollment?.status === 'completed' ? <CheckCircle2 className="size-5" /> : i + 1}</span>
            <div className="max-w-xl"><CourseCardView course={c} index={i} /></div>
          </li>
        ))}
      </ol>
    </div>
  );
}

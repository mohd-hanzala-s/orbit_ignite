import { useState } from 'react';
import { useGet } from '@/lib/queries';
import type { CourseCard } from '@/lib/types';
import { CourseCardView } from '@/components/CourseCardView';
import { EmptyState, ErrorState, PageHeader, Skeleton, Tabs } from '@/components/ui/misc';
import { LinkButton } from '@/components/ui/button';

export default function MyLearning() {
  const { data, isLoading, error, refetch } = useGet<{ inProgress: CourseCard[]; completed: CourseCard[]; saved: CourseCard[] }>('/me/learning');
  const [tab, setTab] = useState<'inProgress' | 'completed' | 'saved'>('inProgress');
  if (error) return <ErrorState error={error} onRetry={refetch} />;
  const list = data?.[tab] ?? [];
  const empty = { inProgress: ['No active missions', 'Enroll in a course to see it here.'], completed: ['Nothing completed yet', 'Finish a course to earn your first certificate.'], saved: ['Nothing saved', 'Tap the bookmark on any course to save it for later.'] }[tab];
  return (
    <div>
      <PageHeader eyebrow="Your journey" title="My missions" description="Everything you're enrolled in, finished, or saved for later." />
      <Tabs className="mb-7" value={tab} onChange={setTab} items={[{ value: 'inProgress', label: 'In progress', count: data?.inProgress.length }, { value: 'completed', label: 'Completed', count: data?.completed.length }, { value: 'saved', label: 'Saved', count: data?.saved.length }]} />
      {isLoading ? <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-[360px]" />)}</div>
        : list.length === 0 ? <div className="surface"><EmptyState mood={tab === 'completed' ? 'cheer' : 'wave'} title={empty[0]} description={empty[1]} action={<LinkButton to="/catalog" variant="primary">Explore catalog</LinkButton>} /></div>
        : <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">{list.map((c, i) => <CourseCardView key={c.id} course={c} index={i} to={tab === 'inProgress' && c.enrollment?.lastLessonId ? `/courses/${c.id}/learn/${c.enrollment.lastLessonId}` : undefined} />)}</div>}
    </div>
  );
}

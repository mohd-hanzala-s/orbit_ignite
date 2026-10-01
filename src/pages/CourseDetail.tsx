import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { motion } from 'motion/react';
import { toast } from 'sonner';
import { Award, BarChart3, CheckCircle2, Clock, FileText, Lock, PlayCircle, Star, Users, Video, Headphones, FileBox, Link2, Code2, ClipboardCheck, PenLine, CalendarClock, Globe, Pencil, ListChecks, Layers } from 'lucide-react';
import { useGet, useAct } from '@/lib/queries';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import type { CourseDetail as CD, LessonType, DiscussionPost } from '@/lib/types';
import { cn, formatDuration, dateFmt, timeAgo, pluralize, daysUntil } from '@/lib/utils';
import { CourseCover } from '@/components/space/CourseCover';
import { ProgressRing } from '@/components/space/ProgressRing';
import { Badge, Avatar, Skeleton, ErrorState, Tabs, ProgressBar, EmptyState } from '@/components/ui/misc';
import { Button, LinkButton } from '@/components/ui/button';
import { Textarea } from '@/components/ui/form';
import { Markdown } from '@/components/ui/Markdown';
import { SaveButton } from '@/components/CourseCardView';
import { ConfirmDialog } from '@/components/ui/dialog';
import { Discussion } from '@/components/Discussion';

export const LESSON_ICONS: Record<LessonType, any> = { video: Video, audio: Headphones, document: FileText, scorm: Layers, page: FileText, link: Link2, embed: Globe, quiz: ClipboardCheck, assignment: PenLine, live: CalendarClock };
export const LESSON_LABEL: Record<LessonType, string> = { video: 'Video', audio: 'Audio', document: 'Document', scorm: 'SCORM', page: 'Reading', link: 'Link', embed: 'Embed', quiz: 'Quiz', assignment: 'Assignment', live: 'Live session' };

function Stars({ value, size = 14 }: { value: number; size?: number }) {
  return <span className="inline-flex">{[1, 2, 3, 4, 5].map((i) => <Star key={i} style={{ width: size, height: size }} className={i <= Math.round(value) ? 'fill-warm text-warm' : 'text-line-2'} />)}</span>;
}

function ReviewBox({ course }: { course: CD }) {
  const [rating, setRating] = useState(course.myReview?.rating ?? 0);
  const [body, setBody] = useState(course.myReview?.body ?? '');
  const submit = useAct(() => api.post(`/courses/${course.id}/reviews`, { rating, body }), { invalidate: [[`/courses/${course.id}`], [`/courses/${course.id}/reviews`]], success: 'Thanks for your review!' });
  return (
    <div className="surface p-5">
      <div className="mb-3 font-display font-semibold">{course.myReview ? 'Update your review' : 'Rate this course'}</div>
      <div className="mb-3 flex gap-1" role="radiogroup" aria-label="Rating">
        {[1, 2, 3, 4, 5].map((i) => <button key={i} type="button" role="radio" aria-checked={rating === i} aria-label={`${i} star${i > 1 ? 's' : ''}`} onClick={() => setRating(i)} className="p-0.5 transition-transform hover:scale-110"><Star className={cn('size-7', i <= rating ? 'fill-warm text-warm' : 'text-line-2')} /></button>)}
      </div>
      <Textarea value={body} onChange={(e) => setBody(e.target.value)} placeholder="What did you think? (optional)" className="min-h-20" maxLength={1000} />
      <Button className="mt-3" variant="primary" disabled={!rating} loading={submit.isPending} onClick={() => submit.mutate()}>Submit review</Button>
    </div>
  );
}

export default function CourseDetail() {
  const { id } = useParams();
  const nav = useNavigate();
  const { user } = useAuth();
  const { data: c, isLoading, error, refetch } = useGet<CD>(`/courses/${id}`);
  const { data: reviews } = useGet<{ id: number; rating: number; body: string; createdAt: string; user: { name: string; avatarColor: string } }[]>(`/courses/${id}/reviews`);
  const [tab, setTab] = useState<'overview' | 'curriculum' | 'reviews' | 'discussion'>('overview');
  const [leave, setLeave] = useState(false);
  const enroll = useAct(() => api.post(`/courses/${id}/enroll`), { invalidate: [[`/courses/${id}`], ['/courses'], ['/me/dashboard'], ['/me/learning']], onSuccess: () => { toast.success('You are enrolled — welcome aboard! 🚀'); nav(`/courses/${id}/learn`); } });
  const unenroll = useAct(() => api.del(`/courses/${id}/enroll`), { invalidate: [[`/courses/${id}`], ['/courses'], ['/me/dashboard'], ['/me/learning']], success: 'You left the course', onSuccess: () => setLeave(false) });

  if (error) return <ErrorState error={error} onRetry={refetch} />;
  if (isLoading || !c) return <div className="space-y-6"><Skeleton className="h-80" /><Skeleton className="h-96" /></div>;

  const e = c.enrollment;
  const allLessons = c.sections.flatMap((s) => s.lessons);
  const next = allLessons.find((l) => l.status !== 'completed' && !l.locked) ?? allLessons[0];
  const resumeId = e?.lastLessonId ?? next?.id;
  const done = allLessons.filter((l) => l.status === 'completed').length;
  const canLearn = !!e || (user && user.role !== 'learner');
  const overdue = e?.dueDate && e.status === 'active' && daysUntil(e.dueDate) < 0;

  return (
    <div className="space-y-8">
      {/* hero */}
      <section className="surface relative overflow-hidden">
        <div className="absolute inset-0 opacity-60"><CourseCover theme={c.theme} seed={c.id} coverUrl={c.coverUrl} rounded={false} className="scale-125 blur-2xl" /></div>
        <div className="absolute inset-0 bg-gradient-to-r from-bg via-bg/85 to-bg/30" />
        <div className="relative grid gap-8 p-6 sm:p-10 lg:grid-cols-[1fr_380px]">
          <div className="flex flex-col justify-center">
            <div className="mb-4 flex flex-wrap items-center gap-2">
              {c.category && <Badge tone="primary">{c.category.name}</Badge>}
              <Badge tone={c.level === 'Beginner' ? 'success' : c.level === 'Advanced' ? 'pink' : 'warn'}>{c.level}</Badge>
              {c.status !== 'published' && <Badge tone="warn" className="uppercase">{c.status}</Badge>}
              {c.sequential && <Badge tone="neutral"><Lock className="size-3" /> Sequential</Badge>}
            </div>
            <h1 className="font-display text-3xl font-bold leading-[1.1] tracking-tight sm:text-[42px]">{c.title}</h1>
            <p className="mt-3 max-w-2xl text-base leading-relaxed text-muted">{c.subtitle}</p>
            <div className="mt-5 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-muted">
              {c.rating != null && <span className="flex items-center gap-1.5"><Stars value={c.rating} /> <b className="text-fg">{c.rating}</b> ({c.ratingCount})</span>}
              <span className="flex items-center gap-1.5"><Users className="size-4" />{pluralize(c.enrolledCount, 'learner')}</span>
              <span className="flex items-center gap-1.5"><Clock className="size-4" />{formatDuration(c.durationMinutes)}</span>
              <span className="flex items-center gap-1.5"><ListChecks className="size-4" />{pluralize(c.lessonCount, 'lesson')}</span>
              {c.certificate && <span className="flex items-center gap-1.5"><Award className="size-4 text-warm" />Certificate</span>}
            </div>
            {c.instructor && <div className="mt-6 flex items-center gap-3"><Avatar name={c.instructor.name} color={c.instructor.avatarColor} size={40} /><div><div className="text-sm font-semibold">{c.instructor.name}</div><div className="text-xs text-muted">{c.instructor.title || 'Instructor'}</div></div></div>}
          </div>

          <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} className="surface overflow-hidden bg-bg-2/80 backdrop-blur-xl dark:bg-[#0c0f2c]/80">
            <div className="relative aspect-video"><CourseCover theme={c.theme} seed={c.id} coverUrl={c.coverUrl} rounded={false} /><SaveButton course={c} className="absolute right-3 top-3" /></div>
            <div className="space-y-4 p-5">
              {e ? (
                <>
                  <div className="flex items-center gap-4">
                    <ProgressRing value={e.progress} size={64} />
                    <div className="min-w-0"><div className="font-display text-lg font-semibold">{e.status === 'completed' ? 'Mission complete!' : e.progress > 0 ? 'In progress' : 'Ready to begin'}</div><div className="text-sm text-muted">{done}/{allLessons.length} lessons done</div></div>
                  </div>
                  {e.dueDate && e.status === 'active' && <div className={cn('rounded-xl border px-3 py-2 text-sm', overdue ? 'border-danger/30 bg-danger/10 text-danger' : 'border-warm/30 bg-warm/10 text-warm')}>{overdue ? 'Overdue — was due' : 'Due'} {dateFmt(e.dueDate)}</div>}
                  <LinkButton to={resumeId ? `/courses/${c.id}/learn/${resumeId}` : `/courses/${c.id}/learn`} variant="primary" size="lg" className="w-full" icon={<PlayCircle className="size-5" />}>{e.status === 'completed' ? 'Review course' : e.progress > 0 ? 'Continue learning' : 'Start course'}</LinkButton>
                  {e.status === 'completed' && c.certificate && <LinkButton to="/certificates" variant="secondary" className="w-full" icon={<Award className="size-4" />}>View certificate</LinkButton>}
                  {e.status !== 'completed' && <button className="w-full text-center text-xs text-subtle hover:text-danger" onClick={() => setLeave(true)}>Leave this course</button>}
                </>
              ) : c.status !== 'published' && user?.role === 'learner' ? (
                <p className="text-sm text-muted">This course is not open for enrollment.</p>
              ) : c.enrollmentMode === 'invite' && user?.role === 'learner' ? (
                <div className="rounded-xl border border-line-2 p-4 text-sm text-muted"><Lock className="mb-1 size-4" /> Invite-only. Ask your administrator to enroll you.</div>
              ) : (
                <>
                  <Button variant="primary" size="lg" className="w-full" loading={enroll.isPending} onClick={() => enroll.mutate()} icon={<PlayCircle className="size-5" />}>Enroll — it's free</Button>
                  {allLessons.some((l) => l.preview) && <p className="text-center text-xs text-muted">Preview lessons are open before you enroll.</p>}
                </>
              )}
              {c.canEdit && <LinkButton to={`/admin/courses/${c.id}`} variant="outline" className="w-full" icon={<Pencil className="size-4" />}>Edit in course builder</LinkButton>}
              {user && user.role !== 'learner' && !e && <LinkButton to={`/courses/${c.id}/learn`} variant="ghost" className="w-full">Preview as staff</LinkButton>}
            </div>
          </motion.div>
        </div>
      </section>

      <Tabs value={tab} onChange={setTab} items={[{ value: 'overview', label: 'Overview' }, { value: 'curriculum', label: 'Curriculum', count: allLessons.length }, { value: 'reviews', label: 'Reviews', count: c.ratingCount }, { value: 'discussion', label: 'Discussion' }]} />

      {tab === 'overview' && (
        <div className="grid gap-8 lg:grid-cols-[1fr_340px]">
          <div className="space-y-8">
            <section className="surface p-6 sm:p-8"><h2 className="mb-4 font-display text-xl font-semibold">About this course</h2><Markdown>{c.description || '_No description yet._'}</Markdown></section>
            {c.objectives.length > 0 && (
              <section className="surface p-6 sm:p-8">
                <h2 className="mb-4 font-display text-xl font-semibold">What you'll learn</h2>
                <ul className="grid gap-3 sm:grid-cols-2">{c.objectives.map((o) => <li key={o} className="flex gap-2.5 text-sm"><CheckCircle2 className="mt-0.5 size-4 shrink-0 text-success" />{o}</li>)}</ul>
              </section>
            )}
          </div>
          <aside className="space-y-6">
            <div className="surface p-5">
              <h3 className="mb-3 font-display font-semibold">This course includes</h3>
              <ul className="space-y-2.5 text-sm text-muted">
                {Object.entries(allLessons.reduce<Record<string, number>>((a, l) => ({ ...a, [l.type]: (a[l.type] ?? 0) + 1 }), {})).map(([t, n]) => { const I = LESSON_ICONS[t as LessonType]; return <li key={t} className="flex items-center gap-3"><I className="size-4 text-primary-2" />{n} × {LESSON_LABEL[t as LessonType]}</li>; })}
                {c.certificate && <li className="flex items-center gap-3"><Award className="size-4 text-warm" />Certificate of completion</li>}
                <li className="flex items-center gap-3"><BarChart3 className="size-4 text-accent" />Pass mark {c.passMark}%</li>
              </ul>
            </div>
            {c.instructor && (
              <div className="surface p-5">
                <h3 className="mb-3 font-display font-semibold">Instructor</h3>
                <div className="flex items-center gap-3"><Avatar name={c.instructor.name} color={c.instructor.avatarColor} size={44} /><div><div className="font-semibold">{c.instructor.name}</div><div className="text-xs text-muted">{c.instructor.title}</div></div></div>
                {c.instructorBio && <p className="mt-3 text-sm text-muted">{c.instructorBio}</p>}
              </div>
            )}
            {c.tags.length > 0 && <div className="flex flex-wrap gap-2">{c.tags.map((t) => <Badge key={t}>#{t}</Badge>)}</div>}
          </aside>
        </div>
      )}

      {tab === 'curriculum' && (
        <div className="space-y-4">
          {c.sections.map((s, si) => (
            <section key={s.id} className="surface overflow-hidden">
              <div className="flex items-center justify-between border-b border-line bg-card-2/40 px-5 py-3.5">
                <div className="font-display font-semibold"><span className="mr-2 text-subtle">{String(si + 1).padStart(2, '0')}</span>{s.title}</div>
                <div className="text-xs text-muted">{s.lessons.length} lessons · {formatDuration(s.lessons.reduce((a, l) => a + l.durationMinutes, 0))}</div>
              </div>
              <ul>
                {s.lessons.map((l) => {
                  const I = LESSON_ICONS[l.type];
                  const open = canLearn || l.preview;
                  const inner = (
                    <>
                      <span className={cn('grid size-9 shrink-0 place-items-center rounded-xl', l.status === 'completed' ? 'bg-success/15 text-success' : 'bg-primary/12 text-primary-2')}>{l.status === 'completed' ? <CheckCircle2 className="size-[18px]" /> : l.locked ? <Lock className="size-4" /> : <I className="size-4" />}</span>
                      <span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium">{l.title}</span><span className="block truncate text-xs text-muted">{LESSON_LABEL[l.type]}{!l.required && ' · Optional'}</span></span>
                      {l.preview && !e && <Badge tone="info">Preview</Badge>}
                      {l.status === 'pending' && <Badge tone="warn">Awaiting review</Badge>}
                      <span className="shrink-0 text-xs tabular-nums text-subtle">{formatDuration(l.durationMinutes)}</span>
                    </>
                  );
                  return <li key={l.id}>{open && !l.locked ? <Link to={`/courses/${c.id}/learn/${l.id}`} className="flex items-center gap-3.5 border-b border-line px-5 py-3 transition-colors last:border-0 hover:bg-card-2">{inner}</Link> : <div className="flex items-center gap-3.5 border-b border-line px-5 py-3 opacity-60 last:border-0">{inner}</div>}</li>;
                })}
              </ul>
            </section>
          ))}
        </div>
      )}

      {tab === 'reviews' && (
        <div className="grid gap-6 lg:grid-cols-[340px_1fr]">
          <div className="space-y-5">
            <div className="surface p-5">
              <div className="flex items-end gap-3"><div className="font-display text-5xl font-bold">{c.rating ?? '—'}</div><div className="pb-1.5">{c.rating != null && <Stars value={c.rating} size={16} />}<div className="text-xs text-muted">{pluralize(c.ratingCount, 'review')}</div></div></div>
              <div className="mt-4 space-y-1.5">{c.ratingDistribution.map((r) => <div key={r.rating} className="flex items-center gap-2 text-xs"><span className="w-3 text-muted">{r.rating}</span><ProgressBar value={c.ratingCount ? (r.count / c.ratingCount) * 100 : 0} tone="warn" height={5} /><span className="w-5 text-right tabular-nums text-subtle">{r.count}</span></div>)}</div>
            </div>
            {c.enrolled && <ReviewBox course={c} />}
          </div>
          <div className="space-y-3">
            {!reviews?.length ? <div className="surface"><EmptyState compact title="No reviews yet" description="Be the first to share your experience." mood="happy" /></div> : reviews.map((r) => (
              <div key={r.id} className="surface p-5">
                <div className="flex items-center gap-3"><Avatar name={r.user.name} color={r.user.avatarColor} size={36} /><div className="min-w-0 flex-1"><div className="text-sm font-semibold">{r.user.name}</div><div className="text-xs text-subtle">{timeAgo(r.createdAt)}</div></div><Stars value={r.rating} /></div>
                {r.body && <p className="mt-3 text-sm leading-relaxed text-muted">{r.body}</p>}
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === 'discussion' && (c.enrolled || user?.role !== 'learner' ? <Discussion courseId={c.id} /> : <div className="surface"><EmptyState title="Enroll to join the conversation" description="Course discussions are for enrolled learners." mood="wave" /></div>)}

      <ConfirmDialog open={leave} onOpenChange={setLeave} danger title="Leave this course?" description="Your progress in this course will be removed. You can re-enroll any time." confirmLabel="Leave course" loading={unenroll.isPending} onConfirm={() => unenroll.mutate()} />
    </div>
  );
}
void Code2; void FileBox; void ({} as DiscussionPost);

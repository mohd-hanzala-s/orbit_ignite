import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { AnimatePresence, motion } from 'motion/react';
import { toast } from 'sonner';
import { ArrowLeft, ArrowRight, CheckCircle2, ChevronDown, ChevronLeft, ChevronRight, Circle, Clock, Lock, ListVideo, PanelLeftClose, PanelLeftOpen, Trash2, Undo2, Award, Hourglass, Sparkles, Eye, NotebookPen } from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import { useGet, useAct } from '@/lib/queries';
import type { LearnCourse, LessonFull, LessonLite, LessonType } from '@/lib/types';
import { cn, formatDuration, formatSeconds, timeAgo } from '@/lib/utils';
import { confetti } from '@/lib/confetti';
import { Badge, EmptyState, ProgressBar, Skeleton, Tabs } from '@/components/ui/misc';
import { Button, LinkButton } from '@/components/ui/button';
import { Textarea } from '@/components/ui/form';
import { Modal } from '@/components/ui/dialog';
import { Drawer } from '@/components/ui/dialog';
import { Markdown } from '@/components/ui/Markdown';
import { ThemeToggle } from '@/components/layout/Shell';
import { LogoMark } from '@/components/space/Logo';
import { Mascot } from '@/components/space/Mascot';
import { Discussion } from '@/components/Discussion';
import { LESSON_ICONS, LESSON_LABEL } from '@/pages/CourseDetail';
import { AudioViewer, DocumentViewer, EmbedViewer, LinkViewer, LiveViewer, PageViewer, VideoViewer, type PlayerHandle } from '@/components/player/viewers';
import { ScormViewer } from '@/components/player/Scorm';
import { QuizViewer } from '@/components/player/Quiz';
import { AssignmentViewer } from '@/components/player/Assignment';

const MANUAL: LessonType[] = ['video', 'audio', 'document', 'page', 'link', 'embed', 'live'];

function StatusIcon({ l, active }: { l: LessonLite; active: boolean }) {
  if (l.status === 'completed') return <CheckCircle2 className="size-[18px] shrink-0 text-success" />;
  if (l.locked) return <Lock className="size-4 shrink-0 text-subtle" />;
  if (l.status === 'pending') return <Hourglass className="size-4 shrink-0 text-warm" />;
  return <Circle className={cn('size-[18px] shrink-0', active ? 'text-primary-2' : 'text-line-2')} />;
}

function Curriculum({ course, lessonId, onPick }: { course: LearnCourse; lessonId: number; onPick?: () => void }) {
  const [closed, setClosed] = useState<Record<number, boolean>>({});
  return (
    <div className="space-y-3 p-3">
      {course.sections.map((s, si) => {
        const done = s.lessons.filter((l) => l.status === 'completed').length;
        const open = !closed[s.id];
        return (
          <section key={s.id}>
            <button onClick={() => setClosed((c) => ({ ...c, [s.id]: open }))} className="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left hover:bg-card-2" aria-expanded={open}>
              <ChevronDown className={cn('size-4 shrink-0 text-subtle transition-transform', !open && '-rotate-90')} />
              <div className="min-w-0 flex-1"><div className="truncate text-[13px] font-semibold"><span className="mr-1.5 text-subtle">{si + 1}.</span>{s.title}</div><div className="text-[11px] text-subtle">{done}/{s.lessons.length} complete</div></div>
            </button>
            {open && (
              <ul className="mt-0.5 space-y-0.5">
                {s.lessons.map((l) => {
                  const Icon = LESSON_ICONS[l.type]; const active = l.id === lessonId;
                  const body = (<><StatusIcon l={l} active={active} /><span className="min-w-0 flex-1"><span className={cn('block truncate text-[13px] leading-snug', active ? 'font-semibold text-fg' : 'text-muted')}>{l.title}</span><span className="mt-0.5 flex items-center gap-1.5 text-[11px] text-subtle"><Icon className="size-3" />{LESSON_LABEL[l.type]} · {formatDuration(l.durationMinutes)}{!l.required && ' · Optional'}</span></span></>);
                  return <li key={l.id}>{l.locked ? <div className="flex cursor-not-allowed items-start gap-3 rounded-xl px-3 py-2.5 opacity-55" title="Complete the previous lessons to unlock">{body}</div> : <Link to={`/courses/${course.id}/learn/${l.id}`} onClick={onPick} aria-current={active ? 'page' : undefined} className={cn('flex items-start gap-3 rounded-xl px-3 py-2.5 transition-colors', active ? 'bg-primary/14 ring-1 ring-primary/30' : 'hover:bg-card-2')}>{body}</Link>}</li>;
                })}
              </ul>
            )}
          </section>
        );
      })}
    </div>
  );
}

function Notes({ lesson, player }: { lesson: LessonFull; player: React.RefObject<PlayerHandle | null> }) {
  const qc = useQueryClient();
  const { data } = useGet<{ id: number; body: string; videoTs: number | null; createdAt: string }[]>(`/lessons/${lesson.id}/notes`);
  const [body, setBody] = useState('');
  const withTs = lesson.type === 'video' || lesson.type === 'audio';
  const add = useAct(() => api.post(`/lessons/${lesson.id}/notes`, { body, videoTs: withTs ? player.current?.getTime() : undefined }), { invalidate: [[`/lessons/${lesson.id}/notes`]], onSuccess: () => { setBody(''); qc.invalidateQueries({ queryKey: ['/me/achievements'] }); } });
  const del = useAct((id: number) => api.del(`/notes/${id}`), { invalidate: [[`/lessons/${lesson.id}/notes`]] });
  return (
    <div className="space-y-4">
      <form onSubmit={(e) => { e.preventDefault(); if (body.trim()) add.mutate(); }} className="surface p-4">
        <Textarea value={body} onChange={(e) => setBody(e.target.value)} placeholder="Jot down a thought — only you can see your notes…" className="min-h-24" maxLength={4000} aria-label="New note" />
        <div className="mt-3 flex items-center justify-between"><span className="text-xs text-subtle">{withTs ? 'Notes are stamped with the current playback time.' : ' '}</span><Button type="submit" variant="primary" size="sm" loading={add.isPending} disabled={!body.trim()}>Save note</Button></div>
      </form>
      {!data?.length ? <EmptyState compact mood="happy" title="No notes yet" description="Capture key ideas as you learn." /> : (
        <ul className="space-y-3">
          {data.map((n) => (
            <li key={n.id} className="surface group p-4">
              <div className="flex items-start gap-3">
                <div className="min-w-0 flex-1">
                  {n.videoTs != null && <button onClick={() => player.current?.seek(n.videoTs!)} className="mb-1.5 inline-flex items-center gap-1 rounded-md bg-primary/12 px-2 py-0.5 text-xs font-semibold text-primary-2 hover:bg-primary/20"><Clock className="size-3" />{formatSeconds(n.videoTs)}</button>}
                  <p className="whitespace-pre-wrap text-sm leading-relaxed">{n.body}</p><div className="mt-1.5 text-xs text-subtle">{timeAgo(n.createdAt)}</div>
                </div>
                <button onClick={() => del.mutate(n.id)} aria-label="Delete note" className="text-subtle opacity-0 transition hover:text-danger focus:opacity-100 group-hover:opacity-100"><Trash2 className="size-4" /></button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default function Player() {
  const { id, lessonId } = useParams();
  const nav = useNavigate();
  const qc = useQueryClient();
  const courseId = Number(id);
  const { data: course, error: courseErr, isLoading: courseLoading } = useGet<LearnCourse>(`/courses/${id}/learn`);
  const flat = useMemo(() => course?.sections.flatMap((s) => s.lessons) ?? [], [course]);
  const lid = lessonId ? Number(lessonId) : null;
  const { data: lesson, error: lessonErr, isLoading: lessonLoading } = useGet<LessonFull>(lid ? `/lessons/${lid}` : null);
  const [side, setSide] = useState(() => { try { return localStorage.getItem('orbit-side') !== '0'; } catch { return true; } });
  const [drawer, setDrawer] = useState(false);
  const [tab, setTab] = useState<'overview' | 'notes' | 'discussion' | 'transcript'>('overview');
  const [celebrate, setCelebrate] = useState(false);
  const player = useRef<PlayerHandle | null>(null);
  const posRef = useRef(0);
  const toggleSide = () => setSide((s) => { try { localStorage.setItem('orbit-side', s ? '0' : '1'); } catch { /* ignore */ } return !s; });

  const idx = flat.findIndex((l) => l.id === lid);
  const meta = idx >= 0 ? flat[idx] : null;
  const prev = idx > 0 ? flat[idx - 1] : null;
  const next = idx >= 0 && idx < flat.length - 1 ? flat[idx + 1] : null;
  const completed = meta?.status === 'completed';

  const refresh = useCallback(() => {
    for (const k of [[`/courses/${id}/learn`], [`/lessons/${lid}`], ['/me/dashboard'], ['/me/notifications'], ['/me/learning'], [`/courses/${id}`], ['/me/achievements'], ['/courses']]) qc.invalidateQueries({ queryKey: k });
  }, [qc, id, lid]);

  const onCompleted = useCallback((r: any) => {
    refresh();
    if (r?.firstTime) toast.success('Lesson complete  ·  +10 XP', { icon: '✨' });
    if (r?.badges?.length) toast('🏅 New badge unlocked!', { description: 'Check your achievements.', action: { label: 'View', onClick: () => nav('/achievements') } });
    if (r?.enrollment?.justCompleted) { confetti({ count: 200, duration: 3400 }); setCelebrate(true); }
  }, [refresh, nav]);

  const complete = useAct(() => api.post(`/lessons/${lid}/complete`), { onSuccess: onCompleted });
  const uncomplete = useAct(() => api.post(`/lessons/${lid}/uncomplete`), { onSuccess: refresh });
  const autoComplete = useCallback(() => { if (lesson?.tracked && meta && meta.status !== 'completed' && MANUAL.includes(meta.type)) complete.mutate(); }, [lesson?.tracked, meta, complete]);
  const sendPos = useCallback((p: number) => { posRef.current = p; }, []);

  // default lesson redirect
  const target = useMemo(() => {
    if (!course || lid) return null;
    const e = course.enrollment;
    return (e?.lastLessonId && flat.find((l) => l.id === e.lastLessonId && !l.locked)) || flat.find((l) => l.status !== 'completed' && !l.locked) || flat[0] || null;
  }, [course, lid, flat]);

  // heartbeat for time spent
  useEffect(() => {
    if (!lesson?.tracked || !lid) return;
    const t = setInterval(() => { if (!document.hidden) api.post(`/lessons/${lid}/progress`, { timeSpent: 20, position: player.current?.getTime?.() ?? posRef.current }).catch(() => {}); }, 20000);
    return () => clearInterval(t);
  }, [lesson?.tracked, lid]);
  useEffect(() => { setTab('overview'); posRef.current = 0; }, [lid]);

  // keyboard shortcuts
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (e.metaKey || e.ctrlKey || e.altKey || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName) || t.isContentEditable) return;
      if (e.key === 'j' && prev && !prev.locked) nav(`/courses/${id}/learn/${prev.id}`);
      if (e.key === 'k' && next && !next.locked) nav(`/courses/${id}/learn/${next.id}`);
      if (e.key === 'c' && meta && MANUAL.includes(meta.type) && lesson?.tracked && meta.status !== 'completed') complete.mutate();
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [prev, next, meta, lesson?.tracked, id, nav, complete]);

  useEffect(() => { if (lesson) document.title = `${lesson.title} · ${lesson.courseTitle}`; return () => { document.title = 'Orbit Ignite — Learning Mission Control'; }; }, [lesson]);

  if (courseErr) {
    const forbidden = (courseErr as ApiError).status === 403;
    return <div className="grid min-h-screen place-items-center p-6"><div className="surface max-w-md"><EmptyState mood={forbidden ? 'wave' : 'oops'} title={forbidden ? 'Enroll to start learning' : 'Course unavailable'} description={forbidden ? 'You need to be enrolled in this course to open its lessons.' : (courseErr as Error).message} action={<LinkButton to={`/courses/${id}`} variant="primary">Go to course page</LinkButton>} /></div></div>;
  }
  if (courseLoading || !course) return <div className="p-8"><Skeleton className="h-[80vh]" /></div>;
  if (!lid) return target ? <Navigate to={`/courses/${id}/learn/${target.id}`} replace /> : <div className="grid min-h-screen place-items-center"><div className="surface"><EmptyState title="This course has no lessons yet" action={<LinkButton to={`/courses/${id}`}>Back to course</LinkButton>} /></div></div>;

  const progress = course.enrollment?.progress ?? 0;
  const lessonBlocked = lessonErr && (lessonErr as ApiError).status === 403;

  const viewer = lesson && (() => {
    switch (lesson.type) {
      case 'video': return <VideoViewer key={lesson.id} lesson={lesson} handle={player} onProgress={sendPos} onEnded={autoComplete} />;
      case 'audio': return <AudioViewer key={lesson.id} lesson={lesson} onEnded={autoComplete} onProgress={sendPos} />;
      case 'document': return <DocumentViewer key={lesson.id} lesson={lesson} />;
      case 'scorm': return <ScormViewer key={lesson.id} lesson={lesson} onResult={(r) => onCompleted(r.result ?? { badges: [] })} />;
      case 'page': return <PageViewer lesson={lesson} />;
      case 'link': return <LinkViewer lesson={lesson} />;
      case 'embed': return <EmbedViewer key={lesson.id} lesson={lesson} />;
      case 'quiz': return <QuizViewer key={lesson.id} lesson={lesson} onDone={(r) => onCompleted(r)} />;
      case 'assignment': return <AssignmentViewer key={lesson.id} lesson={lesson} onSubmitted={refresh} />;
      case 'live': return <LiveViewer lesson={lesson} />;
    }
  })();

  const completeBar = lesson && meta && (
    <div className="surface flex flex-wrap items-center gap-3 p-4">
      {MANUAL.includes(meta.type) ? (
        completed ? (
          <><div className="flex items-center gap-2 text-sm font-semibold text-success"><CheckCircle2 className="size-5" /> Completed</div><Button variant="ghost" size="sm" icon={<Undo2 className="size-3.5" />} loading={uncomplete.isPending} onClick={() => uncomplete.mutate()}>Mark incomplete</Button></>
        ) : lesson.tracked ? (
          <Button variant="primary" loading={complete.isPending} onClick={() => complete.mutate()} icon={<CheckCircle2 className="size-4" />}>Mark as complete <kbd className="ml-1 rounded border border-white/30 px-1 font-mono text-[10px]">C</kbd></Button>
        ) : <span className="flex items-center gap-2 text-sm text-muted"><Eye className="size-4" /> Staff preview — progress isn't tracked</span>
      ) : completed ? <div className="flex items-center gap-2 text-sm font-semibold text-success"><CheckCircle2 className="size-5" /> Completed{lesson.progress?.score != null && <span className="font-normal text-muted"> · score {Math.round(lesson.progress.score)}%</span>}</div>
        : <span className="text-sm text-muted">{meta.type === 'quiz' ? 'Pass the quiz to complete this lesson.' : meta.type === 'scorm' ? 'Finish the module to complete this lesson.' : 'Completes when your submission is graded.'}</span>}
      <div className="ml-auto flex items-center gap-2">
        {prev && <Button variant="ghost" size="sm" disabled={prev.locked} onClick={() => nav(`/courses/${id}/learn/${prev.id}`)} icon={<ChevronLeft className="size-4" />}>Previous</Button>}
        {next ? <Button variant={completed ? 'primary' : 'secondary'} size="sm" disabled={next.locked} onClick={() => nav(`/courses/${id}/learn/${next.id}`)}>Next lesson <ChevronRight className="size-4" /></Button> : <LinkButton to={`/courses/${id}`} variant={completed ? 'primary' : 'secondary'} size="sm">Course overview</LinkButton>}
      </div>
    </div>
  );

  return (
    <div className="flex h-screen flex-col">
      <header className="z-20 flex h-14 shrink-0 items-center gap-3 border-b border-line bg-bg/80 px-3 backdrop-blur-xl sm:px-5">
        <Link to={`/courses/${id}`} className="flex items-center gap-2 rounded-lg p-1.5 text-muted hover:bg-card-2 hover:text-fg" aria-label="Back to course"><ArrowLeft className="size-[18px]" /><LogoMark size={26} /></Link>
        <div className="min-w-0 flex-1"><div className="truncate font-display text-sm font-semibold sm:text-[15px]">{course.title}</div></div>
        {course.preview && <Badge tone="warn" className="hidden sm:inline-flex"><Eye className="size-3" /> Preview</Badge>}
        <div className="hidden w-48 items-center gap-3 md:flex"><ProgressBar value={progress} /><span className="w-9 text-right text-xs font-semibold tabular-nums text-muted">{progress}%</span></div>
        <ThemeToggle />
        <Button variant="ghost" size="icon" className="hidden lg:inline-flex" onClick={toggleSide} aria-label={side ? 'Hide curriculum' : 'Show curriculum'}>{side ? <PanelLeftClose className="size-[18px]" /> : <PanelLeftOpen className="size-[18px]" />}</Button>
        <Button variant="secondary" size="sm" className="lg:hidden" onClick={() => setDrawer(true)} icon={<ListVideo className="size-4" />}>Lessons</Button>
      </header>
      <div className="flex min-h-0 flex-1">
        <AnimatePresence initial={false}>
          {side && (
            <motion.aside initial={{ width: 0, opacity: 0 }} animate={{ width: 340, opacity: 1 }} exit={{ width: 0, opacity: 0 }} transition={{ type: 'spring', stiffness: 380, damping: 38 }} className="hidden shrink-0 overflow-hidden border-r border-line bg-bg/50 lg:block">
              <div className="h-full w-[340px] overflow-y-auto"><Curriculum course={course} lessonId={lid} /></div>
            </motion.aside>
          )}
        </AnimatePresence>
        <Drawer open={drawer} onOpenChange={setDrawer} title="Lessons"><div className="flex-1 overflow-y-auto pt-4"><div className="px-5 pb-1 font-display font-semibold">{course.title}</div><Curriculum course={course} lessonId={lid} onPick={() => setDrawer(false)} /></div></Drawer>

        <main className="min-w-0 flex-1 overflow-y-auto">
          <div className="mx-auto w-full max-w-[1000px] space-y-6 px-4 py-6 sm:px-8 sm:py-8">
            {lessonBlocked ? (
              <div className="surface"><EmptyState mood="think" title="This lesson is locked" description={(lessonErr as Error).message} action={<LinkButton to={`/courses/${id}/learn`} variant="primary">Go to my next lesson</LinkButton>} /></div>
            ) : lessonErr ? (
              <div className="surface"><EmptyState mood="oops" title="Couldn't load this lesson" description={(lessonErr as Error).message} /></div>
            ) : lessonLoading || !lesson || !meta ? <div className="space-y-4"><Skeleton className="h-10 w-2/3" /><Skeleton className="aspect-video" /></div> : (
              <>
                <motion.div key={lesson.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
                  <div>
                    <div className="mb-2 flex flex-wrap items-center gap-2 text-xs"><Badge tone="primary">{LESSON_LABEL[lesson.type]}</Badge><span className="text-subtle">Lesson {idx + 1} of {flat.length}</span>{!lesson.required && <Badge>Optional</Badge>}<span className="flex items-center gap-1 text-subtle"><Clock className="size-3" />{formatDuration(lesson.durationMinutes)}</span></div>
                    <h1 className="font-display text-2xl font-bold tracking-tight sm:text-[32px] sm:leading-tight">{lesson.title}</h1>
                  </div>
                  {viewer}
                  {completeBar}
                </motion.div>
                <Tabs value={tab} onChange={setTab} items={[{ value: 'overview', label: 'Overview' }, { value: 'notes', label: <span className="flex items-center gap-1.5"><NotebookPen className="size-3.5" />Notes</span> }, { value: 'discussion', label: 'Discussion' }, ...((lesson.content.transcript ? [{ value: 'transcript' as const, label: 'Transcript' }] : []))]} />
                {tab === 'overview' && (
                  <div className="surface p-6">
                    {lesson.summary ? <Markdown>{lesson.summary}</Markdown> : <p className="text-sm text-muted">{lesson.type === 'page' ? 'Read the page above, then mark it complete.' : 'No additional notes for this lesson.'}</p>}
                    {course.objectives.length > 0 && <div className="mt-6 border-t border-line pt-5"><div className="mb-3 flex items-center gap-2 text-sm font-semibold"><Sparkles className="size-4 text-warm" /> Course objectives</div><ul className="grid gap-2 text-sm text-muted sm:grid-cols-2">{course.objectives.map((o) => <li key={o} className="flex gap-2"><CheckCircle2 className="mt-0.5 size-4 shrink-0 text-success/80" />{o}</li>)}</ul></div>}
                  </div>
                )}
                {tab === 'notes' && <Notes lesson={lesson} player={player} />}
                {tab === 'discussion' && <Discussion courseId={courseId} lessonId={lesson.id} />}
                {tab === 'transcript' && <div className="surface p-6"><p className="whitespace-pre-wrap text-sm leading-relaxed text-muted">{lesson.content.transcript}</p></div>}
              </>
            )}
          </div>
        </main>
      </div>

      <Modal open={celebrate} onOpenChange={setCelebrate} title="Mission complete! 🎉" size="sm" footer={<><Button variant="ghost" onClick={() => setCelebrate(false)}>Keep exploring</Button>{course.certificate && <LinkButton to="/certificates" variant="primary" icon={<Award className="size-4" />}>View certificate</LinkButton>}</>}>
        <div className="flex flex-col items-center text-center"><Mascot mood="cheer" size={140} /><h3 className="mt-3 font-display text-xl font-bold">You finished {course.title}!</h3><p className="mt-2 text-sm text-muted">+100 XP earned{course.certificate ? ' and your certificate is ready.' : '.'} Nice work, astronaut.</p></div>
      </Modal>
    </div>
  );
}

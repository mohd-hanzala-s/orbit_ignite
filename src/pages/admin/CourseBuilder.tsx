import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Reorder, useDragControls } from 'motion/react';
import { toast } from 'sonner';
import { ArrowDownToLine, Check, Copy, Eye, FilePlus2, GripVertical, ImagePlus, MoreHorizontal, Pencil, Plus, Send, Trash2, Undo2, X, UserPlus, FolderPlus } from 'lucide-react';
import { api, type UploadedFile } from '@/lib/api';
import { useGet, useAct } from '@/lib/queries';
import { useAuth } from '@/lib/auth';
import type { Category, CourseCard, LessonType } from '@/lib/types';
import { cn, dateFmt, formatDuration, timeAgo } from '@/lib/utils';
import { LESSON_ICONS, LESSON_LABEL } from '@/pages/CourseDetail';
import { Badge, Avatar, EmptyState, ErrorState, Menu, MenuContent, MenuItem, MenuSeparator, MenuTrigger, ProgressBar, Skeleton, Tabs } from '@/components/ui/misc';
import { Button, LinkButton } from '@/components/ui/button';
import { Checkbox, Field, Input, Select, Switch, Textarea } from '@/components/ui/form';
import { ConfirmDialog, Modal } from '@/components/ui/dialog';
import { CourseCover, THEME_NAMES } from '@/components/space/CourseCover';
import { LessonEditor, type BuilderLesson } from '@/components/admin/LessonEditor';
import { MarkdownEditor } from '@/components/admin/MarkdownEditor';
import { FileDrop } from '@/components/admin/FileDrop';
import { AssignModal } from '@/components/admin/AssignModal';
import { Table, THead, Th, Tr, Td } from '@/components/admin/Table';

interface BSection { id: number; title: string; lessons: BuilderLesson[] }
interface Builder extends CourseCard {
  description: string; objectives: string[]; passMark: number; instructorId: number | null; coverFile: UploadedFile | null; sections: BSection[];
}

function LessonRow({ l, onEdit, onDelete, onMove, sections, sectionId, persist }: { l: BuilderLesson; onEdit: () => void; onDelete: () => void; onMove: (sid: number) => void; sections: BSection[]; sectionId: number; persist: () => void }) {
  const controls = useDragControls();
  const Icon = LESSON_ICONS[l.type as LessonType];
  return (
    <Reorder.Item value={l} dragListener={false} dragControls={controls} className="group relative list-none" whileDrag={{ scale: 1.01, zIndex: 20 }} onDragEnd={persist}>
      <div className="flex items-center gap-3 rounded-xl border border-transparent bg-card px-3 py-2.5 transition-colors hover:border-line-2 hover:bg-card-2">
        <button type="button" onPointerDown={(e) => controls.start(e)} aria-label="Drag to reorder" className="cursor-grab touch-none text-subtle hover:text-fg active:cursor-grabbing"><GripVertical className="size-4" /></button>
        <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-primary/12 text-primary-2"><Icon className="size-4" /></span>
        <button type="button" onClick={onEdit} className="min-w-0 flex-1 text-left"><span className="block truncate text-sm font-medium">{l.title}</span><span className="block text-xs text-subtle">{LESSON_LABEL[l.type as LessonType]} · {formatDuration(l.durationMinutes)}</span></button>
        {!l.required && <Badge>Optional</Badge>}
        {l.preview && <Badge tone="info">Preview</Badge>}
        <Button variant="ghost" size="icon-sm" onClick={onEdit} aria-label={`Edit ${l.title}`}><Pencil className="size-3.5" /></Button>
        <Menu><MenuTrigger asChild><Button variant="ghost" size="icon-sm" aria-label="Lesson actions"><MoreHorizontal className="size-4" /></Button></MenuTrigger>
          <MenuContent>
            {sections.filter((s) => s.id !== sectionId).map((s) => <MenuItem key={s.id} icon={<ArrowDownToLine />} onSelect={() => onMove(s.id)}>Move to “{s.title}”</MenuItem>)}
            {sections.length > 1 && <MenuSeparator />}
            <MenuItem icon={<Trash2 />} danger onSelect={onDelete}>Delete lesson</MenuItem>
          </MenuContent>
        </Menu>
      </div>
    </Reorder.Item>
  );
}

function SectionCard({ s, index, sections, onAddLesson, onEditLesson, onChangeLessons, onRename, onDeleteSection, onDeleteLesson, onMoveLesson, persist }: {
  s: BSection; index: number; sections: BSection[]; onAddLesson: () => void; onEditLesson: (l: BuilderLesson) => void; onChangeLessons: (ls: BuilderLesson[]) => void; onRename: (t: string) => void; onDeleteSection: () => void; onDeleteLesson: (l: BuilderLesson) => void; onMoveLesson: (l: BuilderLesson, sid: number) => void; persist: () => void;
}) {
  const controls = useDragControls();
  const [title, setTitle] = useState(s.title);
  useEffect(() => setTitle(s.title), [s.title]);
  return (
    <Reorder.Item value={s} dragListener={false} dragControls={controls} className="list-none" onDragEnd={persist}>
      <section className="surface overflow-hidden">
        <div className="flex items-center gap-3 border-b border-line bg-card-2/40 px-4 py-3">
          <button type="button" onPointerDown={(e) => controls.start(e)} aria-label="Drag section" className="cursor-grab touch-none text-subtle hover:text-fg"><GripVertical className="size-4" /></button>
          <span className="text-xs font-bold text-subtle">{String(index + 1).padStart(2, '0')}</span>
          <input value={title} onChange={(e) => setTitle(e.target.value)} onBlur={() => title.trim() && title !== s.title && onRename(title.trim())} onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()} aria-label="Section title" className="min-w-0 flex-1 rounded-lg bg-transparent px-2 py-1 font-display font-semibold hover:bg-card focus:bg-card" />
          <span className="hidden text-xs text-subtle sm:block">{s.lessons.length} lessons · {formatDuration(s.lessons.reduce((a, l) => a + l.durationMinutes, 0))}</span>
          <Button variant="ghost" size="icon-sm" onClick={onDeleteSection} aria-label="Delete section" disabled={sections.length <= 1}><Trash2 className="size-4" /></Button>
        </div>
        <div className="p-3">
          <Reorder.Group axis="y" values={s.lessons} onReorder={onChangeLessons} className="space-y-1.5">
            {s.lessons.map((l) => <LessonRow key={l.id} l={l} sections={sections} sectionId={s.id} persist={persist} onEdit={() => onEditLesson(l)} onDelete={() => onDeleteLesson(l)} onMove={(sid) => onMoveLesson(l, sid)} />)}
          </Reorder.Group>
          {s.lessons.length === 0 && <div className="rounded-xl border border-dashed border-line-2 px-4 py-6 text-center text-sm text-muted">No lessons yet — add your first one below.</div>}
          <Button variant="soft" size="sm" className="mt-3" icon={<FilePlus2 className="size-4" />} onClick={onAddLesson}>Add lesson</Button>
        </div>
      </section>
    </Reorder.Item>
  );
}

export default function CourseBuilder() {
  const { id } = useParams();
  const nav = useNavigate();
  const { user } = useAuth();
  const key = [`/admin/courses/${id}/builder`];
  const { data, error, isLoading, refetch } = useGet<Builder>(`/admin/courses/${id}/builder`);
  const { data: cats } = useGet<Category[]>('/categories');
  const { data: staff } = useGet<{ id: number; name: string; role: string }[]>(user?.role === 'admin' ? '/admin/users/options' : null);
  const [tab, setTab] = useState<'curriculum' | 'details' | 'settings' | 'learners'>('curriculum');
  const [sections, setSections] = useState<BSection[]>([]);
  const [editor, setEditor] = useState<{ sectionId: number | null; lesson: BuilderLesson | null } | null>(null);
  const [confirm, setConfirm] = useState<null | { kind: 'lesson' | 'section' | 'course'; id: number; label: string }>(null);
  const [assign, setAssign] = useState(false);
  const latest = useRef<BSection[]>([]);
  latest.current = sections;

  useEffect(() => { if (data) setSections(data.sections); }, [data]);
  const inval = [key, ['/courses'], [`/courses/${id}`], ['/admin/stats']];

  const persist = () => api.put(`/admin/courses/${id}/order`, { sections: latest.current.map((s) => ({ id: s.id, lessons: s.lessons.map((l) => l.id) })) }).then(() => refetch()).catch((e) => { toast.error(e.message); refetch(); });
  const addSection = useAct(() => api.post(`/admin/courses/${id}/sections`, { title: 'New section' }), { invalidate: [key], success: 'Section added' });
  const rename = useAct(({ sid, title }: { sid: number; title: string }) => api.patch(`/admin/sections/${sid}`, { title }), { invalidate: [key] });
  const del = useAct(() => confirm!.kind === 'lesson' ? api.del(`/admin/lessons/${confirm!.id}`) : confirm!.kind === 'section' ? api.del(`/admin/sections/${confirm!.id}`) : api.del(`/admin/courses/${id}?force=1`), { invalidate: inval, onSuccess: () => { toast.success('Deleted'); const wasCourse = confirm!.kind === 'course'; setConfirm(null); if (wasCourse) nav('/admin/courses'); } });
  const setStatus = useAct((status: string) => api.patch(`/admin/courses/${id}`, { status }), { invalidate: inval, success: 'Status updated' });

  const moveLesson = (l: BuilderLesson, sid: number) => {
    const next = sections.map((s) => ({ ...s, lessons: s.id === sid ? [...s.lessons, l] : s.lessons.filter((x) => x.id !== l.id) }));
    latest.current = next; setSections(next); persist();
  };

  if (error) return <ErrorState error={error} onRetry={refetch} />;
  if (isLoading || !data) return <div className="space-y-5"><Skeleton className="h-24" /><Skeleton className="h-96" /></div>;
  const total = sections.reduce((a, s) => a + s.lessons.length, 0);
  const mins = sections.reduce((a, s) => a + s.lessons.reduce((b, l) => b + l.durationMinutes, 0), 0);

  return (
    <div>
      <div className="mb-7 flex flex-wrap items-center gap-4">
        <div className="size-16 shrink-0 overflow-hidden rounded-2xl"><CourseCover theme={data.theme} seed={data.id} coverUrl={data.coverUrl} /></div>
        <div className="min-w-0 flex-1">
          <Link to="/admin/courses" className="text-xs font-medium text-muted hover:text-fg">← All courses</Link>
          <h1 className="truncate font-display text-2xl font-bold tracking-tight">{data.title}</h1>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted"><Badge tone={data.status === 'published' ? 'success' : data.status === 'draft' ? 'warn' : 'neutral'} dot className="capitalize">{data.status}</Badge>{total} lessons · {formatDuration(mins)} · updated {timeAgo(data.updatedAt)}</div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <LinkButton to={`/courses/${id}/learn`} variant="secondary" icon={<Eye className="size-4" />}>Preview</LinkButton>
          {data.status === 'published' ? <Button variant="secondary" icon={<Undo2 className="size-4" />} onClick={() => setStatus.mutate('draft')} loading={setStatus.isPending}>Unpublish</Button> : <Button variant="primary" icon={<Send className="size-4" />} onClick={() => setStatus.mutate('published')} loading={setStatus.isPending}>Publish</Button>}
        </div>
      </div>

      <Tabs className="mb-6" value={tab} onChange={setTab} items={[{ value: 'curriculum', label: 'Curriculum' }, { value: 'details', label: 'Details' }, { value: 'settings', label: 'Settings' }, { value: 'learners', label: 'Learners', count: data.enrolledCount }]} />

      {tab === 'curriculum' && (
        <div className="space-y-4">
          <Reorder.Group axis="y" values={sections} onReorder={(s) => { latest.current = s; setSections(s); }} className="space-y-4">
            {sections.map((s, i) => (
              <SectionCard key={s.id} s={s} index={i} sections={sections} persist={persist}
                onAddLesson={() => setEditor({ sectionId: s.id, lesson: null })} onEditLesson={(l) => setEditor({ sectionId: s.id, lesson: l })}
                onChangeLessons={(ls) => { const n = sections.map((x) => (x.id === s.id ? { ...x, lessons: ls } : x)); latest.current = n; setSections(n); }}
                onRename={(title) => rename.mutate({ sid: s.id, title })} onDeleteSection={() => setConfirm({ kind: 'section', id: s.id, label: s.title })} onDeleteLesson={(l) => setConfirm({ kind: 'lesson', id: l.id, label: l.title })} onMoveLesson={moveLesson} />
            ))}
          </Reorder.Group>
          <Button variant="outline" icon={<FolderPlus className="size-4" />} onClick={() => addSection.mutate()} loading={addSection.isPending}>Add section</Button>
          {total === 0 && <p className="text-sm text-muted">Tip: add at least one lesson before publishing.</p>}
        </div>
      )}
      {tab === 'details' && <DetailsTab data={data} cats={cats ?? []} staff={staff} onSaved={() => refetch()} invalidate={inval} />}
      {tab === 'settings' && <SettingsTab data={data} invalidate={inval} onDelete={() => setConfirm({ kind: 'course', id: data.id, label: data.title })} isAdmin={user?.role === 'admin'} />}
      {tab === 'learners' && <LearnersTab courseId={data.id} onAssign={() => setAssign(true)} />}

      <LessonEditor open={!!editor} onClose={() => setEditor(null)} sectionId={editor?.sectionId ?? null} lesson={editor?.lesson ?? null} invalidate={inval} />
      <ConfirmDialog open={!!confirm} onOpenChange={(o) => !o && setConfirm(null)} danger title={`Delete ${confirm?.kind}?`} description={<>“{confirm?.label}” will be permanently removed{confirm?.kind !== 'lesson' ? ' along with everything inside it' : ''}. Learner progress for it will be lost.</>} confirmLabel="Delete" loading={del.isPending} onConfirm={() => del.mutate()} />
      <AssignModal open={assign} onClose={() => setAssign(false)} courseId={data.id} />
    </div>
  );
}

/* ───────── details ───────── */
function DetailsTab({ data, cats, staff, onSaved, invalidate }: { data: Builder; cats: Category[]; staff?: { id: number; name: string; role: string }[]; onSaved: () => void; invalidate: (string | number)[][] }) {
  const [f, setF] = useState({ title: data.title, subtitle: data.subtitle, description: data.description, categoryId: data.category?.id ?? '', level: data.level, theme: data.theme, tags: data.tags.join(', '), objectives: data.objectives, coverFileId: data.coverFile?.id ?? null as number | null, instructorId: data.instructorId ?? '' });
  const [coverName, setCoverName] = useState(data.coverFile?.name);
  const dirty = useMemo(() => JSON.stringify(f) !== JSON.stringify({ title: data.title, subtitle: data.subtitle, description: data.description, categoryId: data.category?.id ?? '', level: data.level, theme: data.theme, tags: data.tags.join(', '), objectives: data.objectives, coverFileId: data.coverFile?.id ?? null, instructorId: data.instructorId ?? '' }), [f, data]);
  const save = useAct(() => api.patch(`/admin/courses/${data.id}`, { title: f.title, subtitle: f.subtitle, description: f.description, categoryId: f.categoryId || null, level: f.level, theme: f.theme, tags: f.tags.split(',').map((t) => t.trim()).filter(Boolean), objectives: f.objectives.filter((o) => o.trim()), coverFileId: f.coverFileId, instructorId: f.instructorId || undefined }), { invalidate, success: 'Details saved', onSuccess: onSaved });
  return (
    <div className="grid gap-6 xl:grid-cols-[1fr_360px]">
      <div className="space-y-6">
        <div className="surface space-y-4 p-6">
          <Field label="Title">{(id) => <Input id={id} value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} maxLength={140} />}</Field>
          <Field label="Subtitle">{(id) => <Input id={id} value={f.subtitle} onChange={(e) => setF({ ...f, subtitle: e.target.value })} maxLength={200} />}</Field>
          <Field label="Description (Markdown)">{() => <MarkdownEditor value={f.description} onChange={(v) => setF({ ...f, description: v })} minHeight={200} />}</Field>
        </div>
        <div className="surface space-y-3 p-6">
          <div className="font-display font-semibold">Learning objectives</div>
          {f.objectives.map((o, i) => <div key={i} className="flex gap-2"><Input value={o} onChange={(e) => setF({ ...f, objectives: f.objectives.map((x, j) => (j === i ? e.target.value : x)) })} placeholder="Learners will be able to…" aria-label={`Objective ${i + 1}`} /><Button variant="ghost" size="icon" aria-label="Remove objective" onClick={() => setF({ ...f, objectives: f.objectives.filter((_, j) => j !== i) })}><X className="size-4" /></Button></div>)}
          {f.objectives.length < 12 && <Button variant="ghost" size="sm" icon={<Plus className="size-4" />} onClick={() => setF({ ...f, objectives: [...f.objectives, ''] })}>Add objective</Button>}
        </div>
      </div>
      <div className="space-y-6">
        <div className="surface space-y-4 p-6">
          <Field label="Category">{(id) => <Select id={id} value={f.categoryId} onChange={(e) => setF({ ...f, categoryId: Number(e.target.value) || '' })}><option value="">Uncategorized</option>{cats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</Select>}</Field>
          <Field label="Level">{(id) => <Select id={id} value={f.level} onChange={(e) => setF({ ...f, level: e.target.value })}><option>Beginner</option><option>Intermediate</option><option>Advanced</option></Select>}</Field>
          {staff && <Field label="Instructor">{(id) => <Select id={id} value={f.instructorId} onChange={(e) => setF({ ...f, instructorId: Number(e.target.value) || '' })}>{staff.filter((u) => u.role !== 'learner').map((u) => <option key={u.id} value={u.id}>{u.name} ({u.role})</option>)}</Select>}</Field>}
          <Field label="Tags" hint="Comma separated">{(id) => <Input id={id} value={f.tags} onChange={(e) => setF({ ...f, tags: e.target.value })} placeholder="python, data, ai" />}</Field>
        </div>
        <div className="surface space-y-4 p-6">
          <div className="font-display font-semibold">Cover art</div>
          <div className="aspect-video overflow-hidden rounded-2xl"><CourseCover theme={f.theme} seed={data.id} coverUrl={f.coverFileId ? `/api/files/${f.coverFileId}` : null} /></div>
          <div className="grid grid-cols-4 gap-2">{THEME_NAMES.map((t) => <button key={t} type="button" aria-label={`${t} theme`} aria-pressed={f.theme === t && !f.coverFileId} onClick={() => setF({ ...f, theme: t, coverFileId: null })} className={cn('relative aspect-video overflow-hidden rounded-lg ring-2 ring-offset-2 ring-offset-bg transition', f.theme === t && !f.coverFileId ? 'ring-primary' : 'ring-transparent hover:ring-line-2')}><CourseCover theme={t} seed={data.id} />{f.theme === t && !f.coverFileId && <span className="absolute inset-0 grid place-items-center bg-black/30"><Check className="size-4 text-white" /></span>}</button>)}</div>
          <FileDrop compact accept="image/*" label="Upload a custom cover" hint="16:9 image, PNG/JPG/WebP" maxMB={10} current={f.coverFileId ? { name: coverName ?? 'Custom cover' } : null} onClear={() => setF({ ...f, coverFileId: null })} onUploaded={(u: UploadedFile) => { setF({ ...f, coverFileId: u.id }); setCoverName(u.name); }} />
        </div>
        <Button variant="primary" size="lg" className="w-full" disabled={!dirty || !f.title.trim()} loading={save.isPending} onClick={() => save.mutate()}>Save details</Button>
      </div>
    </div>
  );
}

/* ───────── settings ───────── */
function SettingsTab({ data, invalidate, onDelete, isAdmin }: { data: Builder; invalidate: (string | number)[][]; onDelete: () => void; isAdmin: boolean }) {
  const nav = useNavigate();
  const [f, setF] = useState({ passMark: data.passMark, certificate: data.certificate, sequential: data.sequential, enrollmentMode: data.enrollmentMode, featured: data.featured });
  const save = useAct(() => api.patch(`/admin/courses/${data.id}`, f), { invalidate, success: 'Settings saved' });
  const dup = useAct(() => api.post<{ id: number }>(`/admin/courses/${data.id}/duplicate`), { invalidate: [['/courses']], onSuccess: (r) => { toast.success('Duplicated'); nav(`/admin/courses/${r.id}`); } });
  return (
    <div className="max-w-2xl space-y-6">
      <div className="surface space-y-6 p-6">
        <Switch checked={f.certificate} onChange={(v) => setF({ ...f, certificate: v })} label="Issue a certificate on completion" description="A verifiable certificate is generated when the learner finishes every required lesson." />
        <Switch checked={f.sequential} onChange={(v) => setF({ ...f, sequential: v })} label="Sequential learning" description="Learners must complete lessons in order — later lessons stay locked." />
        {isAdmin && <Switch checked={f.featured} onChange={(v) => setF({ ...f, featured: v })} label="Featured course" description="Highlighted at the top of the catalog." />}
        <Field label="Enrollment">{(id) => <Select id={id} value={f.enrollmentMode} onChange={(e) => setF({ ...f, enrollmentMode: e.target.value as any })}><option value="open">Open — learners can self-enroll</option><option value="invite">Invite only — assigned by admins</option></Select>}</Field>
        <Field label="Default pass mark (%)" hint="Informational — each quiz has its own pass mark.">{(id) => <Input id={id} type="number" min={0} max={100} value={f.passMark} onChange={(e) => setF({ ...f, passMark: Number(e.target.value) })} className="max-w-32" />}</Field>
        <Button variant="primary" loading={save.isPending} onClick={() => save.mutate()}>Save settings</Button>
      </div>
      <div className="surface space-y-4 border-danger/25 p-6">
        <div className="font-display font-semibold">Danger zone</div>
        <div className="flex flex-wrap gap-3"><Button variant="secondary" icon={<Copy className="size-4" />} loading={dup.isPending} onClick={() => dup.mutate()}>Duplicate course</Button><Button variant="danger" icon={<Trash2 className="size-4" />} onClick={onDelete}>Delete course</Button></div>
      </div>
    </div>
  );
}

/* ───────── learners ───────── */
function LearnersTab({ courseId, onAssign }: { courseId: number; onAssign: () => void }) {
  const { data, isLoading } = useGet<{ id: number; user: string; email: string; avatarColor: string; status: string; progress: number; dueDate: string | null; enrolledAt: string; overdue: boolean }[]>(`/admin/enrollments?courseId=${courseId}`, { key: ['/admin/enrollments', courseId] });
  const rm = useAct((id: number) => api.del(`/admin/enrollments/${id}`), { invalidate: [['/admin/enrollments'], ['/courses']], success: 'Learner removed' });
  return (
    <div className="space-y-4">
      <div className="flex justify-end"><Button variant="primary" icon={<UserPlus className="size-4" />} onClick={onAssign}>Assign learners</Button></div>
      {isLoading ? <Skeleton className="h-64" /> : !data?.length ? <div className="surface"><EmptyState compact title="No learners yet" description="Assign learners or wait for self-enrollments." mood="wave" /></div> : (
        <Table><THead><tr><Th>Learner</Th><Th>Progress</Th><Th>Status</Th><Th>Due</Th><Th>Enrolled</Th><Th className="w-12" /></tr></THead>
          <tbody>{data.map((e) => <Tr key={e.id}><Td><div className="flex items-center gap-3"><Avatar name={e.user} color={e.avatarColor} size={32} /><div className="min-w-0"><div className="truncate font-medium">{e.user}</div><div className="truncate text-xs text-subtle">{e.email}</div></div></div></Td><Td className="w-44"><div className="flex items-center gap-2"><ProgressBar value={e.progress} height={5} /><span className="w-9 text-xs tabular-nums text-muted">{e.progress}%</span></div></Td><Td><Badge tone={e.status === 'completed' ? 'success' : e.overdue ? 'danger' : 'info'} className="capitalize">{e.overdue ? 'Overdue' : e.status}</Badge></Td><Td className="text-muted">{dateFmt(e.dueDate)}</Td><Td className="text-muted">{dateFmt(e.enrolledAt)}</Td><Td><Button variant="ghost" size="icon-sm" aria-label={`Remove ${e.user}`} onClick={() => { if (confirm(`Remove ${e.user} from this course? Their progress will be deleted.`)) rm.mutate(e.id); }}><Trash2 className="size-4 text-danger" /></Button></Td></Tr>)}</tbody></Table>
      )}
    </div>
  );
}
void Modal; void Checkbox; void Textarea; void ImagePlus; void dateFmt;

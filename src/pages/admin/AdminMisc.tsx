import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Award, CheckCircle2, Download, FileText, FileVideo, FileAudio, Image as ImageIcon, FileArchive, File as FileIcon, Layers, Megaphone, Pin, Plus, Route, Trash2, X, Pencil, ClipboardCheck, Paperclip, ExternalLink, ArrowUp, ArrowDown, RotateCcw } from 'lucide-react';
import { toast } from 'sonner';
import { api, type UploadedFile } from '@/lib/api';
import { useGet, useAct } from '@/lib/queries';
import { useAuth } from '@/lib/auth';
import type { CourseCard, Category } from '@/lib/types';
import { cn, dateFmt, formatBytes, timeAgo, dateTimeFmt } from '@/lib/utils';
import { Avatar, Badge, EmptyState, ErrorState, PageHeader, ProgressBar, Skeleton, Tabs, Spinner } from '@/components/ui/misc';
import { Button } from '@/components/ui/button';
import { Checkbox, Field, Input, SearchInput, Select, Switch, Textarea } from '@/components/ui/form';
import { ConfirmDialog, Modal } from '@/components/ui/dialog';
import { Table, THead, Th, Tr, Td } from '@/components/admin/Table';
import { FileDrop } from '@/components/admin/FileDrop';
import { CourseCover, THEME_NAMES } from '@/components/space/CourseCover';
import { TONE_COLOR } from '@/components/charts';
import { ACTION_LABEL } from '@/pages/admin/AdminDashboard';

/* ═════════ Content library ═════════ */
interface LibFile extends UploadedFile { uploader: string | null }
const KIND_ICON: Record<string, any> = { video: FileVideo, audio: FileAudio, image: ImageIcon, pdf: FileText, office: FileText, text: FileText, archive: FileArchive, other: FileIcon };

export function AdminLibrary() {
  const [kind, setKind] = useState('');
  const [q, setQ] = useState('');
  const { data, isLoading, error, refetch } = useGet<{ files: LibFile[]; scorm: { id: number; title: string; version: string; size: number; fileCount: number; createdAt: string; uploader: string | null }[] }>(`/files?kind=${kind}&q=${encodeURIComponent(q)}`, { key: ['/files', kind, q] });
  const [view, setView] = useState<'files' | 'scorm'>('files');
  const [del, setDel] = useState<LibFile | null>(null);
  const rm = useAct((f: LibFile) => api.del(`/files/${f.id}`), { invalidate: [['/files']], success: 'File deleted', onSuccess: () => setDel(null) });
  if (error) return <ErrorState error={error} onRetry={refetch} />;
  return (
    <div>
      <PageHeader eyebrow="Content" title="Content library" description="Every uploaded video, document, audio file and SCORM package in one place." />
      <div className="mb-6 grid gap-4 lg:grid-cols-2">
        <FileDrop label="Upload files" hint="Video, audio, PDF, Office, images, text · up to 1 GB each" onUploaded={() => refetch()} compact />
        <FileDrop endpoint="/files/scorm" accept=".zip" label="Upload a SCORM package" hint="SCORM 1.2 / 2004 ZIP with imsmanifest.xml" onUploaded={() => { refetch(); setView('scorm'); }} compact />
      </div>
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <Tabs value={view} onChange={setView} items={[{ value: 'files', label: 'Files', count: data?.files.length }, { value: 'scorm', label: 'SCORM packages', count: data?.scorm.length }]} />
        {view === 'files' && <><div className="w-44"><Select value={kind} onChange={(e) => setKind(e.target.value)} aria-label="Filter by type"><option value="">All types</option>{['video', 'audio', 'pdf', 'office', 'image', 'text', 'archive', 'other'].map((k) => <option key={k} value={k} className="capitalize">{k}</option>)}</Select></div><div className="w-full sm:ml-auto sm:w-64"><SearchInput value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search files…" aria-label="Search files" /></div></>}
      </div>
      {isLoading ? <Skeleton className="h-72" /> : view === 'files' ? (
        !data?.files.length ? <div className="surface"><EmptyState mood="wave" title="No files yet" description="Uploaded media will appear here." /></div> : (
          <Table><THead><tr><Th>File</Th><Th>Type</Th><Th>Size</Th><Th>Uploaded by</Th><Th>Date</Th><Th className="w-24" /></tr></THead><tbody>{data.files.map((f) => { const I = KIND_ICON[f.kind] ?? FileIcon; return <Tr key={f.id}><Td><div className="flex items-center gap-3"><span className="grid size-9 shrink-0 place-items-center rounded-lg bg-primary/12 text-primary-2"><I className="size-4" /></span><span className="min-w-0 truncate font-medium">{f.name}</span></div></Td><Td><Badge className="capitalize">{f.kind}</Badge></Td><Td className="tabular-nums text-muted">{formatBytes(f.size)}</Td><Td className="text-muted">{f.uploader ?? '—'}</Td><Td className="text-muted">{dateFmt(f.createdAt)}</Td><Td><div className="flex gap-1"><a href={`${f.url}/download`} aria-label={`Download ${f.name}`}><Button variant="ghost" size="icon-sm" tabIndex={-1}><Download className="size-4" /></Button></a><Button variant="ghost" size="icon-sm" aria-label={`Delete ${f.name}`} onClick={() => setDel(f)}><Trash2 className="size-4 text-danger" /></Button></div></Td></Tr>; })}</tbody></Table>
        )
      ) : !data?.scorm.length ? <div className="surface"><EmptyState mood="wave" title="No SCORM packages" description="Upload a SCORM ZIP above, then attach it to a SCORM lesson." /></div> : (
        <Table><THead><tr><Th>Package</Th><Th>Version</Th><Th>Files</Th><Th>Size</Th><Th>Uploaded by</Th><Th>Date</Th></tr></THead><tbody>{data.scorm.map((p) => <Tr key={p.id}><Td><div className="flex items-center gap-3"><span className="grid size-9 place-items-center rounded-lg bg-warm/15 text-warm"><Layers className="size-4" /></span><span className="font-medium">{p.title}</span></div></Td><Td><Badge tone="info">SCORM {p.version}</Badge></Td><Td className="tabular-nums text-muted">{p.fileCount}</Td><Td className="tabular-nums text-muted">{formatBytes(p.size)}</Td><Td className="text-muted">{p.uploader ?? '—'}</Td><Td className="text-muted">{dateFmt(p.createdAt)}</Td></Tr>)}</tbody></Table>
      )}
      <ConfirmDialog open={!!del} onOpenChange={(o) => !o && setDel(null)} danger title="Delete file?" description={`“${del?.name}” will be permanently removed. Files used by lessons can't be deleted.`} confirmLabel="Delete" loading={rm.isPending} onConfirm={() => del && rm.mutate(del)} />
    </div>
  );
}

/* ═════════ Grading ═════════ */
interface Sub { id: number; learner: string; avatarColor: string; courseId: number; course: string; lesson: string; maxPoints: number; instructions: string; text: string; link: string; fileId: number | null; fileName: string | null; status: string; grade: number | null; feedback: string; submittedAt: string; gradedAt: string | null }
export function AdminGrading() {
  const [tab, setTab] = useState<'submitted' | 'graded'>('submitted');
  const { data, isLoading, error, refetch } = useGet<Sub[]>(`/admin/grading?status=${tab}`, { key: ['/admin/grading', tab] });
  const [sel, setSel] = useState<Sub | null>(null);
  const [grade, setGrade] = useState('');
  const [fb, setFb] = useState('');
  const open = (s: Sub) => { setSel(s); setGrade(s.grade != null ? String(s.grade) : ''); setFb(s.feedback ?? ''); };
  const act = useAct((action: 'grade' | 'return') => api.post(`/admin/grading/${sel!.id}`, { grade: Number(grade), feedback: fb, action }), { invalidate: [['/admin/grading'], ['/admin/stats']], onSuccess: (_r, a) => { toast.success(a === 'return' ? 'Returned for revision' : 'Graded & learner notified'); setSel(null); } });
  if (error) return <ErrorState error={error} onRetry={refetch} />;
  return (
    <div>
      <PageHeader eyebrow="Review" title="Grading queue" description="Assignment submissions waiting for feedback." />
      <Tabs className="mb-5" value={tab} onChange={setTab} items={[{ value: 'submitted', label: 'Needs grading', count: tab === 'submitted' ? data?.length : undefined }, { value: 'graded', label: 'Graded' }]} />
      {isLoading ? <Skeleton className="h-72" /> : !data?.length ? <div className="surface"><EmptyState mood={tab === 'submitted' ? 'cheer' : 'sleep'} title={tab === 'submitted' ? 'All caught up!' : 'Nothing graded yet'} description={tab === 'submitted' ? 'No submissions are waiting for review.' : undefined} /></div> : (
        <div className="grid gap-4 md:grid-cols-2">
          {data.map((s) => (
            <button key={s.id} onClick={() => open(s)} className="surface surface-hover flex flex-col p-5 text-left">
              <div className="flex items-center gap-3"><Avatar name={s.learner} color={s.avatarColor} size={36} /><div className="min-w-0 flex-1"><div className="truncate font-semibold">{s.learner}</div><div className="text-xs text-subtle">{timeAgo(s.submittedAt)}</div></div>{s.status === 'graded' ? <Badge tone="success">{s.grade}/{s.maxPoints}</Badge> : <Badge tone="warn" dot>Review</Badge>}</div>
              <div className="mt-3 text-sm font-medium">{s.lesson}</div><div className="text-xs text-muted">{s.course}</div>
              <p className="mt-3 line-clamp-3 text-[13px] leading-relaxed text-muted">{s.text || s.link || s.fileName || '—'}</p>
              {(s.fileName || s.link) && <div className="mt-3 flex items-center gap-1.5 text-xs text-primary-2"><Paperclip className="size-3.5" />{s.fileName ?? 'Link'}</div>}
            </button>
          ))}
        </div>
      )}
      <Modal open={!!sel} onOpenChange={(o) => !o && setSel(null)} size="lg" title={sel ? `${sel.learner} · ${sel.lesson}` : ''} description={sel?.course}
        footer={<><Button variant="ghost" onClick={() => setSel(null)}>Close</Button>{sel?.status !== 'graded' && <Button variant="secondary" icon={<RotateCcw className="size-4" />} loading={act.isPending && act.variables === 'return'} onClick={() => act.mutate('return')} disabled={!fb.trim()}>Request revision</Button>}<Button variant="primary" icon={<CheckCircle2 className="size-4" />} loading={act.isPending && act.variables === 'grade'} disabled={grade === '' || Number(grade) < 0 || Number(grade) > (sel?.maxPoints ?? 100) || sel?.status === 'graded'} onClick={() => act.mutate('grade')}>Submit grade</Button></>}>
        {sel && <div className="space-y-5">
          <div className="rounded-2xl border border-line bg-card-2/40 p-4"><div className="mb-2 text-xs font-semibold uppercase tracking-wider text-subtle">Submission · {dateTimeFmt(sel.submittedAt)}</div>{sel.text && <p className="whitespace-pre-wrap text-sm leading-relaxed">{sel.text}</p>}<div className="mt-3 flex flex-wrap gap-4 text-sm">{sel.link && <a className="inline-flex items-center gap-1.5 text-primary-2 hover:underline" href={sel.link} target="_blank" rel="noopener noreferrer"><ExternalLink className="size-4" />{sel.link}</a>}{sel.fileId && <a className="inline-flex items-center gap-1.5 text-primary-2 hover:underline" href={`/api/files/${sel.fileId}/download`}><Paperclip className="size-4" />{sel.fileName}</a>}</div></div>
          <div className="grid gap-4 sm:grid-cols-[160px_1fr]"><Field label={`Grade (max ${sel.maxPoints})`}>{(id) => <Input id={id} type="number" min={0} max={sel.maxPoints} value={grade} onChange={(e) => setGrade(e.target.value)} disabled={sel.status === 'graded'} />}</Field><Field label="Feedback">{(id) => <Textarea id={id} value={fb} onChange={(e) => setFb(e.target.value)} className="min-h-24" disabled={sel.status === 'graded'} placeholder="Helpful, specific feedback…" />}</Field></div>
        </div>}
      </Modal>
    </div>
  );
}

/* ═════════ Reports ═════════ */
export function AdminReports() {
  const [tab, setTab] = useState<'courses' | 'learners'>('courses');
  const { data: courses } = useGet<any[]>('/admin/reports/courses');
  const { data: learners } = useGet<any[]>('/admin/reports/learners');
  const exp = (t: string) => { window.location.href = `/api/admin/reports/export/${t}`; };
  return (
    <div>
      <PageHeader eyebrow="Insights" title="Reports" description="Completion, scores and engagement — export anything to CSV." actions={<><Button variant="secondary" icon={<Download className="size-4" />} onClick={() => exp(tab)}>Export {tab}</Button><Button variant="secondary" icon={<Download className="size-4" />} onClick={() => exp('enrollments')}>Export enrollments</Button></>} />
      <Tabs className="mb-5" value={tab} onChange={setTab} items={[{ value: 'courses', label: 'By course' }, { value: 'learners', label: 'By learner' }]} />
      {tab === 'courses' ? (!courses ? <Skeleton className="h-72" /> : <Table><THead><tr><Th>Course</Th><Th>Category</Th><Th>Enrolled</Th><Th>Completed</Th><Th>Completion</Th><Th>Avg progress</Th><Th>Avg score</Th><Th>Rating</Th></tr></THead><tbody>{courses.map((c) => <Tr key={c.id}><Td><Link to={`/admin/courses/${c.id}`} className="font-medium hover:text-primary-2">{c.title}</Link><div className="text-xs capitalize text-subtle">{c.status}</div></Td><Td className="text-muted">{c.category}</Td><Td className="tabular-nums">{c.enrolled}</Td><Td className="tabular-nums">{c.completed}</Td><Td className="w-40"><div className="flex items-center gap-2"><ProgressBar value={c.completionRate} tone="success" height={5} /><span className="w-9 text-xs tabular-nums">{c.completionRate}%</span></div></Td><Td className="tabular-nums">{c.avgProgress}%</Td><Td className="tabular-nums">{c.avgScore != null ? `${c.avgScore}%` : '—'}</Td><Td className="tabular-nums">{c.rating ?? '—'}</Td></Tr>)}</tbody></Table>)
        : (!learners ? <Skeleton className="h-72" /> : <Table><THead><tr><Th>Learner</Th><Th>Department</Th><Th>Enrolled</Th><Th>Completed</Th><Th>Avg progress</Th><Th>Overdue</Th><Th>XP</Th><Th>Last sign-in</Th></tr></THead><tbody>{learners.map((l) => <Tr key={l.id}><Td><div className="font-medium">{l.name}</div><div className="text-xs text-subtle">{l.email}</div></Td><Td className="text-muted">{l.department || '—'}</Td><Td className="tabular-nums">{l.enrolled}</Td><Td className="tabular-nums">{l.completed}</Td><Td className="w-40"><div className="flex items-center gap-2"><ProgressBar value={l.avgProgress} height={5} /><span className="w-9 text-xs tabular-nums">{l.avgProgress}%</span></div></Td><Td>{l.overdue ? <Badge tone="danger">{l.overdue}</Badge> : <span className="text-subtle">0</span>}</Td><Td className="tabular-nums">{l.xp}</Td><Td className="text-muted">{l.lastLoginAt ? timeAgo(l.lastLoginAt) : 'Never'}</Td></Tr>)}</tbody></Table>)}
    </div>
  );
}

/* ═════════ Announcements ═════════ */
export function AdminAnnouncements() {
  const { data, isLoading } = useGet<any[]>('/admin/announcements');
  const { data: courses } = useGet<CourseCard[]>('/courses?all=1');
  const { data: groups } = useGet<{ id: number; name: string }[]>('/admin/groups');
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ title: '', body: '', audience: 'all', targetId: '', pinned: false });
  const send = useAct(() => api.post<{ notified: number }>('/admin/announcements', { ...f, targetId: f.targetId ? Number(f.targetId) : undefined }), { invalidate: [['/admin/announcements'], ['/me/dashboard']], onSuccess: (r) => { toast.success(`Sent to ${r.notified} people`); setOpen(false); setF({ title: '', body: '', audience: 'all', targetId: '', pinned: false }); } });
  const del = useAct((id: number) => api.del(`/admin/announcements/${id}`), { invalidate: [['/admin/announcements'], ['/me/dashboard']], success: 'Deleted' });
  return (
    <div>
      <PageHeader eyebrow="Communicate" title="Announcements" description="Broadcast news to everyone, a course, or a group. Recipients get a notification." actions={<Button variant="primary" icon={<Megaphone className="size-4" />} onClick={() => setOpen(true)}>New announcement</Button>} />
      {isLoading ? <Skeleton className="h-64" /> : !data?.length ? <div className="surface"><EmptyState mood="wave" title="No announcements yet" /></div> : (
        <div className="space-y-4">{data.map((a) => <div key={a.id} className="surface p-5"><div className="flex items-start gap-3"><span className="grid size-10 shrink-0 place-items-center rounded-xl bg-pink/15 text-pink"><Megaphone className="size-5" /></span><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><span className="font-display font-semibold">{a.title}</span>{a.pinned && <Badge tone="primary"><Pin className="size-3" />Pinned</Badge>}<Badge className="capitalize">{a.audience}</Badge></div><p className="mt-1.5 whitespace-pre-wrap text-sm leading-relaxed text-muted">{a.body}</p><div className="mt-2 text-xs text-subtle">{a.author} · {timeAgo(a.createdAt)}</div></div><Button variant="ghost" size="icon-sm" aria-label="Delete announcement" onClick={() => confirm('Delete this announcement?') && del.mutate(a.id)}><Trash2 className="size-4 text-danger" /></Button></div></div>)}</div>
      )}
      <Modal open={open} onOpenChange={setOpen} title="New announcement" footer={<><Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button><Button variant="primary" loading={send.isPending} disabled={!f.title.trim() || !f.body.trim() || (f.audience !== 'all' && !f.targetId)} onClick={() => send.mutate()}>Publish</Button></>}>
        <div className="space-y-4">
          <Field label="Title">{(id) => <Input id={id} value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} autoFocus maxLength={140} />}</Field>
          <Field label="Message">{(id) => <Textarea id={id} value={f.body} onChange={(e) => setF({ ...f, body: e.target.value })} className="min-h-28" maxLength={5000} />}</Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Audience">{(id) => <Select id={id} value={f.audience} onChange={(e) => setF({ ...f, audience: e.target.value, targetId: '' })}><option value="all">Everyone</option><option value="course">Learners in a course</option><option value="group">A group</option></Select>}</Field>
            {f.audience === 'course' && <Field label="Course">{(id) => <Select id={id} value={f.targetId} onChange={(e) => setF({ ...f, targetId: e.target.value })}><option value="">Select…</option>{courses?.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}</Select>}</Field>}
            {f.audience === 'group' && <Field label="Group">{(id) => <Select id={id} value={f.targetId} onChange={(e) => setF({ ...f, targetId: e.target.value })}><option value="">Select…</option>{groups?.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}</Select>}</Field>}
          </div>
          <Switch checked={f.pinned} onChange={(v) => setF({ ...f, pinned: v })} label="Pin to the top of dashboards" />
        </div>
      </Modal>
    </div>
  );
}

/* ═════════ Learning paths ═════════ */
interface AdminPath { id: number; title: string; description: string; theme: string; status: string; courses: { id: number; title: string; theme: string }[]; learners: number }
export function AdminPaths() {
  const { data, isLoading } = useGet<AdminPath[]>('/admin/paths');
  const { data: courses } = useGet<CourseCard[]>('/courses?all=1&status=published');
  const [f, setF] = useState<{ id?: number; title: string; description: string; theme: string; status: string; courseIds: number[] } | null>(null);
  const [del, setDel] = useState<AdminPath | null>(null);
  const save = useAct(() => (f!.id ? api.put(`/admin/paths/${f!.id}`, f) : api.post('/admin/paths', f)), { invalidate: [['/admin/paths'], ['/paths']], success: 'Path saved', onSuccess: () => setF(null) });
  const rm = useAct((p: AdminPath) => api.del(`/admin/paths/${p.id}`), { invalidate: [['/admin/paths'], ['/paths']], success: 'Path deleted', onSuccess: () => setDel(null) });
  const move = (i: number, d: number) => setF((x) => { if (!x) return x; const a = [...x.courseIds]; const j = i + d; if (j < 0 || j >= a.length) return x; [a[i], a[j]] = [a[j], a[i]]; return { ...x, courseIds: a }; });
  return (
    <div>
      <PageHeader eyebrow="Content" title="Learning paths" description="Bundle courses into guided journeys. Learners who join a path are enrolled in every course." actions={<Button variant="primary" icon={<Plus className="size-4" />} onClick={() => setF({ title: '', description: '', theme: 'nebula', status: 'draft', courseIds: [] })}>New path</Button>} />
      {isLoading ? <Skeleton className="h-64" /> : !data?.length ? <div className="surface"><EmptyState mood="wave" title="No learning paths" description="Create a path to curate a sequence of courses." /></div> : (
        <div className="grid gap-5 md:grid-cols-2">{data.map((p) => <div key={p.id} className="surface relative overflow-hidden p-5"><div className="absolute inset-0 opacity-30"><CourseCover theme={p.theme} seed={p.id + 3} rounded={false} className="scale-125 blur-xl" /></div><div className="relative"><div className="flex items-start gap-3"><span className="grid size-11 shrink-0 place-items-center rounded-xl bg-primary/15 text-primary-2"><Route className="size-5" /></span><div className="min-w-0 flex-1"><div className="flex items-center gap-2"><span className="truncate font-display font-semibold">{p.title}</span><Badge tone={p.status === 'published' ? 'success' : 'warn'} className="capitalize">{p.status}</Badge></div><div className="line-clamp-2 text-xs text-muted">{p.description}</div></div></div>
          <ol className="mt-4 space-y-1.5">{p.courses.map((c, i) => <li key={c.id} className="flex items-center gap-2.5 text-sm"><span className="grid size-5 place-items-center rounded-full bg-card-2 text-[10px] font-bold">{i + 1}</span><span className="truncate">{c.title}</span></li>)}</ol>
          <div className="mt-5 flex items-center justify-between"><span className="text-xs text-subtle">{p.learners} learners</span><div className="flex gap-1"><Button variant="secondary" size="sm" icon={<Pencil className="size-3.5" />} onClick={() => setF({ id: p.id, title: p.title, description: p.description, theme: p.theme, status: p.status, courseIds: p.courses.map((c) => c.id) })}>Edit</Button><Button variant="ghost" size="icon-sm" aria-label="Delete path" onClick={() => setDel(p)}><Trash2 className="size-4 text-danger" /></Button></div></div></div></div>)}</div>
      )}
      <Modal open={!!f} onOpenChange={(o) => !o && setF(null)} size="lg" title={f?.id ? 'Edit learning path' : 'New learning path'} footer={<><Button variant="ghost" onClick={() => setF(null)}>Cancel</Button><Button variant="primary" loading={save.isPending} disabled={!f?.title.trim()} onClick={() => save.mutate()}>Save path</Button></>}>
        {f && <div className="space-y-4">
          <Field label="Title">{(id) => <Input id={id} value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} autoFocus />}</Field>
          <Field label="Description">{(id) => <Textarea id={id} value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} className="min-h-16" />}</Field>
          <div className="grid gap-4 sm:grid-cols-2"><Field label="Theme">{(id) => <Select id={id} value={f.theme} onChange={(e) => setF({ ...f, theme: e.target.value })}>{THEME_NAMES.map((t) => <option key={t} value={t} className="capitalize">{t}</option>)}</Select>}</Field><Field label="Status">{(id) => <Select id={id} value={f.status} onChange={(e) => setF({ ...f, status: e.target.value })}><option value="draft">Draft</option><option value="published">Published</option></Select>}</Field></div>
          <div className="grid gap-4 md:grid-cols-2">
            <div><div className="mb-2 text-[13px] font-medium">Available courses</div><div className="max-h-64 divide-y divide-line overflow-y-auto rounded-2xl border border-line-2">{courses?.filter((c) => !f.courseIds.includes(c.id)).map((c) => <button key={c.id} type="button" onClick={() => setF({ ...f, courseIds: [...f.courseIds, c.id] })} className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm hover:bg-card-2"><Plus className="size-4 text-primary-2" /><span className="truncate">{c.title}</span></button>)}</div></div>
            <div><div className="mb-2 text-[13px] font-medium">In this path (ordered)</div><div className="max-h-64 divide-y divide-line overflow-y-auto rounded-2xl border border-line-2">{!f.courseIds.length && <div className="p-4 text-sm text-muted">Add courses from the left.</div>}{f.courseIds.map((cid, i) => <div key={cid} className="flex items-center gap-1.5 px-3 py-2 text-sm"><span className="w-5 text-xs font-bold text-primary-2">{i + 1}</span><span className="min-w-0 flex-1 truncate">{courses?.find((c) => c.id === cid)?.title ?? `Course ${cid}`}</span><button type="button" className="p-1 text-subtle hover:text-fg disabled:opacity-30" disabled={i === 0} onClick={() => move(i, -1)} aria-label="Move up"><ArrowUp className="size-3.5" /></button><button type="button" className="p-1 text-subtle hover:text-fg disabled:opacity-30" disabled={i === f.courseIds.length - 1} onClick={() => move(i, 1)} aria-label="Move down"><ArrowDown className="size-3.5" /></button><button type="button" className="p-1 text-subtle hover:text-danger" onClick={() => setF({ ...f, courseIds: f.courseIds.filter((x) => x !== cid) })} aria-label="Remove"><X className="size-3.5" /></button></div>)}</div></div>
          </div>
        </div>}
      </Modal>
      <ConfirmDialog open={!!del} onOpenChange={(o) => !o && setDel(null)} danger title={`Delete “${del?.title}”?`} description="Courses inside the path are not affected." confirmLabel="Delete path" loading={rm.isPending} onConfirm={() => del && rm.mutate(del)} />
    </div>
  );
}

/* ═════════ Settings ═════════ */
export function AdminSettings() {
  const [tab, setTab] = useState<'platform' | 'categories' | 'activity'>('platform');
  return (
    <div>
      <PageHeader eyebrow="Configure" title="Settings" description="Platform branding, taxonomy and the audit log." />
      <Tabs className="mb-6" value={tab} onChange={setTab} items={[{ value: 'platform', label: 'Platform' }, { value: 'categories', label: 'Categories' }, { value: 'activity', label: 'Activity log' }]} />
      {tab === 'platform' && <PlatformSettings />}{tab === 'categories' && <Categories />}{tab === 'activity' && <ActivityLog />}
    </div>
  );
}
function PlatformSettings() {
  const { data } = useGet<Record<string, any>>('/admin/settings');
  const [f, setF] = useState<Record<string, any> | null>(null);
  const v = f ?? data;
  const save = useAct(() => api.put('/admin/settings', v), { invalidate: [['/admin/settings'], ['/auth/settings']], success: 'Settings saved', onSuccess: () => setF(null) });
  if (!v) return <Skeleton className="h-96" />;
  const set = (k: string, val: any) => setF({ ...v, [k]: val });
  return (
    <div className="max-w-2xl space-y-6"><div className="surface space-y-5 p-6">
      <Field label="Platform name">{(id) => <Input id={id} value={v.platformName} onChange={(e) => set('platformName', e.target.value)} />}</Field>
      <Field label="Tagline">{(id) => <Input id={id} value={v.tagline} onChange={(e) => set('tagline', e.target.value)} />}</Field>
      <Field label="Support email">{(id) => <Input id={id} type="email" value={v.supportEmail} onChange={(e) => set('supportEmail', e.target.value)} />}</Field>
      <div className="grid gap-4 sm:grid-cols-2"><Field label="Certificate signer">{(id) => <Input id={id} value={v.certificateSigner} onChange={(e) => set('certificateSigner', e.target.value)} />}</Field><Field label="Signer title">{(id) => <Input id={id} value={v.certificateSignerTitle} onChange={(e) => set('certificateSignerTitle', e.target.value)} />}</Field></div>
      <Switch checked={!!v.allowRegistration} onChange={(x) => set('allowRegistration', x)} label="Open self-registration" description="When off, only admins can create accounts." />
      <Button variant="primary" loading={save.isPending} disabled={!f} onClick={() => save.mutate()}>Save settings</Button>
    </div></div>
  );
}
function Categories() {
  const { data } = useGet<Category[]>('/categories');
  const [f, setF] = useState<{ id?: number; name: string; color: string } | null>(null);
  const save = useAct(() => (f!.id ? api.patch(`/admin/categories/${f!.id}`, f) : api.post('/admin/categories', f)), { invalidate: [['/categories'], ['/courses']], success: 'Category saved', onSuccess: () => setF(null) });
  const rm = useAct((c: Category) => api.del(`/admin/categories/${c.id}`), { invalidate: [['/categories'], ['/courses']], success: 'Category deleted' });
  return (
    <div className="max-w-2xl space-y-4"><div className="flex justify-end"><Button variant="primary" icon={<Plus className="size-4" />} onClick={() => setF({ name: '', color: 'violet' })}>Add category</Button></div>
      <div className="surface divide-y divide-line">{data?.map((c) => <div key={c.id} className="flex items-center gap-3 px-5 py-3.5"><span className="size-3 rounded-full" style={{ background: TONE_COLOR[c.color] }} /><span className="flex-1 font-medium">{c.name}</span><span className="text-xs text-subtle">{c.courseCount} courses</span><Button variant="ghost" size="icon-sm" aria-label={`Edit ${c.name}`} onClick={() => setF({ id: c.id, name: c.name, color: c.color })}><Pencil className="size-4" /></Button><Button variant="ghost" size="icon-sm" aria-label={`Delete ${c.name}`} onClick={() => confirm(`Delete “${c.name}”? Courses become uncategorized.`) && rm.mutate(c)}><Trash2 className="size-4 text-danger" /></Button></div>)}</div>
      <Modal open={!!f} onOpenChange={(o) => !o && setF(null)} size="sm" title={f?.id ? 'Edit category' : 'New category'} footer={<><Button variant="ghost" onClick={() => setF(null)}>Cancel</Button><Button variant="primary" loading={save.isPending} disabled={!f?.name.trim()} onClick={() => save.mutate()}>Save</Button></>}>
        {f && <div className="space-y-4"><Field label="Name">{(id) => <Input id={id} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} autoFocus />}</Field><div className="flex gap-2">{['violet', 'cyan', 'amber', 'pink', 'emerald', 'blue', 'orange'].map((c) => <button key={c} type="button" aria-label={c} onClick={() => setF({ ...f, color: c })} className={cn('size-8 rounded-full ring-offset-2 ring-offset-bg', f.color === c && 'ring-2 ring-primary')} style={{ background: TONE_COLOR[c] }} />)}</div></div>}
      </Modal>
    </div>
  );
}
function ActivityLog() {
  const { data } = useGet<{ id: number; action: string; user: string; avatarColor: string; meta: any; createdAt: string }[]>('/admin/activity?limit=150');
  if (!data) return <Skeleton className="h-96" />;
  return <Table className="max-w-3xl"><THead><tr><Th>When</Th><Th>Who</Th><Th>What</Th></tr></THead><tbody>{data.map((a) => <Tr key={a.id}><Td className="whitespace-nowrap text-muted">{dateTimeFmt(a.createdAt)}</Td><Td><div className="flex items-center gap-2"><Avatar name={a.user} color={a.avatarColor} size={24} /><span className="font-medium">{a.user}</span></div></Td><Td className="text-muted">{ACTION_LABEL[a.action] ?? a.action}{a.meta?.title ? ` · ${a.meta.title}` : ''}{a.meta?.email ? ` · ${a.meta.email}` : ''}</Td></Tr>)}</tbody></Table>;
}
void Award; void CheckCircle2; void ClipboardCheck; void Checkbox; void Spinner; void useAuth;

import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Copy, Eye, MoreHorizontal, Pencil, Plus, Trash2, UserPlus, Archive, Send, Undo2 } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { useGet, useAct } from '@/lib/queries';
import type { Category, CourseCard } from '@/lib/types';
import { dateFmt, formatDuration } from '@/lib/utils';
import { Badge, EmptyState, ErrorState, Menu, MenuContent, MenuItem, MenuSeparator, MenuTrigger, PageHeader, Skeleton, Tabs } from '@/components/ui/misc';
import { Button } from '@/components/ui/button';
import { Field, Input, SearchInput, Select, Textarea } from '@/components/ui/form';
import { Modal, ConfirmDialog } from '@/components/ui/dialog';
import { CourseCover } from '@/components/space/CourseCover';
import { Table, THead, Th, Tr, Td } from '@/components/admin/Table';
import { AssignModal } from '@/components/admin/AssignModal';

export default function AdminCourses() {
  const nav = useNavigate();
  const [status, setStatus] = useState<'all' | 'published' | 'draft' | 'archived'>('all');
  const [q, setQ] = useState('');
  const url = `/courses?all=1&sort=newest${status !== 'all' ? `&status=${status}` : ''}${q ? `&q=${encodeURIComponent(q)}` : ''}`;
  const { data, isLoading, error, refetch } = useGet<CourseCard[]>(url, { key: ['/courses', 'admin', url] });
  const { data: cats } = useGet<Category[]>('/categories');
  const [creating, setCreating] = useState(false);
  const [del, setDel] = useState<CourseCard | null>(null);
  const [assign, setAssign] = useState<CourseCard | null>(null);
  const [form, setForm] = useState({ title: '', subtitle: '', categoryId: '', level: 'Beginner' });

  const create = useAct(() => api.post<{ id: number }>('/admin/courses', { ...form, categoryId: form.categoryId ? Number(form.categoryId) : null }), { invalidate: [['/courses']], onSuccess: (r) => { setCreating(false); toast.success('Course created'); nav(`/admin/courses/${r.id}`); } });
  const dup = useAct((id: number) => api.post<{ id: number }>(`/admin/courses/${id}/duplicate`), { invalidate: [['/courses']], onSuccess: (r) => { toast.success('Course duplicated'); nav(`/admin/courses/${r.id}`); } });
  const setSt = useAct(({ id, s }: { id: number; s: string }) => api.patch(`/admin/courses/${id}`, { status: s }), { invalidate: [['/courses'], ['/admin/stats']], success: 'Status updated' });
  const remove = useAct((c: CourseCard) => api.del(`/admin/courses/${c.id}?force=1`), { invalidate: [['/courses'], ['/admin/stats']], success: 'Course deleted', onSuccess: () => setDel(null) });

  if (error) return <ErrorState error={error} onRetry={refetch} />;
  return (
    <div>
      <PageHeader eyebrow="Content" title="Courses" description="Build, publish and manage every course on the platform." actions={<Button variant="primary" icon={<Plus className="size-4" />} onClick={() => setCreating(true)}>New course</Button>} />
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <Tabs value={status} onChange={setStatus} items={[{ value: 'all', label: 'All' }, { value: 'published', label: 'Published' }, { value: 'draft', label: 'Drafts' }, { value: 'archived', label: 'Archived' }]} />
        <div className="w-full sm:ml-auto sm:w-72"><SearchInput value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search courses…" aria-label="Search courses" /></div>
      </div>
      {isLoading ? <Skeleton className="h-96" /> : !data?.length ? <div className="surface"><EmptyState mood="wave" title="No courses here yet" description="Create your first course to get started." action={<Button variant="primary" onClick={() => setCreating(true)}>New course</Button>} /></div> : (
        <Table>
          <THead><tr><Th>Course</Th><Th>Category</Th><Th>Status</Th><Th>Lessons</Th><Th>Learners</Th><Th>Updated</Th><Th className="w-12" /></tr></THead>
          <tbody>
            {data.map((c) => (
              <Tr key={c.id}>
                <Td><Link to={`/admin/courses/${c.id}`} className="flex items-center gap-3.5"><div className="size-12 shrink-0 overflow-hidden rounded-xl"><CourseCover theme={c.theme} seed={c.id} coverUrl={c.coverUrl} /></div><div className="min-w-0"><div className="truncate font-semibold hover:text-primary-2">{c.title}</div><div className="truncate text-xs text-subtle">{c.instructor?.name} · {c.level}</div></div></Link></Td>
                <Td>{c.category ? <Badge tone="primary">{c.category.name}</Badge> : <span className="text-subtle">—</span>}</Td>
                <Td><Badge tone={c.status === 'published' ? 'success' : c.status === 'draft' ? 'warn' : 'neutral'} dot className="capitalize">{c.status}</Badge></Td>
                <Td className="tabular-nums text-muted">{c.lessonCount} · {formatDuration(c.durationMinutes)}</Td>
                <Td className="tabular-nums">{c.enrolledCount}<span className="text-subtle"> ({c.completedCount} done)</span></Td>
                <Td className="text-muted">{dateFmt(c.updatedAt)}</Td>
                <Td>
                  <Menu><MenuTrigger asChild><Button variant="ghost" size="icon-sm" aria-label={`Actions for ${c.title}`}><MoreHorizontal className="size-4" /></Button></MenuTrigger>
                    <MenuContent>
                      <MenuItem icon={<Pencil />} onSelect={() => nav(`/admin/courses/${c.id}`)}>Edit in builder</MenuItem>
                      <MenuItem icon={<Eye />} onSelect={() => nav(`/courses/${c.id}`)}>View course page</MenuItem>
                      <MenuItem icon={<UserPlus />} onSelect={() => setAssign(c)}>Assign learners</MenuItem>
                      <MenuItem icon={<Copy />} onSelect={() => dup.mutate(c.id)}>Duplicate</MenuItem>
                      <MenuSeparator />
                      {c.status !== 'published' ? <MenuItem icon={<Send />} onSelect={() => setSt.mutate({ id: c.id, s: 'published' })}>Publish</MenuItem> : <MenuItem icon={<Undo2 />} onSelect={() => setSt.mutate({ id: c.id, s: 'draft' })}>Unpublish</MenuItem>}
                      {c.status !== 'archived' && <MenuItem icon={<Archive />} onSelect={() => setSt.mutate({ id: c.id, s: 'archived' })}>Archive</MenuItem>}
                      <MenuSeparator />
                      <MenuItem icon={<Trash2 />} danger onSelect={() => setDel(c)}>Delete…</MenuItem>
                    </MenuContent>
                  </Menu>
                </Td>
              </Tr>
            ))}
          </tbody>
        </Table>
      )}

      <Modal open={creating} onOpenChange={setCreating} title="Create a course" description="You can fill in lessons and details next." footer={<><Button variant="ghost" onClick={() => setCreating(false)}>Cancel</Button><Button variant="primary" loading={create.isPending} disabled={!form.title.trim()} onClick={() => create.mutate()}>Create & open builder</Button></>}>
        <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); if (form.title.trim()) create.mutate(); }}>
          <Field label="Course title">{(id) => <Input id={id} autoFocus value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="e.g. Introduction to Orbital Mechanics" maxLength={140} />}</Field>
          <Field label="Subtitle">{(id) => <Textarea id={id} value={form.subtitle} onChange={(e) => setForm({ ...form, subtitle: e.target.value })} className="min-h-16" maxLength={200} placeholder="One line that sells the course" />}</Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Category">{(id) => <Select id={id} value={form.categoryId} onChange={(e) => setForm({ ...form, categoryId: e.target.value })}><option value="">Uncategorized</option>{cats?.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</Select>}</Field>
            <Field label="Level">{(id) => <Select id={id} value={form.level} onChange={(e) => setForm({ ...form, level: e.target.value })}><option>Beginner</option><option>Intermediate</option><option>Advanced</option></Select>}</Field>
          </div>
          <button type="submit" hidden />
        </form>
      </Modal>
      <ConfirmDialog open={!!del} onOpenChange={(o) => !o && setDel(null)} danger title={`Delete “${del?.title}”?`} description={<>This permanently removes the course, its lessons and <b>{del?.enrolledCount ?? 0}</b> enrollment record(s) and progress. This can't be undone. Consider archiving instead.</>} confirmLabel="Delete course" loading={remove.isPending} onConfirm={() => del && remove.mutate(del)} />
      <AssignModal open={!!assign} onClose={() => setAssign(null)} courseId={assign?.id} />
    </div>
  );
}

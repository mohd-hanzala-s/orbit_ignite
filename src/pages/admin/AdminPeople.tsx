import { useMemo, useState } from 'react';
import { Plus, Trash2, UsersRound, BookPlus, Pencil, UserPlus, X, Search } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { useGet, useAct } from '@/lib/queries';
import type { CourseCard } from '@/lib/types';
import { cn, dateFmt, timeAgo } from '@/lib/utils';
import { Avatar, Badge, EmptyState, ErrorState, PageHeader, ProgressBar, Skeleton, Tabs } from '@/components/ui/misc';
import { Button } from '@/components/ui/button';
import { Checkbox, Field, Input, SearchInput, Select, Textarea } from '@/components/ui/form';
import { ConfirmDialog, Modal } from '@/components/ui/dialog';
import { Table, THead, Th, Tr, Td } from '@/components/admin/Table';
import { AssignModal } from '@/components/admin/AssignModal';
import { TONE_COLOR } from '@/components/charts';

/* ═════════ Groups ═════════ */
interface Group { id: number; name: string; description: string; color: string; members: { id: number; name: string; email: string; avatarColor: string }[]; courses: { id: number; title: string; theme: string; dueDays: number | null }[] }

export function AdminGroups() {
  const { data, isLoading, error, refetch } = useGet<Group[]>('/admin/groups');
  const [form, setForm] = useState<{ id?: number; name: string; description: string; color: string } | null>(null);
  const [manage, setManage] = useState<Group | null>(null);
  const [del, setDel] = useState<Group | null>(null);
  const save = useAct(() => (form!.id ? api.patch(`/admin/groups/${form!.id}`, form) : api.post('/admin/groups', form)), { invalidate: [['/admin/groups']], success: 'Group saved', onSuccess: () => setForm(null) });
  const remove = useAct((g: Group) => api.del(`/admin/groups/${g.id}`), { invalidate: [['/admin/groups']], success: 'Group deleted', onSuccess: () => setDel(null) });
  if (error) return <ErrorState error={error} onRetry={refetch} />;
  return (
    <div>
      <PageHeader eyebrow="People" title="Groups" description="Cohorts and teams. Assign a course to a group and every member — including future joiners — is enrolled automatically." actions={<Button variant="primary" icon={<Plus className="size-4" />} onClick={() => setForm({ name: '', description: '', color: 'cyan' })}>New group</Button>} />
      {isLoading ? <Skeleton className="h-64" /> : !data?.length ? <div className="surface"><EmptyState mood="wave" title="No groups yet" description="Create a group to assign courses in bulk." /></div> : (
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {data.map((g) => (
            <div key={g.id} className="surface flex flex-col p-5">
              <div className="flex items-start gap-3"><span className="grid size-11 shrink-0 place-items-center rounded-xl" style={{ background: `color-mix(in oklab, ${TONE_COLOR[g.color] ?? 'var(--accent)'} 20%, transparent)`, color: TONE_COLOR[g.color] }}><UsersRound className="size-5" /></span><div className="min-w-0 flex-1"><div className="truncate font-display font-semibold">{g.name}</div><div className="line-clamp-2 text-xs text-muted">{g.description || 'No description'}</div></div>
                <Button variant="ghost" size="icon-sm" aria-label="Edit group" onClick={() => setForm({ id: g.id, name: g.name, description: g.description, color: g.color })}><Pencil className="size-4" /></Button></div>
              <div className="mt-5 flex -space-x-2">{g.members.slice(0, 7).map((m) => <Avatar key={m.id} name={m.name} color={m.avatarColor} size={30} />)}{g.members.length > 7 && <span className="grid size-[30px] place-items-center rounded-full bg-card-2 text-[11px] font-semibold ring-2 ring-bg">+{g.members.length - 7}</span>}{!g.members.length && <span className="text-xs text-subtle">No members</span>}</div>
              <div className="mt-4 flex flex-wrap gap-1.5">{g.courses.map((c) => <Badge key={c.id} tone="primary" className="max-w-full truncate">{c.title}{c.dueDays ? ` · ${c.dueDays}d` : ''}</Badge>)}{!g.courses.length && <span className="text-xs text-subtle">No courses assigned</span>}</div>
              <div className="mt-auto flex gap-2 pt-5"><Button variant="secondary" size="sm" className="flex-1" onClick={() => setManage(g)}>Manage members & courses</Button><Button variant="ghost" size="icon-sm" aria-label="Delete group" onClick={() => setDel(g)}><Trash2 className="size-4 text-danger" /></Button></div>
            </div>
          ))}
        </div>
      )}
      <Modal open={!!form} onOpenChange={(o) => !o && setForm(null)} title={form?.id ? 'Edit group' : 'New group'} size="sm" footer={<><Button variant="ghost" onClick={() => setForm(null)}>Cancel</Button><Button variant="primary" loading={save.isPending} disabled={!form?.name.trim()} onClick={() => save.mutate()}>Save</Button></>}>
        {form && <div className="space-y-4"><Field label="Name">{(id) => <Input id={id} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} autoFocus />}</Field><Field label="Description">{(id) => <Textarea id={id} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="min-h-16" />}</Field><div><div className="mb-2 text-[13px] font-medium">Colour</div><div className="flex gap-2">{['violet', 'cyan', 'amber', 'pink', 'emerald', 'blue', 'orange'].map((c) => <button key={c} type="button" aria-label={c} onClick={() => setForm({ ...form, color: c })} className={cn('size-8 rounded-full ring-offset-2 ring-offset-bg', form.color === c && 'ring-2 ring-primary')} style={{ background: TONE_COLOR[c] }} />)}</div></div></div>}
      </Modal>
      <GroupManager group={manage} onClose={() => setManage(null)} />
      <ConfirmDialog open={!!del} onOpenChange={(o) => !o && setDel(null)} danger title={`Delete ${del?.name}?`} description="Members stay on the platform and keep their existing enrollments." confirmLabel="Delete group" loading={remove.isPending} onConfirm={() => del && remove.mutate(del)} />
    </div>
  );
}

function GroupManager({ group, onClose }: { group: Group | null; onClose: () => void }) {
  const { data: users } = useGet<{ id: number; name: string; email: string; role: string; avatarColor: string }[]>(group ? '/admin/users/options' : null);
  const { data: courses } = useGet<CourseCard[]>(group ? '/courses?all=1&status=published' : null);
  const [tab, setTab] = useState<'members' | 'courses'>('members');
  const [members, setMembers] = useState<Set<number>>(new Set());
  const [assigned, setAssigned] = useState<Record<number, number | null>>({});
  const [q, setQ] = useState('');
  const [seed, setSeed] = useState<number | null>(null);
  if (group && seed !== group.id) { setSeed(group.id); setMembers(new Set(group.members.map((m) => m.id))); setAssigned(Object.fromEntries(group.courses.map((c) => [c.id, c.dueDays]))); setTab('members'); setQ(''); }
  const saveM = useAct(() => api.put(`/admin/groups/${group!.id}/members`, { userIds: [...members] }), { invalidate: [['/admin/groups'], ['/admin/enrollments']], success: 'Members saved' });
  const saveC = useAct(() => api.put(`/admin/groups/${group!.id}/courses`, { courses: Object.entries(assigned).map(([id, d]) => ({ courseId: Number(id), dueDays: d })) }), { invalidate: [['/admin/groups'], ['/admin/enrollments'], ['/courses']], success: 'Courses assigned & members enrolled' });
  const list = useMemo(() => (users ?? []).filter((u) => (u.name + u.email).toLowerCase().includes(q.toLowerCase())), [users, q]);
  return (
    <Modal open={!!group} onOpenChange={(o) => { if (!o) { onClose(); setSeed(null); } }} title={`Manage “${group?.name}”`} size="md" footer={<><Button variant="ghost" onClick={() => { onClose(); setSeed(null); }}>Close</Button><Button variant="primary" loading={saveM.isPending || saveC.isPending} onClick={() => (tab === 'members' ? saveM.mutate() : saveC.mutate())}>Save {tab}</Button></>}>
      <Tabs className="mb-4" value={tab} onChange={setTab} items={[{ value: 'members', label: 'Members', count: members.size }, { value: 'courses', label: 'Courses', count: Object.keys(assigned).length }]} />
      {tab === 'members' ? (
        <div><Input icon={<Search />} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search people…" aria-label="Search people" /><div className="mt-2 max-h-80 divide-y divide-line overflow-y-auto rounded-2xl border border-line-2">{list.map((u) => <label key={u.id} className={cn('flex cursor-pointer items-center gap-3 px-4 py-2.5 hover:bg-card-2', members.has(u.id) && 'bg-primary/10')}><input type="checkbox" className="size-4 accent-[var(--primary)]" checked={members.has(u.id)} onChange={() => setMembers((s) => { const n = new Set(s); n.has(u.id) ? n.delete(u.id) : n.add(u.id); return n; })} /><Avatar name={u.name} color={u.avatarColor} size={28} /><span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium">{u.name}</span><span className="block truncate text-xs text-subtle">{u.email}</span></span><Badge className="capitalize">{u.role}</Badge></label>)}</div></div>
      ) : (
        <div className="space-y-2"><p className="mb-3 text-sm text-muted">Members are enrolled in checked courses immediately; new members are enrolled when they join.</p>{courses?.map((c) => { const on = c.id in assigned; return <div key={c.id} className={cn('flex items-center gap-3 rounded-2xl border px-4 py-3', on ? 'border-primary/40 bg-primary/8' : 'border-line-2')}><Checkbox checked={on} onChange={(v) => setAssigned((a) => { const n = { ...a }; v ? (n[c.id] = null) : delete n[c.id]; return n; })} label={<span className="font-medium">{c.title}</span>} className="flex-1" />{on && <div className="flex items-center gap-2 text-xs text-muted">Due in<Input type="number" min={1} max={3650} value={assigned[c.id] ?? ''} placeholder="—" onChange={(e) => setAssigned((a) => ({ ...a, [c.id]: e.target.value ? Number(e.target.value) : null }))} className="h-8 w-16 text-center" aria-label={`Due days for ${c.title}`} />days</div>}</div>; })}</div>
      )}
    </Modal>
  );
}

/* ═════════ Enrollments ═════════ */
interface Enr { id: number; userId: number; user: string; email: string; avatarColor: string; courseId: number; course: string; status: string; progress: number; source: string; dueDate: string | null; enrolledAt: string; completedAt: string | null; lastAccessedAt: string | null; overdue: boolean }
export function AdminEnrollments() {
  const [status, setStatus] = useState<'all' | 'active' | 'completed'>('all');
  const [q, setQ] = useState('');
  const url = `/admin/enrollments?${status !== 'all' ? `status=${status}&` : ''}q=${encodeURIComponent(q)}`;
  const { data, isLoading, error, refetch } = useGet<Enr[]>(url, { key: ['/admin/enrollments', url] });
  const [assign, setAssign] = useState(false);
  const [due, setDue] = useState<Enr | null>(null);
  const [dueVal, setDueVal] = useState('');
  const rm = useAct((id: number) => api.del(`/admin/enrollments/${id}`), { invalidate: [['/admin/enrollments'], ['/courses']], success: 'Enrollment removed' });
  const upd = useAct((b: { id: number; dueDate?: string | null; reset?: boolean }) => api.patch(`/admin/enrollments/${b.id}`, b), { invalidate: [['/admin/enrollments']], success: 'Updated', onSuccess: () => setDue(null) });
  if (error) return <ErrorState error={error} onRetry={refetch} />;
  return (
    <div>
      <PageHeader eyebrow="People" title="Enrollments" description="Every learner-course relationship, with progress and deadlines." actions={<Button variant="primary" icon={<UserPlus className="size-4" />} onClick={() => setAssign(true)}>Assign course</Button>} />
      <div className="mb-5 flex flex-wrap items-center gap-3"><Tabs value={status} onChange={setStatus} items={[{ value: 'all', label: 'All' }, { value: 'active', label: 'In progress' }, { value: 'completed', label: 'Completed' }]} /><div className="w-full sm:ml-auto sm:w-72"><SearchInput value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search learner or course…" aria-label="Search enrollments" /></div></div>
      {isLoading ? <Skeleton className="h-96" /> : !data?.length ? <div className="surface"><EmptyState title="No enrollments found" mood="think" /></div> : (
        <Table><THead><tr><Th>Learner</Th><Th>Course</Th><Th>Progress</Th><Th>Status</Th><Th>Due</Th><Th>Last active</Th><Th className="w-24" /></tr></THead>
          <tbody>{data.map((e) => <Tr key={e.id}><Td><div className="flex items-center gap-3"><Avatar name={e.user} color={e.avatarColor} size={32} /><div className="min-w-0"><div className="truncate font-medium">{e.user}</div><div className="truncate text-xs text-subtle">{e.email}</div></div></div></Td><Td className="max-w-[220px]"><div className="truncate">{e.course}</div><div className="text-xs capitalize text-subtle">{e.source}</div></Td><Td className="w-44"><div className="flex items-center gap-2"><ProgressBar value={e.progress} height={5} /><span className="w-9 text-xs tabular-nums text-muted">{e.progress}%</span></div></Td><Td><Badge tone={e.status === 'completed' ? 'success' : e.overdue ? 'danger' : 'info'} className="capitalize">{e.overdue ? 'Overdue' : e.status}</Badge></Td><Td className="text-muted">{dateFmt(e.dueDate)}</Td><Td className="text-muted">{e.lastAccessedAt ? timeAgo(e.lastAccessedAt) : '—'}</Td>
            <Td><div className="flex gap-1"><Button variant="ghost" size="icon-sm" aria-label="Set due date" onClick={() => { setDue(e); setDueVal(e.dueDate ?? ''); }}><Pencil className="size-4" /></Button><Button variant="ghost" size="icon-sm" aria-label={`Remove ${e.user}`} onClick={() => { if (confirm(`Remove ${e.user} from “${e.course}”? Progress will be deleted.`)) rm.mutate(e.id); }}><Trash2 className="size-4 text-danger" /></Button></div></Td></Tr>)}</tbody></Table>
      )}
      <AssignModal open={assign} onClose={() => setAssign(false)} />
      <Modal open={!!due} onOpenChange={(o) => !o && setDue(null)} size="sm" title="Edit enrollment" description={due ? `${due.user} · ${due.course}` : ''} footer={<><Button variant="danger" className="mr-auto" onClick={() => due && confirm('Reset all progress for this learner in this course?') && upd.mutate({ id: due.id, reset: true })}>Reset progress</Button><Button variant="ghost" onClick={() => setDue(null)}>Cancel</Button><Button variant="primary" loading={upd.isPending} onClick={() => due && upd.mutate({ id: due.id, dueDate: dueVal || null })}>Save</Button></>}>
        <Field label="Due date">{(id) => <Input id={id} type="date" value={dueVal} onChange={(e) => setDueVal(e.target.value)} />}</Field>
      </Modal>
    </div>
  );
}
void toast;

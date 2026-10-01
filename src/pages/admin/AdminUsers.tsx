import { useMemo, useRef, useState } from 'react';
import { MoreHorizontal, Pencil, Plus, Trash2, Upload, UserCheck, UserX, KeyRound, Download, Eye } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { useGet, useAct } from '@/lib/queries';
import { useAuth } from '@/lib/auth';
import type { User, CourseCard } from '@/lib/types';
import { dateFmt, timeAgo } from '@/lib/utils';
import { Avatar, Badge, EmptyState, ErrorState, Menu, MenuContent, MenuItem, MenuSeparator, MenuTrigger, PageHeader, ProgressBar, Skeleton, Tabs } from '@/components/ui/misc';
import { Button } from '@/components/ui/button';
import { Field, Input, SearchInput, Select } from '@/components/ui/form';
import { ConfirmDialog, Drawer, Modal } from '@/components/ui/dialog';
import { Table, THead, Th, Tr, Td } from '@/components/admin/Table';
import { CourseCover } from '@/components/space/CourseCover';

type Row = User & { enrollments: number; completed: number };
const ROLE_TONE = { admin: 'warn', instructor: 'pink', learner: 'info' } as const;

function UserForm({ open, onClose, user }: { open: boolean; onClose: () => void; user: Row | null }) {
  const editing = !!user;
  const [f, setF] = useState({ name: '', email: '', role: 'learner', title: '', department: '', password: '' });
  const [seed, setSeed] = useState<string | null>(null);
  const key = `${open}-${user?.id ?? 'new'}`;
  if (open && seed !== key) { setSeed(key); setF({ name: user?.name ?? '', email: user?.email ?? '', role: user?.role ?? 'learner', title: user?.title ?? '', department: user?.department ?? '', password: '' }); }
  const save = useAct(() => (editing ? api.patch(`/admin/users/${user!.id}`, { ...f, password: f.password || undefined }) : api.post('/admin/users', f)), { invalidate: [['/admin/users'], ['/admin/stats']], success: editing ? 'User updated' : 'User created', onSuccess: onClose });
  const genPw = () => setF((x) => ({ ...x, password: 'Orbit' + Math.random().toString(36).slice(2, 8) + '!' + Math.floor(Math.random() * 90 + 10) }));
  return (
    <Modal open={open} onOpenChange={(o) => !o && onClose()} title={editing ? 'Edit user' : 'Add user'} footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button><Button variant="primary" loading={save.isPending} onClick={() => save.mutate()}>{editing ? 'Save changes' : 'Create user'}</Button></>}>
      <form className="grid gap-4 sm:grid-cols-2" onSubmit={(e) => { e.preventDefault(); save.mutate(); }}>
        <Field label="Full name" className="sm:col-span-2">{(id) => <Input id={id} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} autoFocus />}</Field>
        <Field label="Email" className="sm:col-span-2">{(id) => <Input id={id} type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} />}</Field>
        <Field label="Role">{(id) => <Select id={id} value={f.role} onChange={(e) => setF({ ...f, role: e.target.value })}><option value="learner">Learner</option><option value="instructor">Instructor</option><option value="admin">Administrator</option></Select>}</Field>
        <Field label="Department">{(id) => <Input id={id} value={f.department} onChange={(e) => setF({ ...f, department: e.target.value })} />}</Field>
        <Field label="Job title" className="sm:col-span-2">{(id) => <Input id={id} value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} />}</Field>
        <Field label={editing ? 'Reset password (optional)' : 'Password'} hint="At least 8 characters. Share it securely." className="sm:col-span-2">{(id) => <div className="flex gap-2"><Input id={id} value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} autoComplete="new-password" /><Button type="button" variant="secondary" icon={<KeyRound className="size-4" />} onClick={genPw}>Generate</Button></div>}</Field>
        <button type="submit" hidden />
      </form>
    </Modal>
  );
}

function ImportModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [rows, setRows] = useState<Record<string, string>[]>([]);
  const [result, setResult] = useState<{ created: number; errors: { row: number; error: string }[] } | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const parse = async (file: File) => {
    const text = (await file.text()).replace(/^﻿/, '');
    const lines = text.split(/\r?\n/).filter((l) => l.trim());
    const split = (l: string) => { const out: string[] = []; let cur = '', q = false; for (const ch of l) { if (ch === '"') q = !q; else if (ch === ',' && !q) { out.push(cur); cur = ''; } else cur += ch; } out.push(cur); return out.map((s) => s.trim()); };
    const head = split(lines[0]).map((h) => h.toLowerCase());
    if (!head.includes('email') || !head.includes('name')) return toast.error('CSV needs at least "name" and "email" columns');
    setRows(lines.slice(1).map((l) => Object.fromEntries(split(l).map((v, i) => [head[i], v]))));
    setResult(null);
  };
  const go = useAct(() => api.post<{ created: number; errors: { row: number; error: string }[] }>('/admin/users/import', { rows }), { invalidate: [['/admin/users']], onSuccess: (r) => { setResult(r); if (r.created) toast.success(`Imported ${r.created} users`); } });
  const sample = () => { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob(['name,email,role,department,password\nJane Doe,jane@example.com,learner,Operations,Welcome#2026\n'], { type: 'text/csv' })); a.download = 'orbit-users-template.csv'; a.click(); };
  return (
    <Modal open={open} onOpenChange={(o) => { if (!o) { onClose(); setRows([]); setResult(null); } }} title="Import users from CSV" description="Columns: name, email, role (optional), department (optional), password (optional — random if blank)." footer={<><Button variant="ghost" onClick={onClose}>Close</Button><Button variant="primary" disabled={!rows.length || !!result} loading={go.isPending} onClick={() => go.mutate()}>Import {rows.length || ''} users</Button></>}>
      <input ref={input} type="file" accept=".csv,text/csv" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) parse(f); e.target.value = ''; }} />
      <div className="space-y-4">
        <div className="flex gap-3"><Button variant="secondary" icon={<Upload className="size-4" />} onClick={() => input.current?.click()}>Choose CSV file</Button><Button variant="ghost" icon={<Download className="size-4" />} onClick={sample}>Download template</Button></div>
        {rows.length > 0 && !result && <div className="rounded-2xl border border-line-2"><div className="border-b border-line px-4 py-2 text-xs font-semibold text-muted">{rows.length} rows ready</div><div className="max-h-56 overflow-auto p-2 text-sm">{rows.slice(0, 50).map((r, i) => <div key={i} className="flex gap-3 rounded-lg px-2 py-1.5 hover:bg-card-2"><span className="w-6 text-subtle">{i + 1}</span><span className="flex-1 truncate font-medium">{r.name}</span><span className="flex-1 truncate text-muted">{r.email}</span><span className="text-subtle">{r.role || 'learner'}</span></div>)}</div></div>}
        {result && <div className="space-y-2 rounded-2xl border border-line-2 p-4 text-sm"><div className="font-semibold text-success">{result.created} users created</div>{result.errors.map((e) => <div key={e.row} className="text-danger">Row {e.row}: {e.error}</div>)}</div>}
      </div>
    </Modal>
  );
}

function UserDrawer({ id, onClose }: { id: number | null; onClose: () => void }) {
  const { data } = useGet<any>(id ? `/admin/users/${id}` : null);
  return (
    <Drawer open={!!id} onOpenChange={(o) => !o && onClose()} side="right" title="User details">
      <div className="flex-1 overflow-y-auto p-6">
        {!data ? <Skeleton className="h-64" /> : (
          <div className="space-y-6">
            <div className="flex items-center gap-4"><Avatar name={data.name} color={data.avatarColor} size={60} /><div className="min-w-0"><div className="truncate font-display text-xl font-semibold">{data.name}</div><div className="truncate text-sm text-muted">{data.email}</div><div className="mt-1.5 flex gap-2"><Badge tone={ROLE_TONE[data.role as keyof typeof ROLE_TONE]} className="capitalize">{data.role}</Badge><Badge tone={data.status === 'active' ? 'success' : 'neutral'} className="capitalize">{data.status}</Badge></div></div></div>
            <div className="grid grid-cols-3 gap-3 text-center">{[['XP', data.xp], ['Streak', data.streak], ['Badges', data.badges.length]].map(([l, v]) => <div key={l as string} className="rounded-xl border border-line bg-card-2/40 py-3"><div className="font-display text-xl font-bold">{v}</div><div className="text-[11px] text-subtle">{l}</div></div>)}</div>
            <dl className="space-y-2 text-sm">{[['Department', data.department || '—'], ['Title', data.title || '—'], ['Joined', dateFmt(data.createdAt)], ['Last sign-in', data.lastLoginAt ? timeAgo(data.lastLoginAt) : 'Never']].map(([k, v]) => <div key={k} className="flex justify-between gap-4"><dt className="text-muted">{k}</dt><dd className="font-medium">{v}</dd></div>)}</dl>
            {data.groups.length > 0 && <div><div className="mb-2 text-xs font-semibold uppercase tracking-wider text-subtle">Groups</div><div className="flex flex-wrap gap-2">{data.groups.map((g: any) => <Badge key={g.id} tone="primary">{g.name}</Badge>)}</div></div>}
            <div><div className="mb-3 text-xs font-semibold uppercase tracking-wider text-subtle">Enrollments ({data.enrollments.length})</div>
              <ul className="space-y-3">{data.enrollments.map((c: CourseCard) => <li key={c.id} className="flex items-center gap-3"><div className="size-10 shrink-0 overflow-hidden rounded-lg"><CourseCover theme={c.theme} seed={c.id} /></div><div className="min-w-0 flex-1"><div className="truncate text-sm font-medium">{c.title}</div><ProgressBar value={c.enrollment?.progress ?? 0} height={4} className="mt-1.5" /></div><span className="text-xs tabular-nums text-muted">{c.enrollment?.progress}%</span></li>)}{!data.enrollments.length && <li className="text-sm text-muted">Not enrolled in any courses.</li>}</ul></div>
          </div>
        )}
      </div>
    </Drawer>
  );
}

export default function AdminUsers() {
  const { user: me } = useAuth();
  const [role, setRole] = useState<'all' | 'learner' | 'instructor' | 'admin'>('all');
  const [q, setQ] = useState('');
  const url = `/admin/users?${role !== 'all' ? `role=${role}&` : ''}q=${encodeURIComponent(q)}`;
  const { data, isLoading, error, refetch } = useGet<Row[]>(url, { key: ['/admin/users', url] });
  const [edit, setEdit] = useState<{ open: boolean; user: Row | null }>({ open: false, user: null });
  const [imp, setImp] = useState(false);
  const [del, setDel] = useState<Row | null>(null);
  const [detail, setDetail] = useState<number | null>(null);
  const toggle = useAct((u: Row) => api.patch(`/admin/users/${u.id}`, { status: u.status === 'active' ? 'inactive' : 'active' }), { invalidate: [['/admin/users'], ['/admin/stats']], success: 'User updated' });
  const remove = useAct((u: Row) => api.del(`/admin/users/${u.id}`), { invalidate: [['/admin/users'], ['/admin/stats']], success: 'User deleted', onSuccess: () => setDel(null) });
  const counts = useMemo(() => ({ all: data?.length }), [data]);
  if (error) return <ErrorState error={error} onRetry={refetch} />;
  return (
    <div>
      <PageHeader eyebrow="People" title="Users" description="Manage learners, instructors and administrators." actions={<><Button variant="secondary" icon={<Upload className="size-4" />} onClick={() => setImp(true)}>Import CSV</Button><Button variant="primary" icon={<Plus className="size-4" />} onClick={() => setEdit({ open: true, user: null })}>Add user</Button></>} />
      <div className="mb-5 flex flex-wrap items-center gap-3"><Tabs value={role} onChange={setRole} items={[{ value: 'all', label: 'Everyone' }, { value: 'learner', label: 'Learners' }, { value: 'instructor', label: 'Instructors' }, { value: 'admin', label: 'Admins' }]} /><div className="w-full sm:ml-auto sm:w-72"><SearchInput value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name, email, department…" aria-label="Search users" /></div></div>
      {isLoading ? <Skeleton className="h-96" /> : !data?.length ? <div className="surface"><EmptyState title="No users match" mood="think" /></div> : (
        <Table>
          <THead><tr><Th>User</Th><Th>Role</Th><Th>Department</Th><Th>Courses</Th><Th>XP</Th><Th>Last active</Th><Th>Status</Th><Th className="w-12" /></tr></THead>
          <tbody>{data.map((u) => (
            <Tr key={u.id}>
              <Td><button className="flex items-center gap-3 text-left" onClick={() => setDetail(u.id)}><Avatar name={u.name} color={u.avatarColor} size={36} /><div className="min-w-0"><div className="truncate font-semibold hover:text-primary-2">{u.name}{u.id === me?.id && <span className="ml-1.5 text-xs text-subtle">(you)</span>}</div><div className="truncate text-xs text-subtle">{u.email}</div></div></button></Td>
              <Td><Badge tone={ROLE_TONE[u.role]} className="capitalize">{u.role}</Badge></Td>
              <Td className="text-muted">{u.department || '—'}</Td>
              <Td className="tabular-nums">{u.completed}<span className="text-subtle">/{u.enrollments}</span></Td>
              <Td className="tabular-nums">{u.xp.toLocaleString()}</Td>
              <Td className="text-muted">{u.lastLoginAt ? timeAgo(u.lastLoginAt) : 'Never'}</Td>
              <Td><Badge tone={u.status === 'active' ? 'success' : 'neutral'} dot className="capitalize">{u.status}</Badge></Td>
              <Td><Menu><MenuTrigger asChild><Button variant="ghost" size="icon-sm" aria-label={`Actions for ${u.name}`}><MoreHorizontal className="size-4" /></Button></MenuTrigger><MenuContent>
                <MenuItem icon={<Eye />} onSelect={() => setDetail(u.id)}>View details</MenuItem>
                <MenuItem icon={<Pencil />} onSelect={() => setEdit({ open: true, user: u })}>Edit</MenuItem>
                {u.id !== me?.id && <><MenuItem icon={u.status === 'active' ? <UserX /> : <UserCheck />} onSelect={() => toggle.mutate(u)}>{u.status === 'active' ? 'Deactivate' : 'Reactivate'}</MenuItem><MenuSeparator /><MenuItem icon={<Trash2 />} danger onSelect={() => setDel(u)}>Delete…</MenuItem></>}
              </MenuContent></Menu></Td>
            </Tr>))}</tbody>
        </Table>
      )}
      <div className="mt-3 text-xs text-subtle">{counts.all ?? 0} users</div>
      <UserForm open={edit.open} onClose={() => setEdit({ open: false, user: null })} user={edit.user} />
      <ImportModal open={imp} onClose={() => setImp(false)} />
      <UserDrawer id={detail} onClose={() => setDetail(null)} />
      <ConfirmDialog open={!!del} onOpenChange={(o) => !o && setDel(null)} danger title={`Delete ${del?.name}?`} description="This permanently deletes the account with all progress, certificates and submissions. Deactivating is usually safer." confirmLabel="Delete user" loading={remove.isPending} onConfirm={() => del && remove.mutate(del)} />
    </div>
  );
}

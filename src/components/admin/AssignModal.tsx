import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Search } from 'lucide-react';
import { api } from '@/lib/api';
import { useGet, useAct } from '@/lib/queries';
import type { CourseCard } from '@/lib/types';
import { cn } from '@/lib/utils';
import { Modal } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Field, Input, Select } from '@/components/ui/form';
import { Avatar } from '@/components/ui/misc';

interface Opt { id: number; name: string; email: string; role: string; avatarColor: string }

export function AssignModal({ open, onClose, courseId, onDone }: { open: boolean; onClose: () => void; courseId?: number; onDone?: () => void }) {
  const { data: users } = useGet<Opt[]>(open ? '/admin/users/options' : null);
  const { data: groups } = useGet<{ id: number; name: string; members: unknown[] }[]>(open ? '/admin/groups' : null, { enabled: open });
  const { data: courses } = useGet<CourseCard[]>(open && !courseId ? '/courses?all=1&status=published' : null);
  const [cid, setCid] = useState<number | ''>(courseId ?? '');
  const [picked, setPicked] = useState<Set<number>>(new Set());
  const [group, setGroup] = useState('');
  const [due, setDue] = useState('');
  const [q, setQ] = useState('');
  const list = useMemo(() => (users ?? []).filter((u) => u.role === 'learner' && (u.name + u.email).toLowerCase().includes(q.toLowerCase())), [users, q]);
  const go = useAct(() => api.post<{ added: number }>('/admin/enrollments', { courseId: courseId ?? cid, userIds: [...picked], groupId: group ? Number(group) : undefined, dueDate: due || undefined }), {
    invalidate: [['/admin/enrollments'], ['/admin/stats'], ['/courses']],
    onSuccess: (r) => { toast.success(r.added ? `Enrolled ${r.added} learner${r.added > 1 ? 's' : ''}` : 'Everyone was already enrolled'); setPicked(new Set()); setGroup(''); onDone?.(); onClose(); },
  });
  const toggle = (id: number) => setPicked((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  return (
    <Modal open={open} onOpenChange={(o) => !o && onClose()} title="Assign course" description="Enroll individual learners or a whole group, with an optional due date." size="md"
      footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button><Button variant="primary" loading={go.isPending} disabled={!(courseId ?? cid) || (!picked.size && !group)} onClick={() => go.mutate()}>Assign{picked.size ? ` (${picked.size})` : ''}</Button></>}>
      <div className="space-y-5">
        {!courseId && <Field label="Course">{(id) => <Select id={id} value={cid} onChange={(e) => setCid(Number(e.target.value) || '')}><option value="">Select a course…</option>{courses?.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}</Select>}</Field>}
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Group (optional)">{(id) => <Select id={id} value={group} onChange={(e) => setGroup(e.target.value)}><option value="">No group</option>{groups?.map((g) => <option key={g.id} value={g.id}>{g.name} ({g.members.length})</option>)}</Select>}</Field>
          <Field label="Due date (optional)">{(id) => <Input id={id} type="date" value={due} min={new Date().toISOString().slice(0, 10)} onChange={(e) => setDue(e.target.value)} />}</Field>
        </div>
        <div>
          <div className="mb-2 text-[13px] font-medium">Learners</div>
          <Input icon={<Search />} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by name or email…" aria-label="Search learners" />
          <div className="mt-2 max-h-64 divide-y divide-line overflow-y-auto rounded-2xl border border-line-2">
            {list.length === 0 && <div className="p-6 text-center text-sm text-muted">No learners found.</div>}
            {list.map((u) => (
              <label key={u.id} className={cn('flex cursor-pointer items-center gap-3 px-4 py-2.5 hover:bg-card-2', picked.has(u.id) && 'bg-primary/10')}>
                <input type="checkbox" checked={picked.has(u.id)} onChange={() => toggle(u.id)} className="size-4 accent-[var(--primary)]" />
                <Avatar name={u.name} color={u.avatarColor} size={28} /><span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium">{u.name}</span><span className="block truncate text-xs text-subtle">{u.email}</span></span>
              </label>
            ))}
          </div>
        </div>
      </div>
    </Modal>
  );
}

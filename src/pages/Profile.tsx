import { useState } from 'react';
import { toast } from 'sonner';
import { Check, KeyRound, UserRound } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useAct } from '@/lib/queries';
import type { User } from '@/lib/types';
import { cn, dateFmt } from '@/lib/utils';
import { Avatar, Badge, PageHeader } from '@/components/ui/misc';
import { Button } from '@/components/ui/button';
import { Field, Input, Textarea } from '@/components/ui/form';
import { TONE_COLOR } from '@/components/charts';

const COLORS = ['violet', 'cyan', 'amber', 'pink', 'emerald', 'blue', 'orange'];

export default function Profile() {
  const { user, setUser } = useAuth();
  const [name, setName] = useState(user!.name);
  const [title, setTitle] = useState(user!.title);
  const [dept, setDept] = useState(user!.department);
  const [bio, setBio] = useState(user!.bio);
  const [color, setColor] = useState(user!.avatarColor);
  const [cur, setCur] = useState('');
  const [next, setNext] = useState('');
  const save = useAct(() => api.patch<{ user: User }>('/auth/me', { name, title, department: dept, bio, avatarColor: color }), { onSuccess: (r) => { setUser(r.user); toast.success('Profile updated'); } });
  const pw = useAct(() => api.post('/auth/password', { current: cur, next }), { onSuccess: () => { toast.success('Password changed'); setCur(''); setNext(''); } });
  if (!user) return null;
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader eyebrow="Account" title="Profile & settings" />
      <div className="space-y-6">
        <section className="surface p-6 sm:p-8">
          <div className="mb-6 flex items-center gap-5">
            <Avatar name={name || user.name} color={color} size={72} />
            <div><div className="font-display text-xl font-semibold">{user.name}</div><div className="text-sm text-muted">{user.email}</div><div className="mt-2 flex gap-2"><Badge tone="primary" className="capitalize">{user.role}</Badge><Badge>Joined {dateFmt(user.createdAt)}</Badge></div></div>
          </div>
          <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); save.mutate(); }}>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Full name">{(id) => <Input id={id} value={name} onChange={(e) => setName(e.target.value)} required minLength={2} icon={<UserRound />} />}</Field>
              <Field label="Job title">{(id) => <Input id={id} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Mission Specialist" />}</Field>
            </div>
            <Field label="Department">{(id) => <Input id={id} value={dept} onChange={(e) => setDept(e.target.value)} />}</Field>
            <Field label="Bio" hint="Shown on discussions and leaderboards.">{(id) => <Textarea id={id} value={bio} onChange={(e) => setBio(e.target.value)} maxLength={500} />}</Field>
            <div>
              <div className="mb-2 text-[13px] font-medium">Avatar colour</div>
              <div className="flex gap-2.5">{COLORS.map((c) => <button key={c} type="button" onClick={() => setColor(c)} aria-label={c} aria-pressed={color === c} className={cn('grid size-9 place-items-center rounded-full ring-offset-2 ring-offset-bg transition', color === c && 'ring-2 ring-primary')} style={{ background: TONE_COLOR[c] }}>{color === c && <Check className="size-4 text-white" />}</button>)}</div>
            </div>
            <Button type="submit" variant="primary" loading={save.isPending}>Save changes</Button>
          </form>
        </section>
        <section className="surface p-6 sm:p-8">
          <h2 className="mb-5 flex items-center gap-2 font-display text-lg font-semibold"><KeyRound className="size-5 text-primary-2" /> Change password</h2>
          <form className="grid gap-4 sm:grid-cols-2" onSubmit={(e) => { e.preventDefault(); pw.mutate(); }}>
            <Field label="Current password">{(id) => <Input id={id} type="password" value={cur} onChange={(e) => setCur(e.target.value)} autoComplete="current-password" required />}</Field>
            <Field label="New password" hint="At least 8 characters">{(id) => <Input id={id} type="password" value={next} onChange={(e) => setNext(e.target.value)} autoComplete="new-password" required minLength={8} />}</Field>
            <div className="sm:col-span-2"><Button type="submit" loading={pw.isPending} disabled={!cur || next.length < 8}>Update password</Button></div>
          </form>
        </section>
      </div>
    </div>
  );
}

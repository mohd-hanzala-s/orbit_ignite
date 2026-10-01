import { useState } from 'react';
import { MessageSquare, Pin, Trash2, CornerDownRight, Send } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { useGet, useAct } from '@/lib/queries';
import { useAuth } from '@/lib/auth';
import type { DiscussionPost } from '@/lib/types';
import { timeAgo } from '@/lib/utils';
import { Avatar, Badge, EmptyState, Skeleton } from '@/components/ui/misc';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/form';

function Composer({ placeholder, onSubmit, busy, autoFocus, cta = 'Post' }: { placeholder: string; onSubmit: (body: string) => Promise<void>; busy?: boolean; autoFocus?: boolean; cta?: string }) {
  const [body, setBody] = useState('');
  return (
    <form className="flex gap-2" onSubmit={async (e) => { e.preventDefault(); if (!body.trim()) return; await onSubmit(body.trim()); setBody(''); }}>
      <Textarea autoFocus={autoFocus} value={body} onChange={(e) => setBody(e.target.value)} placeholder={placeholder} className="min-h-[44px] flex-1" rows={2} maxLength={4000} aria-label={placeholder} />
      <Button type="submit" variant="primary" loading={busy} disabled={!body.trim()} icon={<Send className="size-4" />} className="self-end">{cta}</Button>
    </form>
  );
}

function Post({ p, courseId, canModerate, onChange, lessonId }: { p: DiscussionPost; courseId: number; canModerate: boolean; onChange: () => void; lessonId?: number }) {
  const { user } = useAuth();
  const [reply, setReply] = useState(false);
  const del = useAct((id: number) => api.del(`/discussions/${id}`), { onSuccess: onChange, success: 'Deleted' });
  const pin = useAct(() => api.post(`/discussions/${p.id}/pin`), { onSuccess: onChange });
  const post = useAct((body: string) => api.post(`/courses/${courseId}/discussions`, { body, parentId: p.id, lessonId }), { onSuccess: () => { setReply(false); onChange(); } });
  const Row = ({ x, child }: { x: DiscussionPost; child?: boolean }) => (
    <div className="flex gap-3">
      <Avatar name={x.user.name} color={x.user.avatarColor} size={child ? 28 : 36} />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-semibold">{x.user.name}</span>
          {x.user.role !== 'learner' && <Badge tone="primary" className="capitalize">{x.user.role}</Badge>}
          {x.pinned && <Badge tone="warn"><Pin className="size-3" /> Pinned</Badge>}
          <span className="text-xs text-subtle">{timeAgo(x.createdAt)}</span>
          {!child && x.lessonTitle && <span className="truncate text-xs text-subtle">· on “{x.lessonTitle}”</span>}
        </div>
        <p className="mt-1 whitespace-pre-wrap break-words text-sm leading-relaxed text-fg/90">{x.body}</p>
        <div className="mt-1.5 flex items-center gap-3 text-xs text-subtle">
          {!child && <button className="flex items-center gap-1 font-medium hover:text-primary-2" onClick={() => setReply((r) => !r)}><CornerDownRight className="size-3" /> Reply</button>}
          {!child && canModerate && <button className="flex items-center gap-1 hover:text-warm" onClick={() => pin.mutate()}><Pin className="size-3" /> {x.pinned ? 'Unpin' : 'Pin'}</button>}
          {(user?.id === x.user.id || canModerate) && <button className="flex items-center gap-1 hover:text-danger" onClick={() => { if (confirm('Delete this message?')) del.mutate(x.id); }}><Trash2 className="size-3" /> Delete</button>}
        </div>
      </div>
    </div>
  );
  return (
    <div className="surface p-5">
      <Row x={p} />
      {(p.replies?.length ?? 0) > 0 && <div className="ml-4 mt-4 space-y-4 border-l border-line pl-5">{p.replies!.map((r) => <Row key={r.id} x={r} child />)}</div>}
      {reply && <div className="ml-4 mt-4 border-l border-line pl-5"><Composer autoFocus placeholder="Write a reply…" busy={post.isPending} cta="Reply" onSubmit={async (b) => { await post.mutateAsync(b); }} /></div>}
    </div>
  );
}

export function Discussion({ courseId, lessonId }: { courseId: number; lessonId?: number }) {
  const { user } = useAuth();
  const url = `/courses/${courseId}/discussions${lessonId ? `?lessonId=${lessonId}` : ''}`;
  const { data, isLoading, refetch } = useGet<DiscussionPost[]>(url, { key: ['/discussions', courseId, lessonId ?? 'all'] });
  const create = useAct((body: string) => api.post(`/courses/${courseId}/discussions`, { body, lessonId }), { onSuccess: () => refetch(), silentError: false });
  const mod = user?.role === 'admin' || user?.role === 'instructor';
  return (
    <div className="space-y-4">
      <div className="surface p-5">
        <div className="mb-3 flex items-center gap-2 font-display font-semibold"><MessageSquare className="size-4 text-primary-2" /> {lessonId ? 'Discuss this lesson' : 'Start a discussion'}</div>
        <Composer placeholder="Ask a question or share an insight…" busy={create.isPending} onSubmit={async (b) => { await create.mutateAsync(b); toast.success('Posted'); }} />
      </div>
      {isLoading ? <Skeleton className="h-32" /> : !data?.length ? <div className="surface"><EmptyState compact mood="happy" title="No messages yet" description="Be the first to say hello." /></div> : data.map((p) => <Post key={p.id} p={p} courseId={courseId} canModerate={mod} onChange={() => refetch()} lessonId={lessonId} />)}
    </div>
  );
}

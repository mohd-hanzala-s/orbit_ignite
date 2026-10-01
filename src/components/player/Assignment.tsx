import { useRef, useState } from 'react';
import { CheckCircle2, FileUp, Link2, Paperclip, RotateCcw, Send, X, Clock, Award } from 'lucide-react';
import { toast } from 'sonner';
import { api, upload, type UploadedFile } from '@/lib/api';
import { useAct } from '@/lib/queries';
import type { LessonFull, Submission } from '@/lib/types';
import { dateTimeFmt, formatBytes } from '@/lib/utils';
import { Badge, ProgressBar } from '@/components/ui/misc';
import { Button } from '@/components/ui/button';
import { Input, Textarea } from '@/components/ui/form';
import { Markdown } from '@/components/ui/Markdown';
import { Mascot } from '@/components/space/Mascot';

export function AssignmentViewer({ lesson, onSubmitted }: { lesson: LessonFull; onSubmitted: () => void }) {
  const c = lesson.content;
  const sub = c.submission as Submission | null;
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(sub?.text ?? '');
  const [link, setLink] = useState(sub?.link ?? '');
  const [file, setFile] = useState<{ id: number; name: string; size?: number } | null>(sub?.fileId ? { id: sub.fileId, name: sub.fileName ?? 'attachment' } : null);
  const [pct, setPct] = useState<number | null>(null);
  const abort = useRef<(() => void) | null>(null);
  const input = useRef<HTMLInputElement>(null);

  const send = useAct(() => api.post(`/lessons/${lesson.id}/submission`, { text, link, fileId: file?.id }), { invalidate: [[`/lessons/${lesson.id}`]], onSuccess: () => { setEditing(false); toast.success('Submitted for review'); onSubmitted(); } });
  const pick = (f?: File) => {
    if (!f) return;
    if (f.size > 100 * 1024 * 1024) return toast.error('Attachments are limited to 100 MB');
    const up = upload('/files', f, setPct);
    abort.current = up.abort;
    up.promise.then((r: UploadedFile) => setFile({ id: r.id, name: r.name, size: r.size })).catch((e) => e.message !== 'Upload cancelled' && toast.error(e.message)).finally(() => setPct(null));
  };

  const canEdit = !sub || sub.status === 'returned' || editing;
  const graded = sub?.status === 'graded';
  return (
    <div className="space-y-5">
      <div className="surface p-6 sm:p-8">
        <div className="mb-3 flex items-center gap-2"><Badge tone="pink">Assignment</Badge><Badge>{c.maxPoints ?? 100} points</Badge></div>
        <Markdown>{c.instructions || '_No instructions provided._'}</Markdown>
      </div>

      {sub && !editing && (
        <div className="surface p-6">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div className="font-display font-semibold">Your submission</div>
            {graded ? <Badge tone="success"><CheckCircle2 className="size-3" /> Graded</Badge> : sub.status === 'returned' ? <Badge tone="warn"><RotateCcw className="size-3" /> Revision requested</Badge> : <Badge tone="info"><Clock className="size-3" /> Awaiting review</Badge>}
          </div>
          <div className="text-xs text-subtle">Submitted {dateTimeFmt(sub.submittedAt)}</div>
          {sub.text && <p className="mt-3 whitespace-pre-wrap rounded-xl border border-line bg-card-2/40 p-4 text-sm leading-relaxed">{sub.text}</p>}
          <div className="mt-3 flex flex-wrap gap-3 text-sm">{sub.link && <a href={sub.link} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-primary-2 hover:underline"><Link2 className="size-4" />{sub.link}</a>}{sub.fileId && <a href={`/api/files/${sub.fileId}/download`} className="inline-flex items-center gap-1.5 text-primary-2 hover:underline"><Paperclip className="size-4" />{sub.fileName}</a>}</div>
          {(graded || sub.status === 'returned') && (
            <div className="mt-5 flex gap-4 rounded-2xl border border-success/25 bg-success/8 p-5">
              <Mascot mood={graded ? 'cheer' : 'think'} size={72} float={false} />
              <div className="min-w-0">
                {graded && <div className="flex items-center gap-2 font-display text-2xl font-bold"><Award className="size-6 text-warm" />{sub.grade}<span className="text-base font-medium text-muted">/ {c.maxPoints ?? 100}</span></div>}
                {sub.feedback ? <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-fg/90"><b>Feedback:</b> {sub.feedback}</p> : <p className="mt-1 text-sm text-muted">No written feedback.</p>}
              </div>
            </div>
          )}
          {sub.status === 'returned' && <Button className="mt-4" variant="primary" onClick={() => setEditing(true)}>Revise &amp; resubmit</Button>}
          {sub.status === 'submitted' && lesson.tracked && <Button className="mt-4" variant="ghost" size="sm" onClick={() => setEditing(true)}>Edit submission</Button>}
        </div>
      )}

      {canEdit && lesson.tracked && !graded && (
        <form className="surface space-y-4 p-6" onSubmit={(e) => { e.preventDefault(); send.mutate(); }}>
          <div className="font-display font-semibold">{sub ? 'Update your work' : 'Submit your work'}</div>
          {c.allowText !== false && <Textarea value={text} onChange={(e) => setText(e.target.value)} placeholder="Write your response…" className="min-h-40" maxLength={20000} aria-label="Response text" />}
          <Input icon={<Link2 />} value={link} onChange={(e) => setLink(e.target.value)} placeholder="Link to your work (optional, https://…)" type="url" aria-label="Link" />
          {c.allowFile !== false && (
            <div>
              <input ref={input} type="file" hidden onChange={(e) => { pick(e.target.files?.[0]); e.target.value = ''; }} />
              {file ? (
                <div className="flex items-center gap-3 rounded-xl border border-line-2 bg-card-2/50 px-4 py-3 text-sm"><Paperclip className="size-4 text-primary-2" /><span className="min-w-0 flex-1 truncate">{file.name}</span>{file.size != null && <span className="text-xs text-subtle">{formatBytes(file.size)}</span>}<button type="button" onClick={() => setFile(null)} aria-label="Remove attachment" className="text-subtle hover:text-danger"><X className="size-4" /></button></div>
              ) : pct != null ? (
                <div className="rounded-xl border border-line-2 px-4 py-3"><div className="mb-2 flex justify-between text-xs text-muted"><span>Uploading…</span><button type="button" onClick={() => abort.current?.()} className="hover:text-danger">Cancel</button></div><ProgressBar value={pct} /></div>
              ) : (
                <button type="button" onClick={() => input.current?.click()} onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); pick(e.dataTransfer.files[0]); }} className="flex w-full flex-col items-center gap-2 rounded-2xl border-2 border-dashed border-line-2 px-4 py-8 text-sm text-muted transition-colors hover:border-primary/60 hover:bg-primary/5"><FileUp className="size-6 text-primary-2" />Drop a file here or <span className="font-semibold text-primary-2">browse</span></button>
              )}
            </div>
          )}
          <div className="flex items-center gap-3"><Button type="submit" variant="primary" loading={send.isPending} disabled={pct != null || (!text.trim() && !link.trim() && !file)} icon={<Send className="size-4" />}>Submit for review</Button>{editing && <Button type="button" variant="ghost" onClick={() => setEditing(false)}>Cancel</Button>}</div>
        </form>
      )}
      {!lesson.tracked && <div className="rounded-2xl border border-line bg-card-2/40 p-4 text-sm text-muted">Preview mode — enroll as a learner to submit work.</div>}
    </div>
  );
}

import { useEffect, useMemo, useState } from 'react';
import { motion } from 'motion/react';
import { toast } from 'sonner';
import { Check, ChevronLeft } from 'lucide-react';
import { api, type UploadedFile } from '@/lib/api';
import { useAct } from '@/lib/queries';
import type { LessonType } from '@/lib/types';
import { cn } from '@/lib/utils';
import { LESSON_ICONS, LESSON_LABEL } from '@/pages/CourseDetail';
import { Modal } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox, Field, Input, Select, Switch, Textarea } from '@/components/ui/form';
import { Tabs } from '@/components/ui/misc';
import { FileDrop } from './FileDrop';
import { MarkdownEditor } from './MarkdownEditor';
import { QuizBuilder, emptyQuiz, type QuizContent } from './QuizBuilder';

export const TYPE_INFO: Record<LessonType, { desc: string; tone: string; minutes: number }> = {
  video: { desc: 'Upload MP4/WebM, or embed YouTube, Vimeo, Loom or HLS streams.', tone: 'from-violet-500/30', minutes: 10 },
  audio: { desc: 'Podcasts, narration and interviews (MP3, WAV, M4A, OGG).', tone: 'from-pink-500/30', minutes: 8 },
  document: { desc: 'PDF, Word, PowerPoint, Excel, images, text and more.', tone: 'from-cyan-500/30', minutes: 10 },
  scorm: { desc: 'Upload a SCORM 1.2 / 2004 package with full tracking.', tone: 'from-amber-500/30', minutes: 20 },
  page: { desc: 'Rich Markdown reading with tables, code and images.', tone: 'from-emerald-500/30', minutes: 5 },
  link: { desc: 'Point learners to any external resource.', tone: 'from-sky-500/30', minutes: 5 },
  embed: { desc: 'Embed any web page, dashboard, form or interactive demo.', tone: 'from-fuchsia-500/30', minutes: 10 },
  quiz: { desc: 'Auto-graded: single, multiple, true/false, short answer, ordering.', tone: 'from-rose-500/30', minutes: 10 },
  assignment: { desc: 'Learners submit text, links or files for you to grade.', tone: 'from-orange-500/30', minutes: 30 },
  live: { desc: 'Schedule a live session with a join link and calendar invite.', tone: 'from-teal-500/30', minutes: 60 },
};
const toLocalInput = (iso?: string) => { if (!iso) return ''; const d = new Date(iso); if (Number.isNaN(d.getTime())) return ''; const p = (n: number) => String(n).padStart(2, '0'); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`; };

export interface BuilderLesson { id: number; title: string; type: LessonType; durationMinutes: number; required: boolean; preview: boolean; summary: string; content: Record<string, any>; file?: UploadedFile | null; scorm?: { id: number; title: string; version: string; fileCount: number } | null }

export function LessonEditor({ open, onClose, sectionId, lesson, invalidate }: { open: boolean; onClose: () => void; sectionId: number | null; lesson: BuilderLesson | null; invalidate: (string | number)[][] }) {
  const editing = !!lesson;
  const [type, setType] = useState<LessonType | null>(null);
  const [title, setTitle] = useState('');
  const [minutes, setMinutes] = useState(5);
  const [required, setRequired] = useState(true);
  const [preview, setPreview] = useState(false);
  const [summary, setSummary] = useState('');
  const [content, setContent] = useState<Record<string, any>>({});
  const [fileMeta, setFileMeta] = useState<{ name: string; size?: number } | null>(null);
  const [scormMeta, setScormMeta] = useState<{ title: string; version: string; fileCount: number } | null>(null);

  useEffect(() => {
    if (!open) return;
    if (lesson) {
      setType(lesson.type); setTitle(lesson.title); setMinutes(lesson.durationMinutes); setRequired(lesson.required); setPreview(lesson.preview); setSummary(lesson.summary);
      setContent(lesson.type === 'quiz' ? { ...emptyQuiz(), ...lesson.content } : { ...lesson.content });
      setFileMeta(lesson.file ? { name: lesson.file.name, size: lesson.file.size } : null);
      setScormMeta(lesson.scorm ?? null);
    } else { setType(null); setTitle(''); setMinutes(5); setRequired(true); setPreview(false); setSummary(''); setContent({}); setFileMeta(null); setScormMeta(null); }
  }, [open, lesson]);

  const pickType = (t: LessonType) => {
    setType(t); setMinutes(TYPE_INFO[t].minutes);
    setContent(t === 'quiz' ? emptyQuiz() : t === 'video' ? { source: 'upload' } : t === 'embed' ? { height: 560 } : t === 'assignment' ? { maxPoints: 100, allowFile: true, allowText: true } : t === 'live' ? { durationMin: 60 } : t === 'link' ? { openIn: 'tab' } : t === 'document' ? { allowDownload: true } : {});
  };
  const set = (p: Record<string, any>) => setContent((c) => ({ ...c, ...p }));

  const save = useAct(async () => {
    if (!type) return;
    if (!title.trim()) throw new Error('Give the lesson a title');
    if (type === 'scorm' && !content.packageId) throw new Error('Upload a SCORM package first');
    const body = { title: title.trim(), type, durationMinutes: minutes, required, preview, summary, content };
    return editing ? api.patch(`/admin/lessons/${lesson!.id}`, body) : api.post(`/admin/sections/${sectionId}/lessons`, body);
  }, { invalidate, onSuccess: () => { toast.success(editing ? 'Lesson saved' : 'Lesson added'); onClose(); } });

  const Icon = type ? LESSON_ICONS[type] : null;
  const quiz = useMemo(() => ({ ...emptyQuiz(), ...content }) as QuizContent, [content]);

  return (
    <Modal
      open={open} onOpenChange={(o) => !o && onClose()} size={type === 'quiz' || type === 'page' ? 'xl' : 'lg'}
      title={!type ? 'Add a lesson' : <span className="flex items-center gap-2.5">{Icon && <span className="grid size-8 place-items-center rounded-lg bg-primary/15 text-primary-2"><Icon className="size-4" /></span>}{editing ? 'Edit' : 'New'} {LESSON_LABEL[type].toLowerCase()} lesson</span>}
      description={!type ? 'Choose a content type. You can host almost any format.' : undefined}
      footer={type ? <>{!editing && <Button variant="ghost" className="mr-auto" icon={<ChevronLeft className="size-4" />} onClick={() => setType(null)}>Change type</Button>}<Button variant="ghost" onClick={onClose}>Cancel</Button><Button variant="primary" loading={save.isPending} onClick={() => save.mutate()}>{editing ? 'Save lesson' : 'Add lesson'}</Button></> : undefined}
    >
      {!type ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {(Object.keys(TYPE_INFO) as LessonType[]).map((t, i) => { const I = LESSON_ICONS[t]; return (
            <motion.button key={t} type="button" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.025 }} onClick={() => pickType(t)} className="surface surface-hover relative flex items-start gap-4 overflow-hidden p-4 text-left" data-testid={`type-${t}`}>
              <span className={cn('absolute -left-6 -top-6 size-24 rounded-full bg-gradient-to-br to-transparent blur-xl', TYPE_INFO[t].tone)} />
              <span className="relative grid size-11 shrink-0 place-items-center rounded-xl border border-line-2 bg-card-2 text-primary-2"><I className="size-5" /></span>
              <span className="relative min-w-0"><span className="block font-display font-semibold">{LESSON_LABEL[t]}</span><span className="mt-0.5 block text-[13px] leading-snug text-muted">{TYPE_INFO[t].desc}</span></span>
            </motion.button>); })}
        </div>
      ) : (
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-[1fr_140px]">
            <Field label="Lesson title">{(id) => <Input id={id} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Introduction to orbital mechanics" autoFocus maxLength={140} />}</Field>
            <Field label="Duration (min)">{(id) => <Input id={id} type="number" min={0} max={1000} value={minutes} onChange={(e) => setMinutes(Number(e.target.value))} />}</Field>
          </div>

          {/* ───── type-specific ───── */}
          {type === 'video' && (
            <div className="space-y-4">
              <Tabs value={content.source ?? 'upload'} onChange={(v) => set({ source: v })} items={[{ value: 'upload', label: 'Upload' }, { value: 'youtube', label: 'YouTube' }, { value: 'vimeo', label: 'Vimeo' }, { value: 'url', label: 'Direct URL / HLS' }]} />
              {(content.source ?? 'upload') === 'upload' ? (
                <FileDrop accept="video/*,.mp4,.webm,.mov,.m4v,.ogv" label="Upload a video" hint="MP4 (H.264) or WebM recommended · up to 1 GB" current={content.fileId ? { name: fileMeta?.name ?? 'Video file', size: fileMeta?.size } : null} onClear={() => set({ fileId: null })} onUploaded={(f: UploadedFile) => { set({ fileId: f.id }); setFileMeta({ name: f.name, size: f.size }); if (!title) setTitle(f.name.replace(/\.[^.]+$/, '')); }} />
              ) : (
                <Field label={content.source === 'youtube' ? 'YouTube URL' : content.source === 'vimeo' ? 'Vimeo URL' : 'Video URL'} hint={content.source === 'url' ? 'MP4/WebM link or an .m3u8 HLS stream (must allow cross-origin playback).' : 'Paste the share link.'}>{(id) => <Input id={id} value={content.url ?? ''} onChange={(e) => set({ url: e.target.value })} placeholder={content.source === 'youtube' ? 'https://www.youtube.com/watch?v=…' : content.source === 'vimeo' ? 'https://vimeo.com/…' : 'https://…'} type="url" />}</Field>
              )}
              <Field label="Captions (optional)" hint="WebVTT (.vtt) file for subtitles on uploaded/direct videos.">{() => <FileDrop compact accept=".vtt" label="Upload captions" current={content.captionFileId ? { name: 'Captions attached' } : null} onClear={() => set({ captionFileId: null })} onUploaded={(f: UploadedFile) => set({ captionFileId: f.id })} />}</Field>
              <Field label="Transcript (optional)">{(id) => <Textarea id={id} value={content.transcript ?? ''} onChange={(e) => set({ transcript: e.target.value })} className="min-h-24" />}</Field>
            </div>
          )}
          {type === 'audio' && (
            <div className="space-y-4">
              <FileDrop accept="audio/*,.mp3,.wav,.m4a,.ogg,.aac,.flac" label="Upload audio" hint="MP3, WAV, M4A, OGG" current={content.fileId ? { name: fileMeta?.name ?? 'Audio file', size: fileMeta?.size } : null} onClear={() => set({ fileId: null })} onUploaded={(f: UploadedFile) => { set({ fileId: f.id }); setFileMeta({ name: f.name, size: f.size }); }} />
              <Field label="…or audio URL">{(id) => <Input id={id} value={content.url ?? ''} onChange={(e) => set({ url: e.target.value })} placeholder="https://…/episode.mp3" type="url" />}</Field>
              <Field label="Transcript (optional)">{(id) => <Textarea id={id} value={content.transcript ?? ''} onChange={(e) => set({ transcript: e.target.value })} className="min-h-24" />}</Field>
            </div>
          )}
          {type === 'document' && (
            <div className="space-y-4">
              <FileDrop accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.odt,.odp,.ods,.txt,.md,.csv,.json,.png,.jpg,.jpeg,.gif,.webp,.svg,.zip" label="Upload a document" hint="PDF & images preview inline · .docx and text convert to HTML · other files download" current={content.fileId ? { name: fileMeta?.name ?? 'Document', size: fileMeta?.size } : null} onClear={() => set({ fileId: null })} onUploaded={(f: UploadedFile) => { set({ fileId: f.id }); setFileMeta({ name: f.name, size: f.size }); if (!title) setTitle(f.name.replace(/\.[^.]+$/, '')); }} />
              <Field label="…or link to a hosted document">{(id) => <Input id={id} value={content.url ?? ''} onChange={(e) => set({ url: e.target.value })} placeholder="https://…" type="url" />}</Field>
              <Switch checked={content.allowDownload !== false} onChange={(v) => set({ allowDownload: v })} label="Allow download" />
            </div>
          )}
          {type === 'scorm' && (
            <div className="space-y-4">
              <FileDrop<{ id: number; title: string; version: string; fileCount: number; size: number }> endpoint="/files/scorm" accept=".zip" label="Upload a SCORM package (.zip)" hint="SCORM 1.2 or 2004 · imsmanifest.xml must be at the root of the ZIP" current={content.packageId ? { name: scormMeta?.title ?? 'SCORM package', sub: scormMeta ? `SCORM ${scormMeta.version} · ${scormMeta.fileCount} files` : undefined } : null} onClear={() => { set({ packageId: null }); setScormMeta(null); }} onUploaded={(p) => { set({ packageId: p.id }); setScormMeta({ title: p.title, version: p.version, fileCount: p.fileCount }); if (!title) setTitle(p.title); }} />
              <p className="rounded-xl border border-line bg-card-2/40 p-3.5 text-xs leading-relaxed text-muted">Completion, score, bookmarks and suspend-data are tracked automatically. The lesson completes when the SCO reports <code>completed</code> or <code>passed</code>.</p>
            </div>
          )}
          {type === 'page' && <MarkdownEditor value={content.markdown ?? ''} onChange={(v) => set({ markdown: v })} minHeight={340} />}
          {type === 'link' && (
            <div className="space-y-4">
              <Field label="URL">{(id) => <Input id={id} value={content.url ?? ''} onChange={(e) => set({ url: e.target.value })} placeholder="https://…" type="url" />}</Field>
              <Field label="Description">{(id) => <Textarea id={id} value={content.description ?? ''} onChange={(e) => set({ description: e.target.value })} className="min-h-20" />}</Field>
              <Field label="Open">{(id) => <Select id={id} value={content.openIn ?? 'tab'} onChange={(e) => set({ openIn: e.target.value })}><option value="tab">In a new tab</option><option value="embed">Inline (embedded)</option></Select>}</Field>
            </div>
          )}
          {type === 'embed' && (
            <div className="space-y-4">
              <Field label="Embed URL" hint="The page must allow being framed (most dashboards, Figma, Miro, Google Slides/Forms embeds do).">{(id) => <Input id={id} value={content.url ?? ''} onChange={(e) => set({ url: e.target.value })} placeholder="https://…" type="url" />}</Field>
              <Field label="Height (px)">{(id) => <Input id={id} type="number" min={240} max={1400} value={content.height ?? 560} onChange={(e) => set({ height: Number(e.target.value) })} />}</Field>
            </div>
          )}
          {type === 'quiz' && <QuizBuilder value={quiz} onChange={(v) => setContent(v as any)} />}
          {type === 'assignment' && (
            <div className="space-y-4">
              <Field label="Instructions (Markdown)">{() => <MarkdownEditor value={content.instructions ?? ''} onChange={(v) => set({ instructions: v })} minHeight={200} />}</Field>
              <div className="grid gap-4 sm:grid-cols-3">
                <Field label="Max points">{(id) => <Input id={id} type="number" min={1} max={1000} value={content.maxPoints ?? 100} onChange={(e) => set({ maxPoints: Number(e.target.value) })} />}</Field>
                <div className="flex items-end pb-2"><Checkbox checked={content.allowText !== false} onChange={(v) => set({ allowText: v })} label="Allow text answer" /></div>
                <div className="flex items-end pb-2"><Checkbox checked={content.allowFile !== false} onChange={(v) => set({ allowFile: v })} label="Allow file upload" /></div>
              </div>
            </div>
          )}
          {type === 'live' && (
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Starts at">{(id) => <Input id={id} type="datetime-local" value={toLocalInput(content.startsAt)} onChange={(e) => set({ startsAt: e.target.value ? new Date(e.target.value).toISOString() : '' })} />}</Field>
              <Field label="Duration (min)">{(id) => <Input id={id} type="number" min={5} max={600} value={content.durationMin ?? 60} onChange={(e) => set({ durationMin: Number(e.target.value) })} />}</Field>
              <Field label="Platform">{(id) => <Input id={id} value={content.platform ?? ''} onChange={(e) => set({ platform: e.target.value })} placeholder="Zoom, Teams, Meet…" />}</Field>
              <Field label="Host">{(id) => <Input id={id} value={content.host ?? ''} onChange={(e) => set({ host: e.target.value })} placeholder="Dr. Nova Reyes" />}</Field>
              <Field label="Join link" className="sm:col-span-2">{(id) => <Input id={id} value={content.joinUrl ?? ''} onChange={(e) => set({ joinUrl: e.target.value })} placeholder="https://…" type="url" />}</Field>
              <Field label="Agenda" className="sm:col-span-2">{(id) => <Textarea id={id} value={content.agenda ?? ''} onChange={(e) => set({ agenda: e.target.value })} className="min-h-20" />}</Field>
              <Field label="Recording link (after the session)" className="sm:col-span-2">{(id) => <Input id={id} value={content.recordingUrl ?? ''} onChange={(e) => set({ recordingUrl: e.target.value })} placeholder="https://…" type="url" />}</Field>
            </div>
          )}

          {/* ───── common ───── */}
          <div className="space-y-4 border-t border-line pt-5">
            <Field label="Short summary (Markdown, shown under the lesson)">{(id) => <Textarea id={id} value={summary} onChange={(e) => setSummary(e.target.value)} className="min-h-16" maxLength={500} />}</Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Switch checked={required} onChange={setRequired} label="Required for completion" description="Optional lessons don't affect course progress." />
              <Switch checked={preview} onChange={setPreview} label="Free preview" description="Visible to anyone before they enroll." />
            </div>
          </div>
        </div>
      )}
    </Modal>
  );
}
void Check;

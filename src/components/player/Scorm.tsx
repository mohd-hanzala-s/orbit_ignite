import { useEffect, useRef, useState } from 'react';
import { Maximize2, Layers, ShieldCheck } from 'lucide-react';
import { api } from '@/lib/api';
import { mountScorm } from '@/lib/scormRuntime';
import { Spinner, Badge } from '@/components/ui/misc';
import { Button } from '@/components/ui/button';
import type { LessonFull } from '@/lib/types';
import { toast } from 'sonner';

export function ScormViewer({ lesson, onResult }: { lesson: LessonFull; onResult: (r: any) => void }) {
  const scorm = lesson.content.scorm as { id: number; title: string; version: '1.2' | '2004'; launchUrl: string } | undefined;
  const [ready, setReady] = useState(false);
  const [status, setStatus] = useState<string>('');
  const frameWrap = useRef<HTMLDivElement>(null);
  const cb = useRef(onResult);
  cb.current = onResult;

  useEffect(() => {
    if (!scorm) return;
    let handle: ReturnType<typeof mountScorm> | null = null;
    let cancelled = false;
    setReady(false);
    api.get<{ cmi: Record<string, string>; tracked: boolean; student: { id: string; name: string } }>(`/lessons/${lesson.id}/scorm`).then((st) => {
      if (cancelled) return;
      handle = mountScorm({
        lessonId: lesson.id, version: scorm.version, initial: st.cmi, student: st.student, tracked: st.tracked,
        onResult: (r) => { setStatus(r.status); if (r.completed) cb.current(r); },
      });
      setStatus(st.cmi['cmi.core.lesson_status'] || st.cmi['cmi.completion_status'] || '');
      setReady(true);
    }).catch((e) => toast.error(e.message));
    return () => { cancelled = true; handle?.destroy(); };
  }, [lesson.id, scorm?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!scorm) return <div className="surface p-8 text-center text-sm text-muted">The SCORM package for this lesson is missing. Please contact your administrator.</div>;
  return (
    <div className="surface overflow-hidden">
      <div className="flex items-center gap-3 border-b border-line bg-card-2/40 px-4 py-2.5">
        <Layers className="size-4 text-primary-2" />
        <div className="min-w-0 flex-1 truncate text-sm font-medium">{scorm.title}</div>
        <Badge tone="info">SCORM {scorm.version}</Badge>
        {status && <Badge tone={/pass|complet/.test(status) ? 'success' : 'neutral'} className="capitalize">{status}</Badge>}
        {!lesson.tracked && <Badge tone="warn">Preview · not tracked</Badge>}
        <Button size="icon-sm" variant="ghost" aria-label="Fullscreen" onClick={() => frameWrap.current?.requestFullscreen?.()}><Maximize2 className="size-4" /></Button>
      </div>
      <div ref={frameWrap} className="relative aspect-[16/10] min-h-[420px] w-full bg-black">
        {!ready && <div className="absolute inset-0 grid place-items-center"><Spinner /></div>}
        {ready && <iframe title={scorm.title} src={scorm.launchUrl} className="absolute inset-0 h-full w-full border-0 bg-white" allow="fullscreen; autoplay; microphone; camera" sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-modals allow-downloads" />}
      </div>
      <div className="flex items-center gap-2 border-t border-line px-4 py-2 text-xs text-subtle"><ShieldCheck className="size-3.5" /> Progress and score are saved automatically as you work through the module.</div>
    </div>
  );
}

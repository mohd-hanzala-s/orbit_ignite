import { useEffect, useRef, useState, useImperativeHandle, type Ref } from 'react';
import { CalendarPlus, Download, ExternalLink, FileText, Headphones, Link2, Maximize2, Video as VideoIcon, Clock, Users, Gauge } from 'lucide-react';
import { api } from '@/lib/api';
import { useGet } from '@/lib/queries';
import type { LessonFull } from '@/lib/types';
import { cn, dateTimeFmt, formatBytes, formatSeconds } from '@/lib/utils';
import { Markdown } from '@/components/ui/Markdown';
import { Badge, Skeleton, Spinner } from '@/components/ui/misc';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/form';
import { SplitFlapDisplay } from '@/components/cp/split-flap-display';

export interface PlayerHandle { getTime: () => number; seek: (t: number) => void }

/* ───────── helpers ───────── */
export function parseVideoUrl(url: string): { kind: 'youtube' | 'vimeo' | 'loom' | 'hls' | 'file'; id?: string; src: string } {
  try {
    const u = new URL(url);
    const h = u.hostname.replace(/^www\./, '');
    if (h === 'youtu.be') return { kind: 'youtube', id: u.pathname.slice(1), src: url };
    if (h.endsWith('youtube.com')) { const id = u.searchParams.get('v') || u.pathname.split('/').filter(Boolean).pop(); return { kind: 'youtube', id: id || '', src: url }; }
    if (h.endsWith('vimeo.com')) return { kind: 'vimeo', id: u.pathname.split('/').filter(Boolean).find((p) => /^\d+$/.test(p)) || '', src: url };
    if (h.endsWith('loom.com')) return { kind: 'loom', id: u.pathname.split('/').filter(Boolean).pop(), src: url };
    if (/\.m3u8($|\?)/i.test(u.pathname + u.search)) return { kind: 'hls', src: url };
  } catch { /* fallthrough */ }
  return { kind: 'file', src: url };
}

declare global { interface Window { YT?: any; onYouTubeIframeAPIReady?: () => void } }
let ytPromise: Promise<void> | null = null;
function loadYT(): Promise<void> {
  if (window.YT?.Player) return Promise.resolve();
  if (!ytPromise) ytPromise = new Promise((res) => {
    const prev = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => { prev?.(); res(); };
    const s = document.createElement('script'); s.src = 'https://www.youtube.com/iframe_api'; s.async = true; s.onerror = () => res(); document.head.appendChild(s);
  });
  return ytPromise;
}

const frame = 'overflow-hidden rounded-2xl border border-line-2 bg-black shadow-xl shadow-black/30';

/* ───────── video ───────── */
export function VideoViewer({ lesson, handle, onProgress, onEnded }: { lesson: LessonFull; handle: Ref<PlayerHandle>; onProgress: (pos: number) => void; onEnded: () => void }) {
  const c = lesson.content;
  const videoRef = useRef<HTMLVideoElement>(null);
  const ytRef = useRef<any>(null);
  const ytHost = useRef<HTMLDivElement>(null);
  const [speed, setSpeed] = useState(1);
  const [err, setErr] = useState<string | null>(null);
  const src: string | null = c.source === 'upload' ? (c.file?.url ?? null) : c.url || null;
  const parsed = c.source !== 'upload' && c.url ? parseVideoUrl(c.url) : null;
  const kind = c.source === 'upload' ? 'file' : parsed?.kind ?? 'file';
  const resumeAt = lesson.progress?.position ?? 0;

  useImperativeHandle(handle, () => ({
    getTime: () => (kind === 'youtube' ? ytRef.current?.getCurrentTime?.() ?? 0 : videoRef.current?.currentTime ?? 0),
    seek: (t) => { if (kind === 'youtube') ytRef.current?.seekTo?.(t, true); else if (videoRef.current) { videoRef.current.currentTime = t; videoRef.current.play().catch(() => {}); } },
  }), [kind]);

  // native / HLS
  useEffect(() => {
    const v = videoRef.current;
    if (!v || !src || (kind !== 'file' && kind !== 'hls')) return;
    setErr(null);
    let hls: any;
    if (kind === 'hls' && !v.canPlayType('application/vnd.apple.mpegurl')) {
      import('hls.js').then(({ default: Hls }) => { if (Hls.isSupported()) { hls = new Hls(); hls.loadSource(src); hls.attachMedia(v); hls.on(Hls.Events.ERROR, (_: any, d: any) => d.fatal && setErr('This stream could not be played.')); } else setErr('Your browser cannot play this stream.'); });
    } else v.src = src;
    const onMeta = () => { if (resumeAt > 3 && resumeAt < (v.duration || Infinity) - 5) v.currentTime = resumeAt; };
    v.addEventListener('loadedmetadata', onMeta);
    return () => { v.removeEventListener('loadedmetadata', onMeta); hls?.destroy(); };
  }, [src, kind, lesson.id]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (videoRef.current) videoRef.current.playbackRate = speed; }, [speed, src]);

  // periodic position
  useEffect(() => {
    const t = setInterval(() => {
      const pos = kind === 'youtube' ? ytRef.current?.getCurrentTime?.() : videoRef.current?.currentTime;
      const playing = kind === 'youtube' ? ytRef.current?.getPlayerState?.() === 1 : videoRef.current && !videoRef.current.paused;
      if (playing && pos) onProgress(pos);
    }, 15000);
    return () => clearInterval(t);
  }, [kind, onProgress]);

  // YouTube
  useEffect(() => {
    if (kind !== 'youtube' || !parsed?.id || !ytHost.current) return;
    let player: any; let dead = false;
    loadYT().then(() => {
      if (dead || !window.YT?.Player || !ytHost.current) return;
      const el = document.createElement('div'); ytHost.current.innerHTML = ''; ytHost.current.appendChild(el);
      player = new window.YT.Player(el, { videoId: parsed.id, width: '100%', height: '100%', playerVars: { rel: 0, modestbranding: 1, start: Math.floor(resumeAt) || undefined, playsinline: 1 }, events: { onStateChange: (e: any) => { if (e.data === 0) onEnded(); } } });
      ytRef.current = player;
    });
    return () => { dead = true; try { player?.destroy?.(); } catch { /* noop */ } ytRef.current = null; };
  }, [parsed?.id, kind, lesson.id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!src) return <div className="surface p-10 text-center text-sm text-muted">No video has been attached to this lesson yet.</div>;

  if (kind === 'youtube') return <div className={cn(frame, 'aspect-video')}><div ref={ytHost} className="h-full w-full [&>iframe]:h-full [&>iframe]:w-full" /></div>;
  if (kind === 'vimeo') return <div className={cn(frame, 'aspect-video')}><iframe title={lesson.title} className="h-full w-full" src={`https://player.vimeo.com/video/${parsed!.id}?dnt=1`} allow="autoplay; fullscreen; picture-in-picture" allowFullScreen /></div>;
  if (kind === 'loom') return <div className={cn(frame, 'aspect-video')}><iframe title={lesson.title} className="h-full w-full" src={`https://www.loom.com/embed/${parsed!.id}`} allow="fullscreen" allowFullScreen /></div>;
  return (
    <div>
      <div className={cn(frame, 'relative aspect-video')}>
        <video ref={videoRef} controls playsInline preload="metadata" className="h-full w-full" onEnded={onEnded} onError={() => setErr('This video could not be loaded.')} crossOrigin="anonymous">
          {c.captionUrl && <track kind="subtitles" src={c.captionUrl} srcLang="en" label="English" default />}
        </video>
        {err && <div className="absolute inset-0 grid place-items-center bg-black/80 p-6 text-center text-sm text-white">{err}</div>}
      </div>
      <div className="mt-3 flex items-center justify-end gap-2 text-xs text-muted">
        <Gauge className="size-4" /> Speed
        <div className="w-24"><Select value={String(speed)} onChange={(e) => setSpeed(Number(e.target.value))} className="h-8 rounded-lg text-xs" aria-label="Playback speed">{[0.5, 0.75, 1, 1.25, 1.5, 2].map((s) => <option key={s} value={s}>{s}×</option>)}</Select></div>
      </div>
    </div>
  );
}

/* ───────── audio ───────── */
export function AudioViewer({ lesson, onEnded, onProgress }: { lesson: LessonFull; onEnded: () => void; onProgress: (p: number) => void }) {
  const c = lesson.content;
  const src = c.file?.url ?? c.url;
  const ref = useRef<HTMLAudioElement>(null);
  useEffect(() => { const t = setInterval(() => { if (ref.current && !ref.current.paused) onProgress(ref.current.currentTime); }, 15000); return () => clearInterval(t); }, [onProgress]);
  if (!src) return <div className="surface p-10 text-center text-sm text-muted">No audio attached yet.</div>;
  return (
    <div className="surface relative overflow-hidden p-8">
      <div className="pointer-events-none absolute -right-10 -top-10 size-52 rounded-full bg-pink/20 blur-3xl" />
      <div className="relative flex flex-col items-center gap-6 sm:flex-row">
        <div className="grid size-28 shrink-0 place-items-center rounded-3xl bg-gradient-to-br from-primary to-pink text-white shadow-glow"><Headphones className="size-12" /></div>
        <div className="w-full min-w-0"><div className="mb-3 font-display text-lg font-semibold">{lesson.title}</div><audio ref={ref} src={src} controls preload="metadata" className="w-full" onEnded={onEnded} onLoadedMetadata={(e) => { const p = lesson.progress?.position ?? 0; if (p > 3) e.currentTarget.currentTime = p; }} /></div>
      </div>
    </div>
  );
}

/* ───────── documents ───────── */
export function DocumentViewer({ lesson }: { lesson: LessonFull }) {
  const c = lesson.content;
  const f = c.file as { id: number; name: string; mime: string; size: number; kind: string; url: string } | undefined;
  const ext = f?.name.split('.').pop()?.toLowerCase() ?? '';
  const needsPreview = !!f && (ext === 'docx' || f.kind === 'text');
  const { data: prev, isLoading } = useGet<{ type: string; html?: string; text?: string }>(needsPreview ? `/files/${f!.id}/preview` : null);
  const [loaded, setLoaded] = useState(false);
  if (!f && !c.url) return <div className="surface p-10 text-center text-sm text-muted">No document attached yet.</div>;

  const head = (name: string, size?: number, href?: string, download?: string) => (
    <div className="flex items-center gap-3 border-b border-line bg-card-2/40 px-4 py-2.5">
      <FileText className="size-4 text-primary-2" /><div className="min-w-0 flex-1 truncate text-sm font-medium">{name}</div>{size != null && <span className="text-xs text-subtle">{formatBytes(size)}</span>}
      {href && <a href={href} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs font-medium text-primary-2 hover:underline">Open <ExternalLink className="size-3" /></a>}
      {download && c.allowDownload !== false && <a href={download} className="inline-flex items-center gap-1 text-xs font-medium text-primary-2 hover:underline"><Download className="size-3" /> Download</a>}
    </div>
  );

  if (f) {
    let body: React.ReactNode;
    if (f.kind === 'pdf') body = <div className="relative h-[78vh] min-h-[520px]">{!loaded && <div className="absolute inset-0 grid place-items-center"><Spinner /></div>}<iframe title={f.name} src={f.url} className="h-full w-full bg-white" onLoad={() => setLoaded(true)} /></div>;
    else if (f.kind === 'image') body = <div className="grid place-items-center bg-black/30 p-4"><img src={f.url} alt={f.name} className="max-h-[75vh] rounded-lg" /></div>;
    else if (needsPreview) body = isLoading ? <div className="p-6"><Skeleton className="h-64" /></div> : prev?.type === 'html' ? <div className="max-h-[75vh] overflow-auto bg-white p-8 text-black"><div className="prose max-w-none [&_table]:border [&_td]:border [&_td]:p-2 [&_th]:border" dangerouslySetInnerHTML={{ __html: sanitizeHtml(prev.html ?? '') }} /></div> : prev?.type === 'markdown' ? <div className="max-h-[75vh] overflow-auto p-8"><Markdown>{prev.text ?? ''}</Markdown></div> : <pre className="max-h-[75vh] overflow-auto whitespace-pre-wrap p-6 font-mono text-[13px] leading-relaxed text-muted">{prev?.text}</pre>;
    else body = (
      <div className="flex flex-col items-center gap-4 p-14 text-center"><div className="grid size-16 place-items-center rounded-2xl bg-primary/12 text-primary-2"><FileText className="size-8" /></div><div><div className="font-semibold">{f.name}</div><p className="mt-1 text-sm text-muted">A browser preview isn't available for .{ext} files.</p></div><a href={`${f.url}/download`}><Button variant="primary" icon={<Download className="size-4" />}>Download file</Button></a></div>
    );
    return <div className="surface overflow-hidden">{head(f.name, f.size, f.url, `${f.url}/download`)}{body}</div>;
  }
  return (
    <div className="surface overflow-hidden">
      {head(c.url, undefined, c.url)}
      <iframe title={lesson.title} src={c.url} className="h-[78vh] min-h-[520px] w-full bg-white" sandbox="allow-scripts allow-same-origin allow-popups" />
    </div>
  );
}

/** Strip scripts/handlers from mammoth HTML (it already emits a safe subset; this is defence in depth). */
function sanitizeHtml(html: string) {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  doc.querySelectorAll('script,iframe,object,embed,link,style').forEach((n) => n.remove());
  doc.querySelectorAll('*').forEach((n) => { for (const a of [...n.attributes]) if (/^on/i.test(a.name) || (['href', 'src'].includes(a.name) && /^\s*javascript:/i.test(a.value))) n.removeAttribute(a.name); });
  return doc.body.innerHTML;
}

/* ───────── page / link / embed ───────── */
export const PageViewer = ({ lesson }: { lesson: LessonFull }) => (
  <article className="surface p-6 sm:p-10"><Markdown>{lesson.content.markdown || '_This page is empty._'}</Markdown></article>
);

export function LinkViewer({ lesson }: { lesson: LessonFull }) {
  const c = lesson.content;
  if (c.openIn === 'embed') return <EmbedViewer lesson={{ ...lesson, content: { ...c, height: 600 } }} />;
  let host = c.url; try { host = new URL(c.url).hostname; } catch { /* keep */ }
  return (
    <div className="surface relative overflow-hidden p-8 text-center sm:p-12">
      <div className="pointer-events-none absolute left-1/2 top-0 size-72 -translate-x-1/2 rounded-full bg-accent/15 blur-3xl" />
      <div className="relative">
        <div className="mx-auto mb-5 grid size-16 place-items-center rounded-2xl bg-accent/15 text-accent"><Link2 className="size-8" /></div>
        <h3 className="font-display text-xl font-semibold">{lesson.title}</h3>
        {c.description && <p className="mx-auto mt-2 max-w-md text-sm text-muted">{c.description}</p>}
        <div className="mt-2 text-xs text-subtle">{host}</div>
        <a href={c.url} target="_blank" rel="noopener noreferrer" className="mt-6 inline-block"><Button variant="primary" size="lg" icon={<ExternalLink className="size-4" />}>Open resource</Button></a>
      </div>
    </div>
  );
}

export function EmbedViewer({ lesson }: { lesson: LessonFull }) {
  const c = lesson.content;
  const [loaded, setLoaded] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  if (!c.url) return <div className="surface p-10 text-center text-sm text-muted">No embed URL set.</div>;
  return (
    <div className="surface overflow-hidden">
      <div className="flex items-center gap-3 border-b border-line bg-card-2/40 px-4 py-2.5">
        <VideoIcon className="size-4 text-primary-2" /><div className="min-w-0 flex-1 truncate text-sm font-medium">{c.url}</div>
        <Button size="icon-sm" variant="ghost" aria-label="Fullscreen" onClick={() => ref.current?.requestFullscreen?.()}><Maximize2 className="size-4" /></Button>
        <a href={c.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs font-medium text-primary-2 hover:underline">Open <ExternalLink className="size-3" /></a>
      </div>
      <div ref={ref} className="relative bg-white" style={{ height: c.height ?? 560 }}>
        {!loaded && <div className="absolute inset-0 grid place-items-center bg-bg"><Spinner /></div>}
        <iframe title={lesson.title} src={c.url} className="h-full w-full border-0" onLoad={() => setLoaded(true)} allow="fullscreen; clipboard-write; autoplay" allowFullScreen sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-presentation" />
      </div>
      <div className="border-t border-line px-4 py-2 text-xs text-subtle">If the content doesn't load, the site may block embedding — use “Open” to view it in a new tab.</div>
    </div>
  );
}

/* ───────── live session ───────── */
function icsFor(title: string, start: Date, mins: number, url: string, desc: string) {
  const f = (d: Date) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const esc = (s: string) => s.replace(/[\;,]/g, (m) => '\\' + m).replace(/\n/g, '\\n');
  return ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Orbit Ignite//EN', 'BEGIN:VEVENT', `UID:${Date.now()}@orbit-ignite`, `DTSTAMP:${f(new Date())}`, `DTSTART:${f(start)}`, `DTEND:${f(new Date(start.getTime() + mins * 60000))}`, `SUMMARY:${esc(title)}`, `DESCRIPTION:${esc(desc)}`, `URL:${url}`, 'END:VEVENT', 'END:VCALENDAR'].join('\r\n');
}

export function LiveViewer({ lesson }: { lesson: LessonFull }) {
  const c = lesson.content;
  const start = c.startsAt ? new Date(c.startsAt) : null;
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, []);
  if (!start || Number.isNaN(start.getTime())) return <div className="surface p-10 text-center text-sm text-muted">This live session hasn't been scheduled yet.</div>;
  const end = start.getTime() + (c.durationMin ?? 60) * 60000;
  const state = now < start.getTime() ? 'upcoming' : now < end ? 'live' : 'ended';
  const diff = Math.max(0, start.getTime() - now);
  const d = Math.floor(diff / 864e5), h = Math.floor((diff % 864e5) / 36e5), m = Math.floor((diff % 36e5) / 6e4), s = Math.floor((diff % 6e4) / 1e3);
  const addToCal = () => { const blob = new Blob([icsFor(lesson.title, start, c.durationMin ?? 60, c.joinUrl || location.href, c.agenda || '')], { type: 'text/calendar' }); const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'live-session.ics'; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000); };
  return (
    <div className="surface relative overflow-hidden p-7 sm:p-10">
      <div className={cn('pointer-events-none absolute -right-16 -top-16 size-72 rounded-full blur-3xl', state === 'live' ? 'bg-success/25' : 'bg-accent/20')} />
      <div className="relative grid gap-8 md:grid-cols-[1fr_auto] md:items-center">
        <div>
          <div className="mb-3 flex items-center gap-2">{state === 'live' ? <Badge tone="success" dot>Live now</Badge> : state === 'upcoming' ? <Badge tone="info">Upcoming</Badge> : <Badge>Ended</Badge>}{c.platform && <Badge>{c.platform}</Badge>}</div>
          <h3 className="font-display text-2xl font-bold">{lesson.title}</h3>
          <div className="mt-3 space-y-1.5 text-sm text-muted"><div className="flex items-center gap-2"><Clock className="size-4" />{dateTimeFmt(c.startsAt)} · {c.durationMin ?? 60} min</div>{c.host && <div className="flex items-center gap-2"><Users className="size-4" />Hosted by {c.host}</div>}</div>
          {c.agenda && <div className="mt-5 rounded-2xl border border-line bg-card-2/40 p-4"><div className="mb-1 text-xs font-semibold uppercase tracking-wider text-subtle">Agenda</div><p className="whitespace-pre-wrap text-sm leading-relaxed">{c.agenda}</p></div>}
          <div className="mt-6 flex flex-wrap gap-3">
            {c.joinUrl && state !== 'ended' && <a href={c.joinUrl} target="_blank" rel="noopener noreferrer"><Button variant="primary" size="lg" icon={<VideoIcon className="size-4" />}>{state === 'live' ? 'Join now' : 'Join link'}</Button></a>}
            {state === 'upcoming' && <Button variant="secondary" size="lg" icon={<CalendarPlus className="size-4" />} onClick={addToCal}>Add to calendar</Button>}
            {c.recordingUrl && <a href={c.recordingUrl} target="_blank" rel="noopener noreferrer"><Button variant="secondary" size="lg" icon={<ExternalLink className="size-4" />}>Watch recording</Button></a>}
          </div>
        </div>
        {state === 'upcoming' && (
          <div className="flex flex-col items-center gap-2" aria-label={`Starts in ${d} days ${h} hours ${m} minutes`}>
            <div className="text-[11px] font-semibold uppercase tracking-[0.25em] text-subtle">Departure board</div>
            <SplitFlapDisplay text={d > 0 ? `T-${String(d).padStart(2, '0')}D ${String(h).padStart(2, '0')}H ${String(m).padStart(2, '0')}M` : `T-${String(h).padStart(2, '0')}H ${String(m).padStart(2, '0')}M ${String(s).padStart(2, '0')}S`} columns={13} size="sm" accentColor="#38d9f5" showIndicators={false} />
          </div>
        )}
      </div>
    </div>
  );
}
void formatSeconds; void api;

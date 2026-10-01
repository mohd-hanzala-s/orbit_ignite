import { useRef, useState } from 'react';
import { CheckCircle2, FileUp, Loader2, X, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { upload, type UploadedFile } from '@/lib/api';
import { cn, formatBytes } from '@/lib/utils';
import { ProgressBar } from '@/components/ui/misc';

interface Props<T> {
  endpoint?: '/files' | '/files/scorm';
  accept?: string;
  label: string;
  hint?: string;
  maxMB?: number;
  current?: { name: string; size?: number; sub?: string } | null;
  onUploaded: (r: T) => void;
  onClear?: () => void;
  compact?: boolean;
}

/** Drag-and-drop uploader with progress + cancel. Works for plain files and SCORM zips. */
export function FileDrop<T = UploadedFile>({ endpoint = '/files', accept, label, hint, maxMB = 1024, current, onUploaded, onClear, compact }: Props<T>) {
  const input = useRef<HTMLInputElement>(null);
  const [pct, setPct] = useState<number | null>(null);
  const [over, setOver] = useState(false);
  const [name, setName] = useState('');
  const abort = useRef<(() => void) | null>(null);

  const go = (file?: File) => {
    if (!file) return;
    if (file.size > maxMB * 1024 * 1024) return toast.error(`File is larger than ${maxMB} MB`);
    setName(file.name); setPct(0);
    const up = upload<T>(endpoint, file, setPct);
    abort.current = up.abort;
    up.promise.then((r) => { onUploaded(r); toast.success('Upload complete'); }).catch((e) => e.message !== 'Upload cancelled' && toast.error(e.message)).finally(() => { setPct(null); abort.current = null; });
  };

  if (pct != null)
    return (
      <div className="rounded-2xl border border-line-2 bg-card-2/50 p-4">
        <div className="mb-2 flex items-center gap-2 text-sm"><Loader2 className="size-4 animate-spin text-primary-2" /><span className="min-w-0 flex-1 truncate font-medium">{name}</span><span className="tabular-nums text-muted">{pct >= 100 ? 'Processing…' : `${pct}%`}</span><button type="button" onClick={() => abort.current?.()} aria-label="Cancel upload" className="text-subtle hover:text-danger"><X className="size-4" /></button></div>
        <ProgressBar value={pct} />
      </div>
    );

  return (
    <div>
      <input ref={input} type="file" hidden accept={accept} onChange={(e) => { go(e.target.files?.[0]); e.target.value = ''; }} />
      {current && (
        <div className="mb-3 flex items-center gap-3 rounded-2xl border border-success/30 bg-success/8 px-4 py-3">
          <CheckCircle2 className="size-5 shrink-0 text-success" />
          <div className="min-w-0 flex-1"><div className="truncate text-sm font-semibold">{current.name}</div><div className="text-xs text-muted">{[current.size != null && formatBytes(current.size), current.sub].filter(Boolean).join(' · ')}</div></div>
          <button type="button" onClick={() => input.current?.click()} className="flex items-center gap-1 text-xs font-medium text-primary-2 hover:underline"><RefreshCw className="size-3" /> Replace</button>
          {onClear && <button type="button" onClick={onClear} aria-label="Remove file" className="text-subtle hover:text-danger"><X className="size-4" /></button>}
        </div>
      )}
      {!current && (
        <button type="button" onClick={() => input.current?.click()} onDragOver={(e) => { e.preventDefault(); setOver(true); }} onDragLeave={() => setOver(false)} onDrop={(e) => { e.preventDefault(); setOver(false); go(e.dataTransfer.files[0]); }}
          className={cn('flex w-full flex-col items-center gap-2 rounded-2xl border-2 border-dashed text-center text-sm text-muted transition-colors', compact ? 'px-4 py-5' : 'px-4 py-9', over ? 'border-primary bg-primary/10' : 'border-line-2 hover:border-primary/60 hover:bg-primary/5')}>
          <FileUp className="size-6 text-primary-2" />
          <span><b className="text-fg">{label}</b> — drop it here or <span className="font-semibold text-primary-2">browse</span></span>
          {hint && <span className="text-xs text-subtle">{hint}</span>}
        </button>
      )}
    </div>
  );
}

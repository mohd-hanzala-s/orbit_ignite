import { useRef, useState } from 'react';
import { Bold, Code, Heading2, Italic, Link2, List, ListOrdered, Quote, Table } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Markdown } from '@/components/ui/Markdown';

export function MarkdownEditor({ value, onChange, minHeight = 280, placeholder }: { value: string; onChange: (v: string) => void; minHeight?: number; placeholder?: string }) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const [mode, setMode] = useState<'write' | 'preview' | 'split'>('write');

  const wrap = (before: string, after = before, fallback = 'text') => {
    const el = ref.current; if (!el) return;
    const { selectionStart: s, selectionEnd: e } = el;
    const sel = value.slice(s, e) || fallback;
    onChange(value.slice(0, s) + before + sel + after + value.slice(e));
    requestAnimationFrame(() => { el.focus(); el.setSelectionRange(s + before.length, s + before.length + sel.length); });
  };
  const linePrefix = (prefix: string) => {
    const el = ref.current; if (!el) return;
    const s = value.lastIndexOf('\n', el.selectionStart - 1) + 1;
    onChange(value.slice(0, s) + prefix + value.slice(s));
    requestAnimationFrame(() => { el.focus(); el.setSelectionRange(el.selectionStart + prefix.length, el.selectionStart + prefix.length); });
  };
  const tools = [
    { i: Bold, l: 'Bold', f: () => wrap('**') }, { i: Italic, l: 'Italic', f: () => wrap('*') }, { i: Heading2, l: 'Heading', f: () => linePrefix('## ') },
    { i: List, l: 'Bullet list', f: () => linePrefix('- ') }, { i: ListOrdered, l: 'Numbered list', f: () => linePrefix('1. ') }, { i: Quote, l: 'Quote', f: () => linePrefix('> ') },
    { i: Code, l: 'Code', f: () => wrap('`') }, { i: Link2, l: 'Link', f: () => wrap('[', '](https://)', 'link text') },
    { i: Table, l: 'Table', f: () => onChange(value + '\n\n| Column A | Column B |\n| --- | --- |\n| Cell | Cell |\n') },
  ];
  return (
    <div className="overflow-hidden rounded-2xl border border-line-2 bg-card/50">
      <div className="flex flex-wrap items-center gap-1 border-b border-line bg-card-2/50 px-2 py-1.5">
        {tools.map((t) => <button key={t.l} type="button" onClick={t.f} title={t.l} aria-label={t.l} className="grid size-8 place-items-center rounded-lg text-muted hover:bg-card-2 hover:text-fg"><t.i className="size-4" /></button>)}
        <div className="ml-auto flex rounded-lg bg-bg/60 p-0.5 text-xs font-medium">{(['write', 'split', 'preview'] as const).map((m) => <button key={m} type="button" onClick={() => setMode(m)} className={cn('rounded-md px-2.5 py-1 capitalize', mode === m ? 'bg-primary/20 text-fg' : 'text-muted hover:text-fg')}>{m}</button>)}</div>
      </div>
      <div className={cn('grid', mode === 'split' && 'md:grid-cols-2 md:divide-x md:divide-line')}>
        {mode !== 'preview' && <textarea ref={ref} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder ?? 'Write in Markdown…'} spellCheck className="block w-full resize-y bg-transparent p-4 font-mono text-[13px] leading-relaxed text-fg placeholder:text-subtle focus:outline-none" style={{ minHeight }} aria-label="Markdown editor" />}
        {mode !== 'write' && <div className="overflow-auto p-5" style={{ minHeight, maxHeight: 600 }}>{value.trim() ? <Markdown>{value}</Markdown> : <p className="text-sm text-subtle">Nothing to preview yet.</p>}</div>}
      </div>
    </div>
  );
}

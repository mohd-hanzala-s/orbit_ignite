import { Reorder } from 'motion/react';
import { Check, GripVertical, Plus, Trash2, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Checkbox, Field, Input, Select, Switch, Textarea } from '@/components/ui/form';

export interface QOption { id: string; text: string }
export interface QQuestion { id: string; type: 'single' | 'multiple' | 'truefalse' | 'short' | 'ordering'; prompt: string; options?: QOption[]; correct?: string[]; points?: number; explanation?: string }
export interface QuizContent { passScore: number; maxAttempts: number; timeLimitMin: number; shuffle: boolean; showAnswers: boolean; questions: QQuestion[] }

const rid = () => Math.random().toString(36).slice(2, 8);
export const emptyQuiz = (): QuizContent => ({ passScore: 70, maxAttempts: 0, timeLimitMin: 0, shuffle: false, showAnswers: true, questions: [] });
const TYPE_LABEL = { single: 'Single choice', multiple: 'Multiple choice', truefalse: 'True / False', short: 'Short answer', ordering: 'Ordering' };

function newQuestion(type: QQuestion['type']): QQuestion {
  const base = { id: 'q' + rid(), type, prompt: '', points: 1, explanation: '' };
  if (type === 'single' || type === 'multiple') return { ...base, options: [{ id: 'o' + rid(), text: '' }, { id: 'o' + rid(), text: '' }], correct: [] };
  if (type === 'truefalse') return { ...base, correct: ['true'] };
  if (type === 'short') return { ...base, correct: [''] };
  return { ...base, options: [{ id: 'o' + rid(), text: '' }, { id: 'o' + rid(), text: '' }, { id: 'o' + rid(), text: '' }] };
}

function QuestionEditor({ q, index, onChange, onRemove }: { q: QQuestion; index: number; onChange: (q: QQuestion) => void; onRemove: () => void }) {
  const setOpt = (id: string, text: string) => onChange({ ...q, options: q.options!.map((o) => (o.id === id ? { ...o, text } : o)) });
  const addOpt = () => onChange({ ...q, options: [...(q.options ?? []), { id: 'o' + rid(), text: '' }] });
  const delOpt = (id: string) => onChange({ ...q, options: q.options!.filter((o) => o.id !== id), correct: q.correct?.filter((c) => c !== id) });
  const toggleCorrect = (id: string) => {
    if (q.type === 'single') return onChange({ ...q, correct: [id] });
    const c = new Set(q.correct ?? []); c.has(id) ? c.delete(id) : c.add(id); onChange({ ...q, correct: [...c] });
  };
  return (
    <div className="surface p-5">
      <div className="mb-4 flex items-center gap-3">
        <GripVertical className="size-4 shrink-0 cursor-grab text-subtle" />
        <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-primary/15 text-xs font-bold text-primary-2">{index + 1}</span>
        <div className="w-44"><Select value={q.type} onChange={(e) => { const t = e.target.value as QQuestion['type']; const n = newQuestion(t); onChange({ ...n, id: q.id, prompt: q.prompt, points: q.points, explanation: q.explanation }); }} aria-label="Question type" className="h-9 text-xs">{Object.entries(TYPE_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}</Select></div>
        <div className="ml-auto flex items-center gap-2 text-xs text-muted">Points <Input type="number" min={1} max={100} value={q.points ?? 1} onChange={(e) => onChange({ ...q, points: Number(e.target.value) || 1 })} className="h-9 w-16 text-center" aria-label="Points" /></div>
        <Button variant="ghost" size="icon-sm" onClick={onRemove} aria-label="Delete question"><Trash2 className="size-4 text-danger" /></Button>
      </div>
      <Textarea value={q.prompt} onChange={(e) => onChange({ ...q, prompt: e.target.value })} placeholder="Type your question…" className="min-h-16" aria-label="Question prompt" />

      {(q.type === 'single' || q.type === 'multiple') && (
        <div className="mt-4 space-y-2">
          <div className="text-xs font-medium text-subtle">{q.type === 'single' ? 'Select the correct answer' : 'Tick every correct answer'}</div>
          {q.options!.map((o, i) => {
            const on = q.correct?.includes(o.id);
            return (
              <div key={o.id} className="flex items-center gap-2">
                <button type="button" role={q.type === 'single' ? 'radio' : 'checkbox'} aria-checked={!!on} aria-label={`Mark option ${i + 1} correct`} onClick={() => toggleCorrect(o.id)} className={cn('grid size-6 shrink-0 place-items-center border-2 transition-colors', q.type === 'single' ? 'rounded-full' : 'rounded-md', on ? 'border-success bg-success text-white' : 'border-line-2 hover:border-success/60')}>{on && <Check className="size-3.5" />}</button>
                <Input value={o.text} onChange={(e) => setOpt(o.id, e.target.value)} placeholder={`Option ${i + 1}`} aria-label={`Option ${i + 1}`} className={cn(on && 'border-success/50')} />
                <Button variant="ghost" size="icon-sm" disabled={q.options!.length <= 2} onClick={() => delOpt(o.id)} aria-label="Remove option"><X className="size-4" /></Button>
              </div>
            );
          })}
          {q.options!.length < 10 && <Button variant="ghost" size="sm" icon={<Plus className="size-3.5" />} onClick={addOpt}>Add option</Button>}
        </div>
      )}
      {q.type === 'truefalse' && (
        <div className="mt-4 flex gap-3">{['true', 'false'].map((v) => <button key={v} type="button" onClick={() => onChange({ ...q, correct: [v] })} className={cn('flex-1 rounded-xl border px-4 py-3 text-sm font-semibold capitalize transition-colors', q.correct?.[0] === v ? 'border-success bg-success/12 text-success' : 'border-line-2 text-muted hover:border-primary/40')}>{v}{q.correct?.[0] === v && ' ✓'}</button>)}</div>
      )}
      {q.type === 'short' && (
        <div className="mt-4 space-y-2">
          <div className="text-xs font-medium text-subtle">Accepted answers (case-insensitive)</div>
          {(q.correct ?? ['']).map((a, i) => (
            <div key={i} className="flex items-center gap-2"><Input value={a} onChange={(e) => onChange({ ...q, correct: q.correct!.map((x, j) => (j === i ? e.target.value : x)) })} placeholder="Accepted answer" aria-label={`Accepted answer ${i + 1}`} /><Button variant="ghost" size="icon-sm" disabled={(q.correct?.length ?? 0) <= 1} onClick={() => onChange({ ...q, correct: q.correct!.filter((_, j) => j !== i) })} aria-label="Remove answer"><X className="size-4" /></Button></div>
          ))}
          <Button variant="ghost" size="sm" icon={<Plus className="size-3.5" />} onClick={() => onChange({ ...q, correct: [...(q.correct ?? []), ''] })}>Add alternative</Button>
        </div>
      )}
      {q.type === 'ordering' && (
        <div className="mt-4 space-y-2">
          <div className="text-xs font-medium text-subtle">Enter the items in the <b>correct order</b> — learners will see them shuffled.</div>
          <Reorder.Group axis="y" values={q.options!} onReorder={(options) => onChange({ ...q, options })} className="space-y-2">
            {q.options!.map((o, i) => (
              <Reorder.Item key={o.id} value={o} className="flex items-center gap-2">
                <GripVertical className="size-4 shrink-0 cursor-grab text-subtle" /><span className="w-5 text-center text-xs font-bold text-primary-2">{i + 1}</span>
                <Input value={o.text} onChange={(e) => setOpt(o.id, e.target.value)} placeholder={`Item ${i + 1}`} aria-label={`Item ${i + 1}`} />
                <Button variant="ghost" size="icon-sm" disabled={q.options!.length <= 2} onClick={() => delOpt(o.id)} aria-label="Remove item"><X className="size-4" /></Button>
              </Reorder.Item>
            ))}
          </Reorder.Group>
          {q.options!.length < 10 && <Button variant="ghost" size="sm" icon={<Plus className="size-3.5" />} onClick={addOpt}>Add item</Button>}
        </div>
      )}
      <Input className="mt-4" value={q.explanation ?? ''} onChange={(e) => onChange({ ...q, explanation: e.target.value })} placeholder="Explanation shown after answering (optional)" aria-label="Explanation" />
    </div>
  );
}

export function QuizBuilder({ value, onChange }: { value: QuizContent; onChange: (v: QuizContent) => void }) {
  const set = (p: Partial<QuizContent>) => onChange({ ...value, ...p });
  return (
    <div className="space-y-5">
      <div className="surface grid gap-4 p-5 sm:grid-cols-3">
        <Field label="Pass mark (%)">{(id) => <Input id={id} type="number" min={0} max={100} value={value.passScore} onChange={(e) => set({ passScore: Number(e.target.value) })} />}</Field>
        <Field label="Max attempts" hint="0 = unlimited">{(id) => <Input id={id} type="number" min={0} max={50} value={value.maxAttempts} onChange={(e) => set({ maxAttempts: Number(e.target.value) })} />}</Field>
        <Field label="Time limit (min)" hint="0 = none">{(id) => <Input id={id} type="number" min={0} max={600} value={value.timeLimitMin} onChange={(e) => set({ timeLimitMin: Number(e.target.value) })} />}</Field>
        <div className="sm:col-span-3 grid gap-3 sm:grid-cols-2"><Switch checked={value.shuffle} onChange={(v) => set({ shuffle: v })} label="Shuffle questions" /><Switch checked={value.showAnswers} onChange={(v) => set({ showAnswers: v })} label="Show correct answers after submitting" /></div>
      </div>
      <Reorder.Group axis="y" values={value.questions} onReorder={(questions) => set({ questions })} className="space-y-4">
        {value.questions.map((q, i) => (
          <Reorder.Item key={q.id} value={q} dragListener={false}>
            <QuestionEditor q={q} index={i} onChange={(nq) => set({ questions: value.questions.map((x) => (x.id === q.id ? nq : x)) })} onRemove={() => set({ questions: value.questions.filter((x) => x.id !== q.id) })} />
          </Reorder.Item>
        ))}
      </Reorder.Group>
      <div className="rounded-2xl border border-dashed border-line-2 p-4">
        <div className="mb-3 text-center text-xs font-medium uppercase tracking-wider text-subtle">Add a question</div>
        <div className="flex flex-wrap justify-center gap-2">{(Object.keys(TYPE_LABEL) as QQuestion['type'][]).map((t) => <Button key={t} variant="outline" size="sm" icon={<Plus className="size-3.5" />} onClick={() => set({ questions: [...value.questions, newQuestion(t)] })}>{TYPE_LABEL[t]}</Button>)}</div>
      </div>
    </div>
  );
}
void Checkbox;

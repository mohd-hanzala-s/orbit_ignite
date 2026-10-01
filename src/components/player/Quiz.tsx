import { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion, Reorder } from 'motion/react';
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, CheckCircle2, Clock, GripVertical, RotateCcw, Trophy, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { useAct } from '@/lib/queries';
import type { LessonFull, QuizQuestionPublic, QuizResultItem } from '@/lib/types';
import { cn, dateFmt, formatSeconds } from '@/lib/utils';
import { Badge, ProgressBar } from '@/components/ui/misc';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/form';
import { ProgressRing } from '@/components/space/ProgressRing';
import { Mascot } from '@/components/space/Mascot';
import { confetti } from '@/lib/confetti';

interface QuizData { passScore: number; maxAttempts: number; timeLimitMin: number; shuffle: boolean; showAnswers: boolean; questions: QuizQuestionPublic[] }
interface Attempt { id: number; percent: number; passed: boolean; score: number; max: number; submittedAt: string }
interface Submitted { percent: number; score: number; max: number; passed: boolean; passScore: number; results: QuizResultItem[]; badges: string[]; answers: Record<string, any>; tracked: boolean }

function shuffleStable<T>(arr: T[], seed: number) {
  const a = [...arr]; let s = seed || 1;
  for (let i = a.length - 1; i > 0; i--) { s = (s * 16807) % 2147483647; const j = s % (i + 1); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

export function QuizViewer({ lesson, onDone }: { lesson: LessonFull; onDone: (r: any) => void }) {
  const quiz = lesson.content.quiz as QuizData;
  const attempts = (lesson.content.attempts ?? []) as Attempt[];
  const last = lesson.content.lastResult as null | { percent: number; passed: boolean; results: QuizResultItem[]; answers: Record<string, any> };
  const [phase, setPhase] = useState<'intro' | 'taking' | 'result'>('intro');
  const [idx, setIdx] = useState(0);
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [result, setResult] = useState<Submitted | null>(null);
  const [remaining, setRemaining] = useState<number | null>(null);
  const startedAt = useRef(0);
  const questions = useMemo(() => (quiz.shuffle ? shuffleStable(quiz.questions, lesson.id + attempts.length) : quiz.questions), [quiz, lesson.id, attempts.length, phase === 'taking']); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { setPhase('intro'); setResult(null); setAnswers({}); setIdx(0); }, [lesson.id]);

  const submit = useAct(() => api.post<Omit<Submitted, 'answers'>>(`/lessons/${lesson.id}/quiz`, { answers, durationSec: Math.round((Date.now() - startedAt.current) / 1000) }), {
    invalidate: [[`/lessons/${lesson.id}`]],
    onSuccess: (r) => { setResult({ ...r, answers }); setPhase('result'); if (r.passed) { if (!(r as any).enrollment?.justCompleted) confetti({ count: 100 }); onDone(r); } },
  });
  const submitRef = useRef(submit.mutate);
  submitRef.current = submit.mutate;

  useEffect(() => {
    if (phase !== 'taking' || remaining == null) return;
    if (remaining <= 0) { toast.info("Time's up — submitting your answers"); submitRef.current(); return; }
    const t = setTimeout(() => setRemaining((r) => (r == null ? r : r - 1)), 1000);
    return () => clearTimeout(t);
  }, [phase, remaining]);

  const start = () => {
    const init: Record<string, any> = {};
    for (const q of quiz.questions) if (q.type === 'ordering') init[q.id] = (q.options ?? []).map((o) => o.id);
    setAnswers(init); setIdx(0); setResult(null); startedAt.current = Date.now();
    setRemaining(quiz.timeLimitMin ? quiz.timeLimitMin * 60 : null); setPhase('taking');
  };

  const usedUp = quiz.maxAttempts > 0 && attempts.length >= quiz.maxAttempts && lesson.tracked;
  const best = attempts.reduce((m, a) => Math.max(m, a.percent), 0);

  if (phase === 'intro') return (
    <div className="surface relative overflow-hidden p-7 sm:p-10">
      <div className="pointer-events-none absolute -right-10 -top-10 size-60 rounded-full bg-pink/15 blur-3xl" />
      <div className="relative grid gap-8 md:grid-cols-[1fr_auto] md:items-center">
        <div>
          <Badge tone="primary">Quiz</Badge>
          <h3 className="mt-3 font-display text-2xl font-bold">{lesson.title}</h3>
          <ul className="mt-4 space-y-1.5 text-sm text-muted">
            <li>• {quiz.questions.length} questions</li><li>• Pass mark: <b className="text-fg">{quiz.passScore}%</b></li>
            <li>• Attempts: {quiz.maxAttempts ? `${attempts.length}/${quiz.maxAttempts} used` : 'Unlimited'}</li>
            {quiz.timeLimitMin > 0 && <li>• Time limit: {quiz.timeLimitMin} minutes</li>}
          </ul>
          {attempts.length > 0 && <div className="mt-5 flex items-center gap-4 rounded-2xl border border-line bg-card-2/40 p-4"><ProgressRing value={best} size={56} /><div><div className="text-sm font-semibold">Best score {best}%</div><div className="text-xs text-muted">{attempts.some((a) => a.passed) ? 'You passed this quiz 🎉' : 'Not passed yet — you can retry'} · last attempt {dateFmt(attempts[0].submittedAt)}</div></div></div>}
          <div className="mt-6 flex flex-wrap gap-3">
            <Button variant="primary" size="lg" disabled={usedUp || quiz.questions.length === 0} onClick={start}>{attempts.length ? 'Retake quiz' : 'Start quiz'} <ArrowRight className="size-4" /></Button>
            {last && quiz.showAnswers && <Button variant="secondary" size="lg" onClick={() => { setResult({ percent: last.percent, passed: last.passed, score: 0, max: 0, passScore: quiz.passScore, results: last.results, badges: [], answers: last.answers, tracked: true }); setPhase('result'); }}>Review last attempt</Button>}
          </div>
          {usedUp && <p className="mt-3 text-sm text-warm">You've used all attempts for this quiz.</p>}
          {!lesson.tracked && <p className="mt-3 text-xs text-subtle">Preview mode — attempts are not recorded.</p>}
        </div>
        <div className="hidden md:block"><Mascot mood="think" size={150} /></div>
      </div>
    </div>
  );

  if (phase === 'result' && result) {
    const byId = new Map(result.results.map((r) => [r.id, r]));
    return (
      <div className="space-y-5">
        <div className="surface relative overflow-hidden p-7 text-center sm:p-10">
          <div className={cn('pointer-events-none absolute left-1/2 top-0 size-80 -translate-x-1/2 rounded-full blur-3xl', result.passed ? 'bg-success/20' : 'bg-warm/15')} />
          <div className="relative flex flex-col items-center">
            <Mascot mood={result.passed ? 'cheer' : 'oops'} size={110} />
            <div className="mt-2"><ProgressRing value={result.percent} size={96} stroke={8} planet={false} /></div>
            <h3 className="mt-3 font-display text-2xl font-bold">{result.passed ? 'Mission accomplished!' : 'Almost there!'}</h3>
            <p className="mt-1 text-sm text-muted">{result.passed ? `You scored ${result.percent}% — the pass mark is ${result.passScore}%.` : `You scored ${result.percent}%. You need ${result.passScore}% to pass.`}</p>
            {result.passed && result.tracked && <div className="mt-3"><Badge tone="success"><Trophy className="size-3" /> +XP earned</Badge></div>}
            <div className="mt-6 flex gap-3">
              {(!usedUp || !lesson.tracked) && !result.passed && <Button variant="primary" icon={<RotateCcw className="size-4" />} onClick={start}>Try again</Button>}
              <Button variant="secondary" onClick={() => setPhase('intro')}>Back to overview</Button>
            </div>
          </div>
        </div>
        {quiz.showAnswers && (
          <div className="space-y-3">
            <h4 className="font-display text-lg font-semibold">Review</h4>
            {quiz.questions.map((q, i) => {
              const r = byId.get(q.id);
              return (
                <div key={q.id} className={cn('surface p-5', r?.correct ? 'border-success/30' : 'border-danger/30')}>
                  <div className="flex items-start gap-3">
                    {r?.correct ? <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-success" /> : <XCircle className="mt-0.5 size-5 shrink-0 text-danger" />}
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-semibold"><span className="mr-1.5 text-subtle">{i + 1}.</span>{q.prompt}</div>
                      <div className="mt-2 space-y-1 text-sm">
                        <div className="text-muted">Your answer: <span className={r?.correct ? 'text-success' : 'text-danger'}>{describe(q, result.answers[q.id])}</span></div>
                        {!r?.correct && r?.correctAnswer != null && <div className="text-muted">Correct answer: <span className="text-success">{describe(q, r.correctAnswer)}</span></div>}
                        {r?.explanation && <div className="mt-2 rounded-xl bg-primary/10 px-3 py-2 text-[13px] text-fg/90">💡 {r.explanation}</div>}
                      </div>
                    </div>
                    <Badge tone={r?.correct ? 'success' : 'danger'}>{r?.earned ?? 0}/{q.points}</Badge>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  const q = questions[idx];
  const answered = (qq: QuizQuestionPublic) => { const a = answers[qq.id]; return Array.isArray(a) ? a.length > 0 : typeof a === 'string' ? a.trim() !== '' : false; };
  const unanswered = questions.filter((x) => !answered(x)).length;
  const isLast = idx === questions.length - 1;
  return (
    <div className="surface overflow-hidden">
      <div className="flex items-center gap-4 border-b border-line px-5 py-3.5">
        <div className="text-sm font-semibold">Question {idx + 1} <span className="text-subtle">of {questions.length}</span></div>
        <ProgressBar value={((idx + 1) / questions.length) * 100} className="flex-1" />
        {remaining != null && <Badge tone={remaining < 60 ? 'danger' : 'neutral'}><Clock className="size-3" /> {formatSeconds(remaining)}</Badge>}
      </div>
      <AnimatePresence mode="wait">
        <motion.div key={q.id} initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -24 }} transition={{ duration: 0.22 }} className="p-6 sm:p-8">
          <div className="mb-1 text-xs font-medium uppercase tracking-wider text-subtle">{{ single: 'Choose one', multiple: 'Select all that apply', truefalse: 'True or false', short: 'Type your answer', ordering: 'Drag into the right order' }[q.type]} · {q.points} {q.points === 1 ? 'pt' : 'pts'}</div>
          <h3 className="font-display text-xl font-semibold leading-snug">{q.prompt}</h3>
          <div className="mt-6"><Answer q={q} value={answers[q.id]} onChange={(v) => setAnswers((a) => ({ ...a, [q.id]: v }))} /></div>
        </motion.div>
      </AnimatePresence>
      <div className="flex items-center justify-between border-t border-line bg-card/40 px-5 py-3.5">
        <Button variant="ghost" disabled={idx === 0} onClick={() => setIdx(idx - 1)} icon={<ArrowLeft className="size-4" />}>Back</Button>
        <div className="flex gap-1.5" aria-hidden>{questions.map((x, i) => <button key={x.id} onClick={() => setIdx(i)} className={cn('size-2 rounded-full transition-all', i === idx ? 'w-5 bg-primary' : answered(x) ? 'bg-primary/60' : 'bg-line-2')} />)}</div>
        {isLast ? (
          <Button variant="primary" loading={submit.isPending} onClick={() => { if (unanswered && !confirm(`${unanswered} question${unanswered > 1 ? 's are' : ' is'} unanswered. Submit anyway?`)) return; submit.mutate(); }}>Submit quiz</Button>
        ) : <Button variant="primary" onClick={() => setIdx(idx + 1)}>Next <ArrowRight className="size-4" /></Button>}
      </div>
    </div>
  );
}

function describe(q: QuizQuestionPublic, a: any): string {
  const opt = (id: string) => (q.type === 'truefalse' ? (id === 'true' ? 'True' : 'False') : q.options?.find((o) => o.id === id)?.text ?? id);
  if (a == null || a === '' || (Array.isArray(a) && !a.length)) return '— no answer —';
  if (q.type === 'short') return Array.isArray(a) ? a.join(' / ') : String(a);
  if (Array.isArray(a)) return q.type === 'ordering' ? a.map((id, i) => `${i + 1}. ${opt(id)}`).join('  ') : a.map(opt).join(', ');
  return opt(String(a));
}

function Answer({ q, value, onChange }: { q: QuizQuestionPublic; value: any; onChange: (v: any) => void }) {
  if (q.type === 'short') return <Input value={value ?? ''} onChange={(e) => onChange(e.target.value)} placeholder="Type your answer…" maxLength={200} aria-label="Your answer" className="h-12 max-w-md text-base" autoFocus />;
  if (q.type === 'ordering') {
    const order: string[] = value ?? (q.options ?? []).map((o) => o.id);
    const text = (id: string) => q.options!.find((o) => o.id === id)?.text;
    const move = (i: number, d: number) => { const n = [...order]; const j = i + d; if (j < 0 || j >= n.length) return; [n[i], n[j]] = [n[j], n[i]]; onChange(n); };
    return (
      <Reorder.Group axis="y" values={order} onReorder={onChange} className="space-y-2.5">
        {order.map((id, i) => (
          <Reorder.Item key={id} value={id} className="flex cursor-grab items-center gap-3 rounded-2xl border border-line-2 bg-card px-4 py-3 active:cursor-grabbing" whileDrag={{ scale: 1.02, boxShadow: '0 12px 30px -8px rgba(0,0,0,.5)' }}>
            <GripVertical className="size-4 text-subtle" /><span className="grid size-6 place-items-center rounded-full bg-primary/15 text-xs font-bold text-primary-2">{i + 1}</span><span className="flex-1 text-sm font-medium">{text(id)}</span>
            <button className="grid size-7 place-items-center rounded-lg text-subtle hover:bg-card-2 hover:text-fg disabled:opacity-30" disabled={i === 0} onClick={() => move(i, -1)} aria-label="Move up"><ArrowUp className="size-4" /></button>
            <button className="grid size-7 place-items-center rounded-lg text-subtle hover:bg-card-2 hover:text-fg disabled:opacity-30" disabled={i === order.length - 1} onClick={() => move(i, 1)} aria-label="Move down"><ArrowDown className="size-4" /></button>
          </Reorder.Item>
        ))}
      </Reorder.Group>
    );
  }
  const multi = q.type === 'multiple';
  const opts = q.options ?? [];
  const sel: string[] = multi ? (Array.isArray(value) ? value : []) : value ? [value] : [];
  return (
    <div className="space-y-2.5" role={multi ? 'group' : 'radiogroup'}>
      {opts.map((o) => {
        const on = sel.includes(o.id);
        return (
          <button key={o.id} type="button" role={multi ? 'checkbox' : 'radio'} aria-checked={on} onClick={() => onChange(multi ? (on ? sel.filter((x) => x !== o.id) : [...sel, o.id]) : o.id)}
            className={cn('flex w-full items-center gap-3.5 rounded-2xl border px-4 py-3.5 text-left text-sm font-medium transition-all', on ? 'border-primary bg-primary/12 shadow-[0_0_0_1px_var(--primary)]' : 'border-line-2 bg-card hover:border-primary/50 hover:bg-card-2')}>
            <span className={cn('grid size-5 shrink-0 place-items-center border-2 transition-colors', multi ? 'rounded-md' : 'rounded-full', on ? 'border-primary bg-primary text-white' : 'border-line-2')}>{on && <CheckCircle2 className="size-3.5" />}</span>
            {o.text}
          </button>
        );
      })}
    </div>
  );
}

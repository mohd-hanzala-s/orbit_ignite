import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { SlidersHorizontal, X } from 'lucide-react';
import { useGet } from '@/lib/queries';
import type { Category, CourseCard } from '@/lib/types';
import { CourseCardView } from '@/components/CourseCardView';
import { PageHeader, Skeleton, EmptyState, ErrorState } from '@/components/ui/misc';
import { SearchInput, Select } from '@/components/ui/form';
import { Button } from '@/components/ui/button';
import { AnimatedBackground } from '@/components/mp/animated-background';
import { cn } from '@/lib/utils';
import { TextEffect } from '@/components/mp/text-effect';

export default function Catalog() {
  const [sp, setSp] = useSearchParams();
  const q = sp.get('q') ?? '';
  const category = sp.get('category') ?? '';
  const level = sp.get('level') ?? '';
  const sort = sp.get('sort') ?? 'recommended';
  const [draft, setDraft] = useState(q);
  const set = (k: string, v: string) => { const n = new URLSearchParams(sp); v ? n.set(k, v) : n.delete(k); setSp(n, { replace: true }); };

  const { data: cats } = useGet<Category[]>('/categories');
  const url = useMemo(() => {
    const p = new URLSearchParams();
    if (q) p.set('q', q);
    if (category) p.set('category', category);
    if (level) p.set('level', level);
    p.set('sort', sort);
    return `/courses?${p}`;
  }, [q, category, level, sort]);
  const { data, isLoading, error, refetch } = useGet<CourseCard[]>(url, { key: ['/courses', 'catalog', url] });
  const hasFilters = !!(q || category || level);

  return (
    <div>
      <PageHeader eyebrow="Explore the galaxy" title={<TextEffect as="span" per="char" preset="fade">Course catalog</TextEffect>} description="Find your next mission across science, engineering, leadership, data and design." />
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <form className="min-w-[240px] flex-1 sm:max-w-sm" onSubmit={(e) => { e.preventDefault(); set('q', draft.trim()); }}>
          <SearchInput value={draft} onChange={(e) => { setDraft(e.target.value); if (!e.target.value) set('q', ''); }} onBlur={() => set('q', draft.trim())} placeholder="Search courses, topics, tags…" aria-label="Search courses" />
        </form>
        <div className="flex items-center gap-2">
          <SlidersHorizontal className="hidden size-4 text-subtle sm:block" />
          <Select value={level} onChange={(e) => set('level', e.target.value)} className="w-40" aria-label="Level">
            <option value="">All levels</option><option>Beginner</option><option>Intermediate</option><option>Advanced</option>
          </Select>
          <Select value={sort} onChange={(e) => set('sort', e.target.value)} className="w-44" aria-label="Sort">
            <option value="recommended">Recommended</option><option value="popular">Most popular</option><option value="rating">Top rated</option><option value="newest">Newest</option><option value="title">A → Z</option>
          </Select>
        </div>
        {hasFilters && <Button variant="ghost" size="sm" onClick={() => { setSp({}, { replace: true }); setDraft(''); }} icon={<X className="size-3.5" />}>Clear</Button>}
      </div>

      <div className="-mx-1 mb-8 overflow-x-auto px-1 pb-1">
        <div className="inline-flex gap-1 rounded-2xl border border-line bg-card p-1.5">
          <AnimatedBackground defaultValue={category || 'all'} className="rounded-xl bg-primary/18 ring-1 ring-primary/30" transition={{ type: 'spring', bounce: 0.15, duration: 0.4 }} onValueChange={(v) => v && set('category', v === 'all' ? '' : v)}>
            {[{ id: 0, name: 'All', slug: 'all' } as any, ...(cats ?? [])].map((c) => (
              <button key={c.id} data-id={c.id ? String(c.id) : 'all'} className={cn('whitespace-nowrap rounded-xl px-4 py-2 text-sm font-medium transition-colors', (category || '') === (c.id ? String(c.id) : '') ? 'text-fg' : 'text-muted hover:text-fg')}>
                {c.name}{c.courseCount != null && <span className="ml-1.5 text-[11px] text-subtle">{c.courseCount}</span>}
              </button>
            ))}
          </AnimatedBackground>
        </div>
      </div>

      {error ? <ErrorState error={error} onRetry={refetch} /> : isLoading ? (
        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-[380px]" />)}</div>
      ) : !data?.length ? (
        <div className="surface"><EmptyState mood="think" title="No missions match" description="Try different keywords or clear the filters." action={<Button onClick={() => { setSp({}); setDraft(''); }}>Clear filters</Button>} /></div>
      ) : (
        <>
          <div className="mb-4 text-sm text-muted" aria-live="polite">{data.length} {data.length === 1 ? 'course' : 'courses'}</div>
          <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">{data.map((c, i) => <CourseCardView key={c.id} course={c} index={i} />)}</div>
        </>
      )}
    </div>
  );
}

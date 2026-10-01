import { Link } from 'react-router-dom';
import { Bookmark, Clock, PlayCircle, Star, Sparkles, CheckCircle2, Users } from 'lucide-react';
import { motion } from 'motion/react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import type { CourseCard } from '@/lib/types';
import { api } from '@/lib/api';
import { cn, formatDuration, daysUntil } from '@/lib/utils';
import { CourseCover } from '@/components/space/CourseCover';
import { Badge, Avatar, ProgressBar } from '@/components/ui/misc';
import { Spotlight } from '@/components/mp/spotlight';

const LEVEL_TONE: Record<string, 'success' | 'warn' | 'pink'> = { Beginner: 'success', Intermediate: 'warn', Advanced: 'pink' };

export function SaveButton({ course, className }: { course: CourseCard; className?: string }) {
  const qc = useQueryClient();
  return (
    <button
      aria-label={course.saved ? 'Remove from saved' : 'Save for later'}
      aria-pressed={course.saved}
      onClick={async (e) => {
        e.preventDefault(); e.stopPropagation();
        try {
          const r = await api.post<{ saved: boolean }>(`/courses/${course.id}/bookmark`);
          toast.success(r.saved ? 'Saved for later' : 'Removed from saved');
          qc.invalidateQueries();
        } catch (err: any) { toast.error(err.message); }
      }}
      className={cn('grid size-8 place-items-center rounded-full bg-black/45 text-white backdrop-blur transition hover:bg-black/65', className)}
    >
      <Bookmark className={cn('size-4', course.saved && 'fill-warm text-warm')} />
    </button>
  );
}

export function CourseCardView({ course, index = 0, to }: { course: CourseCard; index?: number; to?: string }) {
  const e = course.enrollment;
  const overdue = e?.status === 'active' && e.dueDate && daysUntil(e.dueDate) < 0;
  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(index, 8) * 0.04, duration: 0.4 }} className="h-full">
      <Link to={to ?? `/courses/${course.id}`} className="group surface surface-hover relative flex h-full flex-col overflow-hidden">
        <Spotlight className="z-10 from-primary/25 via-accent/10 to-transparent blur-2xl" size={220} />
        <div className="relative aspect-[16/9] overflow-hidden">
          <div className="h-full w-full transition-transform duration-700 group-hover:scale-[1.06]"><CourseCover theme={course.theme} seed={course.id} coverUrl={course.coverUrl} rounded={false} /></div>
          <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/40 to-transparent" />
          <div className="absolute left-3 top-3 flex gap-1.5">
            {course.category && <Badge tone="neutral" className="border-white/20 bg-black/40 text-white backdrop-blur">{course.category.name}</Badge>}
            {course.featured && <Badge tone="warn" className="border-warm/40 bg-warm/25 text-white backdrop-blur"><Sparkles className="size-3" /> Featured</Badge>}
          </div>
          <SaveButton course={course} className="absolute right-3 top-3" />
          {course.status !== 'published' && <Badge tone="warn" className="absolute bottom-3 left-3 uppercase">{course.status}</Badge>}
          {e?.status === 'completed' && <Badge tone="success" className="absolute bottom-3 right-3 border-success/40 bg-success/25 text-white backdrop-blur"><CheckCircle2 className="size-3" /> Completed</Badge>}
        </div>
        <div className="relative z-20 flex flex-1 flex-col p-5">
          <div className="mb-2 flex items-center gap-2">
            <Badge tone={LEVEL_TONE[course.level] ?? 'neutral'}>{course.level}</Badge>
            {overdue ? <Badge tone="danger" dot>Overdue</Badge> : e?.dueDate && e.status === 'active' ? <Badge tone="warn" dot>Due in {daysUntil(e.dueDate)}d</Badge> : null}
          </div>
          <h3 className="font-display text-[17px] font-semibold leading-snug tracking-tight line-clamp-2">{course.title}</h3>
          <p className="mt-1.5 line-clamp-2 text-[13px] leading-relaxed text-muted">{course.subtitle}</p>
          <div className="mt-auto pt-4">
            {e && e.status === 'active' ? (
              <div>
                <div className="mb-1.5 flex items-center justify-between text-xs"><span className="flex items-center gap-1 font-medium text-primary-2"><PlayCircle className="size-3.5" /> {e.progress > 0 ? 'Continue' : 'Start'}</span><span className="tabular-nums text-muted">{e.progress}%</span></div>
                <ProgressBar value={e.progress} />
              </div>
            ) : (
              <div className="flex items-center justify-between gap-3 text-xs text-muted">
                <div className="flex min-w-0 items-center gap-2">
                  {course.instructor && <Avatar name={course.instructor.name} color={course.instructor.avatarColor} size={22} />}
                  <span className="truncate">{course.instructor?.name}</span>
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  <span className="flex items-center gap-1"><Clock className="size-3.5" />{formatDuration(course.durationMinutes)}</span>
                  {course.rating != null ? <span className="flex items-center gap-1"><Star className="size-3.5 fill-warm text-warm" />{course.rating}</span> : <span className="flex items-center gap-1"><Users className="size-3.5" />{course.enrolledCount}</span>}
                </div>
              </div>
            )}
          </div>
        </div>
      </Link>
    </motion.div>
  );
}

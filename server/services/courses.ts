import { q, iso } from '../util.ts';
import { parseJson } from '../db.ts';
import type { Row } from '../db.ts';
import { lessonContent } from './learning.ts';

export const isStaffRole = (u?: Row) => !!u && (u.role === 'admin' || u.role === 'instructor');
export const canEditCourse = (u: Row | undefined, course: Row) => !!u && (u.role === 'admin' || (u.role === 'instructor' && course.instructor_id === u.id));

const COURSE_SQL = `
SELECT c.*,
  cat.name AS category_name, cat.color AS category_color, cat.slug AS category_slug,
  i.name AS instructor_name, i.avatar_color AS instructor_color, i.title AS instructor_title, i.bio AS instructor_bio,
  (SELECT COUNT(*) FROM lessons l WHERE l.course_id=c.id) AS lesson_count,
  (SELECT COALESCE(SUM(duration_minutes),0) FROM lessons l WHERE l.course_id=c.id) AS duration,
  (SELECT COUNT(*) FROM enrollments e WHERE e.course_id=c.id) AS enrolled_count,
  (SELECT COUNT(*) FROM enrollments e WHERE e.course_id=c.id AND e.status='completed') AS completed_count,
  (SELECT ROUND(AVG(rating),1) FROM reviews r WHERE r.course_id=c.id) AS rating,
  (SELECT COUNT(*) FROM reviews r WHERE r.course_id=c.id) AS rating_count
FROM courses c
LEFT JOIN categories cat ON cat.id=c.category_id
LEFT JOIN users i ON i.id=c.instructor_id`;

export function courseRows(where = '1=1', params: any[] = [], tail = 'ORDER BY c.featured DESC, c.id DESC'): Row[] {
  return q.all(`${COURSE_SQL} WHERE ${where} ${tail}`, ...params);
}
export const courseRow = (id: number): Row | undefined => courseRows('c.id=?', [id], '')[0];

export function courseCard(c: Row, userId?: number) {
  const enr = userId ? q.get('SELECT status, progress, due_date, last_lesson_id, enrolled_at, completed_at FROM enrollments WHERE user_id=? AND course_id=?', userId, c.id) : undefined;
  const saved = userId ? !!q.get('SELECT 1 x FROM bookmarks WHERE user_id=? AND course_id=?', userId, c.id) : false;
  return {
    id: c.id,
    title: c.title,
    subtitle: c.subtitle ?? '',
    status: c.status,
    level: c.level,
    theme: c.theme,
    coverUrl: c.cover_file_id ? `/api/files/${c.cover_file_id}` : null,
    category: c.category_id ? { id: c.category_id, name: c.category_name, color: c.category_color, slug: c.category_slug } : null,
    instructor: c.instructor_id ? { id: c.instructor_id, name: c.instructor_name, avatarColor: c.instructor_color, title: c.instructor_title ?? '' } : null,
    tags: parseJson<string[]>(c.tags, []),
    lessonCount: Number(c.lesson_count),
    durationMinutes: Number(c.duration),
    enrolledCount: Number(c.enrolled_count),
    completedCount: Number(c.completed_count),
    rating: c.rating != null ? Number(c.rating) : null,
    ratingCount: Number(c.rating_count),
    featured: !!c.featured,
    certificate: !!c.certificate_enabled,
    sequential: !!c.sequential,
    enrollmentMode: c.enrollment,
    updatedAt: iso(c.updated_at),
    saved,
    enrollment: enr ? { status: enr.status, progress: Number(enr.progress), dueDate: enr.due_date, lastLessonId: enr.last_lesson_id, enrolledAt: iso(enr.enrolled_at), completedAt: iso(enr.completed_at) } : null,
  };
}

export function courseDetailExtras(c: Row) {
  return {
    description: c.description ?? '',
    objectives: parseJson<string[]>(c.objectives, []),
    passMark: c.pass_mark,
    instructorBio: c.instructor_bio ?? '',
  };
}

/** Sections + lessons (no heavy content) with per-user progress and lock state. */
export function outline(courseId: number, userId?: number, opts: { staff?: boolean; sequential?: boolean } = {}) {
  const sections = q.all('SELECT * FROM sections WHERE course_id=? ORDER BY position, id', courseId);
  const lessons = q.all('SELECT id, section_id, title, type, position, duration_minutes, required, preview, summary FROM lessons WHERE course_id=? ORDER BY position, id', courseId);
  const prog = new Map<number, Row>();
  if (userId) for (const p of q.all('SELECT lesson_id, status, score, position, time_spent FROM lesson_progress WHERE user_id=? AND course_id=?', userId, courseId)) prog.set(Number(p.lesson_id), p);
  const subs = new Map<number, Row>();
  if (userId) for (const s of q.all(`SELECT s.lesson_id, s.status FROM submissions s JOIN lessons l ON l.id=s.lesson_id WHERE s.user_id=? AND l.course_id=?`, userId, courseId)) subs.set(Number(s.lesson_id), s);
  const bySection = new Map<number, Row[]>();
  for (const l of lessons) {
    const a = bySection.get(Number(l.section_id)) ?? [];
    a.push(l);
    bySection.set(Number(l.section_id), a);
  }
  let blocked = false;
  return sections.map((s) => ({
    id: s.id,
    title: s.title,
    position: s.position,
    lessons: (bySection.get(Number(s.id)) ?? []).map((l) => {
      const p = prog.get(Number(l.id));
      const status = p?.status === 'completed' ? 'completed' : subs.get(Number(l.id))?.status === 'submitted' ? 'pending' : p ? 'in_progress' : 'not_started';
      const locked = !!opts.sequential && !opts.staff && blocked;
      if (opts.sequential && l.required && status !== 'completed') blocked = true;
      return {
        id: l.id,
        title: l.title,
        type: l.type,
        durationMinutes: l.duration_minutes,
        required: !!l.required,
        preview: !!l.preview,
        summary: l.summary ?? '',
        status,
        locked,
      };
    }),
  }));
}

export function lessonDto(l: Row) {
  return { id: l.id, courseId: l.course_id, sectionId: l.section_id, title: l.title, type: l.type, durationMinutes: l.duration_minutes, required: !!l.required, preview: !!l.preview, summary: l.summary ?? '' };
}
export { lessonContent };

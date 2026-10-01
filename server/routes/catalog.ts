import { Router } from 'express';
import { requireAuth } from '../auth.ts';
import { q, bad, notFound, forbidden, intParam, wrap, log, iso, str, notify } from '../util.ts';
import { courseRows, courseRow, courseCard, courseDetailExtras, outline, isStaffRole } from '../services/courses.ts';
import { ensureEnrollment, checkBadges, awardXp } from '../services/learning.ts';
import { XP } from '../../shared/constants.ts';

export const catalogRouter = Router();

catalogRouter.get('/categories', requireAuth, (_req, res) => {
  const rows = q.all(`SELECT c.*, (SELECT COUNT(*) FROM courses x WHERE x.category_id=c.id AND x.status='published') AS n FROM categories c ORDER BY c.name`);
  res.json(rows.map((r) => ({ id: r.id, name: r.name, slug: r.slug, color: r.color, courseCount: Number(r.n) })));
});

catalogRouter.get(
  '/courses',
  requireAuth,
  wrap((req, res) => {
    const u = req.user!;
    const where: string[] = [];
    const params: any[] = [];
    if (!(isStaffRole(u) && req.query.all === '1')) {
      where.push(`(c.status='published' OR EXISTS(SELECT 1 FROM enrollments e WHERE e.course_id=c.id AND e.user_id=?))`);
      params.push(u.id);
    }
    if (isStaffRole(u) && u.role === 'instructor' && req.query.mine === '1') {
      where.push('c.instructor_id=?');
      params.push(u.id);
    }
    const s = str(req.query.q, 100);
    if (s) {
      where.push(`(c.title LIKE ? OR c.subtitle LIKE ? OR c.tags LIKE ? OR c.description LIKE ?)`);
      params.push(`%${s}%`, `%${s}%`, `%${s}%`, `%${s}%`);
    }
    const cat = Number(req.query.category);
    if (cat) {
      where.push('c.category_id=?');
      params.push(cat);
    }
    if (typeof req.query.level === 'string' && req.query.level) {
      where.push('c.level=?');
      params.push(req.query.level);
    }
    if (typeof req.query.status === 'string' && req.query.status) {
      where.push('c.status=?');
      params.push(req.query.status);
    }
    const sort = req.query.sort;
    const tail = sort === 'popular' ? 'ORDER BY enrolled_count DESC, c.id DESC' : sort === 'rating' ? 'ORDER BY rating DESC, rating_count DESC' : sort === 'newest' ? 'ORDER BY c.id DESC' : sort === 'title' ? 'ORDER BY c.title COLLATE NOCASE' : 'ORDER BY c.featured DESC, enrolled_count DESC, c.id DESC';
    const rows = courseRows(where.length ? where.join(' AND ') : '1=1', params, tail);
    res.json(rows.map((c) => courseCard(c, u.id)));
  }),
);

function visibleCourse(req: any, id: number) {
  const c = courseRow(id);
  if (!c) throw notFound('Course not found');
  const staff = isStaffRole(req.user);
  const enrolled = !!q.get('SELECT 1 x FROM enrollments WHERE user_id=? AND course_id=?', req.user.id, id);
  if (c.status !== 'published' && !staff && !enrolled) throw notFound('Course not found');
  return { c, staff, enrolled };
}

catalogRouter.get(
  '/courses/:id',
  requireAuth,
  wrap((req, res) => {
    const id = intParam(req, 'id');
    const { c, staff, enrolled } = visibleCourse(req, id);
    const card = courseCard(c, req.user!.id);
    const sections = outline(id, req.user!.id, { staff, sequential: !!c.sequential });
    // strip detailed summaries for non-enrolled to keep catalog light
    const myReview = q.get('SELECT rating, body FROM reviews WHERE course_id=? AND user_id=?', id, req.user!.id);
    const dist = q.all('SELECT rating, COUNT(*) n FROM reviews WHERE course_id=? GROUP BY rating', id);
    res.json({
      ...card,
      ...courseDetailExtras(c),
      sections,
      enrolled,
      canEdit: req.user!.role === 'admin' || (req.user!.role === 'instructor' && c.instructor_id === req.user!.id),
      myReview: myReview ? { rating: myReview.rating, body: myReview.body } : null,
      ratingDistribution: [5, 4, 3, 2, 1].map((r) => ({ rating: r, count: Number(dist.find((d) => Number(d.rating) === r)?.n ?? 0) })),
    });
  }),
);

catalogRouter.post(
  '/courses/:id/enroll',
  requireAuth,
  wrap((req, res) => {
    const id = intParam(req, 'id');
    const c = courseRow(id);
    if (!c || c.status !== 'published') throw notFound('Course not found');
    if (c.enrollment === 'invite' && !isStaffRole(req.user)) throw forbidden('This course is invite-only. Ask your administrator to enroll you.');
    const created = ensureEnrollment(req.user!.id, id, 'self');
    if (created) log(req.user!.id, 'course.enrolled', 'course', id);
    res.status(created ? 201 : 200).json({ ok: true, created });
  }),
);

catalogRouter.delete(
  '/courses/:id/enroll',
  requireAuth,
  wrap((req, res) => {
    const id = intParam(req, 'id');
    const e = q.get('SELECT * FROM enrollments WHERE user_id=? AND course_id=?', req.user!.id, id);
    if (!e) throw notFound('You are not enrolled');
    if (e.status === 'completed') throw bad('Completed courses stay in your history.');
    q.run('DELETE FROM enrollments WHERE id=?', e.id);
    q.run('DELETE FROM lesson_progress WHERE user_id=? AND course_id=?', req.user!.id, id);
    res.json({ ok: true });
  }),
);

catalogRouter.post(
  '/courses/:id/bookmark',
  requireAuth,
  wrap((req, res) => {
    const id = intParam(req, 'id');
    if (!courseRow(id)) throw notFound();
    const had = q.run('DELETE FROM bookmarks WHERE user_id=? AND course_id=?', req.user!.id, id).changes > 0;
    if (!had) q.run('INSERT INTO bookmarks(user_id, course_id) VALUES (?,?)', req.user!.id, id);
    res.json({ saved: !had });
  }),
);

catalogRouter.get(
  '/courses/:id/reviews',
  requireAuth,
  wrap((req, res) => {
    const id = intParam(req, 'id');
    const rows = q.all(`SELECT r.*, u.name, u.avatar_color FROM reviews r JOIN users u ON u.id=r.user_id WHERE r.course_id=? ORDER BY r.id DESC LIMIT 100`, id);
    res.json(rows.map((r) => ({ id: r.id, rating: r.rating, body: r.body, createdAt: iso(r.created_at), user: { id: r.user_id, name: r.name, avatarColor: r.avatar_color } })));
  }),
);

catalogRouter.post(
  '/courses/:id/reviews',
  requireAuth,
  wrap((req, res) => {
    const id = intParam(req, 'id');
    const rating = Number(req.body?.rating);
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) throw bad('Pick a rating from 1 to 5');
    if (!q.get('SELECT 1 x FROM enrollments WHERE user_id=? AND course_id=?', req.user!.id, id)) throw forbidden('Enroll in the course to review it');
    const existed = q.get('SELECT 1 x FROM reviews WHERE user_id=? AND course_id=?', req.user!.id, id);
    q.run(`INSERT INTO reviews(course_id, user_id, rating, body) VALUES (?,?,?,?) ON CONFLICT(course_id, user_id) DO UPDATE SET rating=excluded.rating, body=excluded.body`, id, req.user!.id, rating, str(req.body?.body, 1000));
    if (!existed) awardXp(req.user!.id, XP.review, 'review', id);
    checkBadges(req.user!.id);
    res.json({ ok: true });
  }),
);

/* ─────────── learning paths (constellations) ─────────── */

function pathDto(p: any, userId: number) {
  const courses = q.all(
    `SELECT pc.position, c.id FROM path_courses pc JOIN courses c ON c.id=pc.course_id WHERE pc.path_id=? AND c.status='published' ORDER BY pc.position`,
    p.id,
  );
  const cards = courses.map((r) => courseCard(courseRow(Number(r.id))!, userId));
  const done = cards.filter((c) => c.enrollment?.status === 'completed').length;
  const progress = cards.length ? Math.round(cards.reduce((a, c) => a + (c.enrollment?.progress ?? 0), 0) / cards.length) : 0;
  return {
    id: p.id,
    title: p.title,
    description: p.description ?? '',
    theme: p.theme,
    status: p.status,
    courses: cards,
    courseCount: cards.length,
    completedCount: done,
    progress,
    durationMinutes: cards.reduce((a, c) => a + c.durationMinutes, 0),
    enrolled: !!q.get('SELECT 1 x FROM path_enrollments WHERE path_id=? AND user_id=?', p.id, userId),
  };
}

catalogRouter.get('/paths', requireAuth, (req, res) => {
  const rows = q.all(`SELECT * FROM paths WHERE status='published' ORDER BY id DESC`);
  res.json(rows.map((p) => pathDto(p, req.user!.id)));
});
catalogRouter.get(
  '/paths/:id',
  requireAuth,
  wrap((req, res) => {
    const p = q.get('SELECT * FROM paths WHERE id=?', intParam(req, 'id'));
    if (!p || (p.status !== 'published' && !isStaffRole(req.user))) throw notFound('Path not found');
    res.json(pathDto(p, req.user!.id));
  }),
);
catalogRouter.post(
  '/paths/:id/enroll',
  requireAuth,
  wrap((req, res) => {
    const id = intParam(req, 'id');
    const p = q.get(`SELECT * FROM paths WHERE id=? AND status='published'`, id);
    if (!p) throw notFound('Path not found');
    q.run('INSERT OR IGNORE INTO path_enrollments(path_id, user_id) VALUES (?,?)', id, req.user!.id);
    for (const r of q.all(`SELECT c.id FROM path_courses pc JOIN courses c ON c.id=pc.course_id WHERE pc.path_id=? AND c.status='published'`, id)) ensureEnrollment(req.user!.id, Number(r.id), 'path');
    notify(req.user!.id, `You joined “${p.title}”`, 'All courses in this constellation were added to your missions.', `/paths/${id}`, 'info');
    res.json({ ok: true });
  }),
);

/* ─────────── leaderboard & search ─────────── */

catalogRouter.get('/leaderboard', requireAuth, (req, res) => {
  const rows = q.all(`SELECT id, name, avatar_color, xp, streak, title FROM users WHERE status='active' AND role='learner' ORDER BY xp DESC, id LIMIT 25`);
  res.json(rows.map((r, i) => ({ rank: i + 1, id: r.id, name: r.name, avatarColor: r.avatar_color, xp: r.xp, streak: r.streak, title: r.title, me: r.id === req.user!.id })));
});

catalogRouter.get(
  '/search',
  requireAuth,
  wrap((req, res) => {
    const s = str(req.query.q, 80);
    if (s.length < 2) return res.json({ courses: [], lessons: [], paths: [] });
    const like = `%${s}%`;
    const staff = isStaffRole(req.user);
    const courses = courseRows(`(c.title LIKE ? OR c.subtitle LIKE ? OR c.tags LIKE ?) AND (c.status='published' OR ?=1 OR EXISTS(SELECT 1 FROM enrollments e WHERE e.course_id=c.id AND e.user_id=?))`, [like, like, like, staff ? 1 : 0, req.user!.id], 'LIMIT 6').map((c) => courseCard(c, req.user!.id));
    const lessons = q.all(
      `SELECT l.id, l.title, l.type, l.course_id, c.title course_title FROM lessons l JOIN courses c ON c.id=l.course_id
       JOIN enrollments e ON e.course_id=c.id AND e.user_id=? WHERE l.title LIKE ? OR l.summary LIKE ? LIMIT 8`,
      req.user!.id, like, like,
    ).map((l) => ({ id: l.id, title: l.title, type: l.type, courseId: l.course_id, courseTitle: l.course_title }));
    const paths = q.all(`SELECT id, title FROM paths WHERE status='published' AND title LIKE ? LIMIT 4`, like);
    res.json({ courses, lessons, paths });
  }),
);

catalogRouter.get('/certificates/verify/:code', (req, res) => {
  const r = q.get(
    `SELECT ce.code, ce.issued_at, ce.score, u.name, c.title FROM certificates ce JOIN users u ON u.id=ce.user_id JOIN courses c ON c.id=ce.course_id WHERE ce.code=?`,
    String(req.params.code).toUpperCase(),
  );
  if (!r) return res.status(404).json({ error: 'Certificate not found', valid: false });
  res.json({ valid: true, code: r.code, learner: r.name, course: r.title, issuedAt: iso(r.issued_at), score: r.score });
});

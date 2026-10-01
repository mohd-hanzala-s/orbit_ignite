import { Router } from 'express';
import { requireAuth } from '../auth.ts';
import { q, wrap, iso, intParam, notFound, getSettings, todayStr } from '../util.ts';
import { parseJson } from '../db.ts';
import { courseRow, courseRows, courseCard } from '../services/courses.ts';
import { BADGES } from '../services/learning.ts';
import { levelFromXp } from '../../shared/constants.ts';

export const meRouter = Router();
meRouter.use(requireAuth);

function announcementsFor(userId: number, limit = 5) {
  const rows = q.all(
    `SELECT a.*, u.name author FROM announcements a LEFT JOIN users u ON u.id=a.author_id
     WHERE a.audience='all'
        OR (a.audience='course' AND a.target_id IN (SELECT course_id FROM enrollments WHERE user_id=?))
        OR (a.audience='group' AND a.target_id IN (SELECT group_id FROM group_members WHERE user_id=?))
     ORDER BY a.pinned DESC, a.id DESC LIMIT ?`,
    userId, userId, limit,
  );
  return rows.map((a) => ({ id: a.id, title: a.title, body: a.body, pinned: !!a.pinned, author: a.author ?? 'Mission Control', createdAt: iso(a.created_at) }));
}

function liveSessions(userId: number) {
  const rows = q.all(
    `SELECT l.id, l.title, l.content, l.course_id, c.title course_title, c.theme FROM lessons l
     JOIN courses c ON c.id=l.course_id JOIN enrollments e ON e.course_id=c.id AND e.user_id=? WHERE l.type='live'`,
    userId,
  );
  return rows
    .map((l) => {
      const c = parseJson<any>(l.content, {});
      return { lessonId: l.id, courseId: l.course_id, courseTitle: l.course_title, theme: l.theme, title: l.title, startsAt: c.startsAt ?? null, durationMin: c.durationMin ?? 60, platform: c.platform ?? '', joinUrl: c.joinUrl ?? '', host: c.host ?? '' };
    })
    .filter((s) => s.startsAt)
    .sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt));
}

meRouter.get(
  '/dashboard',
  wrap((req, res) => {
    const u = req.user!;
    const enrolled = q.all(`SELECT course_id FROM enrollments WHERE user_id=? ORDER BY last_accessed_at DESC, enrolled_at DESC`, u.id);
    const cards = enrolled.map((e) => courseCard(courseRow(Number(e.course_id))!, u.id));
    const inProgress = cards.filter((c) => c.enrollment?.status === 'active');
    const lessonsDone = Number(q.get(`SELECT COUNT(*) n FROM lesson_progress WHERE user_id=? AND status='completed'`, u.id)!.n);
    const seconds = Number(q.get('SELECT COALESCE(SUM(time_spent),0) n FROM lesson_progress WHERE user_id=?', u.id)!.n);
    // last 7 days activity (lessons completed + minutes)
    const days: { date: string; label: string; lessons: number; minutes: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(Date.now() - i * 864e5);
      const date = d.toISOString().slice(0, 10);
      const n = Number(q.get(`SELECT COUNT(*) n FROM lesson_progress WHERE user_id=? AND status='completed' AND date(completed_at)=?`, u.id, date)!.n);
      const s = Number(q.get(`SELECT COALESCE(SUM(time_spent),0) n FROM lesson_progress WHERE user_id=? AND date(updated_at)=?`, u.id, date)!.n);
      days.push({ date, label: d.toLocaleDateString('en-US', { weekday: 'short', timeZone: 'UTC' }), lessons: n, minutes: Math.round(s / 60) });
    }
    const due = cards
      .filter((c) => c.enrollment?.status === 'active' && c.enrollment.dueDate)
      .map((c) => ({ courseId: c.id, title: c.title, theme: c.theme, dueDate: c.enrollment!.dueDate!, progress: c.enrollment!.progress }))
      .sort((a, b) => a.dueDate.localeCompare(b.dueDate));
    const recommended = courseRows(`c.status='published' AND c.id NOT IN (SELECT course_id FROM enrollments WHERE user_id=?)`, [u.id], 'ORDER BY c.featured DESC, enrolled_count DESC LIMIT 4').map((c) => courseCard(c, u.id));
    const badgeCount = Number(q.get('SELECT COUNT(*) n FROM user_badges WHERE user_id=?', u.id)!.n);
    const rank = Number(q.get(`SELECT COUNT(*)+1 n FROM users WHERE role='learner' AND status='active' AND xp > ?`, u.xp)!.n);
    res.json({
      stats: {
        xp: u.xp,
        ...levelFromXp(u.xp),
        streak: u.last_active_date === todayStr() || u.last_active_date === new Date(Date.now() - 864e5).toISOString().slice(0, 10) ? u.streak : 0,
        longestStreak: u.longest_streak,
        lessonsCompleted: lessonsDone,
        coursesCompleted: cards.filter((c) => c.enrollment?.status === 'completed').length,
        coursesActive: inProgress.length,
        hours: Math.round((seconds / 3600) * 10) / 10,
        badges: badgeCount,
        totalBadges: BADGES.length,
        rank,
      },
      continueLearning: inProgress.slice(0, 4),
      activeCourses: inProgress,
      week: days,
      due: due.slice(0, 5),
      live: liveSessions(u.id).filter((s) => Date.parse(s.startsAt) + (s.durationMin ?? 60) * 60000 > Date.now()).slice(0, 4),
      announcements: announcementsFor(u.id, 3),
      recommended,
    });
  }),
);

meRouter.get(
  '/learning',
  wrap((req, res) => {
    const u = req.user!;
    const enrolled = q.all(`SELECT course_id FROM enrollments WHERE user_id=? ORDER BY last_accessed_at DESC, enrolled_at DESC`, u.id);
    const enrolledCards = enrolled.map((e) => courseCard(courseRow(Number(e.course_id))!, u.id));
    const saved = q.all(`SELECT course_id FROM bookmarks WHERE user_id=? ORDER BY created_at DESC`, u.id).map((b) => courseCard(courseRow(Number(b.course_id))!, u.id));
    res.json({
      inProgress: enrolledCards.filter((c) => c.enrollment?.status === 'active'),
      completed: enrolledCards.filter((c) => c.enrollment?.status === 'completed'),
      saved,
    });
  }),
);

meRouter.get('/certificates', (req, res) => {
  const rows = q.all(
    `SELECT ce.*, c.title, c.theme, c.id cid, i.name instructor FROM certificates ce JOIN courses c ON c.id=ce.course_id LEFT JOIN users i ON i.id=c.instructor_id WHERE ce.user_id=? ORDER BY ce.id DESC`,
    req.user!.id,
  );
  const s = getSettings();
  res.json(rows.map((r) => ({ id: r.id, code: r.code, courseId: r.cid, course: r.title, theme: r.theme, instructor: r.instructor, score: r.score, issuedAt: iso(r.issued_at), learner: req.user!.name, signer: s.certificateSigner, signerTitle: s.certificateSignerTitle, platform: s.platformName })));
});

meRouter.get('/achievements', (req, res) => {
  const earned = new Map(q.all('SELECT badge, earned_at FROM user_badges WHERE user_id=?', req.user!.id).map((r) => [r.badge, r.earned_at]));
  const xp = q.all('SELECT amount, reason, created_at FROM xp_events WHERE user_id=? ORDER BY id DESC LIMIT 15', req.user!.id);
  res.json({
    badges: BADGES.map((b) => ({ key: b.key, name: b.name, description: b.description, icon: b.icon, tone: b.tone, earnedAt: iso(earned.get(b.key)) })),
    recentXp: xp.map((x) => ({ amount: x.amount, reason: x.reason, createdAt: iso(x.created_at) })),
    ...levelFromXp(req.user!.xp),
    xp: req.user!.xp,
    streak: req.user!.streak,
    longestStreak: req.user!.longest_streak,
  });
});

meRouter.get('/notifications', (req, res) => {
  const rows = q.all('SELECT * FROM notifications WHERE user_id=? ORDER BY id DESC LIMIT 50', req.user!.id);
  res.json({
    unread: Number(q.get('SELECT COUNT(*) n FROM notifications WHERE user_id=? AND read=0', req.user!.id)!.n),
    items: rows.map((n) => ({ id: n.id, type: n.type, title: n.title, body: n.body, link: n.link, read: !!n.read, createdAt: iso(n.created_at) })),
  });
});
meRouter.post('/notifications/read', (req, res) => {
  const id = Number(req.body?.id);
  if (id) q.run('UPDATE notifications SET read=1 WHERE id=? AND user_id=?', id, req.user!.id);
  else q.run('UPDATE notifications SET read=1 WHERE user_id=?', req.user!.id);
  res.json({ ok: true });
});

meRouter.get('/announcements', (req, res) => res.json(announcementsFor(req.user!.id, 30)));

meRouter.get('/calendar', (req, res) => {
  const u = req.user!;
  const events: any[] = liveSessions(u.id).map((s) => ({ type: 'live', title: s.title, subtitle: s.courseTitle, at: s.startsAt, durationMin: s.durationMin, link: `/courses/${s.courseId}/learn/${s.lessonId}`, joinUrl: s.joinUrl, platform: s.platform }));
  for (const e of q.all(`SELECT e.due_date, e.progress, c.id, c.title FROM enrollments e JOIN courses c ON c.id=e.course_id WHERE e.user_id=? AND e.due_date IS NOT NULL AND e.status='active'`, u.id)) {
    events.push({ type: 'due', title: `Due: ${e.title}`, subtitle: `${e.progress}% complete`, at: `${e.due_date}T23:59:00Z`, link: `/courses/${e.id}`, allDay: true });
  }
  res.json(events.sort((a, b) => Date.parse(a.at) - Date.parse(b.at)));
});

meRouter.get(
  '/certificates/:id',
  wrap((req, res) => {
    const r = q.get('SELECT 1 x FROM certificates WHERE id=? AND user_id=?', intParam(req, 'id'), req.user!.id);
    if (!r) throw notFound();
    res.json({ ok: true });
  }),
);

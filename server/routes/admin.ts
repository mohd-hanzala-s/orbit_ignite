import { Router } from 'express';
import { requireRole, hashPassword, publicUser } from '../auth.ts';
import { q, bad, notFound, intParam, wrap, log, iso, str, notify, getSettings, setSetting, DEFAULT_SETTINGS, clamp, bool } from '../util.ts';
import { tx, parseJson } from '../db.ts';
import { ensureEnrollment, recomputeEnrollment } from '../services/learning.ts';
import { courseRow, courseCard } from '../services/courses.ts';
import { COURSE_THEMES, ROLES } from '../../shared/constants.ts';

export const adminRouter = Router();
const staff = requireRole('admin', 'instructor');
const adminOnly = requireRole('admin');

/* ───────── dashboard ───────── */
adminRouter.get(
  '/stats',
  staff,
  wrap((req, res) => {
    const isAdm = req.user!.role === 'admin';
    const uid = req.user!.id;
    const scope = isAdm ? '1=1' : 'c.instructor_id=?';
    const sp = isAdm ? [] : [uid];
    const n = (sql: string, ...p: any[]) => Number(q.get(sql, ...p)!.n);
    const enrollWhere = `FROM enrollments e JOIN courses c ON c.id=e.course_id WHERE ${scope}`;
    const totalEnroll = n(`SELECT COUNT(*) n ${enrollWhere}`, ...sp);
    const completed = n(`SELECT COUNT(*) n ${enrollWhere} AND e.status='completed'`, ...sp);
    const activeLearners = n(`SELECT COUNT(DISTINCT lp.user_id) n FROM lesson_progress lp JOIN courses c ON c.id=lp.course_id WHERE ${scope} AND lp.updated_at >= datetime('now','-7 days')`, ...sp);
    const trend: { date: string; label: string; enrollments: number; completions: number }[] = [];
    for (let i = 29; i >= 0; i--) {
      const d = new Date(Date.now() - i * 864e5).toISOString().slice(0, 10);
      trend.push({
        date: d,
        label: d.slice(5),
        enrollments: n(`SELECT COUNT(*) n ${enrollWhere} AND date(e.enrolled_at)=?`, ...sp, d),
        completions: n(`SELECT COUNT(*) n ${enrollWhere} AND date(e.completed_at)=?`, ...sp, d),
      });
    }
    const top = q.all(
      `SELECT c.id, c.title, c.theme, COUNT(e.id) enrolled, SUM(CASE WHEN e.status='completed' THEN 1 ELSE 0 END) done, ROUND(AVG(e.progress)) avg_progress
       FROM courses c LEFT JOIN enrollments e ON e.course_id=c.id WHERE ${scope} GROUP BY c.id ORDER BY enrolled DESC LIMIT 6`, ...sp,
    ).map((r) => ({ id: r.id, title: r.title, theme: r.theme, enrolled: Number(r.enrolled), completed: Number(r.done ?? 0), avgProgress: Number(r.avg_progress ?? 0) }));
    const recent = q.all(
      `SELECT a.*, u.name, u.avatar_color FROM activity a LEFT JOIN users u ON u.id=a.user_id ORDER BY a.id DESC LIMIT 12`,
    ).map((a) => ({ id: a.id, action: a.action, user: a.name ?? 'System', avatarColor: a.avatar_color ?? 'violet', entity: a.entity, entityId: a.entity_id, meta: parseJson(a.meta, {}), createdAt: iso(a.created_at) }));
    const avgScore = q.get(`SELECT ROUND(AVG(qa.percent)) a FROM quiz_attempts qa JOIN lessons l ON l.id=qa.lesson_id JOIN courses c ON c.id=l.course_id WHERE ${scope}`, ...sp)?.a;
    const catBreak = q.all(
      `SELECT COALESCE(cat.name,'Uncategorized') name, COALESCE(cat.color,'violet') color, COUNT(e.id) n FROM courses c LEFT JOIN categories cat ON cat.id=c.category_id LEFT JOIN enrollments e ON e.course_id=c.id WHERE ${scope} GROUP BY cat.id HAVING n>0 ORDER BY n DESC`, ...sp,
    ).map((r) => ({ name: r.name, color: r.color, value: Number(r.n) }));
    res.json({
      kpis: {
        learners: n(`SELECT COUNT(*) n FROM users WHERE role='learner' AND status='active'`),
        courses: n(`SELECT COUNT(*) n FROM courses c WHERE ${scope} AND c.status='published'`, ...sp),
        draftCourses: n(`SELECT COUNT(*) n FROM courses c WHERE ${scope} AND c.status='draft'`, ...sp),
        enrollments: totalEnroll,
        completions: completed,
        completionRate: totalEnroll ? Math.round((completed / totalEnroll) * 100) : 0,
        activeLearners,
        avgScore: avgScore != null ? Number(avgScore) : null,
        pendingGrading: n(`SELECT COUNT(*) n FROM submissions s JOIN lessons l ON l.id=s.lesson_id JOIN courses c ON c.id=l.course_id WHERE s.status='submitted' AND ${scope}`, ...sp),
        certificates: n(`SELECT COUNT(*) n FROM certificates ce JOIN courses c ON c.id=ce.course_id WHERE ${scope}`, ...sp),
      },
      trend,
      topCourses: top,
      categories: catBreak,
      recent: isAdm ? recent : [],
    });
  }),
);

/* ───────── users ───────── */
const userRow = (u: any) => ({
  ...publicUser(u),
  enrollments: Number(u.enr ?? 0),
  completed: Number(u.done ?? 0),
});

adminRouter.get(
  '/users',
  adminOnly,
  wrap((req, res) => {
    const s = `%${str(req.query.q, 80)}%`;
    const role = ROLES.includes(req.query.role as any) ? (req.query.role as string) : '';
    const status = ['active', 'inactive'].includes(req.query.status as string) ? (req.query.status as string) : '';
    const rows = q.all(
      `SELECT u.*, (SELECT COUNT(*) FROM enrollments e WHERE e.user_id=u.id) enr, (SELECT COUNT(*) FROM enrollments e WHERE e.user_id=u.id AND e.status='completed') done
       FROM users u WHERE (u.name LIKE ? OR u.email LIKE ? OR u.department LIKE ?) AND (?='' OR u.role=?) AND (?='' OR u.status=?) ORDER BY u.id DESC LIMIT 1000`,
      s, s, s, role, role, status, status,
    );
    res.json(rows.map(userRow));
  }),
);

adminRouter.get('/users/options', staff, (_req, res) => {
  res.json(q.all(`SELECT id, name, email, role, avatar_color FROM users WHERE status='active' ORDER BY name`).map((u) => ({ id: u.id, name: u.name, email: u.email, role: u.role, avatarColor: u.avatar_color })));
});

adminRouter.get(
  '/users/:id',
  adminOnly,
  wrap((req, res) => {
    const u = q.get('SELECT * FROM users WHERE id=?', intParam(req, 'id'));
    if (!u) throw notFound('User not found');
    const enrollments = q.all(`SELECT e.* FROM enrollments e WHERE e.user_id=? ORDER BY e.enrolled_at DESC`, u.id).map((e) => ({ ...courseCard(courseRow(Number(e.course_id))!, u.id), enrollmentId: e.id, source: e.source }));
    const badges = q.all('SELECT badge, earned_at FROM user_badges WHERE user_id=?', u.id);
    const groups = q.all('SELECT g.id, g.name, g.color FROM groups g JOIN group_members m ON m.group_id=g.id WHERE m.user_id=?', u.id);
    const activity = q.all('SELECT action, entity, entity_id, created_at FROM activity WHERE user_id=? ORDER BY id DESC LIMIT 15', u.id).map((a) => ({ action: a.action, entity: a.entity, entityId: a.entity_id, createdAt: iso(a.created_at) }));
    res.json({ ...publicUser(u), enrollments, badges, groups, activity });
  }),
);

function userInput(b: any, creating: boolean) {
  const name = str(b.name, 80);
  const email = str(b.email, 160).toLowerCase();
  if (creating || b.name !== undefined) if (name.length < 2) throw bad('Name must be at least 2 characters');
  if (creating || b.email !== undefined) if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw bad('Enter a valid email address');
  const role = b.role === undefined ? undefined : (ROLES as readonly string[]).includes(b.role) ? b.role : (() => { throw bad('Invalid role'); })();
  return { name, email, role };
}

adminRouter.post(
  '/users',
  adminOnly,
  wrap((req, res) => {
    const b = req.body ?? {};
    const f = userInput(b, true);
    const password = typeof b.password === 'string' && b.password.length >= 8 ? b.password : null;
    if (!password) throw bad('Password must be at least 8 characters');
    if (q.get('SELECT 1 x FROM users WHERE email=?', f.email)) throw bad('A user with this email already exists');
    const r = q.run('INSERT INTO users(email, name, password_hash, role, title, department, avatar_color) VALUES (?,?,?,?,?,?,?)', f.email, f.name, hashPassword(password), f.role ?? 'learner', str(b.title, 80), str(b.department, 80), ['violet', 'cyan', 'amber', 'pink', 'emerald', 'blue', 'orange'][Math.floor(Math.random() * 7)]);
    notify(r.id, 'Welcome to Orbit Ignite 🚀', 'Your account is ready. Explore the catalog to begin.', '/catalog');
    log(req.user!.id, 'user.created', 'user', r.id, { email: f.email });
    res.status(201).json({ id: r.id });
  }),
);

adminRouter.patch(
  '/users/:id',
  adminOnly,
  wrap((req, res) => {
    const id = intParam(req, 'id');
    const u = q.get('SELECT * FROM users WHERE id=?', id);
    if (!u) throw notFound('User not found');
    const b = req.body ?? {};
    const f = userInput(b, false);
    const status = b.status === 'inactive' ? 'inactive' : b.status === 'active' ? 'active' : u.status;
    const role = f.role ?? u.role;
    if (id === req.user!.id && (status !== 'active' || role !== 'admin')) throw bad('You cannot deactivate or demote your own account.');
    if (f.email && f.email !== u.email && q.get('SELECT 1 x FROM users WHERE email=? AND id<>?', f.email, id)) throw bad('That email is already in use');
    q.run('UPDATE users SET name=?, email=?, role=?, status=?, title=?, department=? WHERE id=?', f.name || u.name, f.email || u.email, role, status, b.title !== undefined ? str(b.title, 80) : u.title, b.department !== undefined ? str(b.department, 80) : u.department, id);
    if (typeof b.password === 'string' && b.password) {
      if (b.password.length < 8) throw bad('Password must be at least 8 characters');
      q.run('UPDATE users SET password_hash=? WHERE id=?', hashPassword(b.password), id);
      q.run('DELETE FROM sessions WHERE user_id=?', id);
    }
    if (status !== 'active') q.run('DELETE FROM sessions WHERE user_id=?', id);
    log(req.user!.id, 'user.updated', 'user', id);
    res.json({ ok: true });
  }),
);

adminRouter.delete(
  '/users/:id',
  adminOnly,
  wrap((req, res) => {
    const id = intParam(req, 'id');
    if (id === req.user!.id) throw bad('You cannot delete your own account.');
    const u = q.get('SELECT * FROM users WHERE id=?', id);
    if (!u) throw notFound('User not found');
    q.run('DELETE FROM users WHERE id=?', id);
    log(req.user!.id, 'user.deleted', 'user', id, { email: u.email });
    res.json({ ok: true });
  }),
);

/** Bulk import: rows [{name,email,role?,department?,password?}] */
adminRouter.post(
  '/users/import',
  adminOnly,
  wrap((req, res) => {
    const rows = Array.isArray(req.body?.rows) ? req.body.rows.slice(0, 2000) : [];
    if (!rows.length) throw bad('No rows to import');
    let created = 0;
    const errors: { row: number; error: string }[] = [];
    rows.forEach((r: any, i: number) => {
      try {
        const f = userInput({ ...r, role: r.role || 'learner' }, true);
        if (q.get('SELECT 1 x FROM users WHERE email=?', f.email)) throw bad('Email already exists');
        const pw = typeof r.password === 'string' && r.password.length >= 8 ? r.password : 'Orbit' + Math.random().toString(36).slice(2, 10) + '!';
        q.run('INSERT INTO users(email, name, password_hash, role, department, avatar_color) VALUES (?,?,?,?,?,?)', f.email, f.name, hashPassword(pw), f.role ?? 'learner', str(r.department, 80), 'cyan');
        created++;
      } catch (e: any) {
        errors.push({ row: i + 1, error: e.message });
      }
    });
    log(req.user!.id, 'user.imported', 'user', undefined, { created });
    res.json({ created, errors });
  }),
);

/* ───────── enrollments ───────── */
adminRouter.get(
  '/enrollments',
  staff,
  wrap((req, res) => {
    const courseId = Number(req.query.courseId) || 0;
    const status = typeof req.query.status === 'string' ? req.query.status : '';
    const s = `%${str(req.query.q, 80)}%`;
    const rows = q.all(
      `SELECT e.*, u.name, u.email, u.avatar_color, c.title course_title, c.theme, c.instructor_id FROM enrollments e JOIN users u ON u.id=e.user_id JOIN courses c ON c.id=e.course_id
       WHERE (?=0 OR e.course_id=?) AND (?='' OR e.status=?) AND (u.name LIKE ? OR u.email LIKE ? OR c.title LIKE ?) AND (?='admin' OR c.instructor_id=?)
       ORDER BY e.enrolled_at DESC LIMIT 1000`,
      courseId, courseId, status, status, s, s, s, req.user!.role, req.user!.id,
    );
    res.json(rows.map((e) => ({
      id: e.id, userId: e.user_id, user: e.name, email: e.email, avatarColor: e.avatar_color, courseId: e.course_id, course: e.course_title, theme: e.theme,
      status: e.status, progress: e.progress, source: e.source, dueDate: e.due_date, enrolledAt: iso(e.enrolled_at), completedAt: iso(e.completed_at), lastAccessedAt: iso(e.last_accessed_at),
      overdue: e.status === 'active' && !!e.due_date && e.due_date < new Date().toISOString().slice(0, 10),
    })));
  }),
);

adminRouter.post(
  '/enrollments',
  staff,
  wrap((req, res) => {
    const courseId = Number(req.body?.courseId);
    const c = courseRow(courseId);
    if (!c) throw notFound('Course not found');
    if (req.user!.role !== 'admin' && c.instructor_id !== req.user!.id) throw bad('You can only enroll learners in your own courses');
    const userIds: number[] = (Array.isArray(req.body?.userIds) ? req.body.userIds : []).map(Number).filter(Boolean);
    const groupId = Number(req.body?.groupId) || 0;
    if (groupId) userIds.push(...q.all('SELECT user_id FROM group_members WHERE group_id=?', groupId).map((r) => Number(r.user_id)));
    if (!userIds.length) throw bad('Pick at least one learner or a group');
    const due = typeof req.body?.dueDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(req.body.dueDate) ? req.body.dueDate : null;
    let added = 0;
    tx(() => {
      for (const uid of new Set(userIds)) {
        if (!q.get(`SELECT 1 x FROM users WHERE id=? AND status='active'`, uid)) continue;
        if (ensureEnrollment(uid, courseId, groupId ? 'group' : 'assigned', req.user!.id, due)) {
          added++;
          notify(uid, `New mission assigned: ${c.title}`, due ? `Due ${due}` : 'Ready when you are.', `/courses/${courseId}`, 'assignment');
        }
      }
    });
    log(req.user!.id, 'enrollment.assigned', 'course', courseId, { added });
    res.status(201).json({ added });
  }),
);

adminRouter.patch(
  '/enrollments/:id',
  staff,
  wrap((req, res) => {
    const e = q.get('SELECT e.*, c.instructor_id FROM enrollments e JOIN courses c ON c.id=e.course_id WHERE e.id=?', intParam(req, 'id'));
    if (!e) throw notFound();
    if (req.user!.role !== 'admin' && e.instructor_id !== req.user!.id) throw bad('Not your course');
    const due = req.body?.dueDate === null ? null : typeof req.body?.dueDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(req.body.dueDate) ? req.body.dueDate : e.due_date;
    q.run('UPDATE enrollments SET due_date=? WHERE id=?', due, e.id);
    if (req.body?.reset) {
      q.run('DELETE FROM lesson_progress WHERE user_id=? AND course_id=?', e.user_id, e.course_id);
      q.run(`UPDATE enrollments SET status='active', progress=0, completed_at=NULL WHERE id=?`, e.id);
    }
    res.json({ ok: true });
  }),
);

adminRouter.delete(
  '/enrollments/:id',
  staff,
  wrap((req, res) => {
    const e = q.get('SELECT e.*, c.instructor_id FROM enrollments e JOIN courses c ON c.id=e.course_id WHERE e.id=?', intParam(req, 'id'));
    if (!e) throw notFound();
    if (req.user!.role !== 'admin' && e.instructor_id !== req.user!.id) throw bad('Not your course');
    q.run('DELETE FROM enrollments WHERE id=?', e.id);
    q.run('DELETE FROM lesson_progress WHERE user_id=? AND course_id=?', e.user_id, e.course_id);
    res.json({ ok: true });
  }),
);

/* ───────── groups ───────── */
const groupDto = (g: any) => ({
  id: g.id, name: g.name, description: g.description, color: g.color,
  members: q.all('SELECT u.id, u.name, u.email, u.avatar_color FROM group_members m JOIN users u ON u.id=m.user_id WHERE m.group_id=? ORDER BY u.name', g.id).map((u) => ({ id: u.id, name: u.name, email: u.email, avatarColor: u.avatar_color })),
  courses: q.all('SELECT c.id, c.title, c.theme, gc.due_days FROM group_courses gc JOIN courses c ON c.id=gc.course_id WHERE gc.group_id=?', g.id).map((c) => ({ id: c.id, title: c.title, theme: c.theme, dueDays: c.due_days })),
});
adminRouter.get('/groups', adminOnly, (_req, res) => res.json(q.all('SELECT * FROM groups ORDER BY name').map(groupDto)));
adminRouter.post('/groups', adminOnly, wrap((req, res) => {
  const name = str(req.body?.name, 80);
  if (!name) throw bad('Group name is required');
  if (q.get('SELECT 1 x FROM groups WHERE name=?', name)) throw bad('A group with that name exists');
  const r = q.run('INSERT INTO groups(name, description, color) VALUES (?,?,?)', name, str(req.body?.description, 300), str(req.body?.color, 20) || 'cyan');
  res.status(201).json({ id: r.id });
}));
adminRouter.patch('/groups/:id', adminOnly, wrap((req, res) => {
  const g = q.get('SELECT * FROM groups WHERE id=?', intParam(req, 'id'));
  if (!g) throw notFound();
  const name = req.body?.name !== undefined ? str(req.body.name, 80) : g.name;
  if (!name) throw bad('Group name is required');
  if (q.get('SELECT 1 x FROM groups WHERE name=? AND id<>?', name, g.id)) throw bad('A group with that name exists');
  q.run('UPDATE groups SET name=?, description=?, color=? WHERE id=?', name, req.body?.description !== undefined ? str(req.body.description, 300) : g.description, str(req.body?.color, 20) || g.color, g.id);
  res.json({ ok: true });
}));
adminRouter.delete('/groups/:id', adminOnly, wrap((req, res) => { q.run('DELETE FROM groups WHERE id=?', intParam(req, 'id')); res.json({ ok: true }); }));
adminRouter.put('/groups/:id/members', adminOnly, wrap((req, res) => {
  const id = intParam(req, 'id');
  if (!q.get('SELECT 1 x FROM groups WHERE id=?', id)) throw notFound();
  const ids: number[] = (Array.isArray(req.body?.userIds) ? req.body.userIds : []).map(Number).filter(Boolean);
  const before = new Set(q.all('SELECT user_id FROM group_members WHERE group_id=?', id).map((r) => Number(r.user_id)));
  tx(() => {
    q.run('DELETE FROM group_members WHERE group_id=?', id);
    for (const uid of new Set(ids)) if (q.get('SELECT 1 x FROM users WHERE id=?', uid)) q.run('INSERT INTO group_members(group_id, user_id) VALUES (?,?)', id, uid);
    // newly added members inherit the group's course assignments
    for (const uid of new Set(ids)) if (!before.has(uid)) for (const gc of q.all('SELECT * FROM group_courses WHERE group_id=?', id)) {
      const due = gc.due_days ? new Date(Date.now() + gc.due_days * 864e5).toISOString().slice(0, 10) : null;
      ensureEnrollment(uid, Number(gc.course_id), 'group', req.user!.id, due);
    }
  });
  res.json({ ok: true });
}));
adminRouter.put('/groups/:id/courses', adminOnly, wrap((req, res) => {
  const id = intParam(req, 'id');
  if (!q.get('SELECT 1 x FROM groups WHERE id=?', id)) throw notFound();
  const items: { courseId: number; dueDays?: number | null }[] = Array.isArray(req.body?.courses) ? req.body.courses : [];
  tx(() => {
    q.run('DELETE FROM group_courses WHERE group_id=?', id);
    for (const it of items) {
      const cid = Number(it.courseId);
      if (!courseRow(cid)) continue;
      const days = it.dueDays ? clamp(Number(it.dueDays), 1, 3650) : null;
      q.run('INSERT OR REPLACE INTO group_courses(group_id, course_id, due_days) VALUES (?,?,?)', id, cid, days);
      const due = days ? new Date(Date.now() + days * 864e5).toISOString().slice(0, 10) : null;
      for (const m of q.all('SELECT user_id FROM group_members WHERE group_id=?', id)) ensureEnrollment(Number(m.user_id), cid, 'group', req.user!.id, due);
    }
  });
  res.json({ ok: true });
}));

/* ───────── categories ───────── */
const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
adminRouter.post('/categories', adminOnly, wrap((req, res) => {
  const name = str(req.body?.name, 60);
  if (!name) throw bad('Category name is required');
  if (q.get('SELECT 1 x FROM categories WHERE name=? OR slug=?', name, slug(name))) throw bad('That category exists');
  res.status(201).json({ id: q.run('INSERT INTO categories(name, slug, color) VALUES (?,?,?)', name, slug(name), str(req.body?.color, 20) || 'violet').id });
}));
adminRouter.patch('/categories/:id', adminOnly, wrap((req, res) => {
  const id = intParam(req, 'id');
  const c = q.get('SELECT * FROM categories WHERE id=?', id);
  if (!c) throw notFound();
  const name = str(req.body?.name, 60) || c.name;
  if (q.get('SELECT 1 x FROM categories WHERE (name=? OR slug=?) AND id<>?', name, slug(name), id)) throw bad('That category exists');
  q.run('UPDATE categories SET name=?, slug=?, color=? WHERE id=?', name, slug(name), str(req.body?.color, 20) || c.color, id);
  res.json({ ok: true });
}));
adminRouter.delete('/categories/:id', adminOnly, wrap((req, res) => { q.run('DELETE FROM categories WHERE id=?', intParam(req, 'id')); res.json({ ok: true }); }));

/* ───────── learning paths ───────── */
adminRouter.get('/paths', staff, (_req, res) => {
  res.json(q.all('SELECT * FROM paths ORDER BY id DESC').map((p) => ({
    id: p.id, title: p.title, description: p.description, theme: p.theme, status: p.status,
    courses: q.all('SELECT c.id, c.title, c.theme FROM path_courses pc JOIN courses c ON c.id=pc.course_id WHERE pc.path_id=? ORDER BY pc.position', p.id),
    learners: Number(q.get('SELECT COUNT(*) n FROM path_enrollments WHERE path_id=?', p.id)!.n),
  })));
});
function savePath(id: number | null, b: any) {
  const title = str(b.title, 120);
  if (!title) throw bad('Path title is required');
  const theme = (COURSE_THEMES as readonly string[]).includes(b.theme) ? b.theme : 'nebula';
  const status = b.status === 'published' ? 'published' : 'draft';
  return tx(() => {
    const pid = id ?? q.run('INSERT INTO paths(title, description, theme, status) VALUES (?,?,?,?)', title, str(b.description, 1000), theme, status).id;
    if (id) q.run('UPDATE paths SET title=?, description=?, theme=?, status=? WHERE id=?', title, str(b.description, 1000), theme, status, id);
    q.run('DELETE FROM path_courses WHERE path_id=?', pid);
    (Array.isArray(b.courseIds) ? b.courseIds : []).map(Number).filter((c: number) => courseRow(c)).forEach((cid: number, i: number) => q.run('INSERT OR IGNORE INTO path_courses(path_id, course_id, position) VALUES (?,?,?)', pid, cid, i));
    return pid;
  });
}
adminRouter.post('/paths', adminOnly, wrap((req, res) => res.status(201).json({ id: savePath(null, req.body ?? {}) })));
adminRouter.put('/paths/:id', adminOnly, wrap((req, res) => {
  const id = intParam(req, 'id');
  if (!q.get('SELECT 1 x FROM paths WHERE id=?', id)) throw notFound();
  savePath(id, req.body ?? {});
  res.json({ ok: true });
}));
adminRouter.delete('/paths/:id', adminOnly, wrap((req, res) => { q.run('DELETE FROM paths WHERE id=?', intParam(req, 'id')); res.json({ ok: true }); }));

/* ───────── announcements ───────── */
adminRouter.get('/announcements', adminOnly, (_req, res) => {
  res.json(q.all('SELECT a.*, u.name author FROM announcements a LEFT JOIN users u ON u.id=a.author_id ORDER BY a.id DESC LIMIT 100').map((a) => ({ id: a.id, title: a.title, body: a.body, audience: a.audience, targetId: a.target_id, pinned: !!a.pinned, author: a.author, createdAt: iso(a.created_at) })));
});
adminRouter.post('/announcements', adminOnly, wrap((req, res) => {
  const title = str(req.body?.title, 140);
  const body = str(req.body?.body, 5000);
  if (!title || !body) throw bad('Title and message are required');
  const audience = ['all', 'course', 'group'].includes(req.body?.audience) ? req.body.audience : 'all';
  const target = audience === 'all' ? null : Number(req.body?.targetId) || null;
  if (audience !== 'all' && !target) throw bad('Pick who should receive this announcement');
  const r = q.run('INSERT INTO announcements(title, body, audience, target_id, pinned, author_id) VALUES (?,?,?,?,?,?)', title, body, audience, target, bool(req.body?.pinned), req.user!.id);
  const recipients = audience === 'all' ? q.all(`SELECT id user_id FROM users WHERE status='active'`) : audience === 'course' ? q.all('SELECT user_id FROM enrollments WHERE course_id=?', target) : q.all('SELECT user_id FROM group_members WHERE group_id=?', target);
  for (const u of recipients) notify(Number(u.user_id), title, body.slice(0, 140), '/', 'announcement');
  res.status(201).json({ id: r.id, notified: recipients.length });
}));
adminRouter.delete('/announcements/:id', adminOnly, wrap((req, res) => { q.run('DELETE FROM announcements WHERE id=?', intParam(req, 'id')); res.json({ ok: true }); }));

/* ───────── settings & activity ───────── */
adminRouter.get('/settings', adminOnly, (_req, res) => res.json(getSettings()));
adminRouter.put('/settings', adminOnly, wrap((req, res) => {
  const b = req.body ?? {};
  const next: Record<string, any> = { ...getSettings() };
  for (const k of Object.keys(DEFAULT_SETTINGS) as (keyof typeof DEFAULT_SETTINGS)[]) {
    if (b[k] === undefined) continue;
    next[k] = typeof DEFAULT_SETTINGS[k] === 'boolean' ? !!b[k] : str(b[k], 200);
  }
  if (!next.platformName) throw bad('Platform name is required');
  setSetting('platform', next);
  log(req.user!.id, 'settings.updated', 'settings');
  res.json(next);
}));
adminRouter.get('/activity', adminOnly, (req, res) => {
  const limit = clamp(Number(req.query.limit) || 100, 1, 500);
  res.json(q.all('SELECT a.*, u.name, u.avatar_color FROM activity a LEFT JOIN users u ON u.id=a.user_id ORDER BY a.id DESC LIMIT ?', limit).map((a) => ({ id: a.id, action: a.action, user: a.name ?? 'System', avatarColor: a.avatar_color ?? 'violet', entity: a.entity, entityId: a.entity_id, meta: parseJson(a.meta, {}), createdAt: iso(a.created_at) })));
});

/* ───────── reports ───────── */
function reportCourses(req: any) {
  return q.all(
    `SELECT c.id, c.title, c.status, cat.name category,
       COUNT(e.id) enrolled, SUM(CASE WHEN e.status='completed' THEN 1 ELSE 0 END) completed, ROUND(AVG(e.progress)) avg_progress,
       (SELECT ROUND(AVG(qa.percent)) FROM quiz_attempts qa JOIN lessons l ON l.id=qa.lesson_id WHERE l.course_id=c.id) avg_score,
       (SELECT ROUND(AVG(rating),1) FROM reviews r WHERE r.course_id=c.id) rating
     FROM courses c LEFT JOIN categories cat ON cat.id=c.category_id LEFT JOIN enrollments e ON e.course_id=c.id
     WHERE (?='admin' OR c.instructor_id=?) GROUP BY c.id ORDER BY enrolled DESC`,
    req.user.role, req.user.id,
  ).map((r) => ({ id: r.id, title: r.title, status: r.status, category: r.category ?? '—', enrolled: Number(r.enrolled), completed: Number(r.completed ?? 0), completionRate: Number(r.enrolled) ? Math.round((Number(r.completed ?? 0) / Number(r.enrolled)) * 100) : 0, avgProgress: Number(r.avg_progress ?? 0), avgScore: r.avg_score != null ? Number(r.avg_score) : null, rating: r.rating != null ? Number(r.rating) : null }));
}
function reportLearners(req: any) {
  return q.all(
    `SELECT u.id, u.name, u.email, u.department, u.xp, u.last_login_at,
       COUNT(e.id) enrolled, SUM(CASE WHEN e.status='completed' THEN 1 ELSE 0 END) completed, ROUND(AVG(e.progress)) avg_progress,
       SUM(CASE WHEN e.status='active' AND e.due_date < date('now') THEN 1 ELSE 0 END) overdue
     FROM users u JOIN enrollments e ON e.user_id=u.id JOIN courses c ON c.id=e.course_id
     WHERE u.role='learner' AND (?='admin' OR c.instructor_id=?) GROUP BY u.id ORDER BY completed DESC, avg_progress DESC LIMIT 1000`,
    req.user.role, req.user.id,
  ).map((r) => ({ id: r.id, name: r.name, email: r.email, department: r.department ?? '', xp: r.xp, enrolled: Number(r.enrolled), completed: Number(r.completed ?? 0), avgProgress: Number(r.avg_progress ?? 0), overdue: Number(r.overdue ?? 0), lastLoginAt: iso(r.last_login_at) }));
}
adminRouter.get('/reports/courses', staff, (req, res) => res.json(reportCourses(req)));
adminRouter.get('/reports/learners', staff, (req, res) => res.json(reportLearners(req)));

const csvCell = (v: unknown) => {
  let s = v == null ? '' : String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = "'" + s; // neutralise spreadsheet formulas
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
adminRouter.get('/reports/export/:type', staff, wrap((req, res) => {
  const type = String(req.params.type);
  let rows: Record<string, any>[];
  if (type === 'courses') rows = reportCourses(req);
  else if (type === 'learners') rows = reportLearners(req);
  else if (type === 'enrollments') {
    rows = q.all(`SELECT u.name learner, u.email, c.title course, e.status, e.progress, e.due_date, e.enrolled_at, e.completed_at FROM enrollments e JOIN users u ON u.id=e.user_id JOIN courses c ON c.id=e.course_id WHERE (?='admin' OR c.instructor_id=?) ORDER BY e.enrolled_at DESC`, req.user!.role, req.user!.id);
  } else throw notFound('Unknown report');
  const cols = rows[0] ? Object.keys(rows[0]) : [];
  const csv = [cols.join(','), ...rows.map((r) => cols.map((c) => csvCell(r[c])).join(','))].join('\n');
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="orbit-${type}-${new Date().toISOString().slice(0, 10)}.csv"`);
  res.send('﻿' + csv);
}));

void recomputeEnrollment;

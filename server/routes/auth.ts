import { Router } from 'express';
import { z } from 'zod';
import { q, bad, wrap, log, getSettings, str } from '../util.ts';
import { hashPassword, verifyPassword, createSession, destroySession, setCookie, tokenFrom, publicUser, requireAuth, COOKIE } from '../auth.ts';
import { ensureEnrollment } from '../services/learning.ts';

export const authRouter = Router();

const AVATARS = ['violet', 'cyan', 'amber', 'pink', 'emerald', 'blue', 'orange'];

// naive in-memory throttle for login attempts
const attempts = new Map<string, { n: number; until: number }>();
function throttle(key: string) {
  const a = attempts.get(key);
  if (a && a.n >= 8 && a.until > Date.now()) throw bad('Too many attempts. Try again in a few minutes.');
}
function failed(key: string) {
  const a = attempts.get(key);
  attempts.set(key, { n: (a && a.until > Date.now() ? a.n : 0) + 1, until: Date.now() + 5 * 60_000 });
}

authRouter.get('/settings', (_req, res) => {
  const s = getSettings();
  res.json({ platformName: s.platformName, tagline: s.tagline, allowRegistration: s.allowRegistration });
});

authRouter.post(
  '/login',
  wrap((req, res) => {
    const body = z.object({ email: z.string().email(), password: z.string().min(1) }).safeParse(req.body);
    if (!body.success) throw bad('Enter a valid email and password');
    const key = body.data.email.toLowerCase();
    throttle(key);
    const u = q.get('SELECT * FROM users WHERE email=?', body.data.email);
    if (!u || !verifyPassword(body.data.password, u.password_hash)) {
      failed(key);
      throw bad('Incorrect email or password');
    }
    if (u.status !== 'active') throw bad('This account is deactivated. Contact your administrator.');
    attempts.delete(key);
    q.run(`UPDATE users SET last_login_at=datetime('now') WHERE id=?`, u.id);
    log(u.id, 'auth.login', 'user', u.id);
    setCookie(res, createSession(u.id));
    res.json({ user: publicUser(u) });
  }),
);

authRouter.post(
  '/register',
  wrap((req, res) => {
    if (!getSettings().allowRegistration) throw bad('Registration is closed. Ask an administrator for an invite.');
    const body = z
      .object({ name: z.string().trim().min(2).max(80), email: z.string().trim().email().max(160), password: z.string().min(8, 'Password must be at least 8 characters').max(200) })
      .safeParse(req.body);
    if (!body.success) throw bad(body.error.issues[0]?.message || 'Check your details');
    if (q.get('SELECT 1 x FROM users WHERE email=?', body.data.email)) throw bad('An account with this email already exists');
    const r = q.run('INSERT INTO users(email, name, password_hash, role, avatar_color) VALUES (?,?,?,?,?)', body.data.email, body.data.name, hashPassword(body.data.password), 'learner', AVATARS[Math.floor(Math.random() * AVATARS.length)]);
    // auto-enroll in any "onboarding" group courses
    for (const gc of q.all(`SELECT gc.course_id FROM group_courses gc JOIN groups g ON g.id=gc.group_id WHERE g.name='All Astronauts'`)) ensureEnrollment(r.id, gc.course_id, 'group');
    q.run('INSERT INTO notifications(user_id, type, title, body, link) VALUES (?,?,?,?,?)', r.id, 'info', 'Welcome aboard, astronaut! 🚀', 'Pick your first mission from the catalog.', '/catalog');
    log(r.id, 'auth.register', 'user', r.id);
    setCookie(res, createSession(r.id));
    res.status(201).json({ user: publicUser(q.get('SELECT * FROM users WHERE id=?', r.id)!) });
  }),
);

authRouter.post('/logout', (req, res) => {
  const t = tokenFrom(req);
  if (t) destroySession(t);
  res.clearCookie(COOKIE, { path: '/' });
  res.json({ ok: true });
});

authRouter.get('/me', (req, res) => {
  res.json({ user: req.user ? publicUser(req.user) : null });
});

authRouter.patch(
  '/me',
  requireAuth,
  wrap((req, res) => {
    const b = req.body ?? {};
    const name = str(b.name, 80);
    if (b.name !== undefined && name.length < 2) throw bad('Name is too short');
    const color = AVATARS.includes(b.avatarColor) ? b.avatarColor : req.user!.avatar_color;
    q.run('UPDATE users SET name=?, title=?, bio=?, department=?, avatar_color=? WHERE id=?', name || req.user!.name, b.title !== undefined ? str(b.title, 80) : req.user!.title, b.bio !== undefined ? str(b.bio, 500) : req.user!.bio, b.department !== undefined ? str(b.department, 80) : req.user!.department, color, req.user!.id);
    res.json({ user: publicUser(q.get('SELECT * FROM users WHERE id=?', req.user!.id)!) });
  }),
);

authRouter.post(
  '/password',
  requireAuth,
  wrap((req, res) => {
    const b = z.object({ current: z.string(), next: z.string().min(8, 'New password must be at least 8 characters').max(200) }).safeParse(req.body);
    if (!b.success) throw bad(b.error.issues[0]?.message || 'Invalid input');
    if (!verifyPassword(b.data.current, req.user!.password_hash)) throw bad('Current password is incorrect');
    q.run('UPDATE users SET password_hash=? WHERE id=?', hashPassword(b.data.next), req.user!.id);
    // sign out other sessions
    const t = tokenFrom(req);
    q.run('DELETE FROM sessions WHERE user_id=?', req.user!.id);
    if (t) setCookie(res, createSession(req.user!.id));
    res.json({ ok: true });
  }),
);

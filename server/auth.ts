import crypto from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';
import { q, HttpError, forbidden } from './util.ts';
import type { Row } from './db.ts';

declare module 'express-serve-static-core' {
  interface Request {
    user?: Row;
  }
}

const SESSION_DAYS = 14;
export const COOKIE = 'orbit_session';

export function hashPassword(pw: string): string {
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(pw, salt, 64);
  return `scrypt$${salt.toString('hex')}$${hash.toString('hex')}`;
}
export function verifyPassword(pw: string, stored: string): boolean {
  const [alg, saltHex, hashHex] = stored.split('$');
  if (alg !== 'scrypt' || !saltHex || !hashHex) return false;
  const expected = Buffer.from(hashHex, 'hex');
  const actual = crypto.scryptSync(pw, Buffer.from(saltHex, 'hex'), expected.length);
  return crypto.timingSafeEqual(expected, actual);
}

const sha = (s: string) => crypto.createHash('sha256').update(s).digest('hex');

export function createSession(userId: number): string {
  const token = crypto.randomBytes(32).toString('base64url');
  q.run('INSERT INTO sessions(token_hash, user_id, expires_at) VALUES (?,?,?)', sha(token), userId, Date.now() + SESSION_DAYS * 864e5);
  q.run('DELETE FROM sessions WHERE expires_at < ?', Date.now());
  return token;
}
export const destroySession = (token: string) => q.run('DELETE FROM sessions WHERE token_hash=?', sha(token));

export function setCookie(res: Response, token: string) {
  res.cookie(COOKIE, token, { httpOnly: true, sameSite: 'lax', secure: process.env.COOKIE_SECURE === '1', maxAge: SESSION_DAYS * 864e5, path: '/' });
}

function parseCookies(header?: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const part of (header ?? '').split(';')) {
    const i = part.indexOf('=');
    if (i > 0) out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  }
  return out;
}
export const tokenFrom = (req: Request) => parseCookies(req.headers.cookie)[COOKIE];

export function loadUser(req: Request, _res: Response, next: NextFunction) {
  const token = tokenFrom(req);
  if (token) {
    const u = q.get(
      `SELECT u.* FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token_hash=? AND s.expires_at > ? AND u.status='active'`,
      sha(token),
      Date.now(),
    );
    if (u) req.user = u;
  }
  next();
}

/** Mutating requests must come from our own front-end (CSRF defence in depth on top of SameSite=Lax). */
export function csrfGuard(req: Request, _res: Response, next: NextFunction) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
  if (req.headers['x-requested-with'] !== 'orbit') return next(new HttpError(403, 'Missing request header'));
  next();
}

export function requireAuth(req: Request, _res: Response, next: NextFunction) {
  if (!req.user) return next(new HttpError(401, 'Please sign in to continue'));
  next();
}
export const requireRole =
  (...roles: string[]) =>
  (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) return next(new HttpError(401, 'Please sign in to continue'));
    if (!roles.includes(req.user.role)) return next(forbidden('Your role cannot do this'));
    next();
  };

export const isStaff = (u?: Row) => !!u && (u.role === 'admin' || u.role === 'instructor');
export const isAdmin = (u?: Row) => !!u && u.role === 'admin';

export function publicUser(u: Row) {
  return {
    id: u.id,
    email: u.email,
    name: u.name,
    role: u.role,
    status: u.status,
    avatarColor: u.avatar_color,
    title: u.title ?? '',
    bio: u.bio ?? '',
    department: u.department ?? '',
    xp: u.xp,
    streak: u.streak,
    longestStreak: u.longest_streak,
    createdAt: u.created_at,
    lastLoginAt: u.last_login_at,
  };
}

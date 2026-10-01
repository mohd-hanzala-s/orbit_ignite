import type { Request, Response, NextFunction } from 'express';
import { db, parseJson } from './db.ts';
import type { Row } from './db.ts';

export class HttpError extends Error {
  constructor(public status: number, message: string, public code?: string) {
    super(message);
  }
}
export const bad = (msg: string, code?: string) => new HttpError(400, msg, code);
export const notFound = (msg = 'Not found') => new HttpError(404, msg);
export const forbidden = (msg = 'You do not have access to this') => new HttpError(403, msg);

export const q = {
  get: (sql: string, ...p: any[]): Row | undefined => db.prepare(sql).get(...p) as Row | undefined,
  all: (sql: string, ...p: any[]): Row[] => db.prepare(sql).all(...p) as Row[],
  run: (sql: string, ...p: any[]) => {
    const r = db.prepare(sql).run(...p);
    return { changes: Number(r.changes), id: Number(r.lastInsertRowid) };
  },
};

export const nowIso = () => new Date().toISOString().replace('T', ' ').slice(0, 19);
export const todayStr = () => new Date().toISOString().slice(0, 10);

export function intParam(req: Request, name: string): number {
  const n = Number(req.params[name]);
  if (!Number.isInteger(n) || n <= 0) throw bad(`Invalid ${name}`);
  return n;
}

export function log(userId: number | null, action: string, entity?: string, entityId?: number, meta: object = {}) {
  q.run('INSERT INTO activity(user_id, action, entity, entity_id, meta) VALUES (?,?,?,?,?)', userId, action, entity ?? null, entityId ?? null, JSON.stringify(meta));
}

export function notify(userId: number, title: string, body = '', link = '', type = 'info') {
  q.run('INSERT INTO notifications(user_id, type, title, body, link) VALUES (?,?,?,?,?)', userId, type, title, body, link);
}

export function getSetting<T>(key: string, fallback: T): T {
  const r = q.get('SELECT value FROM settings WHERE key=?', key);
  return r ? parseJson<T>(r.value, fallback) : fallback;
}
export function setSetting(key: string, value: unknown) {
  q.run('INSERT INTO settings(key,value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value', key, JSON.stringify(value));
}

export const DEFAULT_SETTINGS = {
  platformName: 'Orbit Ignite',
  tagline: 'Launch your learning into orbit',
  allowRegistration: true,
  defaultRole: 'learner',
  certificateSigner: 'Commander Comet',
  certificateSignerTitle: 'Chief Learning Officer',
  supportEmail: 'support@orbitignite.space',
};
export const getSettings = () => ({ ...DEFAULT_SETTINGS, ...getSetting<Record<string, any>>('platform', {}) });

export const wrap =
  (fn: (req: Request, res: Response, next: NextFunction) => any) =>
  (req: Request, res: Response, next: NextFunction) =>
    Promise.resolve(fn(req, res, next)).catch(next);

export const str = (v: unknown, max = 5000) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
export const bool = (v: unknown) => (v ? 1 : 0);
export const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

/** SQLite 'YYYY-MM-DD HH:MM:SS' (UTC) → ISO string the browser parses correctly. */
export const iso = (s: unknown): string | null => (typeof s === 'string' && s ? (s.includes('T') ? s : s.replace(' ', 'T') + 'Z') : null);

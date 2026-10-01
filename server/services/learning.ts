import crypto from 'node:crypto';
import { q, notify, todayStr, log } from '../util.ts';
import { parseJson, tx } from '../db.ts';
import type { Row } from '../db.ts';
import { XP } from '../../shared/constants.ts';

/* ───────────────────────── badges ───────────────────────── */

export interface BadgeDef {
  key: string;
  name: string;
  description: string;
  icon: string;
  tone: 'violet' | 'cyan' | 'amber' | 'pink' | 'emerald';
  check: (userId: number) => boolean;
}

const count = (sql: string, ...p: any[]) => Number(q.get(sql, ...p)?.n ?? 0);

export const BADGES: BadgeDef[] = [
  { key: 'first-launch', name: 'First Launch', description: 'Complete your very first lesson.', icon: 'Rocket', tone: 'violet', check: (u) => count(`SELECT COUNT(*) n FROM lesson_progress WHERE user_id=? AND status='completed'`, u) >= 1 },
  { key: 'explorer', name: 'Star Explorer', description: 'Enroll in 3 different courses.', icon: 'Compass', tone: 'cyan', check: (u) => count('SELECT COUNT(*) n FROM enrollments WHERE user_id=?', u) >= 3 },
  { key: 'note-taker', name: 'Mission Log', description: 'Capture 5 notes while learning.', icon: 'NotebookPen', tone: 'amber', check: (u) => count('SELECT COUNT(*) n FROM notes WHERE user_id=?', u) >= 5 },
  { key: 'quiz-ace', name: 'Perfect Trajectory', description: 'Score 100% on a quiz.', icon: 'Target', tone: 'pink', check: (u) => count('SELECT COUNT(*) n FROM quiz_attempts WHERE user_id=? AND percent=100', u) >= 1 },
  { key: 'comms', name: 'Mission Comms', description: 'Post 3 messages in course discussions.', icon: 'MessagesSquare', tone: 'cyan', check: (u) => count('SELECT COUNT(*) n FROM discussions WHERE user_id=?', u) >= 3 },
  { key: 'reviewer', name: 'Star Rater', description: 'Leave a course review.', icon: 'Star', tone: 'amber', check: (u) => count('SELECT COUNT(*) n FROM reviews WHERE user_id=?', u) >= 1 },
  { key: 'streak-3', name: 'Warm-up Burn', description: 'Learn 3 days in a row.', icon: 'Flame', tone: 'amber', check: (u) => Number(q.get('SELECT longest_streak s FROM users WHERE id=?', u)?.s ?? 0) >= 3 },
  { key: 'streak-7', name: 'Hyperdrive', description: 'Learn 7 days in a row.', icon: 'Zap', tone: 'pink', check: (u) => Number(q.get('SELECT longest_streak s FROM users WHERE id=?', u)?.s ?? 0) >= 7 },
  { key: 'mission-complete', name: 'Mission Complete', description: 'Finish your first course.', icon: 'Flag', tone: 'emerald', check: (u) => count(`SELECT COUNT(*) n FROM enrollments WHERE user_id=? AND status='completed'`, u) >= 1 },
  { key: 'galaxy-brain', name: 'Galaxy Brain', description: 'Finish 5 courses.', icon: 'Brain', tone: 'violet', check: (u) => count(`SELECT COUNT(*) n FROM enrollments WHERE user_id=? AND status='completed'`, u) >= 5 },
  { key: 'centurion', name: 'Orbit 500', description: 'Earn 500 XP.', icon: 'Orbit', tone: 'cyan', check: (u) => Number(q.get('SELECT xp FROM users WHERE id=?', u)?.xp ?? 0) >= 500 },
  { key: 'legend', name: 'Cosmic Legend', description: 'Earn 2,000 XP.', icon: 'Crown', tone: 'amber', check: (u) => Number(q.get('SELECT xp FROM users WHERE id=?', u)?.xp ?? 0) >= 2000 },
];

export function checkBadges(userId: number): string[] {
  const owned = new Set(q.all('SELECT badge FROM user_badges WHERE user_id=?', userId).map((r) => r.badge));
  const earned: string[] = [];
  for (const b of BADGES) {
    if (owned.has(b.key)) continue;
    if (b.check(userId)) {
      q.run('INSERT OR IGNORE INTO user_badges(user_id, badge) VALUES (?,?)', userId, b.key);
      notify(userId, `Badge unlocked: ${b.name}`, b.description, '/achievements', 'badge');
      earned.push(b.key);
    }
  }
  return earned;
}

/* ───────────────────────── xp & streaks ───────────────────────── */

export function awardXp(userId: number, amount: number, reason: string, ref?: string | number): boolean {
  const r = q.run('INSERT OR IGNORE INTO xp_events(user_id, amount, reason, ref) VALUES (?,?,?,?)', userId, amount, reason, ref == null ? null : String(ref));
  if (!r.changes) return false;
  q.run('UPDATE users SET xp = xp + ? WHERE id=?', amount, userId);
  return true;
}

export function touchStreak(userId: number) {
  const u = q.get('SELECT streak, longest_streak, last_active_date FROM users WHERE id=?', userId);
  if (!u) return;
  const today = todayStr();
  if (u.last_active_date === today) return;
  const y = new Date(Date.now() - 864e5).toISOString().slice(0, 10);
  const streak = u.last_active_date === y ? Number(u.streak) + 1 : 1;
  q.run('UPDATE users SET streak=?, longest_streak=MAX(longest_streak, ?), last_active_date=? WHERE id=?', streak, streak, today, userId);
}

/* ───────────────────────── course structure ───────────────────────── */

export function requiredLessons(courseId: number): Row[] {
  return q.all('SELECT id, type FROM lessons WHERE course_id=? AND required=1', courseId);
}

export function recomputeEnrollment(userId: number, courseId: number) {
  const enr = q.get('SELECT * FROM enrollments WHERE user_id=? AND course_id=?', userId, courseId);
  if (!enr) return null;
  const total = count('SELECT COUNT(*) n FROM lessons WHERE course_id=? AND required=1', courseId);
  const done = count(
    `SELECT COUNT(*) n FROM lesson_progress lp JOIN lessons l ON l.id=lp.lesson_id
     WHERE lp.user_id=? AND lp.course_id=? AND lp.status='completed' AND l.required=1`,
    userId,
    courseId,
  );
  const progress = total === 0 ? 0 : Math.round((done / total) * 100);
  let justCompleted = false;
  if (total > 0 && done >= total && enr.status !== 'completed') {
    justCompleted = true;
    q.run(`UPDATE enrollments SET status='completed', progress=100, completed_at=datetime('now') WHERE id=?`, enr.id);
    completeCourse(userId, courseId);
  } else if (enr.status === 'completed' && done < total) {
    // lessons were added after completion — reopen but keep certificate
    q.run(`UPDATE enrollments SET status='active', progress=?, completed_at=NULL WHERE id=?`, progress, enr.id);
  } else if (enr.status !== 'completed') {
    q.run('UPDATE enrollments SET progress=? WHERE id=?', progress, enr.id);
  }
  return { progress: justCompleted ? 100 : progress, justCompleted };
}

function completeCourse(userId: number, courseId: number) {
  const course = q.get('SELECT * FROM courses WHERE id=?', courseId);
  if (!course) return;
  awardXp(userId, XP.course, 'course', courseId);
  const avg = q.get(
    `SELECT AVG(qa.best) a FROM (SELECT MAX(percent) best FROM quiz_attempts qa JOIN lessons l ON l.id=qa.lesson_id WHERE qa.user_id=? AND l.course_id=? GROUP BY qa.lesson_id) qa`,
    userId,
    courseId,
  );
  if (course.certificate_enabled) {
    const code = 'OI-' + crypto.randomBytes(5).toString('hex').toUpperCase();
    q.run('INSERT OR IGNORE INTO certificates(code, user_id, course_id, score) VALUES (?,?,?,?)', code, userId, courseId, avg?.a != null ? Math.round(Number(avg.a)) : null);
    notify(userId, `Mission complete: ${course.title}`, 'Your certificate is ready.', '/certificates', 'certificate');
  } else {
    notify(userId, `Mission complete: ${course.title}`, 'Great work, astronaut!', `/courses/${courseId}`, 'success');
  }
  log(userId, 'course.completed', 'course', courseId);
}

export function markLessonComplete(userId: number, lesson: Row, opts: { score?: number | null } = {}) {
  return tx(() => {
    const prev = q.get('SELECT status FROM lesson_progress WHERE user_id=? AND lesson_id=?', userId, lesson.id);
    q.run(
      `INSERT INTO lesson_progress(user_id, lesson_id, course_id, status, score, completed_at, updated_at)
       VALUES (?,?,?, 'completed', ?, datetime('now'), datetime('now'))
       ON CONFLICT(user_id, lesson_id) DO UPDATE SET status='completed',
         score=COALESCE(excluded.score, lesson_progress.score),
         completed_at=COALESCE(lesson_progress.completed_at, datetime('now')), updated_at=datetime('now')`,
      userId,
      lesson.id,
      lesson.course_id,
      opts.score ?? null,
    );
    const first = prev?.status !== 'completed';
    if (first) {
      awardXp(userId, XP.lesson, 'lesson', lesson.id);
      log(userId, 'lesson.completed', 'lesson', lesson.id);
    }
    touchStreak(userId);
    const enr = recomputeEnrollment(userId, lesson.course_id);
    const badges = checkBadges(userId);
    return { firstTime: first, enrollment: enr, badges };
  });
}

export function ensureEnrollment(userId: number, courseId: number, source = 'self', assignedBy: number | null = null, dueDate: string | null = null): boolean {
  const r = q.run('INSERT OR IGNORE INTO enrollments(user_id, course_id, source, assigned_by, due_date) VALUES (?,?,?,?,?)', userId, courseId, source, assignedBy, dueDate);
  if (r.changes) {
    checkBadges(userId);
    return true;
  }
  if (dueDate) q.run('UPDATE enrollments SET due_date=COALESCE(due_date, ?) WHERE user_id=? AND course_id=?', dueDate, userId, courseId);
  return false;
}

/* ───────────────────────── quizzes ───────────────────────── */

export interface QuizOption { id: string; text: string }
export interface QuizQuestion {
  id: string;
  type: 'single' | 'multiple' | 'truefalse' | 'short' | 'ordering';
  prompt: string;
  options?: QuizOption[];
  correct?: string[]; // option ids (single/multiple/truefalse) or accepted answers (short)
  points?: number;
  explanation?: string;
}
export interface QuizContent {
  passScore?: number;
  maxAttempts?: number;
  timeLimitMin?: number;
  shuffle?: boolean;
  showAnswers?: boolean;
  questions?: QuizQuestion[];
}

export function tfOptions(): QuizOption[] {
  return [{ id: 'true', text: 'True' }, { id: 'false', text: 'False' }];
}

/** Hide correct answers before submission. Ordering options are shuffled deterministically. */
export function publicQuiz(c: QuizContent) {
  return {
    passScore: c.passScore ?? 70,
    maxAttempts: c.maxAttempts ?? 0,
    timeLimitMin: c.timeLimitMin ?? 0,
    shuffle: !!c.shuffle,
    showAnswers: c.showAnswers !== false,
    questions: (c.questions ?? []).map((qn) => {
      let options = qn.type === 'truefalse' ? tfOptions() : qn.options;
      if (qn.type === 'ordering' && options) options = [...options].sort((a, b) => hash(qn.id + a.id) - hash(qn.id + b.id));
      return { id: qn.id, type: qn.type, prompt: qn.prompt, options, points: qn.points ?? 1 };
    }),
  };
}
const hash = (s: string) => parseInt(crypto.createHash('md5').update(s).digest('hex').slice(0, 8), 16);

export function gradeQuiz(c: QuizContent, answers: Record<string, any>) {
  const results: Row[] = [];
  let score = 0;
  let max = 0;
  for (const qn of c.questions ?? []) {
    const pts = qn.points ?? 1;
    max += pts;
    const given = answers?.[qn.id];
    let ok = false;
    let correctAnswer: any;
    if (qn.type === 'single' || qn.type === 'truefalse') {
      correctAnswer = qn.correct ?? [];
      ok = typeof given === 'string' && correctAnswer.length === 1 && given === correctAnswer[0];
    } else if (qn.type === 'multiple') {
      correctAnswer = qn.correct ?? [];
      const g = Array.isArray(given) ? [...new Set(given.map(String))].sort() : [];
      const c2 = [...correctAnswer].sort();
      ok = g.length > 0 && g.length === c2.length && g.every((v, i) => v === c2[i]);
    } else if (qn.type === 'short') {
      correctAnswer = qn.correct ?? [];
      const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, ' ');
      ok = typeof given === 'string' && given.trim() !== '' && correctAnswer.some((a: string) => norm(a) === norm(given));
    } else if (qn.type === 'ordering') {
      correctAnswer = (qn.options ?? []).map((o) => o.id);
      ok = Array.isArray(given) && given.length === correctAnswer.length && given.every((v: string, i: number) => v === correctAnswer[i]);
    }
    if (ok) score += pts;
    results.push({ id: qn.id, correct: ok, earned: ok ? pts : 0, points: pts, correctAnswer, explanation: qn.explanation ?? '' });
  }
  const percent = max === 0 ? 100 : Math.round((score / max) * 100);
  return { results, score, max, percent, passed: percent >= (c.passScore ?? 70) };
}

export const lessonContent = (l: Row) => parseJson<Record<string, any>>(l.content, {});

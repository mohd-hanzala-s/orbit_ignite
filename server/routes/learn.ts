import { Router } from 'express';
import path from 'node:path';
import fs from 'node:fs';
import { requireAuth } from '../auth.ts';
import { q, bad, notFound, forbidden, intParam, wrap, log, iso, str, notify, clamp } from '../util.ts';
import { parseJson, SCORM_DIR } from '../db.ts';
import type { Row } from '../db.ts';
import { courseRow, outline, courseCard, courseDetailExtras, isStaffRole, lessonDto, canEditCourse } from '../services/courses.ts';
import { markLessonComplete, publicQuiz, gradeQuiz, awardXp, touchStreak, checkBadges, lessonContent } from '../services/learning.ts';
import type { QuizContent } from '../services/learning.ts';
import { summariseCmi } from '../services/scorm.ts';
import { fileDto } from './files.ts';
import { XP } from '../../shared/constants.ts';

export const learnRouter = Router();
learnRouter.use(requireAuth);

const MANUAL_COMPLETE = ['video', 'audio', 'document', 'page', 'link', 'embed', 'live'];

function access(req: any, lesson: Row) {
  const course = courseRow(Number(lesson.course_id))!;
  const staff = isStaffRole(req.user);
  const enr = q.get('SELECT * FROM enrollments WHERE user_id=? AND course_id=?', req.user.id, lesson.course_id);
  const canView = staff || !!enr || (!!lesson.preview && course.status === 'published');
  if (!canView) throw forbidden('Enroll in this course to open the lesson');
  if (course.sequential && enr && !staff) {
    const flat = outline(Number(lesson.course_id), req.user.id, { sequential: true }).flatMap((s) => s.lessons);
    const me = flat.find((l) => l.id === lesson.id);
    if (me?.locked) throw forbidden('Complete the previous lessons first');
  }
  return { course, staff, enr, tracked: !!enr };
}
const getLesson = (id: number) => {
  const l = q.get('SELECT * FROM lessons WHERE id=?', id);
  if (!l) throw notFound('Lesson not found');
  return l;
};

/* ───────── course player payload ───────── */
learnRouter.get(
  '/courses/:id/learn',
  wrap((req, res) => {
    const id = intParam(req, 'id');
    const c = courseRow(id);
    if (!c) throw notFound('Course not found');
    const staff = isStaffRole(req.user);
    const enr = q.get('SELECT * FROM enrollments WHERE user_id=? AND course_id=?', req.user!.id, id);
    if (!enr && !staff) throw forbidden('Enroll in this course to start learning');
    res.json({
      ...courseCard(c, req.user!.id),
      ...courseDetailExtras(c),
      preview: !enr,
      sections: outline(id, req.user!.id, { staff, sequential: !!c.sequential }),
    });
  }),
);

/* ───────── lesson payload ───────── */
learnRouter.get(
  '/lessons/:id',
  wrap((req, res) => {
    const lesson = getLesson(intParam(req, 'id'));
    const { course, enr, staff, tracked } = access(req, lesson);
    const content = lessonContent(lesson);
    const out: Record<string, any> = { ...content };
    const uid = req.user!.id;

    if (lesson.type === 'quiz') {
      const attempts = q.all('SELECT * FROM quiz_attempts WHERE user_id=? AND lesson_id=? ORDER BY id DESC', uid, lesson.id);
      Object.assign(out, { quiz: publicQuiz(content as QuizContent) });
      delete out.questions;
      out.attempts = attempts.map((a) => ({ id: a.id, percent: a.percent, passed: !!a.passed, score: a.score, max: a.max_score, submittedAt: iso(a.submitted_at), durationSec: a.duration_sec }));
      const last = attempts[0];
      const qz = content as QuizContent;
      out.lastResult = last ? { ...gradedForClient(qz, last), percent: last.percent, passed: !!last.passed, answers: parseJson(last.answers, {}) } : null;
    }
    if (content.fileId) {
      const f = q.get('SELECT * FROM files WHERE id=?', content.fileId);
      if (f) out.file = fileDto(f);
    }
    if (content.captionFileId) {
      const f = q.get('SELECT * FROM files WHERE id=?', content.captionFileId);
      if (f) out.captionUrl = `/api/files/${f.id}`;
    }
    if (lesson.type === 'scorm') {
      const pkg = q.get('SELECT * FROM scorm_packages WHERE id=?', content.packageId);
      if (!pkg) out.missing = true;
      else out.scorm = { id: pkg.id, title: pkg.title, version: pkg.version, launchUrl: `/scorm-content/${pkg.dir}/${pkg.launch_path}` };
    }
    if (lesson.type === 'assignment') {
      const s = q.get('SELECT s.*, f.original_name fname FROM submissions s LEFT JOIN files f ON f.id=s.file_id WHERE s.user_id=? AND s.lesson_id=?', uid, lesson.id);
      out.submission = s ? submissionDto(s) : null;
    }
    const progress = q.get('SELECT status, position, time_spent, score FROM lesson_progress WHERE user_id=? AND lesson_id=?', uid, lesson.id);
    if (enr) {
      q.run(`UPDATE enrollments SET last_accessed_at=datetime('now'), last_lesson_id=? WHERE id=?`, lesson.id, enr.id);
      if (!progress) q.run(`INSERT OR IGNORE INTO lesson_progress(user_id, lesson_id, course_id, status) VALUES (?,?,?, 'in_progress')`, uid, lesson.id, lesson.course_id);
      touchStreak(uid);
    }
    res.json({
      ...lessonDto(lesson),
      courseTitle: course.title,
      content: out,
      tracked,
      staffPreview: staff && !enr,
      progress: progress ? { status: progress.status, position: Number(progress.position), timeSpent: Number(progress.time_spent), score: progress.score } : null,
    });
  }),
);

const submissionDto = (s: Row) => ({
  id: s.id,
  text: s.text,
  link: s.link,
  fileId: s.file_id,
  fileName: s.fname ?? null,
  status: s.status,
  grade: s.grade,
  feedback: s.feedback,
  submittedAt: iso(s.submitted_at),
  gradedAt: iso(s.graded_at),
});

function gradedForClient(qz: QuizContent, attempt: Row) {
  const show = qz.showAnswers !== false;
  const results = parseJson<Row[]>(attempt.results, []).map((r) => (show ? r : { id: r.id, correct: r.correct, earned: r.earned, points: r.points }));
  return { results };
}

/* ───────── progress ───────── */
learnRouter.post(
  '/lessons/:id/progress',
  wrap((req, res) => {
    const lesson = getLesson(intParam(req, 'id'));
    const { tracked } = access(req, lesson);
    if (!tracked) return res.json({ ok: true, tracked: false });
    const position = Number.isFinite(Number(req.body?.position)) ? Math.max(0, Number(req.body.position)) : 0;
    const add = clamp(Math.round(Number(req.body?.timeSpent) || 0), 0, 600);
    q.run(
      `INSERT INTO lesson_progress(user_id, lesson_id, course_id, status, position, time_spent) VALUES (?,?,?, 'in_progress', ?, ?)
       ON CONFLICT(user_id, lesson_id) DO UPDATE SET position=excluded.position, time_spent=lesson_progress.time_spent+excluded.time_spent, updated_at=datetime('now')`,
      req.user!.id, lesson.id, lesson.course_id, position, add,
    );
    res.json({ ok: true });
  }),
);

learnRouter.post(
  '/lessons/:id/complete',
  wrap((req, res) => {
    const lesson = getLesson(intParam(req, 'id'));
    const { tracked } = access(req, lesson);
    if (!tracked) throw bad('Enroll in the course to track progress');
    if (!MANUAL_COMPLETE.includes(lesson.type)) throw bad('This lesson completes automatically when you finish the activity.');
    if (lesson.type === 'live') {
      const startsAt = Date.parse(String(lessonContent(lesson).startsAt ?? ''));
      if (startsAt && startsAt > Date.now()) throw bad('This live session has not started yet.');
    }
    res.json(markLessonComplete(req.user!.id, lesson));
  }),
);

learnRouter.post(
  '/lessons/:id/uncomplete',
  wrap((req, res) => {
    const lesson = getLesson(intParam(req, 'id'));
    const { tracked } = access(req, lesson);
    if (!tracked || !MANUAL_COMPLETE.includes(lesson.type)) throw bad('This lesson cannot be reopened.');
    q.run(`UPDATE lesson_progress SET status='in_progress', completed_at=NULL WHERE user_id=? AND lesson_id=?`, req.user!.id, lesson.id);
    const enr = q.get('SELECT * FROM enrollments WHERE user_id=? AND course_id=?', req.user!.id, lesson.course_id)!;
    if (enr.status !== 'completed') {
      const total = Number(q.get('SELECT COUNT(*) n FROM lessons WHERE course_id=? AND required=1', lesson.course_id)!.n);
      const done = Number(q.get(`SELECT COUNT(*) n FROM lesson_progress lp JOIN lessons l ON l.id=lp.lesson_id WHERE lp.user_id=? AND lp.course_id=? AND lp.status='completed' AND l.required=1`, req.user!.id, lesson.course_id)!.n);
      q.run('UPDATE enrollments SET progress=? WHERE id=?', total ? Math.round((done / total) * 100) : 0, enr.id);
    }
    res.json({ ok: true });
  }),
);

/* ───────── quizzes ───────── */
learnRouter.post(
  '/lessons/:id/quiz',
  wrap((req, res) => {
    const lesson = getLesson(intParam(req, 'id'));
    if (lesson.type !== 'quiz') throw bad('Not a quiz');
    const { tracked } = access(req, lesson);
    const qz = lessonContent(lesson) as QuizContent;
    if (!(qz.questions ?? []).length) throw bad('This quiz has no questions yet');
    const answers = req.body?.answers && typeof req.body.answers === 'object' ? req.body.answers : {};
    if (tracked && qz.maxAttempts) {
      const n = Number(q.get('SELECT COUNT(*) n FROM quiz_attempts WHERE user_id=? AND lesson_id=?', req.user!.id, lesson.id)!.n);
      if (n >= qz.maxAttempts) throw bad('You have used all attempts for this quiz.');
    }
    const g = gradeQuiz(qz, answers);
    let attemptId: number | null = null;
    let newBadges: string[] = [];
    if (tracked) {
      attemptId = q.run('INSERT INTO quiz_attempts(user_id, lesson_id, answers, results, score, max_score, percent, passed, duration_sec) VALUES (?,?,?,?,?,?,?,?,?)', req.user!.id, lesson.id, JSON.stringify(answers), JSON.stringify(g.results), g.score, g.max, g.percent, g.passed ? 1 : 0, clamp(Math.round(Number(req.body?.durationSec) || 0), 0, 86400)).id;
      if (g.passed) {
        awardXp(req.user!.id, XP.quizPass, 'quiz', lesson.id);
        if (g.percent === 100) awardXp(req.user!.id, XP.quizPerfect, 'quiz-perfect', lesson.id);
        const done = markLessonComplete(req.user!.id, lesson, { score: g.percent });
        newBadges = done.badges;
      } else {
        q.run(`INSERT INTO lesson_progress(user_id, lesson_id, course_id, status, score) VALUES (?,?,?, 'in_progress', ?)
               ON CONFLICT(user_id, lesson_id) DO UPDATE SET score=MAX(COALESCE(lesson_progress.score,0), excluded.score), updated_at=datetime('now')`, req.user!.id, lesson.id, lesson.course_id, g.percent);
      }
      newBadges = [...newBadges, ...checkBadges(req.user!.id)];
    }
    const show = qz.showAnswers !== false;
    res.json({
      attemptId,
      tracked,
      percent: g.percent,
      score: g.score,
      max: g.max,
      passed: g.passed,
      passScore: qz.passScore ?? 70,
      results: show ? g.results : g.results.map((r) => ({ id: r.id, correct: r.correct, earned: r.earned, points: r.points })),
      badges: [...new Set(newBadges)],
    });
  }),
);

/* ───────── assignments ───────── */
learnRouter.post(
  '/lessons/:id/submission',
  wrap((req, res) => {
    const lesson = getLesson(intParam(req, 'id'));
    if (lesson.type !== 'assignment') throw bad('Not an assignment');
    const { tracked, course } = access(req, lesson);
    if (!tracked) throw bad('Enroll in the course to submit work');
    const c = lessonContent(lesson);
    const text = str(req.body?.text, 20000);
    const link = str(req.body?.link, 500);
    const fileId = req.body?.fileId ? Number(req.body.fileId) : null;
    if (fileId && !q.get('SELECT 1 x FROM files WHERE id=? AND uploaded_by=?', fileId, req.user!.id)) throw bad('Attachment not found');
    if (!text && !fileId && !link) throw bad('Add some text, a link or a file before submitting');
    const prev = q.get('SELECT * FROM submissions WHERE user_id=? AND lesson_id=?', req.user!.id, lesson.id);
    if (prev?.status === 'graded') throw bad('This submission has already been graded.');
    q.run(
      `INSERT INTO submissions(user_id, lesson_id, text, file_id, link, status) VALUES (?,?,?,?,?, 'submitted')
       ON CONFLICT(user_id, lesson_id) DO UPDATE SET text=excluded.text, file_id=excluded.file_id, link=excluded.link, status='submitted', submitted_at=datetime('now'), grade=NULL, feedback=''`,
      req.user!.id, lesson.id, text, fileId, link,
    );
    if (course.instructor_id) notify(Number(course.instructor_id), `New submission: ${lesson.title}`, `${req.user!.name} submitted work in ${course.title}.`, '/admin/grading', 'info');
    log(req.user!.id, 'assignment.submitted', 'lesson', Number(lesson.id));
    const s = q.get('SELECT s.*, f.original_name fname FROM submissions s LEFT JOIN files f ON f.id=s.file_id WHERE s.user_id=? AND s.lesson_id=?', req.user!.id, lesson.id)!;
    void c;
    res.status(201).json(submissionDto(s));
  }),
);

/* ───────── SCORM runtime ───────── */
learnRouter.get(
  '/lessons/:id/scorm',
  wrap((req, res) => {
    const lesson = getLesson(intParam(req, 'id'));
    const { tracked } = access(req, lesson);
    const row = tracked ? q.get('SELECT data FROM scorm_tracking WHERE user_id=? AND lesson_id=?', req.user!.id, lesson.id) : undefined;
    res.json({ cmi: parseJson(row?.data, {}), tracked, student: { id: String(req.user!.id), name: req.user!.name } });
  }),
);

learnRouter.post(
  '/lessons/:id/scorm',
  wrap((req, res) => {
    const lesson = getLesson(intParam(req, 'id'));
    const { tracked } = access(req, lesson);
    if (!tracked) return res.json({ ok: true, tracked: false });
    const incoming = req.body?.cmi && typeof req.body.cmi === 'object' ? req.body.cmi : {};
    const prevRow = q.get('SELECT data FROM scorm_tracking WHERE user_id=? AND lesson_id=?', req.user!.id, lesson.id);
    const cmi: Record<string, string> = { ...parseJson(prevRow?.data, {}) };
    for (const [k, v] of Object.entries(incoming)) if (k.startsWith('cmi.') && (typeof v === 'string' || typeof v === 'number')) cmi[k] = String(v).slice(0, 65536);
    q.run(`INSERT INTO scorm_tracking(user_id, lesson_id, data) VALUES (?,?,?) ON CONFLICT(user_id, lesson_id) DO UPDATE SET data=excluded.data, updated_at=datetime('now')`, req.user!.id, lesson.id, JSON.stringify(cmi));
    const sum = summariseCmi(cmi);
    q.run(
      `INSERT INTO lesson_progress(user_id, lesson_id, course_id, status, score) VALUES (?,?,?, 'in_progress', ?)
       ON CONFLICT(user_id, lesson_id) DO UPDATE SET score=COALESCE(excluded.score, lesson_progress.score), updated_at=datetime('now')`,
      req.user!.id, lesson.id, lesson.course_id, sum.score,
    );
    let result: any = null;
    if (sum.completed) result = markLessonComplete(req.user!.id, lesson, { score: sum.score });
    res.json({ ok: true, tracked: true, status: sum.status, completed: sum.completed, result });
  }),
);

/** Serves extracted SCORM package files (same-origin so the SCO can reach the LMS API in the parent frame). */
export const scormStatic = Router();
scormStatic.get(
  /^\/(\d+)\/(.+)$/,
  requireAuth,
  wrap((req, res) => {
    const [pkg, rel] = [String((req.params as any)[0]), String((req.params as any)[1])];
    const root = path.join(SCORM_DIR, pkg);
    const target = path.resolve(root, decodeURIComponent(rel));
    if (!target.startsWith(root + path.sep) || !fs.existsSync(target) || !fs.statSync(target).isFile()) throw notFound('File not found in package');
    res.setHeader('Cache-Control', 'private, max-age=300');
    res.sendFile(target, { dotfiles: 'allow' });
  }),
);

/* ───────── notes ───────── */
learnRouter.get(
  '/lessons/:id/notes',
  wrap((req, res) => {
    const id = intParam(req, 'id');
    const rows = q.all('SELECT * FROM notes WHERE user_id=? AND lesson_id=? ORDER BY id DESC', req.user!.id, id);
    res.json(rows.map((n) => ({ id: n.id, body: n.body, videoTs: n.video_ts, createdAt: iso(n.created_at) })));
  }),
);
learnRouter.post(
  '/lessons/:id/notes',
  wrap((req, res) => {
    const lesson = getLesson(intParam(req, 'id'));
    access(req, lesson);
    const body = str(req.body?.body, 4000);
    if (!body) throw bad('Write something first');
    const ts = req.body?.videoTs != null && Number.isFinite(Number(req.body.videoTs)) ? Number(req.body.videoTs) : null;
    const r = q.run('INSERT INTO notes(user_id, lesson_id, body, video_ts) VALUES (?,?,?,?)', req.user!.id, lesson.id, body, ts);
    checkBadges(req.user!.id);
    const n = q.get('SELECT * FROM notes WHERE id=?', r.id)!;
    res.status(201).json({ id: n.id, body: n.body, videoTs: n.video_ts, createdAt: iso(n.created_at) });
  }),
);
learnRouter.delete(
  '/notes/:id',
  wrap((req, res) => {
    q.run('DELETE FROM notes WHERE id=? AND user_id=?', intParam(req, 'id'), req.user!.id);
    res.json({ ok: true });
  }),
);

/* ───────── discussions ───────── */
const postDto = (d: Row) => ({
  id: d.id,
  body: d.body,
  pinned: !!d.pinned,
  parentId: d.parent_id,
  lessonId: d.lesson_id,
  lessonTitle: d.lesson_title ?? null,
  createdAt: iso(d.created_at),
  user: { id: d.user_id, name: d.name, avatarColor: d.avatar_color, role: d.role },
});

learnRouter.get(
  '/courses/:id/discussions',
  wrap((req, res) => {
    const id = intParam(req, 'id');
    const staff = isStaffRole(req.user);
    if (!staff && !q.get('SELECT 1 x FROM enrollments WHERE user_id=? AND course_id=?', req.user!.id, id)) throw forbidden('Enroll to join the discussion');
    const lessonId = Number(req.query.lessonId) || null;
    const rows = q.all(
      `SELECT d.*, u.name, u.avatar_color, u.role, l.title lesson_title FROM discussions d JOIN users u ON u.id=d.user_id LEFT JOIN lessons l ON l.id=d.lesson_id
       WHERE d.course_id=? AND (?1 IS NULL OR d.lesson_id=?1 OR d.parent_id IS NOT NULL) ORDER BY d.pinned DESC, d.id DESC LIMIT 300`.replace(/\?1/g, '?'),
      ...(lessonId ? [id, lessonId, lessonId] : [id, null, null]),
    );
    const top = rows.filter((r) => !r.parent_id);
    const topIds = new Set(top.map((t) => Number(t.id)));
    const replies = rows.filter((r) => r.parent_id && topIds.has(Number(r.parent_id))).sort((a, b) => Number(a.id) - Number(b.id));
    res.json(top.map((t) => ({ ...postDto(t), replies: replies.filter((r) => r.parent_id === t.id).map(postDto) })));
  }),
);
learnRouter.post(
  '/courses/:id/discussions',
  wrap((req, res) => {
    const id = intParam(req, 'id');
    const staff = isStaffRole(req.user);
    if (!staff && !q.get('SELECT 1 x FROM enrollments WHERE user_id=? AND course_id=?', req.user!.id, id)) throw forbidden('Enroll to join the discussion');
    const body = str(req.body?.body, 4000);
    if (!body) throw bad('Write a message first');
    const parentId = req.body?.parentId ? Number(req.body.parentId) : null;
    const parent = parentId ? q.get('SELECT * FROM discussions WHERE id=? AND course_id=? AND parent_id IS NULL', parentId, id) : null;
    if (parentId && !parent) throw bad('Original post not found');
    const lessonId = req.body?.lessonId && q.get('SELECT 1 x FROM lessons WHERE id=? AND course_id=?', req.body.lessonId, id) ? Number(req.body.lessonId) : null;
    const r = q.run('INSERT INTO discussions(course_id, lesson_id, user_id, parent_id, body) VALUES (?,?,?,?,?)', id, lessonId, req.user!.id, parentId, body);
    if (!parent) awardXp(req.user!.id, XP.post, 'post', r.id);
    if (parent && Number(parent.user_id) !== req.user!.id) notify(Number(parent.user_id), `${req.user!.name} replied to your post`, body.slice(0, 120), `/courses/${id}/learn?tab=discussion`, 'info');
    checkBadges(req.user!.id);
    const d = q.get('SELECT d.*, u.name, u.avatar_color, u.role, l.title lesson_title FROM discussions d JOIN users u ON u.id=d.user_id LEFT JOIN lessons l ON l.id=d.lesson_id WHERE d.id=?', r.id)!;
    res.status(201).json({ ...postDto(d), replies: [] });
  }),
);
learnRouter.delete(
  '/discussions/:id',
  wrap((req, res) => {
    const d = q.get('SELECT * FROM discussions WHERE id=?', intParam(req, 'id'));
    if (!d) throw notFound();
    const course = courseRow(Number(d.course_id));
    if (Number(d.user_id) !== req.user!.id && !(course && canEditCourse(req.user, course))) throw forbidden();
    q.run('DELETE FROM discussions WHERE id=?', d.id);
    res.json({ ok: true });
  }),
);
learnRouter.post(
  '/discussions/:id/pin',
  wrap((req, res) => {
    const d = q.get('SELECT * FROM discussions WHERE id=?', intParam(req, 'id'));
    if (!d) throw notFound();
    const course = courseRow(Number(d.course_id));
    if (!course || !canEditCourse(req.user, course)) throw forbidden();
    q.run('UPDATE discussions SET pinned = 1 - pinned WHERE id=?', d.id);
    res.json({ ok: true });
  }),
);

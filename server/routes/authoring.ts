import { Router } from 'express';
import { requireRole } from '../auth.ts';
import { q, bad, notFound, forbidden, intParam, wrap, log, iso, str, bool, notify, clamp } from '../util.ts';
import { parseJson, tx } from '../db.ts';
import type { Row } from '../db.ts';
import { courseRow, courseCard, canEditCourse, lessonDto, outline } from '../services/courses.ts';
import { markLessonComplete, recomputeEnrollment, lessonContent } from '../services/learning.ts';
import { fileDto } from './files.ts';
import { LESSON_TYPES, COURSE_THEMES, LEVELS } from '../../shared/constants.ts';

export const authoringRouter = Router();
authoringRouter.use(requireRole('admin', 'instructor'));

function ownCourse(req: any, id: number) {
  const c = courseRow(id);
  if (!c) throw notFound('Course not found');
  if (!canEditCourse(req.user, c)) throw forbidden('You can only edit your own courses');
  return c;
}

/* ───────── course CRUD ───────── */

function courseFields(b: any, existing: Row | undefined, isAdmin: boolean) {
  const title = str(b.title, 140);
  if (!existing && !title) throw bad('Give the course a title');
  if (b.title !== undefined && !title) throw bad('Title cannot be empty');
  const status = ['draft', 'published', 'archived'].includes(b.status) ? b.status : existing?.status ?? 'draft';
  const level = (LEVELS as readonly string[]).includes(b.level) ? b.level : existing?.level ?? 'Beginner';
  const theme = (COURSE_THEMES as readonly string[]).includes(b.theme) ? b.theme : existing?.theme ?? 'nebula';
  const tags = Array.isArray(b.tags) ? b.tags.map((t: any) => str(t, 30)).filter(Boolean).slice(0, 12) : parseJson(existing?.tags, []);
  const objectives = Array.isArray(b.objectives) ? b.objectives.map((t: any) => str(t, 200)).filter(Boolean).slice(0, 12) : parseJson(existing?.objectives, []);
  return {
    title: title || existing!.title,
    subtitle: b.subtitle !== undefined ? str(b.subtitle, 200) : existing?.subtitle ?? '',
    description: b.description !== undefined ? str(b.description, 8000) : existing?.description ?? '',
    category_id: b.categoryId !== undefined ? (Number(b.categoryId) || null) : existing?.category_id ?? null,
    level, status, theme,
    cover_file_id: b.coverFileId !== undefined ? (Number(b.coverFileId) || null) : existing?.cover_file_id ?? null,
    tags: JSON.stringify(tags),
    objectives: JSON.stringify(objectives),
    pass_mark: b.passMark !== undefined ? clamp(Number(b.passMark) || 70, 0, 100) : existing?.pass_mark ?? 70,
    certificate_enabled: b.certificate !== undefined ? bool(b.certificate) : existing?.certificate_enabled ?? 1,
    sequential: b.sequential !== undefined ? bool(b.sequential) : existing?.sequential ?? 0,
    enrollment: ['open', 'invite'].includes(b.enrollmentMode) ? b.enrollmentMode : existing?.enrollment ?? 'open',
    featured: b.featured !== undefined && isAdmin ? bool(b.featured) : existing?.featured ?? 0,
  };
}

authoringRouter.post(
  '/courses',
  wrap((req, res) => {
    const f = courseFields(req.body ?? {}, undefined, req.user!.role === 'admin');
    const instructorId = req.user!.role === 'admin' && req.body?.instructorId ? Number(req.body.instructorId) : req.user!.id;
    const r = q.run(
      `INSERT INTO courses(title, subtitle, description, category_id, level, status, theme, cover_file_id, instructor_id, tags, objectives, pass_mark, certificate_enabled, sequential, enrollment, featured)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      f.title, f.subtitle, f.description, f.category_id, f.level, f.status, f.theme, f.cover_file_id, instructorId, f.tags, f.objectives, f.pass_mark, f.certificate_enabled, f.sequential, f.enrollment, f.featured,
    );
    q.run('INSERT INTO sections(course_id, title, position) VALUES (?,?,0)', r.id, 'Getting started');
    log(req.user!.id, 'course.created', 'course', r.id, { title: f.title });
    res.status(201).json({ id: r.id });
  }),
);

authoringRouter.patch(
  '/courses/:id',
  wrap((req, res) => {
    const id = intParam(req, 'id');
    const c = ownCourse(req, id);
    const f = courseFields(req.body ?? {}, c, req.user!.role === 'admin');
    if (f.status === 'published' && c.status !== 'published') {
      const n = Number(q.get('SELECT COUNT(*) n FROM lessons WHERE course_id=?', id)!.n);
      if (n === 0) throw bad('Add at least one lesson before publishing.');
    }
    const instructorId = req.user!.role === 'admin' && req.body?.instructorId ? Number(req.body.instructorId) : c.instructor_id;
    q.run(
      `UPDATE courses SET title=?, subtitle=?, description=?, category_id=?, level=?, status=?, theme=?, cover_file_id=?, instructor_id=?, tags=?, objectives=?, pass_mark=?, certificate_enabled=?, sequential=?, enrollment=?, featured=?, updated_at=datetime('now') WHERE id=?`,
      f.title, f.subtitle, f.description, f.category_id, f.level, f.status, f.theme, f.cover_file_id, instructorId, f.tags, f.objectives, f.pass_mark, f.certificate_enabled, f.sequential, f.enrollment, f.featured, id,
    );
    if (f.status !== c.status) log(req.user!.id, `course.${f.status}`, 'course', id, { title: f.title });
    res.json({ ok: true });
  }),
);

authoringRouter.delete(
  '/courses/:id',
  wrap((req, res) => {
    const id = intParam(req, 'id');
    const c = ownCourse(req, id);
    const enrolled = Number(q.get('SELECT COUNT(*) n FROM enrollments WHERE course_id=?', id)!.n);
    if (enrolled > 0 && req.query.force !== '1') throw bad(`${enrolled} learner(s) are enrolled. Archive the course instead, or confirm deletion.`, 'has_enrollments');
    q.run('DELETE FROM courses WHERE id=?', id);
    log(req.user!.id, 'course.deleted', 'course', id, { title: c.title });
    res.json({ ok: true });
  }),
);

authoringRouter.post(
  '/courses/:id/duplicate',
  wrap((req, res) => {
    const id = intParam(req, 'id');
    const c = ownCourse(req, id);
    const newId = tx(() => {
      const r = q.run(
        `INSERT INTO courses(title, subtitle, description, category_id, level, status, theme, cover_file_id, instructor_id, tags, objectives, pass_mark, certificate_enabled, sequential, enrollment)
         VALUES (?,?,?,?,?, 'draft', ?,?,?,?,?,?,?,?,?)`,
        `${c.title} (copy)`, c.subtitle, c.description, c.category_id, c.level, c.theme, c.cover_file_id, req.user!.id, c.tags, c.objectives, c.pass_mark, c.certificate_enabled, c.sequential, c.enrollment,
      );
      for (const s of q.all('SELECT * FROM sections WHERE course_id=? ORDER BY position', id)) {
        const ns = q.run('INSERT INTO sections(course_id, title, position) VALUES (?,?,?)', r.id, s.title, s.position);
        for (const l of q.all('SELECT * FROM lessons WHERE section_id=? ORDER BY position', s.id))
          q.run('INSERT INTO lessons(course_id, section_id, title, type, position, duration_minutes, required, preview, summary, content) VALUES (?,?,?,?,?,?,?,?,?,?)', r.id, ns.id, l.title, l.type, l.position, l.duration_minutes, l.required, l.preview, l.summary, l.content);
      }
      return r.id;
    });
    res.status(201).json({ id: newId });
  }),
);

/** Everything the builder needs, including quiz answers. */
authoringRouter.get(
  '/courses/:id/builder',
  wrap((req, res) => {
    const id = intParam(req, 'id');
    const c = ownCourse(req, id);
    const card = courseCard(c);
    const sections = q.all('SELECT * FROM sections WHERE course_id=? ORDER BY position, id', id).map((s) => ({
      id: s.id,
      title: s.title,
      lessons: q.all('SELECT * FROM lessons WHERE section_id=? ORDER BY position, id', s.id).map((l) => {
        const content = lessonContent(l);
        let file = null;
        if (content.fileId) { const f = q.get('SELECT * FROM files WHERE id=?', content.fileId); if (f) file = fileDto(f); }
        let scorm = null;
        if (l.type === 'scorm' && content.packageId) { const p = q.get('SELECT * FROM scorm_packages WHERE id=?', content.packageId); if (p) scorm = { id: p.id, title: p.title, version: p.version, fileCount: p.file_count }; }
        return { ...lessonDto(l), content, file, scorm };
      }),
    }));
    let coverFile = null;
    if (c.cover_file_id) { const f = q.get('SELECT * FROM files WHERE id=?', c.cover_file_id); if (f) coverFile = fileDto(f); }
    res.json({
      ...card,
      description: c.description,
      objectives: parseJson(c.objectives, []),
      passMark: c.pass_mark,
      instructorId: c.instructor_id,
      coverFile,
      sections,
    });
  }),
);

/* ───────── sections ───────── */
authoringRouter.post(
  '/courses/:id/sections',
  wrap((req, res) => {
    const id = intParam(req, 'id');
    ownCourse(req, id);
    const pos = Number(q.get('SELECT COALESCE(MAX(position)+1,0) n FROM sections WHERE course_id=?', id)!.n);
    const r = q.run('INSERT INTO sections(course_id, title, position) VALUES (?,?,?)', id, str(req.body?.title, 120) || 'New section', pos);
    res.status(201).json({ id: r.id });
  }),
);
function ownSection(req: any, sid: number) {
  const s = q.get('SELECT * FROM sections WHERE id=?', sid);
  if (!s) throw notFound('Section not found');
  ownCourse(req, Number(s.course_id));
  return s;
}
authoringRouter.patch('/sections/:id', wrap((req, res) => {
  const s = ownSection(req, intParam(req, 'id'));
  const t = str(req.body?.title, 120);
  if (!t) throw bad('Section title is required');
  q.run('UPDATE sections SET title=? WHERE id=?', t, s.id);
  res.json({ ok: true });
}));
authoringRouter.delete('/sections/:id', wrap((req, res) => {
  const s = ownSection(req, intParam(req, 'id'));
  const n = Number(q.get('SELECT COUNT(*) n FROM sections WHERE course_id=?', s.course_id)!.n);
  if (n <= 1) throw bad('A course needs at least one section.');
  q.run('DELETE FROM sections WHERE id=?', s.id);
  for (const e of q.all('SELECT user_id FROM enrollments WHERE course_id=?', s.course_id)) recomputeEnrollment(Number(e.user_id), Number(s.course_id));
  res.json({ ok: true });
}));

/** Full reorder: [{id, lessons:[lessonId...]}] in display order; lessons may move between sections. */
authoringRouter.put(
  '/courses/:id/order',
  wrap((req, res) => {
    const id = intParam(req, 'id');
    ownCourse(req, id);
    const tree = Array.isArray(req.body?.sections) ? req.body.sections : [];
    tx(() => {
      tree.forEach((s: any, si: number) => {
        if (!q.get('SELECT 1 x FROM sections WHERE id=? AND course_id=?', s.id, id)) return;
        q.run('UPDATE sections SET position=? WHERE id=?', si, s.id);
        (s.lessons ?? []).forEach((lid: number, li: number) => q.run('UPDATE lessons SET section_id=?, position=? WHERE id=? AND course_id=?', s.id, li, lid, id));
      });
    });
    res.json({ ok: true });
  }),
);

/* ───────── lessons ───────── */
function normalizeContent(type: string, c: any, prev: Record<string, any> = {}): Record<string, any> {
  c = c && typeof c === 'object' ? c : {};
  const url = (v: any) => {
    const s = str(v, 2000);
    if (s && !/^https?:\/\//i.test(s)) throw bad('Links must start with http:// or https://');
    return s;
  };
  switch (type) {
    case 'video': {
      const source = ['upload', 'youtube', 'vimeo', 'url'].includes(c.source) ? c.source : 'upload';
      const out: Record<string, any> = { source, url: url(c.url), fileId: c.fileId ? Number(c.fileId) : null, captionFileId: c.captionFileId ? Number(c.captionFileId) : null, transcript: str(c.transcript, 20000) };
      return out;
    }
    case 'audio':
      return { fileId: c.fileId ? Number(c.fileId) : null, url: url(c.url), transcript: str(c.transcript, 20000) };
    case 'document':
      return { fileId: c.fileId ? Number(c.fileId) : null, url: url(c.url), allowDownload: c.allowDownload !== false };
    case 'scorm': {
      const pid = Number(c.packageId) || prev.packageId || null;
      if (pid && !q.get('SELECT 1 x FROM scorm_packages WHERE id=?', pid)) throw bad('SCORM package not found');
      return { packageId: pid };
    }
    case 'page':
      return { markdown: str(c.markdown, 100000) };
    case 'link':
      return { url: url(c.url), description: str(c.description, 1000), openIn: c.openIn === 'embed' ? 'embed' : 'tab' };
    case 'embed':
      return { url: url(c.url), height: clamp(Number(c.height) || 560, 240, 1400), allowFullscreen: c.allowFullscreen !== false };
    case 'live':
      return { startsAt: str(c.startsAt, 40), durationMin: clamp(Number(c.durationMin) || 60, 5, 600), platform: str(c.platform, 40), joinUrl: url(c.joinUrl), host: str(c.host, 80), recordingUrl: url(c.recordingUrl), agenda: str(c.agenda, 4000) };
    case 'assignment':
      return { instructions: str(c.instructions, 20000), maxPoints: clamp(Number(c.maxPoints) || 100, 1, 1000), allowFile: c.allowFile !== false, allowText: c.allowText !== false, dueNote: str(c.dueNote, 200) };
    case 'quiz': {
      const questions = (Array.isArray(c.questions) ? c.questions : []).slice(0, 100).map((qn: any, i: number) => {
        const t = ['single', 'multiple', 'truefalse', 'short', 'ordering'].includes(qn?.type) ? qn.type : 'single';
        const options = (Array.isArray(qn?.options) ? qn.options : []).slice(0, 12).map((o: any, j: number) => ({ id: str(o?.id, 20) || `o${j + 1}`, text: str(o?.text, 300) })).filter((o: any) => o.text);
        const base: Record<string, any> = { id: str(qn?.id, 24) || `q${i + 1}`, type: t, prompt: str(qn?.prompt, 1000), points: clamp(Number(qn?.points) || 1, 1, 100), explanation: str(qn?.explanation, 1000) };
        if (!base.prompt) throw bad(`Question ${i + 1} needs a prompt`);
        if (t === 'truefalse') {
          const ans = Array.isArray(qn.correct) ? qn.correct[0] : qn.correct;
          base.correct = [ans === 'false' || ans === false ? 'false' : 'true'];
        } else if (t === 'short') {
          const ans = (Array.isArray(qn.correct) ? qn.correct : []).map((a: any) => str(a, 200)).filter(Boolean);
          if (!ans.length) throw bad(`Question ${i + 1} needs at least one accepted answer`);
          base.correct = ans;
        } else if (t === 'ordering') {
          if (options.length < 2) throw bad(`Question ${i + 1} needs at least 2 items to order`);
          base.options = options;
        } else {
          if (options.length < 2) throw bad(`Question ${i + 1} needs at least 2 options`);
          const ids = new Set(options.map((o: any) => o.id));
          const correct = (Array.isArray(qn.correct) ? qn.correct : [qn.correct]).filter((x: any) => ids.has(x));
          if (!correct.length) throw bad(`Question ${i + 1} needs a correct answer`);
          if (t === 'single' && correct.length > 1) correct.length = 1;
          base.options = options;
          base.correct = correct;
        }
        return base;
      });
      return { passScore: clamp(Number(c.passScore) || 70, 0, 100), maxAttempts: clamp(Number(c.maxAttempts) || 0, 0, 50), timeLimitMin: clamp(Number(c.timeLimitMin) || 0, 0, 600), shuffle: !!c.shuffle, showAnswers: c.showAnswers !== false, questions };
    }
  }
  throw bad('Unknown lesson type');
}

authoringRouter.post(
  '/sections/:id/lessons',
  wrap((req, res) => {
    const s = ownSection(req, intParam(req, 'id'));
    const type = String(req.body?.type);
    if (!(LESSON_TYPES as readonly string[]).includes(type)) throw bad('Choose a lesson type');
    const title = str(req.body?.title, 140) || 'Untitled lesson';
    const content = normalizeContent(type, req.body?.content ?? {});
    const pos = Number(q.get('SELECT COALESCE(MAX(position)+1,0) n FROM lessons WHERE section_id=?', s.id)!.n);
    const r = q.run('INSERT INTO lessons(course_id, section_id, title, type, position, duration_minutes, required, preview, summary, content) VALUES (?,?,?,?,?,?,?,?,?,?)', s.course_id, s.id, title, type, pos, clamp(Number(req.body?.durationMinutes) || 5, 0, 1000), req.body?.required === false ? 0 : 1, bool(req.body?.preview), str(req.body?.summary, 500), JSON.stringify(content));
    q.run(`UPDATE courses SET updated_at=datetime('now') WHERE id=?`, s.course_id);
    for (const e of q.all('SELECT user_id FROM enrollments WHERE course_id=?', s.course_id)) recomputeEnrollment(Number(e.user_id), Number(s.course_id));
    res.status(201).json({ id: r.id });
  }),
);

authoringRouter.patch(
  '/lessons/:id',
  wrap((req, res) => {
    const l = q.get('SELECT * FROM lessons WHERE id=?', intParam(req, 'id'));
    if (!l) throw notFound('Lesson not found');
    ownCourse(req, Number(l.course_id));
    const b = req.body ?? {};
    const title = b.title !== undefined ? str(b.title, 140) : l.title;
    if (!title) throw bad('Lesson title is required');
    const content = b.content !== undefined ? normalizeContent(l.type, b.content, lessonContent(l)) : lessonContent(l);
    q.run(
      'UPDATE lessons SET title=?, duration_minutes=?, required=?, preview=?, summary=?, content=? WHERE id=?',
      title,
      b.durationMinutes !== undefined ? clamp(Number(b.durationMinutes) || 0, 0, 1000) : l.duration_minutes,
      b.required !== undefined ? bool(b.required) : l.required,
      b.preview !== undefined ? bool(b.preview) : l.preview,
      b.summary !== undefined ? str(b.summary, 500) : l.summary,
      JSON.stringify(content),
      l.id,
    );
    q.run(`UPDATE courses SET updated_at=datetime('now') WHERE id=?`, l.course_id);
    if (b.required !== undefined) for (const e of q.all('SELECT user_id FROM enrollments WHERE course_id=?', l.course_id)) recomputeEnrollment(Number(e.user_id), Number(l.course_id));
    res.json({ ok: true });
  }),
);

authoringRouter.delete(
  '/lessons/:id',
  wrap((req, res) => {
    const l = q.get('SELECT * FROM lessons WHERE id=?', intParam(req, 'id'));
    if (!l) throw notFound('Lesson not found');
    ownCourse(req, Number(l.course_id));
    q.run('DELETE FROM lessons WHERE id=?', l.id);
    for (const e of q.all('SELECT user_id FROM enrollments WHERE course_id=?', l.course_id)) recomputeEnrollment(Number(e.user_id), Number(l.course_id));
    res.json({ ok: true });
  }),
);

/* ───────── grading ───────── */
authoringRouter.get(
  '/grading',
  wrap((req, res) => {
    const status = req.query.status === 'graded' ? 'graded' : 'submitted';
    const rows = q.all(
      `SELECT s.*, u.name learner, u.avatar_color, l.title lesson_title, l.content lesson_content, c.title course_title, c.id course_id, f.original_name fname
       FROM submissions s JOIN users u ON u.id=s.user_id JOIN lessons l ON l.id=s.lesson_id JOIN courses c ON c.id=l.course_id LEFT JOIN files f ON f.id=s.file_id
       WHERE s.status=? AND (?='admin' OR c.instructor_id=?) ORDER BY s.submitted_at DESC LIMIT 200`,
      status, req.user!.role, req.user!.id,
    );
    res.json(rows.map((s) => ({
      id: s.id, learner: s.learner, avatarColor: s.avatar_color, courseId: s.course_id, course: s.course_title, lesson: s.lesson_title,
      maxPoints: parseJson<any>(s.lesson_content, {}).maxPoints ?? 100, instructions: parseJson<any>(s.lesson_content, {}).instructions ?? '',
      text: s.text, link: s.link, fileId: s.file_id, fileName: s.fname, status: s.status, grade: s.grade, feedback: s.feedback, submittedAt: iso(s.submitted_at), gradedAt: iso(s.graded_at),
    })));
  }),
);

authoringRouter.post(
  '/grading/:id',
  wrap((req, res) => {
    const s = q.get('SELECT * FROM submissions WHERE id=?', intParam(req, 'id'));
    if (!s) throw notFound('Submission not found');
    const lesson = q.get('SELECT * FROM lessons WHERE id=?', s.lesson_id)!;
    ownCourse(req, Number(lesson.course_id));
    const max = Number(lessonContent(lesson).maxPoints ?? 100);
    const returned = req.body?.action === 'return';
    const feedback = str(req.body?.feedback, 5000);
    if (returned) {
      q.run(`UPDATE submissions SET status='returned', feedback=?, graded_by=?, graded_at=datetime('now') WHERE id=?`, feedback, req.user!.id, s.id);
      notify(Number(s.user_id), `Revision requested: ${lesson.title}`, feedback || 'Your instructor asked for changes.', `/courses/${lesson.course_id}/learn/${lesson.id}`, 'info');
    } else {
      const grade = Number(req.body?.grade);
      if (!Number.isFinite(grade) || grade < 0 || grade > max) throw bad(`Grade must be between 0 and ${max}`);
      q.run(`UPDATE submissions SET status='graded', grade=?, feedback=?, graded_by=?, graded_at=datetime('now') WHERE id=?`, grade, feedback, req.user!.id, s.id);
      markLessonComplete(Number(s.user_id), lesson, { score: Math.round((grade / max) * 100) });
      notify(Number(s.user_id), `Graded: ${lesson.title}`, `You scored ${grade}/${max}.${feedback ? ' ' + feedback.slice(0, 100) : ''}`, `/courses/${lesson.course_id}/learn/${lesson.id}`, 'success');
    }
    res.json({ ok: true });
  }),
);

authoringRouter.get('/courses/:id/outline', wrap((req, res) => {
  const id = intParam(req, 'id');
  ownCourse(req, id);
  res.json(outline(id));
}));

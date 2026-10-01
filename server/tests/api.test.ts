import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { Server } from 'node:http';

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'orbit-test-'));
process.env.DATA_DIR = dir;
process.env.DB_FILE = path.join(dir, 'test.db');

let server: Server;
let base = '';

class Client {
  cookie = '';
  async req(method: string, url: string, body?: any, raw?: FormData) {
    const res = await fetch(base + url, {
      method,
      headers: { ...(raw ? {} : { 'Content-Type': 'application/json' }), 'X-Requested-With': 'orbit', ...(this.cookie ? { Cookie: this.cookie } : {}) },
      body: raw ?? (body !== undefined ? JSON.stringify(body) : undefined),
    });
    const sc = res.headers.get('set-cookie');
    if (sc) this.cookie = sc.split(';')[0];
    const text = await res.text();
    let json: any = null;
    try { json = JSON.parse(text); } catch {}
    return { status: res.status, json, text, headers: res.headers };
  }
  get = (u: string) => this.req('GET', u);
  post = (u: string, b?: any) => this.req('POST', u, b ?? {});
  patch = (u: string, b?: any) => this.req('PATCH', u, b ?? {});
  put = (u: string, b?: any) => this.req('PUT', u, b ?? {});
  del = (u: string) => this.req('DELETE', u);
}
const login = async (email: string) => {
  const c = new Client();
  const r = await c.post('/api/auth/login', { email, password: 'Orbit123!' });
  assert.equal(r.status, 200, JSON.stringify(r.json));
  return c;
};

before(async () => {
  const { seedIfEmpty } = await import('../seed.ts');
  await seedIfEmpty();
  const { createApp } = await import('../app.ts');
  server = createApp().listen(0);
  base = `http://127.0.0.1:${(server.address() as any).port}`;
});
after(() => server.close());

test('auth: login, me, bad password, csrf header', async () => {
  const c = new Client();
  assert.equal((await c.post('/api/auth/login', { email: 'astro@orbit.space', password: 'nope' })).status, 400);
  const ok = await c.post('/api/auth/login', { email: 'astro@orbit.space', password: 'Orbit123!' });
  assert.equal(ok.json.user.role, 'learner');
  assert.equal((await c.get('/api/auth/me')).json.user.email, 'astro@orbit.space');
  const noHeader = await fetch(base + '/api/auth/logout', { method: 'POST', headers: { Cookie: c.cookie } });
  assert.equal(noHeader.status, 403);
  await c.post('/api/auth/logout');
  assert.equal((await new Client().get('/api/me/dashboard')).status, 401);
});

test('register creates a learner, rejects duplicates & weak passwords', async () => {
  const c = new Client();
  assert.equal((await c.post('/api/auth/register', { name: 'T Est', email: 'new@x.io', password: 'short' })).status, 400);
  const r = await c.post('/api/auth/register', { name: 'T Est', email: 'new@x.io', password: 'longenough1' });
  assert.equal(r.status, 201);
  assert.equal((await new Client().post('/api/auth/register', { name: 'T Est', email: 'NEW@x.io', password: 'longenough1' })).status, 400);
});

test('role guards: learner cannot reach admin APIs', async () => {
  const c = await login('astro@orbit.space');
  assert.equal((await c.get('/api/admin/users')).status, 403);
  assert.equal((await c.get('/api/admin/stats')).status, 403);
  assert.equal((await c.post('/api/admin/courses', { title: 'x' })).status, 403);
});

test('catalog hides drafts from learners and shows them to staff', async () => {
  const l = await login('astro@orbit.space');
  const list = (await l.get('/api/courses')).json;
  assert.ok(list.length >= 6);
  assert.ok(!list.some((c: any) => c.status === 'draft'));
  const a = await login('admin@orbit.space');
  assert.ok((await a.get('/api/courses?all=1')).json.some((c: any) => c.status === 'draft'));
  const draft = (await a.get('/api/courses?all=1&status=draft')).json[0];
  assert.equal((await l.get(`/api/courses/${draft.id}`)).status, 404);
});

test('enroll → learn → complete lessons → certificate', async () => {
  const c = await login('astro@orbit.space');
  const courses = (await c.get('/api/courses')).json;
  const target = courses.find((x: any) => x.title.startsWith('Designing for Zero'));
  assert.ok(target && !target.enrollment);
  assert.equal((await c.get(`/api/courses/${target.id}/learn`)).status, 403);
  assert.equal((await c.post(`/api/courses/${target.id}/enroll`)).status, 201);
  assert.equal((await c.post(`/api/courses/${target.id}/enroll`)).status, 200);
  const learn = (await c.get(`/api/courses/${target.id}/learn`)).json;
  const lessons = learn.sections.flatMap((s: any) => s.lessons);
  for (const l of lessons.filter((x: any) => x.type !== 'quiz')) {
    const r = await c.post(`/api/lessons/${l.id}/complete`);
    assert.equal(r.status, 200, JSON.stringify(r.json));
  }
  // quiz: wrong then right
  const quiz = lessons.find((x: any) => x.type === 'quiz');
  const detail = (await c.get(`/api/lessons/${quiz.id}`)).json;
  assert.ok(!JSON.stringify(detail).includes('"correct"'), 'quiz payload must not leak answers');
  const wrong = (await c.post(`/api/lessons/${quiz.id}/quiz`, { answers: { q1: 'true' } })).json;
  assert.equal(wrong.passed, false);
  const right = (await c.post(`/api/lessons/${quiz.id}/quiz`, { answers: { q1: 'false' } })).json;
  assert.equal(right.passed, true);
  const after = (await c.get(`/api/courses/${target.id}`)).json;
  assert.equal(after.enrollment.status, 'completed');
  const certs = (await c.get('/api/me/certificates')).json;
  const cert = certs.find((x: any) => x.courseId === target.id);
  assert.ok(cert);
  const v = await new Client().get(`/api/certificates/verify/${cert.code}`);
  assert.equal(v.json.valid, true);
  assert.equal((await new Client().get('/api/certificates/verify/NOPE')).status, 404);
});

test('sequential course locks later lessons', async () => {
  const c = await login('astro@orbit.space');
  const safety = (await c.get('/api/courses')).json.find((x: any) => x.title.startsWith('Mission-Critical'));
  const learn = (await c.get(`/api/courses/${safety.id}/learn`)).json;
  const flat = learn.sections.flatMap((s: any) => s.lessons);
  const locked = flat.find((l: any) => l.locked);
  assert.ok(locked, 'expected a locked lesson');
  assert.equal((await c.get(`/api/lessons/${locked.id}`)).status, 403);
});

test('SCORM: package served and tracking completes lesson', async () => {
  const c = await login('astro@orbit.space');
  const safety = (await c.get('/api/courses')).json.find((x: any) => x.title.startsWith('Mission-Critical'));
  const flat = (await c.get(`/api/courses/${safety.id}/learn`)).json.sections.flatMap((s: any) => s.lessons);
  const sc = flat.find((l: any) => l.type === 'scorm');
  const first = flat[0];
  await c.post(`/api/lessons/${first.id}/complete`);
  const d = (await c.get(`/api/lessons/${sc.id}`)).json;
  assert.equal(d.content.scorm.version, '1.2');
  const html = await c.get(d.content.scorm.launchUrl);
  assert.equal(html.status, 200);
  assert.ok(html.text.includes('Pre-flight'));
  assert.equal((await c.get('/scorm-content/1/../../etc/passwd')).status, 404);
  const s1 = (await c.post(`/api/lessons/${sc.id}/scorm`, { cmi: { 'cmi.core.lesson_status': 'incomplete' } })).json;
  assert.equal(s1.completed, false);
  const s2 = (await c.post(`/api/lessons/${sc.id}/scorm`, { cmi: { 'cmi.core.lesson_status': 'passed', 'cmi.core.score.raw': '100' } })).json;
  assert.equal(s2.completed, true);
  const st = (await c.get(`/api/lessons/${sc.id}/scorm`)).json;
  assert.equal(st.cmi['cmi.core.lesson_status'], 'passed');
});

test('assignment submit → grade → completes', async () => {
  const l = await login('astro@orbit.space');
  const t = await login('nova@orbit.space');
  const lead = (await l.get('/api/courses')).json.find((x: any) => x.title.startsWith('Leading Remote'));
  const flat = (await l.get(`/api/courses/${lead.id}/learn`)).json.sections.flatMap((s: any) => s.lessons);
  const asg = flat.find((x: any) => x.type === 'assignment');
  assert.equal((await l.post(`/api/lessons/${asg.id}/submission`, {})).status, 400);
  const sub = await l.post(`/api/lessons/${asg.id}/submission`, { text: 'My playbook' });
  assert.equal(sub.status, 201);
  const queue = (await t.get('/api/admin/grading')).json;
  const mine = queue.find((x: any) => x.lesson === asg.title && x.text === 'My playbook');
  assert.ok(mine);
  assert.equal((await t.post(`/api/admin/grading/${mine.id}`, { grade: 999 })).status, 400);
  assert.equal((await t.post(`/api/admin/grading/${mine.id}`, { grade: 45, feedback: 'Nice' })).status, 200);
  const d = (await l.get(`/api/lessons/${asg.id}`)).json;
  assert.equal(d.content.submission.status, 'graded');
  assert.equal(d.progress.status, 'completed');
});

test('authoring: build a course with every lesson type', async () => {
  const a = await login('admin@orbit.space');
  const created = await a.post('/api/admin/courses', { title: 'Test Course', level: 'Beginner' });
  assert.equal(created.status, 201);
  const id = created.json.id;
  let b = (await a.get(`/api/admin/courses/${id}/builder`)).json;
  const sec = b.sections[0].id;
  const mk = async (type: string, content: any) => {
    const r = await a.post(`/api/admin/sections/${sec}/lessons`, { type, title: type, content });
    assert.equal(r.status, 201, `${type}: ${JSON.stringify(r.json)}`);
    return r.json.id as number;
  };
  await mk('page', { markdown: '# hi' });
  await mk('link', { url: 'https://example.com' });
  await mk('embed', { url: 'https://example.com' });
  await mk('video', { source: 'youtube', url: 'https://youtu.be/abc' });
  await mk('live', { startsAt: new Date().toISOString() });
  await mk('assignment', { instructions: 'do it' });
  await mk('quiz', { questions: [{ type: 'single', prompt: 'p', options: [{ id: 'a', text: 'A' }, { id: 'b', text: 'B' }], correct: ['b'] }] });
  assert.equal((await a.post(`/api/admin/sections/${sec}/lessons`, { type: 'link', title: 'bad', content: { url: 'javascript:alert(1)' } })).status, 400);
  assert.equal((await a.post(`/api/admin/sections/${sec}/lessons`, { type: 'quiz', title: 'bad', content: { questions: [{ type: 'single', prompt: 'p', options: [{ id: 'a', text: 'A' }] }] } })).status, 400);
  // upload scorm via API
  const fd = new FormData();
  const { buildDemoScorm } = await import('../seed-scorm.ts');
  fd.append('file', new Blob([buildDemoScorm() as any]), 'p.zip');
  const up = await a.req('POST', '/api/files/scorm', undefined, fd);
  assert.equal(up.status, 201, up.text);
  await mk('scorm', { packageId: up.json.id });
  const bad = new FormData();
  bad.append('file', new Blob(['not a zip']), 'x.zip');
  assert.equal((await a.req('POST', '/api/files/scorm', undefined, bad)).status, 400);
  // file upload + serve with range
  const f = new FormData();
  f.append('file', new Blob(['hello world']), 'hello.txt');
  const file = (await a.req('POST', '/api/files', undefined, f)).json;
  assert.equal(file.kind, 'text');
  const got = await fetch(base + file.url, { headers: { Cookie: a.cookie, Range: 'bytes=0-4' } });
  assert.equal(got.status, 206);
  assert.equal(await got.text(), 'hello');
  // reorder + publish
  b = (await a.get(`/api/admin/courses/${id}/builder`)).json;
  const ids = b.sections[0].lessons.map((l: any) => l.id).reverse();
  assert.equal((await a.put(`/api/admin/courses/${id}/order`, { sections: [{ id: sec, lessons: ids }] })).status, 200);
  b = (await a.get(`/api/admin/courses/${id}/builder`)).json;
  assert.deepEqual(b.sections[0].lessons.map((l: any) => l.id), ids);
  assert.equal((await a.patch(`/api/admin/courses/${id}`, { status: 'published' })).status, 200);
  const l = await login('astro@orbit.space');
  assert.equal((await l.get(`/api/courses/${id}`)).status, 200);
  // instructors cannot edit others' courses
  const kai = await login('kai@orbit.space');
  assert.equal((await kai.patch(`/api/admin/courses/${id}`, { title: 'hack' })).status, 403);
  // duplicate & delete
  const dup = await a.post(`/api/admin/courses/${id}/duplicate`);
  assert.equal(dup.status, 201);
  assert.equal((await a.del(`/api/admin/courses/${dup.json.id}`)).status, 200);
});

test('admin: users, groups, enrollments, reports', async () => {
  const a = await login('admin@orbit.space');
  assert.ok((await a.get('/api/admin/users')).json.length >= 16);
  const u = await a.post('/api/admin/users', { name: 'Zed Test', email: 'zed@orbit.space', password: 'Passw0rd!x', role: 'learner' });
  assert.equal(u.status, 201);
  assert.equal((await a.post('/api/admin/users', { name: 'Zed Test', email: 'zed@orbit.space', password: 'Passw0rd!x' })).status, 400);
  assert.equal((await a.patch(`/api/admin/users/1`, { status: 'inactive' })).status, 400, 'cannot deactivate self');
  const g = await a.post('/api/admin/groups', { name: 'QA Crew' });
  assert.equal((await a.put(`/api/admin/groups/${g.json.id}/members`, { userIds: [u.json.id] })).status, 200);
  const course = (await a.get('/api/courses')).json[0];
  const en = await a.post('/api/admin/enrollments', { courseId: course.id, groupId: g.json.id, dueDate: '2030-01-01' });
  assert.equal(en.json.added, 1);
  const stats = (await a.get('/api/admin/stats')).json;
  assert.ok(stats.kpis.enrollments > 10 && stats.trend.length === 30);
  const csv = await a.get('/api/admin/reports/export/enrollments');
  assert.ok(csv.text.includes('learner,email,course'));
  const imp = await a.post('/api/admin/users/import', { rows: [{ name: 'Imp One', email: 'imp1@orbit.space' }, { name: 'Bad', email: 'nope' }] });
  assert.equal(imp.json.created, 1);
  assert.equal(imp.json.errors.length, 1);
  // deactivated user cannot log in
  await a.patch(`/api/admin/users/${u.json.id}`, { status: 'inactive' });
  assert.equal((await new Client().post('/api/auth/login', { email: 'zed@orbit.space', password: 'Passw0rd!x' })).status, 400);
});

test('discussions, notes, reviews, bookmarks, search', async () => {
  const c = await login('astro@orbit.space');
  const c1 = (await c.get('/api/courses')).json.find((x: any) => x.title.startsWith('Foundations'));
  const post = await c.post(`/api/courses/${c1.id}/discussions`, { body: 'Hello!' });
  assert.equal(post.status, 201);
  assert.equal((await c.post(`/api/courses/${c1.id}/discussions`, { body: 'reply', parentId: post.json.id })).status, 201);
  const list = (await c.get(`/api/courses/${c1.id}/discussions`)).json;
  assert.ok(list.find((p: any) => p.id === post.json.id).replies.length === 1);
  assert.equal((await c.post(`/api/courses/${c1.id}/reviews`, { rating: 9 })).status, 400);
  assert.equal((await c.post(`/api/courses/${c1.id}/reviews`, { rating: 5, body: 'great' })).status, 200);
  assert.equal((await c.post(`/api/courses/${c1.id}/bookmark`)).json.saved, true);
  const s = (await c.get('/api/search?q=orbit')).json;
  assert.ok(s.courses.length + s.lessons.length > 0);
  const dash = (await c.get('/api/me/dashboard')).json;
  assert.ok(dash.stats.xp > 0 && dash.week.length === 7);
});

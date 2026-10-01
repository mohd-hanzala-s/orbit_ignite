import { chromium } from 'playwright-core';
import { execSync } from 'node:child_process';
import fs from 'node:fs';
const base = process.env.BASE || 'http://localhost:5173';
execSync(`node --import tsx -e "import('./server/seed-scorm.ts').then(m=>require('fs').writeFileSync('/tmp/e2e-scorm.zip',m.buildDemoScorm()))"`, { stdio: 'inherit' });
fs.writeFileSync('/tmp/e2e-doc.txt', '# Hello\nThis is a plain text document.');
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
const problems = [];
page.on('console', (m) => { if (m.type() === 'error' && !/youtube|favicon|net::ERR/.test(m.text())) problems.push('console: ' + m.text().slice(0, 300)); });
page.on('pageerror', (e) => problems.push('pageerror: ' + e.message));
page.on('response', (r) => { if (r.status() >= 400 && !/youtube|favicon/.test(r.url())) problems.push(`http ${r.status()} ${r.request().method()} ${r.url()}`); });
let n = 0;
const T = { timeout: 8000 };
const run = async (name, fn) => { try { await fn(); console.log(`✓ ${++n}. ${name}`); } catch (e) { console.log(`✗ ${name}: ${e.message.split('\n')[0]}`); await page.screenshot({ path: 'screenshots/fail.png' }); await browser.close(); process.exit(1); } };
const addLesson = async (type, title, fill) => {
  await page.getByRole('button', { name: 'Add lesson' }).first().click();
  await page.getByTestId(`type-${type}`).click();
  await page.getByPlaceholder(/Introduction to orbital/).fill(title);
  await fill?.();
  await page.getByRole('button', { name: 'Add lesson', exact: true }).last().click();
  await page.getByText(title, { exact: true }).first().waitFor(T);
};

await run('admin login', async () => {
  await page.goto(base + '/login');
  await page.getByTestId('demo-admin').click();
  await page.getByRole('button', { name: /sign in/i }).click();
  await page.getByRole('heading', { name: /Welcome back, Maya/ }).waitFor(T);
});
await run('create a course', async () => {
  await page.getByRole('link', { name: 'Courses', exact: true }).click();
  await page.getByRole('button', { name: 'New course' }).click();
  await page.getByLabel('Course title').fill('E2E Test Course');
  await page.getByRole('button', { name: /Create & open builder/ }).click();
  await page.getByRole('heading', { name: 'E2E Test Course' }).waitFor(T);
});
await run('add markdown page lesson', () => addLesson('page', 'Welcome page', async () => { await page.getByLabel('Markdown editor').fill('# Hi\n\n**bold** text'); }));
await run('add link lesson', () => addLesson('link', 'Docs link', async () => { await page.getByPlaceholder('https://…').first().fill('https://example.com'); }));
await run('add YouTube video lesson', () => addLesson('video', 'YT video', async () => { await page.getByRole('tab', { name: 'YouTube' }).click(); await page.getByPlaceholder(/youtube\.com/).fill('https://www.youtube.com/watch?v=uD4izuDMUQA'); }));
await run('add document lesson via upload', () => addLesson('document', 'Text doc', async () => {
  await page.locator('input[type=file]').first().setInputFiles('/tmp/e2e-doc.txt');
  await page.getByText('e2e-doc.txt').waitFor(T);
}));
await run('add SCORM lesson via zip upload', () => addLesson('scorm', 'SCORM lesson', async () => {
  await page.locator('input[type=file]').first().setInputFiles('/tmp/e2e-scorm.zip');
  await page.getByText(/SCORM 1\.2 · 2 files/).waitFor(T);
}));
await run('add quiz lesson with questions', () => addLesson('quiz', 'Final quiz', async () => {
  await page.getByRole('button', { name: 'Single choice' }).click();
  await page.getByLabel('Question prompt').fill('Capital of France?');
  await page.getByLabel('Option 1', { exact: true }).fill('Paris');
  await page.getByLabel('Option 2', { exact: true }).fill('Rome');
  await page.getByLabel('Mark option 1 correct').click();
  await page.getByRole('button', { name: 'True / False' }).click();
  await page.getByLabel('Question prompt').nth(1).fill('The Moon is a planet.');
  await page.getByRole('button', { name: 'false', exact: true }).click();
}));
await run('add live session lesson', () => addLesson('live', 'Live Q&A', async () => {
  const d = new Date(Date.now() + 2 * 864e5); const p = (x) => String(x).padStart(2, '0');
  await page.getByLabel('Starts at').fill(`${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T10:00`);
  await page.getByLabel('Join link').fill('https://zoom.us/j/123');
}));
await run('validation: empty quiz question prompt is rejected', async () => {
  await page.getByRole('button', { name: 'Add lesson' }).first().click();
  await page.getByTestId('type-quiz').click();
  await page.getByPlaceholder(/Introduction to orbital/).fill('Bad quiz');
  await page.getByRole('button', { name: 'Multiple choice' }).click();
  await page.getByRole('button', { name: 'Add lesson', exact: true }).last().click();
  await page.getByText(/needs a prompt|needs a correct answer|at least/).first().waitFor(T);
  await page.keyboard.press('Escape');
  await page.getByRole('dialog').waitFor({ state: 'detached', timeout: 5000 });
});
await run('edit details & settings tabs save', async () => {
  await page.getByRole('tab', { name: 'Details' }).click();
  await page.getByLabel('Subtitle').fill('Created by Playwright');
  await page.getByRole('button', { name: 'Save details' }).click();
  await page.getByText('Details saved').waitFor(T);
  await page.getByRole('tab', { name: 'Settings' }).click();
  await page.getByRole('switch').nth(1).click();
  await page.getByRole('button', { name: 'Save settings' }).click();
  await page.getByText('Settings saved').waitFor(T);
  await page.getByRole('tab', { name: 'Curriculum' }).click();
});
await run('publish course', async () => {
  await page.getByRole('button', { name: 'Publish', exact: true }).click();
  await page.getByRole('button', { name: 'Unpublish' }).waitFor(T);
});
await run('assign learners via group', async () => {
  await page.getByRole('tab', { name: /Learners/ }).click();
  await page.getByRole('button', { name: 'Assign learners' }).click();
  await page.getByLabel('Search learners').fill('Alex');
  await page.getByText('Alex Rivera').click();
  await page.getByRole('button', { name: /^Assign \(1\)/ }).click();
  await page.getByText('Alex Rivera').first().waitFor(T);
});
await run('learner sees and opens the new course (sequential locks, SCORM + doc + quiz render)', async () => {
  const lctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const lp = await lctx.newPage();
  await lp.goto(base + '/login');
  await lp.getByTestId('demo-learner').click();
  await lp.getByRole('button', { name: /sign in/i }).click();
  await lp.goto(base + '/catalog?q=E2E');
  await lp.getByRole('heading', { name: 'E2E Test Course' }).click();
  await lp.getByRole('link', { name: /Start course/ }).click();
  await lp.getByRole('heading', { level: 1, name: 'Welcome page' }).waitFor(T);
  await lp.getByText('bold', { exact: true }).waitFor(T);
  // sequential on → second lesson locked
  const locked = await lp.locator('[title*="Complete the previous"]').count();
  if (!locked) throw new Error('expected locked lessons in sequential course');
  await lp.keyboard.press('c');
  await lp.getByRole('link', { name: /Docs link/ }).click();
  await lp.getByRole('link', { name: /Open resource/ }).waitFor(T);
  await lp.getByRole('button', { name: /Mark as complete/ }).click();
  await lp.getByRole('link', { name: /YT video/ }).click();
  await lp.getByRole('button', { name: /Mark as complete/ }).waitFor(T);
  await lp.getByRole('button', { name: /Mark as complete/ }).click();
  await lp.getByRole('link', { name: /Text doc/ }).click();
  await lp.getByText('This is a plain text document.').waitFor(T);
  await lp.screenshot({ path: 'screenshots/e2e-doc.png' });
  await lp.getByRole('button', { name: /Mark as complete/ }).click();
  await lp.getByRole('link', { name: /SCORM lesson/ }).click();
  await lp.frameLocator('iframe').getByText(/Connected to LMS/).waitFor(T);
  await lctx.close();
});

await run('drag-reorder lessons persists after reload', async () => {
  await page.goto(page.url().replace(/\?.*/, ''));
  await page.getByRole('tab', { name: 'Curriculum' }).click();
  const names = async () => (await page.locator('[aria-label^="Edit "]').evaluateAll((els) => els.map((e) => e.getAttribute('aria-label').replace('Edit ', ''))));
  const before = await names();
  const handle = page.getByLabel('Drag to reorder').first();
  const target = page.getByLabel('Drag to reorder').nth(2);
  const hb = await handle.boundingBox(); const tb = await target.boundingBox();
  await page.mouse.move(hb.x + hb.width / 2, hb.y + hb.height / 2);
  await page.mouse.down();
  await page.mouse.move(hb.x + 2, hb.y + 30, { steps: 5 });
  await page.mouse.move(tb.x + 2, tb.y + 40, { steps: 12 });
  await page.mouse.up();
  await page.waitForTimeout(1200);
  await page.reload();
  await page.getByText('Welcome page').first().waitFor(T);
  const after = await names();
  if (JSON.stringify(before) === JSON.stringify(after)) throw new Error('order did not change: ' + after.join(', '));
  if (after[0] === before[0]) throw new Error('first lesson did not move');
});
console.log(problems.length ? '\nPROBLEMS:\n' + [...new Set(problems)].join('\n') : '\nNo console/network problems.');
await browser.close();

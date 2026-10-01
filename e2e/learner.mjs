import { chromium } from 'playwright-core';
const base = process.env.BASE || 'http://localhost:5173';
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
const problems = [];
page.on('console', (m) => { if (m.type() === 'error' && !/youtube|favicon|ERR_BLOCKED|net::ERR/.test(m.text())) problems.push('console: ' + m.text().slice(0, 300)); });
page.on('pageerror', (e) => problems.push('pageerror: ' + e.message));
page.on('response', (r) => { if (r.status() >= 400 && !/youtube|favicon/.test(r.url())) problems.push(`http ${r.status()} ${r.request().method()} ${r.url()}`); });
let step = 0;
const ok = (name) => console.log(`✓ ${++step}. ${name}`);
const fail = async (name, e) => { console.log(`✗ ${name}: ${e.message.split('\n')[0]}`); await page.screenshot({ path: 'screenshots/fail.png' }); await browser.close(); process.exit(1); };
const run = async (name, fn) => { try { await fn(); ok(name); } catch (e) { await fail(name, e); } };
const T = { timeout: 8000 };

await run('login via demo account button', async () => {
  await page.goto(base + '/login');
  await page.getByTestId('demo-learner').click();
  await page.getByRole('button', { name: /sign in/i }).click();
  await page.getByRole('heading', { name: /Alex/ }).waitFor(T);
});
await run('command palette search finds a course', async () => {
  await page.keyboard.press('Control+k');
  await page.getByPlaceholder(/Search courses, lessons/).fill('propulsion');
  await page.getByRole('option', { name: /Rocket Propulsion 101/ }).first().click();
  await page.getByRole('heading', { name: 'Rocket Propulsion 101' }).waitFor(T);
});
await run('enroll in course and land in player', async () => {
  await page.getByRole('button', { name: /Enroll/ }).click();
  await page.waitForURL(/\/learn\//, T);
  await page.getByRole('heading', { level: 1, name: 'Tsiolkovsky in one page' }).waitFor(T);
});
await run('mark page lesson complete with keyboard shortcut', async () => {
  await page.keyboard.press('c');
  await page.getByText('Completed', { exact: true }).first().waitFor(T);
});
await run('add a note and see it listed', async () => {
  await page.getByRole('tab', { name: /Notes/ }).click();
  await page.getByLabel('New note').fill('Remember: Isp is exponential!');
  await page.getByRole('button', { name: 'Save note' }).click();
  await page.getByText('Remember: Isp is exponential!').waitFor(T);
});
await run('post in lesson discussion', async () => {
  await page.getByRole('tab', { name: 'Discussion' }).click();
  await page.getByLabel(/Ask a question or share/).fill('Is staging always worth it?');
  await page.getByRole('button', { name: 'Post', exact: true }).click();
  await page.getByText('Is staging always worth it?').first().waitFor(T);
});
await run('next lesson (video) plays uploaded video', async () => {
  await page.getByRole('button', { name: /Next lesson/ }).click();
  await page.getByRole('heading', { level: 1, name: 'Mission preview' }).waitFor(T);
  await page.locator('video').waitFor(T);
  await page.waitForFunction(() => { const v = document.querySelector('video'); return v && v.readyState >= 1 && v.duration > 5; }, null, T);
  await page.getByRole('button', { name: /Mark as complete/ }).click();
  await page.getByText('Completed', { exact: true }).first().waitFor(T);
});
await run('take quiz: wrong then right', async () => {
  await page.getByRole('link', { name: /Propulsion quiz/ }).click();
  await page.getByRole('button', { name: /Start quiz/ }).click();
  await page.getByRole('radio', { name: 'Solid motor' }).click();
  await page.getByRole('button', { name: /Next/ }).click();
  await page.getByLabel('Your answer').fill('thrust');
  page.once('dialog', (d) => d.accept());
  await page.getByRole('button', { name: 'Submit quiz' }).click();
  await page.getByText('Almost there!').waitFor(T);
  await page.getByRole('button', { name: /Try again/ }).click();
  await page.getByRole('radio', { name: 'Ion thruster' }).click();
  await page.getByRole('button', { name: /Next/ }).click();
  await page.getByLabel('Your answer').fill('Impulse');
  await page.getByRole('button', { name: 'Submit quiz' }).click();
  await page.getByText('Mission accomplished!').waitFor(T);
});
await run('course completes → celebration + certificate', async () => {
  await page.getByText(/Mission complete!/).first().waitFor({ timeout: 8000 });
  await page.getByRole('link', { name: /View certificate/ }).click();
  await page.getByText('Rocket Propulsion 101').first().waitFor(T);
});
await run('SCORM end-to-end completes lesson', async () => {
  await page.goto(base + '/courses/2/learn/12');
  const f = page.frameLocator('iframe[title="Pre-flight Safety Checklist"]');
  await f.getByText('Connected to LMS as Alex Rivera').waitFor(T);
  for (let step = 0; step < 2; step++) {
    for (const cb of await f.locator('input[type=checkbox]').all()) await cb.check();
    await f.getByRole('button', { name: 'Continue' }).click();
  }
  await f.getByRole('button', { name: /emergency oxygen/ }).click();
  await f.getByText('Cleared for launch!').waitFor(T);
  await page.waitForFunction(() => document.body.innerText.includes('Completed'), null, T);
  const state = await page.evaluate(() => fetch('/api/lessons/12', { credentials: 'same-origin' }).then((r) => r.json()));
  if (state.progress?.status !== 'completed' || Math.round(state.progress.score) !== 100) throw new Error('lesson not completed: ' + JSON.stringify(state.progress));
});
await run('assignment: submit text + file', async () => {
  await page.goto(base + '/courses/1/learn/10');
  await page.waitForTimeout(500);
  const h = await page.locator('h1').first().innerText();
  if (!/Capstone/.test(h)) throw new Error('unexpected lesson ' + h);
  await page.getByLabel('Response text').fill('My playbook: brief daily, feedback kindly.');
  await page.locator('input[type=file]').setInputFiles({ name: 'playbook.txt', mimeType: 'text/plain', buffer: Buffer.from('hello') });
  await page.getByText('playbook.txt').waitFor(T);
  await page.getByRole('button', { name: 'Submit for review' }).click();
  await page.getByText('Awaiting review').waitFor(T);
});
await run('theme toggle persists', async () => {
  await page.goto(base + '/');
  await page.getByRole('button', { name: 'Toggle theme' }).click();
  const light = await page.evaluate(() => !document.documentElement.classList.contains('dark'));
  if (!light) throw new Error('did not switch to light');
  await page.reload();
  if (await page.evaluate(() => document.documentElement.classList.contains('dark'))) throw new Error('theme not persisted');
  await page.screenshot({ path: 'screenshots/light-dash.png' });
  await page.getByRole('button', { name: 'Toggle theme' }).click();
});
await run('mobile layout: drawer nav works', async () => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(base + '/catalog');
  await page.getByRole('button', { name: 'Open menu' }).click();
  await page.getByRole('link', { name: 'Achievements' }).click();
  await page.getByRole("heading", { name: "Achievements" }).waitFor(T); await page.waitForTimeout(800);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 2);
  if (overflow) throw new Error('horizontal overflow on mobile');
  await page.screenshot({ path: 'screenshots/mobile-ach.png' });
});
await run('logout returns to login', async () => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(base + '/');
  await page.getByRole('button', { name: 'Account menu' }).click();
  await page.getByRole('menuitem', { name: 'Sign out' }).click();
  await page.waitForURL(/\/login/, T);
});
console.log(problems.length ? '\nPROBLEMS:\n' + [...new Set(problems)].join('\n') : '\nNo console/network problems.');
await browser.close();

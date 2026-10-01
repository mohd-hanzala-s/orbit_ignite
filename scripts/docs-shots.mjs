// Generates README screenshots. Run via:  e2e/run.sh scripts/docs-shots.mjs
import { chromium } from 'playwright-core';
const base = process.env.BASE;
const emails = { admin: 'admin@orbit.space', learner: 'astro@orbit.space' };
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const shots = [
  ['none', '/login', 'login', 'dark'], ['learner', '/', 'dashboard', 'dark'], ['learner', '/', 'dashboard-light', 'light'], ['learner', '/catalog', 'catalog', 'dark'],
  ['learner', '/courses/1/learn/7', 'player-quiz', 'dark'], ['learner', '/courses/2/learn/12', 'player-scorm', 'dark'], ['learner', '/achievements', 'achievements', 'dark'], ['learner', '/certificates/1', 'certificate', 'dark'],
  ['admin', '/admin', 'admin-dashboard', 'dark'], ['admin', '/admin/courses/1', 'course-builder', 'dark'], ['admin', '/admin/users', 'admin-users', 'light'],
];
for (const [role, path, name, theme] of shots) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await ctx.addInitScript((t) => { try { localStorage.setItem('orbit-theme', t); } catch {} }, theme);
  if (role !== 'none') await ctx.request.post(base + '/api/auth/login', { data: { email: emails[role], password: 'Orbit123!' }, headers: { 'X-Requested-With': 'orbit' } });
  const page = await ctx.newPage();
  await page.goto(base + path, { waitUntil: 'networkidle' });
  await page.waitForTimeout(2200);
  await page.screenshot({ path: `docs/screenshots/${name}.png`, type: 'png' });
  console.log('shot', name);
  await ctx.close();
}
await browser.close();

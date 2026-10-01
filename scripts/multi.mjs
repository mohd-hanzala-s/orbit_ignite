// Usage: node scripts/multi.mjs role outprefix path1 path2 ...   (screenshots each path)
import { chromium } from 'playwright-core';
const [role, prefix, ...paths] = process.argv.slice(2);
const emails = { admin: 'admin@orbit.space', instructor: 'nova@orbit.space', learner: 'astro@orbit.space' };
const base = process.env.BASE || 'http://localhost:5173';
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
await ctx.request.post(base + '/api/auth/login', { data: { email: emails[role], password: 'Orbit123!' }, headers: { 'X-Requested-With': 'orbit' } });
await ctx.addInitScript((t) => { try { localStorage.setItem('orbit-theme', t); } catch {} }, process.env.THEME || 'dark');
const page = await ctx.newPage();
const errors = [];
page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text().slice(0, 200)); });
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
page.on('response', (r) => { if (r.status() >= 400) errors.push(`http ${r.status()} ${r.url()}`); });
let i = 0;
for (const p of paths) {
  await page.goto(base + p, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);
  const f = `${prefix}-${i++}.png`;
  await page.screenshot({ path: f });
  console.log(f, '←', p);
}
if (errors.length) console.log('ERRORS:\n' + [...new Set(errors)].join('\n'));
await browser.close();

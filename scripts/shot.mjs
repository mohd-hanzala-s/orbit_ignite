// Usage: node scripts/shot.mjs <role|none> <path> <out.png> [width] [height] [--dark|--light] [--full]
import { chromium } from 'playwright-core';
const [role, path, out, w = '1440', h = '900', ...flags] = process.argv.slice(2);
const emails = { admin: 'admin@orbit.space', instructor: 'nova@orbit.space', learner: 'astro@orbit.space' };
const base = process.env.BASE || 'http://localhost:5173';
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const ctx = await browser.newContext({ viewport: { width: +w, height: +h }, deviceScaleFactor: 1 });
const page = await ctx.newPage();
const errors = [];
page.on('console', (m) => { if (['error'].includes(m.type())) errors.push('console: ' + m.text()); });
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
page.on('response', (r) => { if (r.status() >= 400 && !r.url().includes('favicon')) errors.push(`http ${r.status()} ${r.url()}`); });
if (role !== 'none') {
  const r = await ctx.request.post(base + '/api/auth/login', { data: { email: emails[role], password: 'Orbit123!' }, headers: { 'X-Requested-With': 'orbit' } });
  if (!r.ok()) throw new Error('login failed ' + r.status());
}
await page.addInitScript((t) => { try { localStorage.setItem('orbit-theme', t); } catch {} }, flags.includes('--light') ? 'light' : 'dark');
await page.goto(base + path, { waitUntil: 'networkidle' });
await page.waitForTimeout(1600);
await page.screenshot({ path: out, fullPage: flags.includes('--full') });
if (errors.length) console.log('ERRORS:\n' + [...new Set(errors)].join('\n'));
await browser.close();

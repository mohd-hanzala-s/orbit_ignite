import { chromium } from 'playwright-core';
const base = process.env.BASE || 'http://localhost:5173';
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
await ctx.request.post(base + '/api/auth/login', { data: { email: 'astro@orbit.space', password: 'Orbit123!' }, headers: { 'X-Requested-With': 'orbit' } });
const page = await ctx.newPage();
for (const [p, n] of [['/', 'm-dash'], ['/courses/1/learn/7', 'm-player'], ['/catalog', 'm-catalog']]) { await page.goto(base + p, { waitUntil: 'networkidle' }); await page.waitForTimeout(1500); await page.screenshot({ path: `screenshots/${n}.png` }); }
await b.close();

import { chromium } from 'playwright-core';
const base='http://localhost:5173';
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const ctx = await b.newContext({ viewport: { width: 390, height: 844 } });
await ctx.request.post(base+'/api/auth/login',{data:{email:process.env.EMAIL||'astro@orbit.space',password:'Orbit123!'},headers:{'X-Requested-With':'orbit'}});
const page = await ctx.newPage();
for (const p of (process.env.PATHS?process.env.PATHS.split(','):['/', '/catalog','/achievements','/courses/1','/learning','/paths','/calendar','/certificates','/profile','/courses/1/learn/1','/courses/1/learn/7','/courses/1/learn/9','/courses/1/learn/10','/profile'])) {
  await page.goto(base+p,{waitUntil:'networkidle'}); await page.waitForTimeout(700);
  const r = await page.evaluate(()=>{ const w=window.innerWidth; const sw=document.documentElement.scrollWidth; const off=[]; if(sw>w+1){ for(const el of document.querySelectorAll('body *')){ const r=el.getBoundingClientRect(); if(r.right>w+1 && r.width>0 && getComputedStyle(el).position!=='fixed') off.push(el.tagName+'.'+String(el.className).slice(0,60)+' '+Math.round(r.right)); } } return {sw,w,off:off.slice(0,4)}; });
  console.log(p, r.sw>r.w+1 ? 'OVERFLOW '+JSON.stringify(r) : 'ok');
}
await b.close();

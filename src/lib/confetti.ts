/** Tiny dependency-free confetti burst in the Orbit palette. */
export function confetti(opts: { count?: number; duration?: number } = {}) {
  if (typeof document === 'undefined' || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const { count = 140, duration = 2600 } = opts;
  const canvas = document.createElement('canvas');
  Object.assign(canvas.style, { position: 'fixed', inset: '0', width: '100%', height: '100%', pointerEvents: 'none', zIndex: '100' });
  const dpr = window.devicePixelRatio || 1;
  canvas.width = window.innerWidth * dpr;
  canvas.height = window.innerHeight * dpr;
  document.body.appendChild(canvas);
  const ctx = canvas.getContext('2d')!;
  ctx.scale(dpr, dpr);
  const colors = ['#8b6cff', '#38d9f5', '#ff6aa8', '#ffb547', '#3ddc97', '#ffffff'];
  const w = window.innerWidth;
  const parts = Array.from({ length: count }, () => ({
    x: w / 2 + (Math.random() - 0.5) * 120, y: window.innerHeight * 0.55,
    vx: (Math.random() - 0.5) * 16, vy: -Math.random() * 18 - 6,
    s: Math.random() * 7 + 4, r: Math.random() * Math.PI, vr: (Math.random() - 0.5) * 0.4,
    c: colors[Math.floor(Math.random() * colors.length)], star: Math.random() > 0.7,
  }));
  const start = performance.now();
  const tick = (t: number) => {
    const p = (t - start) / duration;
    ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
    for (const q of parts) {
      q.vy += 0.42; q.vx *= 0.992; q.x += q.vx; q.y += q.vy; q.r += q.vr;
      ctx.save(); ctx.translate(q.x, q.y); ctx.rotate(q.r); ctx.globalAlpha = Math.max(0, 1 - p * 1.1); ctx.fillStyle = q.c;
      if (q.star) { ctx.beginPath(); for (let i = 0; i < 5; i++) { ctx.lineTo(Math.cos((i * 4 * Math.PI) / 5) * q.s, Math.sin((i * 4 * Math.PI) / 5) * q.s); } ctx.closePath(); ctx.fill(); }
      else ctx.fillRect(-q.s / 2, -q.s / 3, q.s, q.s * 0.66);
      ctx.restore();
    }
    if (p < 1) requestAnimationFrame(tick); else canvas.remove();
  };
  requestAnimationFrame(tick);
}

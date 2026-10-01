import { useEffect, useRef } from 'react';

interface Star { x: number; y: number; z: number; r: number; tw: number; sp: number }

/** Subtle parallax starfield with the occasional shooting star. Pauses when the tab is hidden. */
export function Starfield() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current!;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let w = 0, h = 0, raf = 0, stars: Star[] = [];
    let shoot: { x: number; y: number; vx: number; vy: number; life: number } | null = null;
    let nextShoot = performance.now() + 4000;
    const mouse = { x: 0, y: 0 };

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = window.innerWidth; h = window.innerHeight;
      canvas.width = w * dpr; canvas.height = h * dpr;
      canvas.style.width = w + 'px'; canvas.style.height = h + 'px';
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const count = Math.min(220, Math.floor((w * h) / 9000));
      stars = Array.from({ length: count }, () => ({ x: Math.random() * w, y: Math.random() * h, z: Math.random(), r: Math.random() * 1.2 + 0.3, tw: Math.random() * Math.PI * 2, sp: 0.4 + Math.random() * 1.4 }));
    };
    const onMove = (e: MouseEvent) => { mouse.x = (e.clientX / w - 0.5); mouse.y = (e.clientY / h - 0.5); };

    const draw = (t: number) => {
      ctx.clearRect(0, 0, w, h);
      for (const s of stars) {
        const a = reduce ? 0.7 : 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(t / 1000 * s.sp + s.tw));
        const px = (s.x + mouse.x * 18 * s.z + w) % w;
        const py = (s.y + mouse.y * 18 * s.z + (reduce ? 0 : t / 1000 * s.z * 1.2) + h) % h;
        ctx.globalAlpha = a * (0.4 + s.z * 0.6);
        ctx.fillStyle = s.z > 0.85 ? '#cfd8ff' : s.z > 0.5 ? '#ffffff' : '#a9a6ff';
        ctx.beginPath(); ctx.arc(px, py, s.r * (0.6 + s.z), 0, Math.PI * 2); ctx.fill();
      }
      if (!reduce) {
        if (!shoot && t > nextShoot) {
          shoot = { x: Math.random() * w * 0.8, y: Math.random() * h * 0.35, vx: 9 + Math.random() * 4, vy: 4 + Math.random() * 2, life: 1 };
          nextShoot = t + 7000 + Math.random() * 9000;
        }
        if (shoot) {
          const g = ctx.createLinearGradient(shoot.x, shoot.y, shoot.x - shoot.vx * 9, shoot.y - shoot.vy * 9);
          g.addColorStop(0, `rgba(255,255,255,${shoot.life})`); g.addColorStop(1, 'rgba(255,255,255,0)');
          ctx.globalAlpha = 1; ctx.strokeStyle = g; ctx.lineWidth = 1.6;
          ctx.beginPath(); ctx.moveTo(shoot.x, shoot.y); ctx.lineTo(shoot.x - shoot.vx * 9, shoot.y - shoot.vy * 9); ctx.stroke();
          shoot.x += shoot.vx; shoot.y += shoot.vy; shoot.life -= 0.018;
          if (shoot.life <= 0 || shoot.x > w + 100 || shoot.y > h + 100) shoot = null;
        }
      }
      ctx.globalAlpha = 1;
    };
    const loop = (t: number) => { draw(t); raf = requestAnimationFrame(loop); };
    const vis = () => { cancelAnimationFrame(raf); if (!document.hidden && !reduce) raf = requestAnimationFrame(loop); };

    resize();
    draw(0);
    if (!reduce) raf = requestAnimationFrame(loop);
    window.addEventListener('resize', resize);
    window.addEventListener('mousemove', onMove, { passive: true });
    document.addEventListener('visibilitychange', vis);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
      window.removeEventListener('mousemove', onMove);
      document.removeEventListener('visibilitychange', vis);
    };
  }, []);

  return (
    <>
      <div className="space-bg" aria-hidden />
      <canvas ref={ref} className="starfield pointer-events-none fixed inset-0 -z-[1]" aria-hidden />
    </>
  );
}

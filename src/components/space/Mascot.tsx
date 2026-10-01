import { useId } from 'react';
import { cn } from '@/lib/utils';

export type Mood = 'idle' | 'wave' | 'happy' | 'cheer' | 'think' | 'sleep' | 'oops';

/** Comet — the Orbit Ignite astro-cat. Pure SVG so it stays crisp and themeable. */
export function Mascot({ mood = 'idle', size = 160, float = true, className, title = 'Comet, the Orbit Ignite mascot' }: { mood?: Mood; size?: number; float?: boolean; className?: string; title?: string }) {
  const id = useId().replace(/:/g, '');
  const closed = mood === 'sleep' || mood === 'cheer';
  const armUp = mood === 'cheer';
  const waving = mood === 'wave';
  const thinking = mood === 'think';
  return (
    <svg
      role="img"
      aria-label={title}
      viewBox="0 0 220 236"
      width={size}
      height={(size * 236) / 220}
      className={cn('overflow-visible select-none', float && 'animate-float', className)}
    >
      <defs>
        <radialGradient id={`${id}-glass`} cx="35%" cy="25%" r="85%">
          <stop offset="0" stopColor="#4a47c9" />
          <stop offset="0.55" stopColor="#242a78" />
          <stop offset="1" stopColor="#10143f" />
        </radialGradient>
        <linearGradient id={`${id}-suit`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset="1" stopColor="#dcdaf7" />
        </linearGradient>
        <linearGradient id={`${id}-boot`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#7c5cff" />
          <stop offset="1" stopColor="#4a35c9" />
        </linearGradient>
        <linearGradient id={`${id}-fur`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffbf7a" />
          <stop offset="1" stopColor="#ff9a4d" />
        </linearGradient>
        <style>{`
          .c-blink-${id}{transform-box:fill-box;transform-origin:center;animation:c-blink-${id} 4.6s infinite}
          @keyframes c-blink-${id}{0%,92%,100%{transform:scaleY(1)}95%{transform:scaleY(.08)}}
          .c-wave-${id}{transform-box:view-box;transform-origin:140px 150px;animation:c-wave-${id} 1.1s ease-in-out infinite}
          @keyframes c-wave-${id}{0%,100%{transform:rotate(-8deg)}50%{transform:rotate(14deg)}}
          .c-tail-${id}{transform-box:view-box;transform-origin:148px 188px;animation:c-tail-${id} 3s ease-in-out infinite}
          @keyframes c-tail-${id}{0%,100%{transform:rotate(-4deg)}50%{transform:rotate(6deg)}}
          .c-z-${id}{animation:c-z-${id} 2.8s ease-in-out infinite}
          @keyframes c-z-${id}{0%{opacity:0;transform:translate(0,6px)}40%{opacity:1}100%{opacity:0;transform:translate(10px,-14px)}}
        `}</style>
      </defs>

      {/* ground glow */}
      <ellipse cx="110" cy="226" rx="52" ry="6" fill="#000" opacity="0.18" />

      {/* tail */}
      <g className={`c-tail-${id}`}>
        <path d="M146 192 C 188 196, 206 170, 196 140 C 192 128, 182 124, 178 130" fill="none" stroke="#ff9a4d" strokeWidth="14" strokeLinecap="round" />
        <path d="M196 140 C 192 128, 182 124, 178 130" fill="none" stroke="#fff3e3" strokeWidth="14" strokeLinecap="round" />
        <path d="M184 188 l6 -7 M196 168 l8 -3" stroke="#e6762a" strokeWidth="4" strokeLinecap="round" />
      </g>

      {/* backpack */}
      <rect x="66" y="132" width="88" height="64" rx="20" fill="#4a35c9" />
      <rect x="58" y="146" width="14" height="30" rx="7" fill="#7c5cff" />
      <rect x="148" y="146" width="14" height="30" rx="7" fill="#7c5cff" />

      {/* legs & boots */}
      <rect x="84" y="186" width="24" height="30" rx="11" fill={`url(#${id}-boot)`} />
      <rect x="112" y="186" width="24" height="30" rx="11" fill={`url(#${id}-boot)`} />
      <rect x="82" y="208" width="28" height="9" rx="4.5" fill="#2a1f8f" />
      <rect x="110" y="208" width="28" height="9" rx="4.5" fill="#2a1f8f" />

      {/* torso */}
      <rect x="76" y="128" width="68" height="68" rx="28" fill={`url(#${id}-suit)`} />
      <rect x="95" y="150" width="30" height="20" rx="7" fill="#1c1f55" />
      <circle cx="104" cy="160" r="3.2" fill="#38d9f5" />
      <circle cx="112" cy="160" r="3.2" fill="#ff6aa8" />
      <circle cx="120" cy="160" r="3.2" fill="#ffb547" />

      {/* left arm */}
      {armUp ? (
        <g>
          <path d="M82 148 C 64 140, 52 120, 54 100" fill="none" stroke="#f1f0ff" strokeWidth="18" strokeLinecap="round" />
          <circle cx="54" cy="98" r="10" fill="#7c5cff" />
        </g>
      ) : thinking ? (
        <g>
          <path d="M82 150 C 64 156, 70 132, 92 124" fill="none" stroke="#f1f0ff" strokeWidth="18" strokeLinecap="round" />
          <circle cx="94" cy="122" r="10" fill="#7c5cff" />
        </g>
      ) : (
        <g>
          <path d="M82 148 C 66 156, 60 170, 62 182" fill="none" stroke="#f1f0ff" strokeWidth="18" strokeLinecap="round" />
          <circle cx="62" cy="184" r="10" fill="#7c5cff" />
        </g>
      )}
      {/* right arm */}
      {armUp ? (
        <g>
          <path d="M138 148 C 156 140, 168 120, 166 100" fill="none" stroke="#f1f0ff" strokeWidth="18" strokeLinecap="round" />
          <circle cx="166" cy="98" r="10" fill="#7c5cff" />
        </g>
      ) : waving ? (
        <g className={`c-wave-${id}`}>
          <path d="M138 148 C 160 142, 172 120, 170 96" fill="none" stroke="#f1f0ff" strokeWidth="18" strokeLinecap="round" />
          <circle cx="170" cy="94" r="10" fill="#7c5cff" />
        </g>
      ) : (
        <g>
          <path d="M138 148 C 154 156, 160 170, 158 182" fill="none" stroke="#f1f0ff" strokeWidth="18" strokeLinecap="round" />
          <circle cx="158" cy="184" r="10" fill="#7c5cff" />
        </g>
      )}

      {/* ears (poke out of the helmet) */}
      <path d="M58 62 L52 20 L92 44 Z" fill="#f6f5ff" stroke="#f6f5ff" strokeWidth="10" strokeLinejoin="round" />
      <path d="M62 54 L59 30 L80 44 Z" fill="#ff8fb8" stroke="#ff8fb8" strokeWidth="4" strokeLinejoin="round" />
      <path d="M162 62 L168 20 L128 44 Z" fill="#f6f5ff" stroke="#f6f5ff" strokeWidth="10" strokeLinejoin="round" />
      <path d="M158 54 L161 30 L140 44 Z" fill="#ff8fb8" stroke="#ff8fb8" strokeWidth="4" strokeLinejoin="round" />

      {/* helmet */}
      <circle cx="110" cy="92" r="64" fill="#f1f0ff" />
      <circle cx="110" cy="92" r="64" fill="none" stroke="#c9c7f2" strokeWidth="2" />
      <circle cx="110" cy="92" r="55" fill={`url(#${id}-glass)`} />
      <ellipse cx="110" cy="142" rx="42" ry="9" fill="#7c5cff" />
      <ellipse cx="110" cy="141" rx="42" ry="5" fill="#a78bff" opacity=".6" />

      {/* face */}
      <ellipse cx="110" cy="96" rx="40" ry="35" fill={`url(#${id}-fur)`} />
      <path d="M100 66 l2 9 M110 64 v10 M120 66 l-2 9" stroke="#e6762a" strokeWidth="3.2" strokeLinecap="round" />
      <ellipse cx="110" cy="108" rx="21" ry="15" fill="#fff3e3" />
      <ellipse cx="82" cy="106" rx="7" ry="4.4" fill="#ff6aa8" opacity=".45" />
      <ellipse cx="138" cy="106" rx="7" ry="4.4" fill="#ff6aa8" opacity=".45" />

      {/* eyes */}
      {closed ? (
        <g fill="none" stroke="#1a1640" strokeWidth="3.6" strokeLinecap="round">
          {mood === 'cheer' ? (
            <>
              <path d="M85 94 q8 -10 16 0" />
              <path d="M119 94 q8 -10 16 0" />
            </>
          ) : (
            <>
              <path d="M85 92 q8 7 16 0" />
              <path d="M119 92 q8 7 16 0" />
            </>
          )}
        </g>
      ) : (
        <g className={`c-blink-${id}`}>
          <ellipse cx="93" cy="92" rx="7.4" ry="9.4" fill="#1a1640" />
          <ellipse cx="127" cy="92" rx="7.4" ry="9.4" fill="#1a1640" />
          <circle cx={thinking ? 91 : 95.5} cy={thinking ? 86 : 88.5} r="2.9" fill="#fff" />
          <circle cx={thinking ? 125 : 129.5} cy={thinking ? 86 : 88.5} r="2.9" fill="#fff" />
          <circle cx="91" cy="96" r="1.3" fill="#fff" opacity=".8" />
          <circle cx="125" cy="96" r="1.3" fill="#fff" opacity=".8" />
        </g>
      )}
      {mood === 'oops' && <path d="M82 80 l14 -4 M138 80 l-14 -4" stroke="#1a1640" strokeWidth="3" strokeLinecap="round" />}

      {/* nose & mouth */}
      <path d="M105.5 101 h9 l-4.5 5.2 z" fill="#ff6aa8" stroke="#ff6aa8" strokeWidth="1.6" strokeLinejoin="round" />
      {mood === 'cheer' ? (
        <path d="M101 110 q9 14 18 0 z" fill="#7a2a4a" stroke="#7a2a4a" strokeWidth="2" strokeLinejoin="round" />
      ) : thinking || mood === 'oops' ? (
        <ellipse cx="110" cy="114" rx="3.4" ry="4" fill="#7a2a4a" />
      ) : mood === 'sleep' ? (
        <path d="M105 112 q5 3 10 0" fill="none" stroke="#7a2a4a" strokeWidth="2.6" strokeLinecap="round" />
      ) : (
        <path d="M110 106 v4 M110 110 q-5 6 -10 0 M110 110 q5 6 10 0" fill="none" stroke="#7a2a4a" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
      )}
      {/* whiskers */}
      <g stroke="#c9792f" strokeWidth="1.8" strokeLinecap="round" opacity=".75">
        <path d="M78 104 l-10 -2 M78 109 l-11 3" />
        <path d="M142 104 l10 -2 M142 109 l11 3" />
      </g>

      {/* glass glare */}
      <path d="M68 70 C 74 52, 92 42, 112 41" fill="none" stroke="#fff" strokeOpacity=".5" strokeWidth="5" strokeLinecap="round" />
      <circle cx="66" cy="84" r="2.6" fill="#fff" fillOpacity=".5" />

      {/* extras */}
      {mood === 'sleep' && (
        <g fill="#c9c7f2" fontFamily="Space Grotesk Variable, sans-serif" fontWeight="700">
          <text x="168" y="46" fontSize="18" className={`c-z-${id}`}>z</text>
          <text x="182" y="30" fontSize="13" className={`c-z-${id}`} style={{ animationDelay: '0.9s' }}>z</text>
        </g>
      )}
      {thinking && (
        <g>
          <circle cx="170" cy="46" r="4" fill="#c9c7f2" />
          <circle cx="182" cy="30" r="6" fill="#c9c7f2" />
          <text x="198" y="26" fontSize="24" fontWeight="700" fill="#a78bff" fontFamily="Space Grotesk Variable, sans-serif">?</text>
        </g>
      )}
      {mood === 'cheer' && (
        <g fill="#ffb547">
          <path d="M30 60 l3 7 7 3 -7 3 -3 7 -3 -7 -7 -3 7 -3z" />
          <path d="M190 52 l2.5 6 6 2.5 -6 2.5 -2.5 6 -2.5 -6 -6 -2.5 6 -2.5z" fill="#38d9f5" />
          <circle cx="40" cy="120" r="3" fill="#ff6aa8" />
          <circle cx="184" cy="118" r="3" fill="#a78bff" />
        </g>
      )}
    </svg>
  );
}

import { useState, type FormEvent } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { ArrowRight, Eye, EyeOff, Lock, Mail, UserRound, Rocket, ShieldCheck, Sparkles, Video, FileBox, Trophy } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { useGet } from '@/lib/queries';
import { Button } from '@/components/ui/button';
import { Field, Input } from '@/components/ui/form';
import { Logo } from '@/components/space/Logo';
import { Mascot } from '@/components/space/Mascot';
import { TextEffect } from '@/components/mp/text-effect';
import { InfiniteSlider } from '@/components/mp/infinite-slider';
import { Magnetic } from '@/components/mp/magnetic';
import { ThemeToggle } from '@/components/layout/Shell';
import { Tilt } from '@/components/mp/tilt';

const DEMOS = [
  { label: 'Learner', email: 'astro@orbit.space', icon: Rocket, desc: 'Alex Rivera' },
  { label: 'Instructor', email: 'nova@orbit.space', icon: Sparkles, desc: 'Dr. Nova Reyes' },
  { label: 'Admin', email: 'admin@orbit.space', icon: ShieldCheck, desc: 'Maya Okafor' },
];
const FORMATS = ['Video', 'SCORM 1.2 & 2004', 'PDF & documents', 'Audio', 'Quizzes', 'Assignments', 'Live sessions', 'Web embeds', 'Markdown pages', 'YouTube & Vimeo'];

export function AuthPage({ mode }: { mode: 'login' | 'register' }) {
  const { user, login, register } = useAuth();
  const nav = useNavigate();
  const loc = useLocation();
  const stateFrom = (loc.state as any)?.from as string | undefined;
  const { data: settings } = useGet<{ platformName: string; allowRegistration: boolean }>('/auth/settings');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const home = (u: { role: string }) => stateFrom || (u.role === 'learner' ? '/' : '/admin');
  if (user) return <Navigate to={home(user)} replace />;
  const isLogin = mode === 'login';

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const u = isLogin ? await login(email.trim(), password) : await register(name.trim(), email.trim(), password);
      nav(home(u), { replace: true });
    } catch (err: any) {
      setError(err.message || 'Something went wrong');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid min-h-screen lg:grid-cols-[1.1fr_1fr]">
      {/* hero */}
      <div className="relative hidden flex-col justify-between overflow-hidden p-12 lg:flex">
        <Logo />
        <div className="relative z-10 max-w-[500px]">
          <TextEffect as="h1" per="word" preset="fade-in-blur" speedReveal={1.4} className="font-display text-[56px] font-bold leading-[1.02] tracking-tight">
            Launch your learning into orbit.
          </TextEffect>
          <motion.p initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.9 }} className="mt-6 max-w-md text-lg leading-relaxed text-muted">
            One beautiful home for every course, certification and crew-training mission — videos, SCORM, documents, quizzes and live sessions.
          </motion.p>
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.2 }} className="mt-10 grid grid-cols-3 gap-3">
            {[{ i: Video, t: 'Any format', s: 'Video, SCORM, PDF' }, { i: Trophy, t: 'Gamified', s: 'XP, badges, streaks' }, { i: FileBox, t: 'Certified', s: 'Verifiable certs' }].map((f) => (
              <div key={f.t} className="surface p-4">
                <f.i className="mb-2.5 size-5 text-primary-2" />
                <div className="text-sm font-semibold">{f.t}</div>
                <div className="text-xs text-muted">{f.s}</div>
              </div>
            ))}
          </motion.div>
        </div>
        <div className="pointer-events-none absolute right-6 top-[40%] hidden -translate-y-1/2 xl:block">
          <Tilt rotationFactor={6} isRevese><Mascot mood="wave" size={185} /></Tilt>
        </div>
        <div className="relative z-10 -mx-12 [mask-image:linear-gradient(90deg,transparent,#000_15%,#000_85%,transparent)]">
          <InfiniteSlider gap={32} speed={34}>
            {FORMATS.map((f) => <span key={f} className="whitespace-nowrap rounded-full border border-line-2 px-4 py-1.5 text-sm text-muted">{f}</span>)}
          </InfiniteSlider>
        </div>
      </div>

      {/* form */}
      <div className="relative flex flex-col px-5 py-8 sm:px-12">
        <div className="mb-8 flex items-center justify-between lg:justify-end">
          <Logo className="lg:hidden" />
          <ThemeToggle />
        </div>
        <div className="m-auto w-full max-w-[420px]">
          <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="surface relative p-7 sm:p-9">
            <div className="absolute -top-12 left-1/2 -translate-x-1/2 lg:hidden"><Mascot mood="wave" size={86} /></div>
            <h2 className="font-display text-[26px] font-bold tracking-tight">{isLogin ? 'Welcome back, astronaut' : 'Create your account'}</h2>
            <p className="mt-1.5 text-sm text-muted">{isLogin ? 'Sign in to continue your mission.' : `Join ${settings?.platformName ?? 'Orbit Ignite'} and start earning XP.`}</p>

            <form onSubmit={submit} className="mt-7 space-y-4" noValidate>
              {!isLogin && (
                <Field label="Full name">{(id) => <Input id={id} icon={<UserRound />} value={name} onChange={(e) => setName(e.target.value)} placeholder="Alex Rivera" autoComplete="name" required />}</Field>
              )}
              <Field label="Email">{(id) => <Input id={id} icon={<Mail />} type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@company.com" autoComplete="email" required />}</Field>
              <Field label="Password" hint={!isLogin ? 'At least 8 characters' : undefined}>
                {(id) => (
                  <div className="relative">
                    <Input id={id} icon={<Lock />} type={show ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" autoComplete={isLogin ? 'current-password' : 'new-password'} required className="pr-11" />
                    <button type="button" onClick={() => setShow((s) => !s)} className="absolute right-2 top-1/2 grid size-7 -translate-y-1/2 place-items-center rounded-lg text-subtle hover:text-fg" aria-label={show ? 'Hide password' : 'Show password'}>
                      {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                    </button>
                  </div>
                )}
              </Field>
              {error && <div role="alert" className="rounded-xl border border-danger/30 bg-danger/10 px-3.5 py-2.5 text-sm text-danger">{error}</div>}
              <Magnetic intensity={0.12} range={60}>
                <Button type="submit" variant="primary" size="lg" className="w-full" loading={busy}>
                  {isLogin ? 'Sign in' : 'Create account'} <ArrowRight className="size-4" />
                </Button>
              </Magnetic>
            </form>

            <p className="mt-6 text-center text-sm text-muted">
              {isLogin ? (settings?.allowRegistration === false ? 'Registration is invite-only.' : <>New here? <Link to="/register" state={loc.state} className="font-semibold text-primary-2 hover:underline">Create an account</Link></>) : <>Already registered? <Link to="/login" state={loc.state} className="font-semibold text-primary-2 hover:underline">Sign in</Link></>}
            </p>
          </motion.div>

          {isLogin && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }} className="mt-5">
              <div className="mb-2.5 text-center text-xs font-medium uppercase tracking-wider text-subtle">Try a demo account</div>
              <div className="grid grid-cols-3 gap-2.5">
                {DEMOS.map((d) => (
                  <button key={d.email} type="button" onClick={() => { setEmail(d.email); setPassword('Orbit123!'); setError(null); }} className="surface surface-hover flex flex-col items-center gap-1 px-2 py-3 text-center" data-testid={`demo-${d.label.toLowerCase()}`}>
                    <d.icon className="size-4 text-primary-2" />
                    <span className="text-[13px] font-semibold">{d.label}</span>
                    <span className="text-[10px] text-subtle">{d.desc}</span>
                  </button>
                ))}
              </div>
            </motion.div>
          )}
        </div>
      </div>
    </div>
  );
}

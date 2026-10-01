import { useEffect, useState, type ReactNode } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { Menu as MenuIcon, Search, Moon, Sun, LogOut, UserRound, ShieldCheck, Rocket, type LucideIcon } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { useTheme } from '@/lib/theme';
import { cn } from '@/lib/utils';
import { levelFromXp } from '@shared/constants';
import { Logo } from '@/components/space/Logo';
import { Mascot } from '@/components/space/Mascot';
import { Avatar, Menu, MenuTrigger, MenuContent, MenuItem, MenuSeparator, Tooltip, ProgressBar } from '@/components/ui/misc';
import { Drawer } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { NotificationsMenu } from './NotificationsMenu';
import { useCommandPalette } from './CommandPalette';
import { useGet } from '@/lib/queries';

export interface NavItem { to: string; label: string; icon: LucideIcon; end?: boolean; badge?: number }

function NavList({ items, onNavigate, scope }: { items: NavItem[]; onNavigate?: () => void; scope: string }) {
  return (
    <nav className="flex flex-col gap-0.5" aria-label="Primary">
      {items.map((it) => (
        <NavLink key={it.to} to={it.to} end={it.end} onClick={onNavigate} className="group relative block rounded-xl">
          {({ isActive }) => (
            <>
              {isActive && <motion.span layoutId={`nav-pill-${scope}`} className="absolute inset-0 rounded-xl bg-primary/14 ring-1 ring-primary/30" transition={{ type: 'spring', bounce: 0.18, duration: 0.5 }} />}
              <span className={cn('relative flex items-center gap-3 px-3 py-2.5 text-sm font-medium transition-colors', isActive ? 'text-fg' : 'text-muted group-hover:text-fg')}>
                <it.icon className={cn('size-[18px] transition-colors', isActive ? 'text-primary-2' : 'text-subtle group-hover:text-primary-2')} />
                {it.label}
                {!!it.badge && <span className="ml-auto grid min-w-5 place-items-center rounded-full bg-pink px-1.5 text-[10px] font-bold leading-5 text-white">{it.badge}</span>}
              </span>
            </>
          )}
        </NavLink>
      ))}
    </nav>
  );
}

function LevelCard() {
  const { user } = useAuth();
  if (!user) return null;
  const lv = levelFromXp(user.xp);
  return (
    <Link to="/achievements" className="surface surface-hover relative mt-auto block overflow-hidden p-4">
      <div className="absolute -right-4 -top-3 opacity-90"><Mascot mood="happy" size={64} float /></div>
      <div className="text-[11px] font-semibold uppercase tracking-wider text-subtle">Level {lv.level}</div>
      <div className="mt-0.5 font-display text-lg font-bold tabular-nums">{user.xp.toLocaleString()} <span className="text-xs font-medium text-muted">XP</span></div>
      <ProgressBar value={lv.pct} className="mt-3" height={5} />
      <div className="mt-1.5 text-[11px] text-subtle">{(lv.next - user.xp).toLocaleString()} XP to level {lv.level + 1}</div>
    </Link>
  );
}

export function ThemeToggle() {
  const { theme, toggle } = useTheme();
  return (
    <Tooltip content={theme === 'dark' ? 'Switch to Lunar (light) mode' : 'Switch to Deep Space (dark) mode'}>
      <Button variant="ghost" size="icon" onClick={toggle} aria-label="Toggle theme">
        {theme === 'dark' ? <Sun className="size-[18px]" /> : <Moon className="size-[18px]" />}
      </Button>
    </Tooltip>
  );
}

export function UserMenu({ mode }: { mode: 'learner' | 'admin' }) {
  const { user, logout } = useAuth();
  const nav = useNavigate();
  if (!user) return null;
  const staff = user.role !== 'learner';
  return (
    <Menu>
      <MenuTrigger asChild>
        <button className="flex items-center gap-2.5 rounded-full py-1 pl-1 pr-2.5 transition-colors hover:bg-card-2" aria-label="Account menu">
          <Avatar name={user.name} color={user.avatarColor} size={34} />
          <span className="hidden text-left leading-tight sm:block">
            <span className="block max-w-32 truncate text-[13px] font-semibold">{user.name}</span>
            <span className="block text-[11px] capitalize text-subtle">{user.role}</span>
          </span>
        </button>
      </MenuTrigger>
      <MenuContent>
        <div className="px-3 py-2">
          <div className="truncate text-sm font-semibold">{user.name}</div>
          <div className="truncate text-xs text-subtle">{user.email}</div>
        </div>
        <MenuSeparator />
        <MenuItem icon={<UserRound />} onSelect={() => nav('/profile')}>Profile & settings</MenuItem>
        {staff && mode === 'learner' && <MenuItem icon={<ShieldCheck />} onSelect={() => nav('/admin')}>Open Mission Control</MenuItem>}
        {staff && mode === 'admin' && <MenuItem icon={<Rocket />} onSelect={() => nav('/')}>Switch to learner view</MenuItem>}
        <MenuSeparator />
        <MenuItem icon={<LogOut />} danger onSelect={async () => { await logout(); nav('/login'); }}>Sign out</MenuItem>
      </MenuContent>
    </Menu>
  );
}

export function Shell({ items, mode, children }: { items: NavItem[]; mode: 'learner' | 'admin'; children?: ReactNode }) {
  const [open, setOpen] = useState(false);
  const loc = useLocation();
  const palette = useCommandPalette();
  useEffect(() => { setOpen(false); window.scrollTo({ top: 0 }); }, [loc.pathname]);
  const isMac = typeof navigator !== 'undefined' && /mac/i.test(navigator.platform);

  const sidebar = (
    <div className="flex h-full flex-col gap-6 p-4">
      <Link to={mode === 'admin' ? '/admin' : '/'} className="px-2 pt-1"><Logo /></Link>
      {mode === 'admin' && (
        <div className="-mb-2 flex items-center gap-2 rounded-xl border border-warm/25 bg-warm/10 px-3 py-2 text-xs font-semibold text-warm"><ShieldCheck className="size-4" /> Mission Control</div>
      )}
      <NavList items={items} scope={mode} onNavigate={() => setOpen(false)} />
      {mode === 'learner' ? <LevelCard /> : <div className="mt-auto"><Link to="/" className="surface surface-hover flex items-center gap-3 p-3.5 text-sm font-medium"><Rocket className="size-4 text-primary-2" /> View as learner</Link></div>}
    </div>
  );

  return (
    <div className="min-h-screen">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 border-r border-line bg-bg/60 backdrop-blur-xl lg:block">{sidebar}</aside>
      <Drawer open={open} onOpenChange={setOpen}>{sidebar}</Drawer>
      <div className="lg:pl-64">
        <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-line bg-bg/70 px-4 backdrop-blur-xl sm:px-8">
          <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setOpen(true)} aria-label="Open menu"><MenuIcon className="size-5" /></Button>
          <button onClick={palette.open} className="flex h-10 min-w-0 max-w-md flex-1 items-center gap-2.5 rounded-xl border border-line-2 bg-card px-3.5 text-sm text-subtle transition-colors hover:border-primary/40 hover:text-muted" aria-label="Search">
            <Search className="size-4" />
            <span className="truncate"><span className="sm:hidden">Search…</span><span className="hidden sm:inline">Search missions, lessons, people…</span></span>
            <kbd className="ml-auto hidden rounded-md border border-line-2 bg-card-2 px-1.5 py-0.5 font-mono text-[10px] sm:block">{isMac ? '⌘' : 'Ctrl'} K</kbd>
          </button>
          <div className="ml-auto flex shrink-0 items-center gap-1">
            <ThemeToggle />
            <NotificationsMenu />
            <UserMenu mode={mode} />
          </div>
        </header>
        <main className="mx-auto w-full max-w-[1280px] px-4 py-8 sm:px-8">{children ?? <Outlet />}</main>
      </div>
    </div>
  );
}

export function useGradingCount() {
  const { user } = useAuth();
  const { data } = useGet<{ kpis: { pendingGrading: number } }>(user && user.role !== 'learner' ? '/admin/stats' : null, { staleTime: 30000 });
  return data?.kpis.pendingGrading ?? 0;
}

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Command } from 'cmdk';
import { useNavigate } from 'react-router-dom';
import { Compass, BookOpen, LayoutDashboard, Route, Trophy, Award, CalendarDays, Moon, LogOut, GraduationCap, Layers, ShieldCheck, UserRound, Search } from 'lucide-react';
import * as Dialog from '@radix-ui/react-dialog';
import { useAuth } from '@/lib/auth';
import { useTheme } from '@/lib/theme';
import { useGet } from '@/lib/queries';
import type { CourseCard } from '@/lib/types';

const Ctx = createContext<{ open: () => void }>({ open: () => {} });
export const useCommandPalette = () => useContext(Ctx);

export function CommandPaletteProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const [debounced, setDebounced] = useState('');
  const nav = useNavigate();
  const { user, logout } = useAuth();
  const { toggle } = useTheme();

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setOpen((o) => !o); }
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, []);
  useEffect(() => { const t = setTimeout(() => setDebounced(q.trim()), 200); return () => clearTimeout(t); }, [q]);
  useEffect(() => { if (!open) setQ(''); }, [open]);

  const { data } = useGet<{ courses: CourseCard[]; lessons: { id: number; title: string; courseId: number; courseTitle: string; type: string }[]; paths: { id: number; title: string }[] }>(open && user && debounced.length >= 2 ? `/search?q=${encodeURIComponent(debounced)}` : null);

  const go = (to: string) => { setOpen(false); nav(to); };
  const pages = useMemo(() => [
    { l: 'Launchpad', to: '/', i: LayoutDashboard }, { l: 'Explore catalog', to: '/catalog', i: Compass }, { l: 'My missions', to: '/learning', i: BookOpen },
    { l: 'Constellations (learning paths)', to: '/paths', i: Route }, { l: 'Calendar', to: '/calendar', i: CalendarDays }, { l: 'Achievements', to: '/achievements', i: Trophy },
    { l: 'Certificates', to: '/certificates', i: Award }, { l: 'Profile & settings', to: '/profile', i: UserRound },
    ...(user && user.role !== 'learner' ? [{ l: 'Mission Control (admin)', to: '/admin', i: ShieldCheck }, { l: 'Course manager', to: '/admin/courses', i: Layers }] : []),
  ], [user]);

  const item = 'flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-fg data-[selected=true]:bg-primary/15 [&>svg]:size-4 [&>svg]:text-muted data-[selected=true]:[&>svg]:text-primary-2';
  const group = '[&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-[11px] [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-wider [&_[cmdk-group-heading]]:text-subtle';

  return (
    <Ctx.Provider value={{ open: () => setOpen(true) }}>
      {children}
      {user && (
        <Dialog.Root open={open} onOpenChange={setOpen}>
          <Dialog.Portal>
            <Dialog.Overlay className="fixed inset-0 z-[70] bg-[#02030c]/70 backdrop-blur-sm" />
            <Dialog.Content aria-describedby={undefined} className="fixed left-1/2 top-[14vh] z-[70] w-[min(94vw,620px)] -translate-x-1/2 overflow-hidden rounded-3xl border border-line-2 bg-bg-2 shadow-2xl dark:bg-[#0d1030]">
              <Dialog.Title className="sr-only">Search</Dialog.Title>
              <Command shouldFilter={debounced.length < 2} label="Command palette">
                <div className="flex items-center gap-3 border-b border-line px-5">
                  <Search className="size-4 text-subtle" />
                  <Command.Input autoFocus value={q} onValueChange={setQ} placeholder="Search courses, lessons, or jump to a page…" className="h-14 flex-1 bg-transparent text-[15px] text-fg placeholder:text-subtle focus:outline-none" />
                  <kbd className="rounded-md border border-line-2 px-1.5 py-0.5 font-mono text-[10px] text-subtle">ESC</kbd>
                </div>
                <Command.List className="max-h-[56vh] overflow-y-auto p-2">
                  <Command.Empty className="px-4 py-10 text-center text-sm text-muted">No results. Try a different keyword.</Command.Empty>
                  {!!data?.courses.length && (
                    <Command.Group heading="Courses" className={group}>
                      {data.courses.map((c) => <Command.Item key={`c${c.id}`} value={`course ${c.title} ${c.id}`} onSelect={() => go(`/courses/${c.id}`)} className={item}><GraduationCap />{c.title}<span className="ml-auto text-xs text-subtle">{c.level}</span></Command.Item>)}
                    </Command.Group>
                  )}
                  {!!data?.lessons.length && (
                    <Command.Group heading="Lessons" className={group}>
                      {data.lessons.map((l) => <Command.Item key={`l${l.id}`} value={`lesson ${l.title} ${l.id}`} onSelect={() => go(`/courses/${l.courseId}/learn/${l.id}`)} className={item}><BookOpen /><span className="truncate">{l.title}</span><span className="ml-auto truncate text-xs text-subtle">{l.courseTitle}</span></Command.Item>)}
                    </Command.Group>
                  )}
                  {!!data?.paths.length && (
                    <Command.Group heading="Learning paths" className={group}>
                      {data.paths.map((p) => <Command.Item key={`p${p.id}`} value={`path ${p.title} ${p.id}`} onSelect={() => go(`/paths/${p.id}`)} className={item}><Route />{p.title}</Command.Item>)}
                    </Command.Group>
                  )}
                  <Command.Group heading="Go to" className={group}>
                    {pages.map((p) => <Command.Item key={p.to} value={`go ${p.l}`} onSelect={() => go(p.to)} className={item}><p.i />{p.l}</Command.Item>)}
                  </Command.Group>
                  <Command.Group heading="Actions" className={group}>
                    <Command.Item value="toggle theme dark light" onSelect={() => { toggle(); setOpen(false); }} className={item}><Moon />Toggle dark / light theme</Command.Item>
                    <Command.Item value="sign out logout" onSelect={async () => { setOpen(false); await logout(); nav('/login'); }} className={item}><LogOut />Sign out</Command.Item>
                  </Command.Group>
                </Command.List>
              </Command>
            </Dialog.Content>
          </Dialog.Portal>
        </Dialog.Root>
      )}
    </Ctx.Provider>
  );
}

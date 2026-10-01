import { Bell, CheckCheck, Award, Megaphone, GraduationCap, Sparkles, FileCheck2, Info } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useGet } from '@/lib/queries';
import { timeAgo, cn } from '@/lib/utils';
import type { Notification } from '@/lib/types';
import { Menu, MenuTrigger, MenuContent } from '@/components/ui/misc';
import { Button } from '@/components/ui/button';
import { Mascot } from '@/components/space/Mascot';

const ICONS: Record<string, any> = { badge: Sparkles, certificate: Award, announcement: Megaphone, assignment: GraduationCap, success: FileCheck2, info: Info };

export function NotificationsMenu() {
  const { data } = useGet<{ unread: number; items: Notification[] }>('/me/notifications', { refetchInterval: 45000 });
  const nav = useNavigate();
  const qc = useQueryClient();
  const refresh = () => qc.invalidateQueries({ queryKey: ['/me/notifications'] });
  const unread = data?.unread ?? 0;
  return (
    <Menu>
      <MenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative" aria-label={`Notifications${unread ? `, ${unread} unread` : ''}`}>
          <Bell className="size-[18px]" />
          {unread > 0 && <span className="absolute right-1.5 top-1.5 grid min-w-4 place-items-center rounded-full bg-pink px-1 text-[10px] font-bold leading-4 text-white ring-2 ring-bg">{unread > 9 ? '9+' : unread}</span>}
        </Button>
      </MenuTrigger>
      <MenuContent className="w-[min(92vw,380px)] p-0">
        <div className="flex items-center justify-between border-b border-line px-4 py-3">
          <div className="font-display font-semibold">Notifications</div>
          {unread > 0 && (
            <button className="flex items-center gap-1 text-xs font-medium text-primary-2 hover:underline" onClick={async () => { await api.post('/me/notifications/read', {}); refresh(); }}>
              <CheckCheck className="size-3.5" /> Mark all read
            </button>
          )}
        </div>
        <div className="max-h-[420px] overflow-y-auto p-1.5">
          {!data?.items.length ? (
            <div className="flex flex-col items-center px-4 py-8 text-center"><Mascot mood="sleep" size={80} /><p className="mt-2 text-sm text-muted">All quiet in orbit.</p></div>
          ) : (
            data.items.map((n) => {
              const Icon = ICONS[n.type] ?? Info;
              return (
                <button
                  key={n.id}
                  onClick={async () => { if (!n.read) { await api.post('/me/notifications/read', { id: n.id }); refresh(); } if (n.link) nav(n.link); }}
                  className="flex w-full gap-3 rounded-xl px-3 py-2.5 text-left transition-colors hover:bg-card-2"
                >
                  <span className={cn('mt-0.5 grid size-8 shrink-0 place-items-center rounded-lg bg-primary/12 text-primary-2', n.type === 'badge' && 'bg-warm/15 text-warm', n.type === 'certificate' && 'bg-success/15 text-success')}><Icon className="size-4" /></span>
                  <span className="min-w-0 flex-1">
                    <span className={cn('block text-[13px] leading-snug', n.read ? 'text-muted' : 'font-semibold text-fg')}>{n.title}</span>
                    {n.body && <span className="mt-0.5 line-clamp-2 block text-xs text-subtle">{n.body}</span>}
                    <span className="mt-1 block text-[11px] text-subtle">{timeAgo(n.createdAt)}</span>
                  </span>
                  {!n.read && <span className="mt-2 size-2 shrink-0 rounded-full bg-primary" />}
                </button>
              );
            })
          )}
        </div>
      </MenuContent>
    </Menu>
  );
}

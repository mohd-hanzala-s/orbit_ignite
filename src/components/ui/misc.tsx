import { type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import * as Tip from '@radix-ui/react-tooltip';
import * as DM from '@radix-ui/react-dropdown-menu';
import { motion } from 'motion/react';
import { cn, initials, AVATAR_TONES } from '@/lib/utils';
import { Mascot, type Mood } from '@/components/space/Mascot';
import { AnimatedBackground } from '@/components/mp/animated-background';

/* ───── badge ───── */
const TONES = {
  neutral: 'bg-card-2 text-muted border-line-2',
  primary: 'bg-primary/12 text-primary-2 border-primary/25',
  success: 'bg-success/12 text-success border-success/25',
  warn: 'bg-warm/14 text-warm border-warm/30',
  danger: 'bg-danger/12 text-danger border-danger/25',
  info: 'bg-accent/12 text-accent border-accent/25',
  pink: 'bg-pink/12 text-pink border-pink/25',
} as const;
export type Tone = keyof typeof TONES;
export function Badge({ tone = 'neutral', children, className, dot }: { tone?: Tone; children: ReactNode; className?: string; dot?: boolean }) {
  return (
    <span className={cn('inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-0.5 text-[11px] font-medium leading-5', TONES[tone], className)}>
      {dot && <span className="size-1.5 rounded-full bg-current" />}
      {children}
    </span>
  );
}

/* ───── avatar ───── */
export function Avatar({ name, color = 'violet', size = 36, className }: { name: string; color?: string; size?: number; className?: string }) {
  return (
    <span
      className={cn('inline-grid shrink-0 place-items-center rounded-full bg-gradient-to-br font-semibold text-white shadow-inner ring-2 ring-bg', AVATAR_TONES[color] ?? AVATAR_TONES.violet, className)}
      style={{ width: size, height: size, fontSize: size * 0.38 }}
      aria-hidden
    >
      {initials(name)}
    </span>
  );
}

/* ───── progress bar ───── */
export function ProgressBar({ value, className, tone = 'primary', height = 6 }: { value: number; className?: string; tone?: 'primary' | 'success' | 'warn'; height?: number }) {
  return (
    <div className={cn('w-full overflow-hidden rounded-full bg-line-2/70', className)} style={{ height }} role="progressbar" aria-valuenow={Math.round(value)} aria-valuemin={0} aria-valuemax={100}>
      <motion.div
        className={cn('h-full rounded-full', tone === 'success' ? 'bg-gradient-to-r from-success to-accent' : tone === 'warn' ? 'bg-gradient-to-r from-warm to-pink' : 'bg-gradient-to-r from-primary to-accent')}
        initial={{ width: 0 }}
        animate={{ width: `${Math.max(0, Math.min(100, value))}%` }}
        transition={{ duration: 0.8, ease: [0.2, 0.8, 0.2, 1] }}
      />
    </div>
  );
}

export const Skeleton = ({ className }: { className?: string }) => <div className={cn('animate-pulse rounded-xl bg-line-2/60', className)} />;

export function Spinner({ className }: { className?: string }) {
  return <span className={cn('inline-block size-5 animate-spin rounded-full border-2 border-line-2 border-t-primary', className)} role="status" aria-label="Loading" />;
}

/* ───── empty / error states ───── */
export function EmptyState({ title, description, mood = 'think', action, className, compact }: { title: string; description?: ReactNode; mood?: Mood; action?: ReactNode; className?: string; compact?: boolean }) {
  return (
    <div className={cn('flex flex-col items-center justify-center text-center', compact ? 'px-4 py-8' : 'px-6 py-16', className)}>
      <Mascot mood={mood} size={compact ? 84 : 124} />
      <h3 className="mt-3 font-display text-lg font-semibold">{title}</h3>
      {description && <p className="mt-1 max-w-sm text-sm text-muted">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function ErrorState({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const msg = error instanceof Error ? error.message : 'Something went wrong';
  return (
    <EmptyState
      mood="oops"
      title="Houston, we have a problem"
      description={msg}
      action={onRetry && <button onClick={onRetry} className="rounded-xl border border-line-2 bg-card px-4 py-2 text-sm font-medium hover:bg-card-2">Try again</button>}
    />
  );
}

/* ───── page header ───── */
export function PageHeader({ title, description, actions, eyebrow, back }: { title: ReactNode; description?: ReactNode; actions?: ReactNode; eyebrow?: ReactNode; back?: { to: string; label: string } }) {
  return (
    <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        {back && <Link to={back.to} className="mb-2 inline-flex items-center gap-1 text-xs font-medium text-muted hover:text-fg">← {back.label}</Link>}
        {eyebrow && <div className="mb-1.5 text-xs font-semibold uppercase tracking-[0.16em] text-primary-2">{eyebrow}</div>}
        <h1 className="font-display text-2xl font-bold tracking-tight sm:text-[28px]">{title}</h1>
        {description && <p className="mt-1.5 max-w-2xl text-sm text-muted">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

/* ───── segmented tabs with the motion-primitives animated pill ───── */
export function Tabs<T extends string>({ value, onChange, items, className }: { value: T; onChange: (v: T) => void; items: { value: T; label: ReactNode; count?: number }[]; className?: string }) {
  return (
    <div className={cn('inline-flex max-w-full gap-0.5 overflow-x-auto rounded-xl border border-line bg-card p-1', className)} role="tablist">
      <AnimatedBackground
        defaultValue={value}
        className="rounded-lg bg-primary/15 ring-1 ring-primary/30"
        transition={{ type: 'spring', bounce: 0.15, duration: 0.45 }}
        onValueChange={(v) => v && onChange(v as T)}
      >
        {items.map((it) => (
          <button
            key={it.value}
            data-id={it.value}
            role="tab"
            aria-selected={value === it.value}
            type="button"
            className={cn('relative flex items-center gap-1.5 whitespace-nowrap rounded-lg px-3.5 py-1.5 text-sm font-medium transition-colors', value === it.value ? 'text-fg' : 'text-muted hover:text-fg')}
          >
            {it.label}
            {it.count != null && <span className="rounded-full bg-line-2 px-1.5 text-[10px] tabular-nums">{it.count}</span>}
          </button>
        ))}
      </AnimatedBackground>
    </div>
  );
}

/* ───── tooltip ───── */
export function Tooltip({ content, children, side = 'top' }: { content: ReactNode; children: ReactNode; side?: 'top' | 'bottom' | 'left' | 'right' }) {
  return (
    <Tip.Root delayDuration={250}>
      <Tip.Trigger asChild>{children}</Tip.Trigger>
      <Tip.Portal>
        <Tip.Content side={side} sideOffset={6} className="z-[60] max-w-xs rounded-lg border border-line-2 bg-bg-2 px-2.5 py-1.5 text-xs text-fg shadow-xl dark:bg-[#12163a]">
          {content}
        </Tip.Content>
      </Tip.Portal>
    </Tip.Root>
  );
}
export const TooltipProvider = Tip.Provider;

/* ───── dropdown ───── */
export const Menu = DM.Root;
export const MenuTrigger = DM.Trigger;
export function MenuContent({ children, align = 'end', className }: { children: ReactNode; align?: 'start' | 'end' | 'center'; className?: string }) {
  return (
    <DM.Portal>
      <DM.Content align={align} sideOffset={8} className={cn('z-[60] min-w-52 overflow-hidden rounded-2xl border border-line-2 bg-bg-2 p-1.5 shadow-2xl shadow-black/30 dark:bg-[#0f1236]', className)}>
        {children}
      </DM.Content>
    </DM.Portal>
  );
}
export function MenuItem({ children, onSelect, danger, icon, className }: { children: ReactNode; onSelect?: () => void; danger?: boolean; icon?: ReactNode; className?: string }) {
  return (
    <DM.Item onSelect={onSelect} className={cn('flex cursor-pointer select-none items-center gap-2.5 rounded-xl px-3 py-2 text-sm outline-none transition-colors data-[highlighted]:bg-card-2 [&>svg]:size-4 [&>svg]:text-muted', danger ? 'text-danger data-[highlighted]:bg-danger/10 [&>svg]:text-danger' : 'text-fg', className)}>
      {icon}
      {children}
    </DM.Item>
  );
}
export const MenuSeparator = () => <DM.Separator className="my-1.5 h-px bg-line" />;
export const MenuLabel = ({ children }: { children: ReactNode }) => <DM.Label className="px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-subtle">{children}</DM.Label>;

/* ───── stat card ───── */
export function StatCard({ icon, label, value, sub, tone = 'primary' }: { icon: ReactNode; label: string; value: ReactNode; sub?: ReactNode; tone?: 'primary' | 'accent' | 'warm' | 'pink' | 'success' }) {
  const tones = { primary: 'from-primary/25 text-primary-2', accent: 'from-accent/25 text-accent', warm: 'from-warm/25 text-warm', pink: 'from-pink/25 text-pink', success: 'from-success/25 text-success' };
  return (
    <div className="surface relative overflow-hidden p-5">
      <div className={cn('absolute -right-6 -top-6 size-24 rounded-full bg-gradient-to-br to-transparent opacity-70 blur-xl', tones[tone])} />
      <div className={cn('mb-3 grid size-9 place-items-center rounded-xl border border-line bg-card-2 [&>svg]:size-[18px]', tones[tone].split(' ')[1])}>{icon}</div>
      <div className="font-display text-[26px] font-bold leading-none tracking-tight">{value}</div>
      <div className="mt-1.5 text-[13px] text-muted">{label}</div>
      {sub && <div className="mt-2 text-xs text-subtle">{sub}</div>}
    </div>
  );
}

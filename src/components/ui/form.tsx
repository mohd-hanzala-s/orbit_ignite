import { forwardRef, useId, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react';
import { ChevronDown, Search } from 'lucide-react';
import { cn } from '@/lib/utils';

const fieldBase =
  'w-full rounded-xl border border-line-2 bg-card px-3.5 text-sm text-fg placeholder:text-subtle transition-colors hover:border-primary/40 focus:border-primary disabled:opacity-50 dark:bg-white/[0.03]';

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement> & { icon?: ReactNode }>(function Input({ className, icon, ...rest }, ref) {
  if (icon)
    return (
      <div className="relative">
        <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-subtle [&>svg]:size-4">{icon}</span>
        <input ref={ref} className={cn(fieldBase, 'h-10 pl-10', className)} {...rest} />
      </div>
    );
  return <input ref={ref} className={cn(fieldBase, 'h-10', className)} {...rest} />;
});

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(function Textarea({ className, ...rest }, ref) {
  return <textarea ref={ref} className={cn(fieldBase, 'min-h-24 resize-y py-2.5 leading-relaxed', className)} {...rest} />;
});

export function Select({ className, children, ...rest }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <div className="relative">
      <select className={cn(fieldBase, 'h-10 cursor-pointer appearance-none pr-9', className)} {...rest}>
        {children}
      </select>
      <ChevronDown className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-subtle" />
    </div>
  );
}

export function SearchInput({ className, ...rest }: InputHTMLAttributes<HTMLInputElement>) {
  return <Input icon={<Search />} type="search" className={className} {...rest} />;
}

export function Field({ label, hint, error, children, className }: { label?: ReactNode; hint?: ReactNode; error?: string | null; children: (id: string) => ReactNode; className?: string }) {
  const id = useId();
  return (
    <div className={cn('space-y-1.5', className)}>
      {label && <label htmlFor={id} className="block text-[13px] font-medium text-fg/90">{label}</label>}
      {children(id)}
      {error ? <p className="text-xs text-danger" role="alert">{error}</p> : hint ? <p className="text-xs text-subtle">{hint}</p> : null}
    </div>
  );
}

export function Checkbox({ checked, onChange, label, className, disabled }: { checked: boolean; onChange: (v: boolean) => void; label?: ReactNode; className?: string; disabled?: boolean }) {
  return (
    <label className={cn('flex cursor-pointer items-center gap-2.5 text-sm', disabled && 'opacity-50', className)}>
      <input type="checkbox" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} className="size-4 cursor-pointer rounded accent-[var(--primary)]" />
      {label}
    </label>
  );
}

export function Switch({ checked, onChange, label, description }: { checked: boolean; onChange: (v: boolean) => void; label?: ReactNode; description?: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4">
      {(label || description) && (
        <div className="min-w-0">
          <div className="text-sm font-medium">{label}</div>
          {description && <div className="text-xs text-subtle">{description}</div>}
        </div>
      )}
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={cn('relative h-6 w-11 shrink-0 rounded-full border transition-colors', checked ? 'border-primary bg-primary' : 'border-line-2 bg-card-2')}
      >
        <span className={cn('absolute top-0.5 size-4.5 rounded-full bg-white shadow transition-all', checked ? 'left-[22px]' : 'left-0.5')} style={{ width: 18, height: 18 }} />
      </button>
    </div>
  );
}

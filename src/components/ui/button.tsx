import { type ButtonHTMLAttributes, type ReactNode } from 'react';
import { Link, type LinkProps } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'outline' | 'soft';
type Size = 'xs' | 'sm' | 'md' | 'lg' | 'icon' | 'icon-sm';

export function buttonClass(variant: Variant = 'secondary', size: Size = 'md', className?: string) {
  return cn(
    'relative inline-flex shrink-0 select-none items-center justify-center gap-2 whitespace-nowrap font-medium transition-all duration-200 disabled:pointer-events-none disabled:opacity-50 active:scale-[0.98]',
    {
      xs: 'h-7 rounded-lg px-2.5 text-xs',
      sm: 'h-8 rounded-lg px-3 text-[13px]',
      md: 'h-10 rounded-xl px-4 text-sm',
      lg: 'h-12 rounded-xl px-6 text-[15px]',
      icon: 'h-10 w-10 rounded-xl',
      'icon-sm': 'h-8 w-8 rounded-lg',
    }[size],
    {
      primary: 'bg-gradient-to-br from-primary-2 to-primary text-white shadow-[0_6px_20px_-6px_color-mix(in_oklab,var(--primary)_80%,transparent),inset_0_1px_0_rgb(255_255_255/0.25)] hover:brightness-110 hover:shadow-[0_10px_28px_-6px_color-mix(in_oklab,var(--primary)_90%,transparent),inset_0_1px_0_rgb(255_255_255/0.25)]',
      secondary: 'border border-line-2 bg-card text-fg hover:bg-card-2 hover:border-primary/40',
      outline: 'border border-line-2 text-fg hover:bg-card hover:border-primary/50',
      ghost: 'text-muted hover:bg-card-2 hover:text-fg',
      soft: 'bg-primary/12 text-primary-2 hover:bg-primary/20 dark:text-primary-2',
      danger: 'bg-danger/12 text-danger hover:bg-danger/20 border border-danger/25',
    }[variant],
    className,
  );
}

interface BtnProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  icon?: ReactNode;
}
export function Button({ variant = 'secondary', size = 'md', loading, icon, className, children, disabled, type = 'button', ...rest }: BtnProps) {
  return (
    <button type={type} className={buttonClass(variant, size, className)} disabled={disabled || loading} {...rest}>
      {loading ? <Loader2 className="size-4 animate-spin" /> : icon}
      {children}
    </button>
  );
}

export function LinkButton({ variant = 'secondary', size = 'md', className, icon, children, ...rest }: LinkProps & { variant?: Variant; size?: Size; icon?: ReactNode }) {
  return (
    <Link className={buttonClass(variant, size, className)} {...rest}>
      {icon}
      {children}
    </Link>
  );
}

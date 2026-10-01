import { type ReactNode } from 'react';
import { cn } from '@/lib/utils';

export function Table({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('surface overflow-hidden', className)}><div className="overflow-x-auto"><table className="w-full min-w-[640px] text-sm">{children}</table></div></div>;
}
export const THead = ({ children }: { children: ReactNode }) => <thead className="border-b border-line bg-card-2/40 text-left text-[11px] font-semibold uppercase tracking-wider text-subtle">{children}</thead>;
export const Th = ({ children, className }: { children?: ReactNode; className?: string }) => <th scope="col" className={cn('px-5 py-3 font-semibold', className)}>{children}</th>;
export const Tr = ({ children, className, onClick }: { children: ReactNode; className?: string; onClick?: () => void }) => <tr onClick={onClick} className={cn('border-b border-line transition-colors last:border-0 hover:bg-card-2/50', onClick && 'cursor-pointer', className)}>{children}</tr>;
export const Td = ({ children, className }: { children?: ReactNode; className?: string }) => <td className={cn('px-5 py-3.5 align-middle', className)}>{children}</td>;

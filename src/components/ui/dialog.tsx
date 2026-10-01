import * as D from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { type ReactNode } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { cn } from '@/lib/utils';
import { Button } from './button';

export function Modal({ open, onOpenChange, title, description, children, footer, size = 'md', className }: { open: boolean; onOpenChange: (o: boolean) => void; title: ReactNode; description?: ReactNode; children?: ReactNode; footer?: ReactNode; size?: 'sm' | 'md' | 'lg' | 'xl'; className?: string }) {
  return (
    <D.Root open={open} onOpenChange={onOpenChange}>
      <AnimatePresence>
        {open && (
          <D.Portal forceMount>
            <D.Overlay asChild forceMount>
              <motion.div className="fixed inset-0 z-50 bg-[#02030c]/70 backdrop-blur-sm" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} />
            </D.Overlay>
            <div className="pointer-events-none fixed inset-0 z-50 grid place-items-center p-4">
              <D.Content asChild forceMount aria-describedby={undefined}>
                <motion.div
                  initial={{ opacity: 0, y: 14, scale: 0.97 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 8, scale: 0.98 }}
                  transition={{ type: 'spring', stiffness: 380, damping: 32 }}
                  className={cn(
                    'pointer-events-auto flex max-h-[90vh] w-full flex-col overflow-hidden rounded-3xl border border-line-2 bg-bg-2 shadow-2xl shadow-black/40 dark:bg-[#0d1030]',
                    { sm: 'max-w-md', md: 'max-w-xl', lg: 'max-w-3xl', xl: 'max-w-5xl' }[size],
                    className,
                  )}
                >
                  <div className="flex items-start justify-between gap-4 border-b border-line px-6 py-4">
                    <div className="min-w-0">
                      <D.Title className="font-display text-lg font-semibold">{title}</D.Title>
                      {description && <D.Description className="mt-0.5 text-sm text-muted">{description}</D.Description>}
                    </div>
                    <D.Close asChild>
                      <Button variant="ghost" size="icon-sm" aria-label="Close"><X className="size-4" /></Button>
                    </D.Close>
                  </div>
                  <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">{children}</div>
                  {footer && <div className="flex items-center justify-end gap-2 border-t border-line bg-card/50 px-6 py-3.5">{footer}</div>}
                </motion.div>
              </D.Content>
            </div>
          </D.Portal>
        )}
      </AnimatePresence>
    </D.Root>
  );
}

export function ConfirmDialog({ open, onOpenChange, title, description, confirmLabel = 'Confirm', danger, loading, onConfirm }: { open: boolean; onOpenChange: (o: boolean) => void; title: string; description?: ReactNode; confirmLabel?: string; danger?: boolean; loading?: boolean; onConfirm: () => void }) {
  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      size="sm"
      footer={
        <>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button variant={danger ? 'danger' : 'primary'} loading={loading} onClick={onConfirm}>{confirmLabel}</Button>
        </>
      }
    >
      <p className="text-sm leading-relaxed text-muted">{description}</p>
    </Modal>
  );
}

/** Right-hand drawer used for mobile navigation and quick panels. */
export function Drawer({ open, onOpenChange, children, side = 'left', title = 'Menu' }: { open: boolean; onOpenChange: (o: boolean) => void; children: ReactNode; side?: 'left' | 'right'; title?: string }) {
  return (
    <D.Root open={open} onOpenChange={onOpenChange}>
      <AnimatePresence>
        {open && (
          <D.Portal forceMount>
            <D.Overlay asChild forceMount>
              <motion.div className="fixed inset-0 z-50 bg-[#02030c]/70 backdrop-blur-sm" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} />
            </D.Overlay>
            <D.Content asChild forceMount aria-describedby={undefined}>
              <motion.div
                initial={{ x: side === 'left' ? '-100%' : '100%' }}
                animate={{ x: 0 }}
                exit={{ x: side === 'left' ? '-100%' : '100%' }}
                transition={{ type: 'spring', stiffness: 360, damping: 36 }}
                className={cn('fixed top-0 z-50 flex h-full w-[min(86vw,340px)] flex-col border-line-2 bg-bg-2 shadow-2xl dark:bg-[#0a0d26]', side === 'left' ? 'left-0 border-r' : 'right-0 border-l')}
              >
                <D.Title className="sr-only">{title}</D.Title>
                {children}
              </motion.div>
            </D.Content>
          </D.Portal>
        )}
      </AnimatePresence>
    </D.Root>
  );
}

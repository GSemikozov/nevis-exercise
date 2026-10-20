import type { ComponentProps } from 'react';
import { cn } from '@/lib/cn';

/**
 * A message that needs the user's attention. `role="alert"` makes screen readers
 * announce it as soon as it appears, so render it only when there is something to say.
 */
export function Alert({ className, ...props }: ComponentProps<'div'>) {
  return (
    <div
      role="alert"
      className={cn(
        'flex flex-col items-start gap-3 rounded-card border border-line bg-surface p-6',
        className
      )}
      {...props}
    />
  );
}

export function AlertTitle({ className, ...props }: ComponentProps<'h2'>) {
  return <h2 className={cn('text-body text-content', className)} {...props} />;
}

export function AlertDescription({ className, ...props }: ComponentProps<'p'>) {
  return <p className={cn('text-body text-content-secondary', className)} {...props} />;
}

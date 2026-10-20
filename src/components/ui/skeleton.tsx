import type { ComponentProps } from 'react';
import { cn } from '@/lib/cn';

/** Placeholder block. Decorative: announce loading on the region that contains it. */
export function Skeleton({ className, ...props }: ComponentProps<'div'>) {
  return (
    <div
      aria-hidden="true"
      className={cn('animate-pulse rounded-card bg-hover motion-reduce:animate-none', className)}
      {...props}
    />
  );
}

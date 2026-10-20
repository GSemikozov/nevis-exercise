import type { ComponentProps } from 'react';
import { cn } from '@/lib/cn';

export function initialsOf(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase())
    .join('');
}

type AvatarProps = ComponentProps<'span'> & { name: string };

/**
 * Initials avatar. The design shows photos, but the API has no image URLs. Decorative,
 * since the name is always rendered next to it.
 */
export function Avatar({ name, className, ...props }: AvatarProps) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        'inline-flex size-5 shrink-0 select-none items-center justify-center rounded-full bg-avatar text-[0.5625rem] leading-none text-content',
        className
      )}
      {...props}
    >
      {initialsOf(name)}
    </span>
  );
}

import { ChevronRight } from 'lucide-react';
import type { ComponentProps } from 'react';
import { cn } from '@/lib/cn';

/*
 * Breadcrumb trail (WAI-ARIA APG breadcrumb pattern): a labelled <nav> around an
 * ordered list, the current item marked with aria-current and separators hidden.
 */

export function Breadcrumb(props: ComponentProps<'nav'>) {
  return <nav {...props} />;
}

export function BreadcrumbList({ className, ...props }: ComponentProps<'ol'>) {
  return (
    <ol
      className={cn(
        'flex flex-wrap items-center gap-1 text-body text-content-secondary',
        className
      )}
      {...props}
    />
  );
}

export function BreadcrumbItem({ className, ...props }: ComponentProps<'li'>) {
  return <li className={cn('inline-flex items-center gap-1', className)} {...props} />;
}

/** An ancestor the user can go back to. */
export function BreadcrumbButton({
  className,
  type = 'button',
  ...props
}: ComponentProps<'button'>) {
  return (
    <button
      type={type}
      className={cn(
        'rounded-sm underline-offset-4 transition-colors duration-300 ease-figma hover:text-content hover:underline motion-reduce:transition-none',
        className
      )}
      {...props}
    />
  );
}

/** The current location; `aria-current="location"` because it is a view, not a page. */
export function BreadcrumbCurrent({ className, ...props }: ComponentProps<'span'>) {
  return <span aria-current="location" className={cn('text-content', className)} {...props} />;
}

export function BreadcrumbSeparator({ className, ...props }: ComponentProps<'li'>) {
  return (
    <li
      role="presentation"
      aria-hidden="true"
      className={cn('[&_svg]:size-3.5', className)}
      {...props}
    >
      <ChevronRight />
    </li>
  );
}

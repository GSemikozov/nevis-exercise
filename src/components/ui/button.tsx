import { cva, type VariantProps } from 'class-variance-authority';
import type { ComponentProps } from 'react';
import { cn } from '@/lib/cn';

const buttonVariants = cva(
  [
    'inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-card text-body',
    'transition-colors duration-300 ease-figma motion-reduce:transition-none',
    'disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-4 [&_svg]:shrink-0',
  ],
  {
    variants: {
      variant: {
        secondary: 'border border-line bg-surface text-content hover:bg-hover',
        ghost: 'text-content hover:bg-hover',
      },
      size: {
        sm: 'h-8 px-2',
        md: 'h-10 px-4',
      },
    },
    defaultVariants: { variant: 'secondary', size: 'md' },
  }
);

type ButtonProps = ComponentProps<'button'> & VariantProps<typeof buttonVariants>;

export function Button({ className, variant, size, type = 'button', ...props }: ButtonProps) {
  return (
    <button type={type} className={cn(buttonVariants({ variant, size }), className)} {...props} />
  );
}

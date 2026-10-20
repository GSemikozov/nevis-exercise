import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { type RenderOptions, render } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { domMax, LazyMotion, MotionConfig } from 'motion/react';
import type { ReactElement, ReactNode } from 'react';

/**
 * Renders with the app's providers: a fresh non-retrying QueryClient, and motion features
 * loaded synchronously (the app loads them lazily). Returns a userEvent instance.
 */
export function renderWithProviders(ui: ReactElement, options?: Omit<RenderOptions, 'wrapper'>) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        <LazyMotion features={domMax} strict>
          <MotionConfig reducedMotion="user">{children}</MotionConfig>
        </LazyMotion>
      </QueryClientProvider>
    );
  }

  const user = userEvent.setup();
  return { user, queryClient, ...render(ui, { wrapper: Wrapper, ...options }) };
}

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { LazyMotion, MotionConfig } from 'motion/react';
import { type ReactNode, useState } from 'react';

const loadMotionFeatures = () => import('./motion-features').then((module) => module.features);

export function AppProviders({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          // Matches the API's Cache-Control max-age.
          queries: { staleTime: 60_000 },
        },
      })
  );

  return (
    <QueryClientProvider client={queryClient}>
      {/* `strict` makes any accidental full `motion.*` import (34 KB) fail loudly. */}
      <LazyMotion features={loadMotionFeatures} strict>
        {/* Honour the OS "reduce motion" setting: no movement, opacity fades only. */}
        <MotionConfig reducedMotion="user">{children}</MotionConfig>
      </LazyMotion>
    </QueryClientProvider>
  );
}

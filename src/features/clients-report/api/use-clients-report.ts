import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { toReport } from '../model/report';
import { demoParamsFrom, fetchClients, shouldRetry } from './clients-api';

export function useClientsReport() {
  const [params] = useState(() => demoParamsFrom(window.location.search));

  return useQuery({
    queryKey: ['clients', params],
    queryFn: ({ signal }) => fetchClients({ signal, params }),
    // Module-level function, so TanStack Query memoises the normalised report.
    select: toReport,
    retry: shouldRetry(params),
  });
}

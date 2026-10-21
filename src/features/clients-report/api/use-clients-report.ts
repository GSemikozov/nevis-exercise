import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { toReport } from '../model/report';
import { demoParamsFrom, fetchClients, isTransient } from './clients-api';

const MAX_RETRIES = 2;

export function useClientsReport() {
  const [params] = useState(() => demoParamsFrom(window.location.search));

  return useQuery({
    queryKey: ['clients', params],
    queryFn: ({ signal }) => fetchClients({ signal, params }),
    // Module-level function, so TanStack Query memoises the normalised report.
    select: toReport,
    // Retry server and network failures, not bad requests or contract errors, and never
    // a failure the URL asked for on purpose (?fail=…).
    retry: (failureCount, error) =>
      !params.fail && isTransient(error) && failureCount < MAX_RETRIES,
  });
}

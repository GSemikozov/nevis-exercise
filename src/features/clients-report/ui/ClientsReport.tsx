import { lazy, Suspense } from 'react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ApiError, ContractError } from '../api/clients-api';
import { useClientsReport } from '../api/use-clients-report';

/*
 * The dashboard (tree grid, chart, animation runtime) is its own chunk. The import starts
 * when this module loads, so the code downloads while the data request is in flight: off
 * the critical path, without a request waterfall.
 */
const dashboardModule = import('./ClientsDashboard');
const ClientsDashboard = lazy(() =>
  dashboardModule.then((module) => ({ default: module.ClientsDashboard }))
);

export function ClientsReport() {
  const query = useClientsReport();

  if (query.isPending) return <ClientsReportSkeleton />;
  if (query.isError) {
    return (
      <ClientsReportError
        error={query.error}
        isRetrying={query.isFetching}
        onRetry={() => query.refetch()}
      />
    );
  }
  return (
    <Suspense fallback={<ClientsReportSkeleton />}>
      <ClientsDashboard report={query.data} />
    </Suspense>
  );
}

/** Same footprint as the loaded page, so nothing jumps when the data arrives. */
function ClientsReportSkeleton() {
  return (
    <>
      <p role="status" className="sr-only">
        Loading client data…
      </p>
      <div aria-hidden="true" className="flex flex-col gap-4">
        <div className="flex flex-col gap-4 rounded-card bg-surface px-4 pt-6 pb-4">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-[22.375rem]" />
          <Skeleton className="mx-auto h-6 w-64" />
        </div>
        <div className="flex flex-col gap-px overflow-hidden rounded-card bg-surface">
          {['header', 'company', 'branch-1', 'branch-2', 'branch-3'].map((row) => (
            <div key={row} className="flex h-14 items-center px-4">
              <Skeleton className="h-4 w-full" />
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

function errorMessage(error: Error): string {
  if (error instanceof ApiError) {
    return `The server answered with an error (${error.status}: ${error.message}).`;
  }
  if (error instanceof ContractError) {
    return 'The server sent data in a format this page does not understand.';
  }
  return 'Check your connection and try again.';
}

function ClientsReportError({
  error,
  isRetrying,
  onRetry,
}: {
  error: Error;
  isRetrying: boolean;
  onRetry: () => void;
}) {
  return (
    <Alert>
      <AlertTitle>We couldn’t load the client data</AlertTitle>
      <AlertDescription>{errorMessage(error)}</AlertDescription>
      {/* aria-disabled rather than disabled, so the button keeps focus while retrying. */}
      <Button
        aria-disabled={isRetrying}
        onClick={isRetrying ? undefined : onRetry}
        className="aria-disabled:opacity-60"
      >
        {isRetrying ? 'Retrying…' : 'Try again'}
      </Button>
    </Alert>
  );
}

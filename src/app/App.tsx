import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { ClientsReport } from '@/features/clients-report/ui/ClientsReport';
import { ErrorBoundary } from './ErrorBoundary';

export function App() {
  return (
    <main className="mx-auto flex w-full min-w-0 max-w-[90rem] flex-col gap-4 px-4 py-6">
      <h1 className="text-title">Clients</h1>
      <ErrorBoundary fallback={<RenderError />}>
        <ClientsReport />
      </ErrorBoundary>
    </main>
  );
}

function RenderError() {
  return (
    <Alert>
      <AlertTitle>Something went wrong showing the report</AlertTitle>
      <AlertDescription>Reloading the page usually fixes it.</AlertDescription>
      <Button onClick={() => window.location.reload()}>Reload</Button>
    </Alert>
  );
}

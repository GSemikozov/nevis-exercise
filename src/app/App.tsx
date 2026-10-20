import { Sparkles } from 'lucide-react';

export function App() {
  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col gap-6 px-4 py-12">
      <header className="flex items-center gap-2">
        <Sparkles className="size-5 text-primary" aria-hidden />
        <h1 className="text-xl font-semibold">Nevis Exercise</h1>
      </header>

      <section className="rounded-xl border border-border bg-card p-6">
        <p className="text-muted-foreground text-sm">Mount the component under development here.</p>
      </section>
    </main>
  );
}

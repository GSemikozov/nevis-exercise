import { type ClientsResponse, clientsResponseSchema } from '@shared/clients.schema';
import * as z from 'zod/mini';

/** The API answered with a non-2xx status. */
export class ApiError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

/** The API answered, but with data that breaks the shared contract. */
export class ContractError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ContractError';
  }
}

const DEMO_PARAMS = ['delay', 'fail'] as const;

/**
 * The API's demo switches, passed through from the page URL so that `/?delay=2000` or
 * `/?fail=503` shows the loading or error state against the real API.
 */
export function demoParamsFrom(search: string): Record<string, string> {
  const params = new URLSearchParams(search);
  return Object.fromEntries(
    DEMO_PARAMS.flatMap((name) => {
      const value = params.get(name);
      return value === null ? [] : [[name, value]];
    })
  );
}

export async function fetchClients({
  signal,
  params = {},
}: {
  signal?: AbortSignal;
  params?: Record<string, string>;
}): Promise<ClientsResponse> {
  const url = new URL('/api/clients', window.location.origin);
  for (const [name, value] of Object.entries(params)) url.searchParams.set(name, value);

  const response = await fetch(url, { signal, headers: { Accept: 'application/json' } });
  if (!response.ok) throw new ApiError(response.status, await problemTitle(response));

  const parsed = clientsResponseSchema.safeParse(await response.json());
  if (!parsed.success) throw new ContractError(z.prettifyError(parsed.error));
  return parsed.data;
}

/** Errors worth retrying: the server failed or the network did, not the request. */
export function isTransient(error: unknown): boolean {
  if (error instanceof ApiError) return error.status >= 500;
  return error instanceof TypeError; // fetch rejects with TypeError on network failure
}

async function problemTitle(response: Response): Promise<string> {
  try {
    const body: unknown = await response.json();
    if (typeof body === 'object' && body && 'title' in body && typeof body.title === 'string') {
      return body.title;
    }
  } catch {
    // Not a problem document; fall back to the status text.
  }
  return response.statusText || `HTTP ${response.status}`;
}

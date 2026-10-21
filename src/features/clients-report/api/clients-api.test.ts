import { HttpResponse, http } from 'msw';
import { apiServer, setupMockApi } from '@/test/api-mock';
import {
  ApiError,
  ContractError,
  demoParamsFrom,
  fetchClients,
  isTransient,
  shouldRetry,
} from './clients-api';

setupMockApi();

describe('fetchClients', () => {
  it('returns the validated response', async () => {
    const response = await fetchClients({});
    expect(response.meta.periodStart).toBe('2024-02');
  });

  it('turns a non-2xx answer into an ApiError carrying the problem title', async () => {
    apiServer.use(
      http.get('*/api/clients', () =>
        HttpResponse.json({ title: 'Service Unavailable', status: 503 }, { status: 503 })
      )
    );
    const error = await fetchClients({}).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ status: 503, message: 'Service Unavailable' });
  });

  it('treats a 2xx body that is not JSON as a contract error, not a network one', async () => {
    apiServer.use(http.get('*/api/clients', () => HttpResponse.html('<!doctype html><p>Hi</p>')));
    await expect(fetchClients({})).rejects.toBeInstanceOf(ContractError);
  });

  it('forwards the demo switches to the API', async () => {
    let requested = '';
    apiServer.use(
      http.get('*/api/clients', ({ request }) => {
        requested = new URL(request.url).search;
        return HttpResponse.json({ title: 'Simulated failure', status: 503 }, { status: 503 });
      })
    );
    await expect(fetchClients({ params: demoParamsFrom('?fail=503&x=1') })).rejects.toBeInstanceOf(
      ApiError
    );
    expect(requested).toBe('?fail=503');
  });
});

describe('retry policy', () => {
  const retry = shouldRetry({});

  it('retries server and network failures, at most twice', () => {
    expect(retry(0, new ApiError(503, 'Unavailable'))).toBe(true);
    expect(retry(1, new TypeError('Failed to fetch'))).toBe(true);
    expect(retry(2, new ApiError(503, 'Unavailable'))).toBe(false);
  });

  it('never retries bad requests or contract errors', () => {
    expect(retry(0, new ApiError(404, 'Not Found'))).toBe(false);
    expect(retry(0, new ContractError('bad shape'))).toBe(false);
    expect(isTransient(new Error('anything else'))).toBe(false);
  });

  it('never retries a failure the page asked for with ?fail', () => {
    expect(shouldRetry({ fail: '503' })(0, new ApiError(503, 'Simulated failure'))).toBe(false);
  });
});

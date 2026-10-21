import { HttpResponse, http } from 'msw';
import { setupServer } from 'msw/node';
import clients from '../../server/data/clients.json';

/** The API response the real server sends, for tests that run without it. */
export const clientsResponse = { data: clients, meta: { periodStart: '2024-02' } };

export const apiServer = setupServer(
  http.get('*/api/v1/clients', () => HttpResponse.json(clientsResponse))
);

/** Starts the mock API for the current test file and resets it between tests. */
export function setupMockApi() {
  beforeAll(() => apiServer.listen({ onUnhandledRequest: 'error' }));
  afterEach(() => apiServer.resetHandlers());
  afterAll(() => apiServer.close());
}

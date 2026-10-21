import { claimReload } from './stale-build';

describe('claimReload', () => {
  beforeEach(() => sessionStorage.clear());

  it('allows one reload, then refuses another within a minute', () => {
    expect(claimReload(1_000_000)).toBe(true);
    expect(claimReload(1_000_000 + 30_000)).toBe(false);
  });

  it('allows a reload again once a minute has passed', () => {
    expect(claimReload(1_000_000)).toBe(true);
    expect(claimReload(1_000_000 + 60_000)).toBe(true);
  });
});

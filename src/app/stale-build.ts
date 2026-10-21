const RELOADED_AT = 'stale-build-reloaded-at';
const MIN_INTERVAL_MS = 60_000;

/**
 * Deploy skew: a tab opened before a deploy asks for code-split chunks that the new deploy
 * no longer has. Vite reports that as `vite:preloadError`; the fix is to load the new
 * build. Reload at most once a minute, so a chunk missing for any other reason ends in
 * the error boundary instead of a reload loop.
 */
export function reloadOnStaleBuild() {
  window.addEventListener('vite:preloadError', (event) => {
    if (!claimReload(Date.now())) return;
    event.preventDefault();
    window.location.reload();
  });
}

/** Whether a reload may happen now; records it if so. Exported for tests. */
export function claimReload(now: number): boolean {
  try {
    const last = Number(sessionStorage.getItem(RELOADED_AT) ?? 0);
    if (now - last < MIN_INTERVAL_MS) return false;
    sessionStorage.setItem(RELOADED_AT, String(now));
    return true;
  } catch {
    return false; // Storage unavailable: no loop protection, so do not reload.
  }
}

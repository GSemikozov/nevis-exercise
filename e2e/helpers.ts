import type { Page } from '@playwright/test';

/** A body row of the tree grid, by the name in its first cell. */
export const row = (page: Page, name: string) =>
  page.getByRole('row', { name: new RegExp(`^${name} \\d`) });

export const chart = (page: Page) => page.getByRole('group', { name: /^Clients per month for/ });

/** Loads the dashboard and waits until the table is there. */
export async function openDashboard(page: Page, path = '/') {
  await page.goto(path);
  await page.getByRole('treegrid').waitFor();
}

/**
 * Waits until rows have finished fading and sliding. Checks that read rendered colours
 * (axe's contrast rule) would otherwise see half-transparent text mid-animation, which
 * shows up on slower machines such as CI runners.
 */
export async function waitForAnimations(page: Page) {
  await page.waitForFunction(() => {
    const running = document.getAnimations().some((a) => a.playState === 'running');
    const rows = [...document.querySelectorAll<HTMLElement>('[role="row"]')];
    const settled = rows.every((r) => {
      const style = getComputedStyle(r);
      return style.opacity === '1' && style.transform === 'none';
    });
    return !running && settled;
  });
}

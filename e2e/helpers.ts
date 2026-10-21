import type { Locator, Page } from '@playwright/test';

/** A body row of the tree grid, by the name in its first cell. */
export const row = (page: Page, name: string) =>
  page.getByRole('row', { name: new RegExp(`^${name} \\d`) });

export const chart = (page: Page) => page.getByRole('group', { name: /^Clients per month for/ });

/**
 * Presses Tab until `target` has focus and returns every stop on the way as
 * "role: accessible label", so a test can assert the order without assuming which
 * elements the platform puts in it.
 */
export async function tabTo(page: Page, target: Locator, maxStops = 10): Promise<string[]> {
  const stops: string[] = [];
  for (let i = 0; i < maxStops; i += 1) {
    await page.keyboard.press('Tab');
    stops.push(
      await page.evaluate(() => {
        const element = document.activeElement;
        if (!element || element === document.body) return 'none';
        const role = element.getAttribute('role') ?? element.tagName.toLowerCase();
        return `${role}: ${element.getAttribute('aria-label') ?? ''}`.trim();
      })
    );
    if (await target.evaluate((element) => element === document.activeElement)) return stops;
  }
  throw new Error(`Tab never reached the target. Stops: ${stops.join(' → ')}`);
}

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

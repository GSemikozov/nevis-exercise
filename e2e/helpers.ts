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

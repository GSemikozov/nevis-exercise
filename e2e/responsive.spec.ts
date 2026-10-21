import { expect, test } from '@playwright/test';
import { openDashboard, row } from './helpers';

// The brief: full responsiveness is not required, but nothing may break or overflow down to 375px.
test.use({ viewport: { width: 375, height: 812 } });

test('nothing overflows the page, even fully expanded', async ({ page }) => {
  await openDashboard(page);
  await row(page, 'Branch 1').click();
  await row(page, 'Anna Blackwood').click();
  await expect(row(page, 'New paid')).toBeVisible();

  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth
  );
  expect(overflow).toBe(0);
});

test('the table scrolls sideways inside its card with the names pinned', async ({ page }) => {
  await openDashboard(page);
  const card = page.locator('section', { has: page.getByRole('treegrid') });
  const name = page.getByRole('rowheader', { name: 'Company' });
  const february = row(page, 'Company').getByRole('gridcell').first();
  const nameBefore = await name.boundingBox();
  const februaryBefore = await february.boundingBox();

  await card.evaluate((element) => {
    element.scrollLeft = 400;
  });

  // The months move with the scroll; the name column stays where it was.
  await expect
    .poll(async () => (await february.boundingBox())?.x)
    .toBeCloseTo((februaryBefore?.x ?? 0) - 400, 0);
  expect((await name.boundingBox())?.x).toBeCloseTo(nameBefore?.x ?? 0, 0);
  expect(await page.evaluate(() => document.documentElement.scrollLeft)).toBe(0);
});

test('the chart fits and keeps its month labels apart', async ({ page }) => {
  await openDashboard(page);
  const svg = page.locator('svg[aria-hidden="true"]').first();
  const box = await svg.boundingBox();

  expect(box?.width).toBeLessThanOrEqual(375 - 2 * 16 - 2 * 16);
  // Every other month is labelled at this width ("Feb", "Apr", …).
  await expect(svg.locator('text', { hasText: /^Feb$/ })).toHaveCount(1);
  await expect(svg.locator('text', { hasText: /^Mar$/ })).toHaveCount(0);
});

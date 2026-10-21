import { expect, test } from '@playwright/test';
import { chart, openDashboard, row } from './helpers';

test('runs without console errors under the production CSP', async ({ page }) => {
  const errors: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  page.on('pageerror', (error) => errors.push(error.message));

  await openDashboard(page);
  // Exercise the animations, including the popLayout style injection on collapse.
  await row(page, 'Branch 1').click();
  await expect(row(page, 'Anna Blackwood')).toBeVisible();
  await row(page, 'Branch 1').click();
  await expect(row(page, 'Anna Blackwood')).toHaveCount(0);

  expect(errors).toEqual([]);
});

test.describe('expand and collapse', () => {
  test('reveals and hides the level beneath with the mouse, fully animated in', async ({
    page,
  }) => {
    await openDashboard(page);
    await expect(row(page, 'Company')).toHaveAttribute('aria-expanded', 'true');

    await row(page, 'Branch 1').click();
    await expect(row(page, 'Branch 1')).toHaveAttribute('aria-expanded', 'true');
    // The fade-in finishes and the rows below settle where they belong.
    await expect(row(page, 'Anna Blackwood')).toHaveCSS('opacity', '1');
    await expect(row(page, 'Branch 2')).toHaveCSS('transform', 'none');

    await row(page, 'Anna Blackwood').click();
    await expect(row(page, 'New paid')).toBeVisible();

    await row(page, 'Branch 1').click();
    await expect(row(page, 'Anna Blackwood')).toHaveCount(0);
    await expect(row(page, 'New paid')).toHaveCount(0);
  });

  test('works from the keyboard alone', async ({ page, browserName }) => {
    await openDashboard(page);

    // Tab order: chart, its drillable legend entry, then a single stop in the table.
    await page.keyboard.press('Tab');
    await expect(chart(page)).toBeFocused();
    // Safari leaves buttons out of the Tab order unless Full Keyboard Access is on,
    // and Playwright's WebKit does the same.
    if (browserName !== 'webkit') {
      await page.keyboard.press('Tab');
      await expect(page.getByRole('button', { name: 'Branch 1, show breakdown' })).toBeFocused();
    }
    await page.keyboard.press('Tab');
    await expect(row(page, 'Company')).toBeFocused();

    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('ArrowRight');
    await expect(row(page, 'Branch 1')).toHaveAttribute('aria-expanded', 'true');

    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Enter');
    await expect(row(page, 'Existing clients')).toBeVisible();

    await page.keyboard.press('ArrowLeft');
    await expect(row(page, 'Anna Blackwood')).toHaveAttribute('aria-expanded', 'false');
    await page.keyboard.press('ArrowLeft');
    await expect(row(page, 'Branch 1')).toBeFocused();
    await page.keyboard.press('ArrowLeft');
    await expect(row(page, 'Anna Blackwood')).toHaveCount(0);
  });

  test.describe('with reduced motion', () => {
    test.use({ reducedMotion: 'reduce' });

    test('rows appear in place without sliding', async ({ page }) => {
      await openDashboard(page);
      await row(page, 'Branch 1').click();

      await expect(row(page, 'Anna Blackwood')).toBeVisible();
      await expect(row(page, 'Branch 2')).toHaveCSS('transform', 'none');
    });
  });
});

test.describe('chart', () => {
  test('drills from the company to an advisor and back, with the table in step', async ({
    page,
  }) => {
    await openDashboard(page);
    await expect(chart(page)).toHaveAccessibleName(
      'Clients per month for Company, by branch, Feb 2024 to Jan 2025'
    );

    await page.getByRole('button', { name: 'Branch 1, show breakdown' }).click();
    await expect(chart(page)).toHaveAccessibleName(/^Clients per month for Branch 1, by advisor/);
    await expect(row(page, 'Anna Blackwood')).toBeVisible();

    await page.getByRole('button', { name: 'Anna Blackwood, show breakdown' }).click();
    await expect(page.getByRole('list').getByText('New organic')).toBeVisible();

    await page
      .getByRole('navigation', { name: 'Chart scope' })
      .getByRole('button', { name: 'Company' })
      .click();
    await expect(chart(page)).toHaveAccessibleName(/^Clients per month for Company/);
  });

  test('shows every series and the total for a month on hover', async ({ page }) => {
    await openDashboard(page);
    await page.locator('[data-column="0"]').hover();

    const tooltip = page.locator('p', { hasText: 'Feb 2024' }).locator('..');
    await expect(tooltip).toContainText('Branch 1147');
    await expect(tooltip).toContainText('Total250');
  });
});

test.describe('loading and errors against the real API', () => {
  test('shows a skeleton while the data loads', async ({ page }) => {
    await page.goto('/?delay=1500');
    await expect(page.getByRole('status')).toHaveText('Loading client data…');
    await expect(page.getByRole('treegrid')).toBeVisible({ timeout: 5000 });
  });

  test('explains a server error and offers a retry', async ({ page }) => {
    await page.goto('/?fail=503');
    const alert = page.getByRole('alert');
    await expect(alert).toContainText('We couldn’t load the client data');
    await expect(alert).toContainText('503');
    await expect(alert.getByRole('button', { name: 'Try again' })).toBeVisible();
  });
});

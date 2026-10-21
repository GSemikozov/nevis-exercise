import AxeBuilder from '@axe-core/playwright';
import { expect, type Page, test } from '@playwright/test';
import { openDashboard, row, waitForAnimations } from './helpers';

/*
 * Automated WCAG 2.2 AA checks with axe-core in real browsers, in every state that
 * renders different markup. Automated checks catch roughly a third of issues; the rest
 * is covered by the keyboard tests, the virtual screen reader tests and the manual
 * checklist in docs/a11y-testing.md.
 */
const WCAG_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];

async function expectNoViolations(page: Page) {
  await waitForAnimations(page);
  const { violations } = await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze();
  expect(
    violations.map(({ id, help, nodes }) => ({ id, help, targets: nodes.map((n) => n.target) }))
  ).toEqual([]);
}

test('default view', async ({ page }) => {
  await openDashboard(page);
  await expectNoViolations(page);
});

test('every level expanded and the chart drilled to an advisor', async ({ page }) => {
  await openDashboard(page);
  await page.getByRole('button', { name: 'Branch 1, show breakdown' }).click();
  await page.getByRole('button', { name: 'Anna Blackwood, show breakdown' }).click();
  await expect(row(page, 'New paid')).toBeVisible();
  await expectNoViolations(page);
});

test('chart tooltip open from the keyboard', async ({ page }) => {
  await openDashboard(page);
  await page.keyboard.press('Tab');
  await page.keyboard.press('ArrowRight');
  await expectNoViolations(page);
});

test('loading state', async ({ page }) => {
  await page.goto('/?delay=3000');
  await expect(page.getByRole('status')).toBeVisible();
  await expectNoViolations(page);
});

test('error state', async ({ page }) => {
  await page.goto('/?fail=503');
  await expect(page.getByRole('alert')).toBeVisible();
  await expectNoViolations(page);
});

test.describe('at 375px', () => {
  test.use({ viewport: { width: 375, height: 812 } });

  test('default view', async ({ page }) => {
    await openDashboard(page);
    await expectNoViolations(page);
  });
});

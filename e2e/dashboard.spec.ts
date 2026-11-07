import { expect, type Page, test } from '@playwright/test';
import { chart, openDashboard, row, tabTo } from './helpers';

test('runs without console errors under the production CSP', async ({ page }) => {
  const errors: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  page.on('pageerror', (error) => errors.push(error.message));

  await openDashboard(page);
  // Exercise the expand and collapse animations, which write inline styles.
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
    // The new row opens to its full height and fades in.
    await expect(row(page, 'Anna Blackwood')).toHaveCSS('height', '56px');
    await expect(row(page, 'Anna Blackwood')).toHaveCSS('opacity', '1');

    await row(page, 'Anna Blackwood').click();
    await expect(row(page, 'New paid')).toBeVisible();

    await row(page, 'Branch 1').click();
    await expect(row(page, 'Anna Blackwood')).toHaveCount(0);
    await expect(row(page, 'New paid')).toHaveCount(0);
  });

  test('works from the keyboard alone', async ({ page }) => {
    await openDashboard(page);

    // Tab order: chart, its drillable legend entry, then a single stop in the table.
    // Whether buttons are Tab stops depends on the platform, not the engine: Safari on
    // macOS skips them unless Full Keyboard Access is on, WebKit on Linux does not. So
    // walk the order and check every stop instead of hard-coding it per browser.
    const stops = await tabTo(page, row(page, 'Company'));
    expect(stops[0]).toBe('group: Clients per month for Company, by branch, Feb 2024 to Jan 2025');
    expect(stops.slice(1, -1).every((stop) => stop === 'button: Branch 1, show breakdown')).toBe(
      true
    );
    expect(stops.length).toBeLessThanOrEqual(3);

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

  test('collapsing near the bottom of the page moves the content smoothly, not in one jump', async ({
    page,
  }) => {
    await openDashboard(page);
    await row(page, 'Branch 1').click();
    await row(page, 'Anna Blackwood').click();
    await expect(row(page, 'New paid')).toHaveCSS('height', '56px');
    // Scrolled to the bottom, a shorter page pulls everything above the table down.
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));

    // Where the chart is on every frame after the click, and when.
    const samples = await page.evaluate(async () => {
      const chart = document.querySelector('[role="group"][aria-label^="Clients per month"]');
      const branch = document.querySelector('[role="rowheader"][aria-label="Branch 1"]');
      if (!chart || !(branch instanceof HTMLElement)) throw new Error('dashboard not rendered');
      const frames = [{ t: 0, top: chart.getBoundingClientRect().top }];
      const start = performance.now();
      branch.click();
      await new Promise<void>((resolve) => {
        const sample = (now: number) => {
          frames.push({ t: now - start, top: chart.getBoundingClientRect().top });
          if (now - start < 700) requestAnimationFrame(sample);
          else resolve();
        };
        requestAnimationFrame(sample);
      });
      return frames;
    });

    const trace = samples.map((s) => `${Math.round(s.t)}ms:${Math.round(s.top)}`).join(' ');
    const from = samples[0]?.top ?? 0;
    const to = samples.at(-1)?.top ?? 0;
    const inBetween = samples.filter((s) => (s.top - from) * (s.top - to) < 0);
    expect(Math.abs(to - from), trace).toBeGreaterThan(200);
    // A jump goes from the old position to the new one in a single frame. An animation
    // passes through positions in between, even when a busy CI machine draws only a few
    // long frames (one run in a loaded Linux container drew frames 250ms apart).
    expect(inBetween.length, trace).toBeGreaterThan(0);
  });

  test.describe('on a screen narrower than the table', () => {
    test.use({ viewport: { width: 1024, height: 768 } });

    test('opening rows never changes the column widths', async ({ page }) => {
      await openDashboard(page);
      const columnWidths = () =>
        page
          .getByRole('columnheader')
          .evaluateAll((cells) => cells.map((cell) => cell.getBoundingClientRect().width));
      const closed = await columnWidths();

      // An advisor row (indent, avatar, name, button) is the widest content in the table.
      await row(page, 'Branch 1').click();
      await row(page, 'Anna Blackwood').click();
      await expect(row(page, 'New paid')).toHaveCSS('height', '56px');
      expect(await columnWidths()).toEqual(closed);
    });
  });

  test.describe('with reduced motion', () => {
    test.use({ reducedMotion: 'reduce' });

    test('rows take their place at once instead of sliding', async ({ page }) => {
      await openDashboard(page);
      await row(page, 'Branch 1').click();

      // Full height in the first frame the new row is drawn; only its fade remains.
      const firstHeight = await page.evaluate(
        () =>
          new Promise<number>((resolve) => {
            const sample = () => {
              const name = document.querySelector(
                '[role="rowheader"][aria-label="Anna Blackwood"]'
              );
              const anna = name?.closest('[role="row"]');
              if (anna) resolve(anna.getBoundingClientRect().height);
              else requestAnimationFrame(sample);
            };
            sample();
          })
      );
      expect(firstHeight).toBe(56);
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

test.describe('chart on a touch screen', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

  test('a tap reads the month beside its column, without drilling; a tap elsewhere closes it', async ({
    page,
  }) => {
    await openDashboard(page);

    for (const index of [0, 6, 11]) {
      const bar = await page
        .locator(`[data-column="${index}"] [data-series]`)
        .first()
        .boundingBox();
      if (!bar) throw new Error('bar not rendered');
      await page.touchscreen.tap(bar.x + bar.width / 2, bar.y + bar.height / 2);

      const tooltip = page.locator('div[aria-hidden="true"]', { has: page.locator('ul') });
      const box = await tooltip.boundingBox();
      const chartBox = await chart(page).boundingBox();
      if (!box || !chartBox) throw new Error('tooltip not shown');
      // Beside the column, never over it, and inside the chart.
      expect(box.x + box.width <= bar.x || box.x >= bar.x + bar.width).toBe(true);
      expect(box.x).toBeGreaterThanOrEqual(chartBox.x - 1);
      expect(box.x + box.width).toBeLessThanOrEqual(chartBox.x + chartBox.width + 1);
      await expect(chart(page)).toHaveAccessibleName(/^Clients per month for Company/);
    }

    await page.touchscreen.tap(20, 20);
    await expect(page.locator('div[aria-hidden="true"]', { has: page.locator('ul') })).toHaveCount(
      0
    );
  });
});

test.describe('"Show in chart" in the table', () => {
  const showInChart = (page: Page, name: string) =>
    page.getByRole('button', { name: `Show ${name} in chart` });

  test('appears on hover and shows the row in the chart', async ({ page }) => {
    await openDashboard(page);
    // The chart starts on the company, so that row's button is shown and pressed.
    await expect(showInChart(page, 'Company')).toHaveCSS('opacity', '1');
    await expect(showInChart(page, 'Branch 1')).toHaveCSS('opacity', '0');

    await row(page, 'Branch 1').hover();
    await expect(showInChart(page, 'Branch 1')).toHaveCSS('opacity', '1');
    await showInChart(page, 'Branch 1').click();

    await expect(chart(page)).toHaveAccessibleName(/^Clients per month for Branch 1, by advisor/);
    await expect(chart(page)).toBeFocused();
    await expect(showInChart(page, 'Branch 1')).toHaveAttribute('aria-pressed', 'true');
    // The table opens the same level, as for a drill in the chart.
    await expect(row(page, 'Branch 1')).toHaveAttribute('aria-expanded', 'true');
  });

  test('is reached with Tab from its row only', async ({ page }) => {
    await openDashboard(page);
    await tabTo(page, row(page, 'Company'));
    await page.keyboard.press('ArrowDown');
    await expect(row(page, 'Branch 1')).toBeFocused();

    await page.keyboard.press('Tab');
    await expect(showInChart(page, 'Branch 1')).toBeFocused();
    await expect(showInChart(page, 'Branch 1')).toHaveCSS('opacity', '1');
    await page.keyboard.press('Shift+Tab');
    await expect(row(page, 'Branch 1')).toBeFocused();

    await page.keyboard.press('Tab');
    await page.keyboard.press('Enter');
    await expect(chart(page)).toHaveAccessibleName(/^Clients per month for Branch 1, by advisor/);
    await expect(chart(page)).toBeFocused();
  });

  test.describe('on a touch screen', () => {
    test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

    test('is always visible, since there is no hover', async ({ page }) => {
      await openDashboard(page);
      await expect(showInChart(page, 'Branch 1')).toHaveCSS('opacity', '1');

      await showInChart(page, 'Branch 1').tap();
      await expect(chart(page)).toHaveAccessibleName(/^Clients per month for Branch 1/);
      await expect(showInChart(page, 'Anna Blackwood')).toHaveCSS('opacity', '1');
    });
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

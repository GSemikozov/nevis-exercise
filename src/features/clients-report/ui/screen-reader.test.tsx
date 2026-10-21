import { virtual } from '@guidepup/virtual-screen-reader';
import { screen } from '@testing-library/react';
import { setupMockApi } from '@/test/api-mock';
import { renderWithProviders } from '@/test/render';
import { ClientsReport } from './ClientsReport';

/*
 * What a screen reader announces, simulated from the accessibility tree
 * (@guidepup/virtual-screen-reader). It supplements testing with VoiceOver and NVDA
 * (docs/a11y-testing.md); it does not replace it.
 */

setupMockApi();

afterEach(async () => {
  await virtual.stop();
});

/** Reads an element from start to end, as a screen reader user would with "next". */
async function readThrough(element: HTMLElement) {
  await virtual.start({ container: element });
  for (let step = 0; step < 500; step += 1) {
    await virtual.next();
    if ((await virtual.lastSpokenPhrase()).startsWith('end of treegrid')) break;
  }
  return virtual.spokenPhraseLog();
}

const rowPhrase = (log: string[], name: string) =>
  log.find((phrase) => phrase.startsWith(`row, ${name} `));

describe('the table, as a screen reader hears it', () => {
  it('names the tree grid and explains how to use it', async () => {
    renderWithProviders(<ClientsReport />);
    const log = await readThrough(await screen.findByRole('treegrid'));

    expect(log[0]).toBe(
      'treegrid, Clients per month by branch, advisor and acquisition channel, ' +
        'Use the arrow keys to move between rows and cells. ' +
        'Right arrow expands a row, left arrow collapses it., column count 13'
    );
  });

  it('announces each row with its state, level and position among its siblings', async () => {
    renderWithProviders(<ClientsReport />);
    const log = await readThrough(await screen.findByRole('treegrid'));

    expect(rowPhrase(log, 'Company')).toMatch(/, expanded, level 1, position 1, set size 1$/);
    expect(rowPhrase(log, 'Branch 1')).toMatch(/, not expanded, level 2, position 1, set size 3$/);
    // Branch 2 has no employees: no expanded state is announced at all.
    expect(rowPhrase(log, 'Branch 2')).toMatch(/\d, level 2, position 2, set size 3$/);
    expect(log).toContain('rowheader, Branch 2, column index 1');
    expect(log).toContain('columnheader, Feb 2024');
  });

  it('announces the level beneath once a row is expanded', async () => {
    const { user } = renderWithProviders(<ClientsReport />);
    await user.click(await screen.findByRole('row', { name: /^Branch 1 / }));
    const log = await readThrough(screen.getByRole('treegrid'));

    expect(rowPhrase(log, 'Branch 1')).toMatch(/, expanded, level 2, position 1, set size 3$/);
    expect(rowPhrase(log, 'Anna Blackwood')).toMatch(
      /, not expanded, level 3, position 1, set size 5$/
    );
    expect(rowPhrase(log, 'James Walker')).toMatch(/\d, level 3, position 2, set size 5$/);
  });
});

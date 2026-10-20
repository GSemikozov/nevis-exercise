import { formatCount, formatMonth, formatMonthLong, formatMonthShort, monthsFrom } from './format';

describe('monthsFrom', () => {
  it('returns consecutive months across a year boundary', () => {
    const months = monthsFrom('2024-02', 12);

    expect(months).toHaveLength(12);
    expect(months.map(formatMonth)).toEqual([
      'Feb 2024',
      'Mar 2024',
      'Apr 2024',
      'May 2024',
      'Jun 2024',
      'Jul 2024',
      'Aug 2024',
      'Sep 2024',
      'Oct 2024',
      'Nov 2024',
      'Dec 2024',
      'Jan 2025',
    ]);
  });

  it('rejects a malformed period', () => {
    expect(() => monthsFrom('Feb 2024', 12)).toThrow(/Invalid period start/);
  });
});

describe('formatters', () => {
  const date = new Date(Date.UTC(2025, 0, 1));

  it('formats months for headers, tight axes and screen readers', () => {
    expect(formatMonth(date)).toBe('Jan 2025');
    expect(formatMonthShort(date)).toBe('Jan');
    expect(formatMonthLong(date)).toBe('January 2025');
  });

  it('formats counts with grouping', () => {
    expect(formatCount(1250)).toBe('1,250');
  });
});

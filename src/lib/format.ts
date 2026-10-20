/*
 * Formatting is pinned to en-US: the UI copy is English, and numbers and month names
 * should not change with the visitor's locale mid-sentence.
 */
const LOCALE = 'en-US';

const countFormat = new Intl.NumberFormat(LOCALE, { maximumFractionDigits: 0 });
const monthYearFormat = new Intl.DateTimeFormat(LOCALE, {
  month: 'short',
  year: 'numeric',
  timeZone: 'UTC',
});
const monthShortFormat = new Intl.DateTimeFormat(LOCALE, { month: 'short', timeZone: 'UTC' });
const monthLongFormat = new Intl.DateTimeFormat(LOCALE, {
  month: 'long',
  year: 'numeric',
  timeZone: 'UTC',
});

export function formatCount(value: number): string {
  return countFormat.format(value);
}

/** `count` consecutive months starting at `periodStart` (`YYYY-MM`), as UTC dates. */
export function monthsFrom(periodStart: string, count: number): Date[] {
  const [year, month] = periodStart.split('-').map(Number);
  if (!year || !month) throw new Error(`Invalid period start: ${periodStart}`);
  return Array.from({ length: count }, (_, i) => new Date(Date.UTC(year, month - 1 + i, 1)));
}

/** "Feb 2024" — column headers and axis labels. */
export function formatMonth(date: Date): string {
  return monthYearFormat.format(date);
}

/** "Feb" — axis labels where space is tight. */
export function formatMonthShort(date: Date): string {
  return monthShortFormat.format(date);
}

/** "February 2024" — text read by assistive technology. */
export function formatMonthLong(date: Date): string {
  return monthLongFormat.format(date);
}

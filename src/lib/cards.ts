import { addDays, toISODate } from '@/lib/dates';

/**
 * A credit card is an account whose balance goes negative as you spend: -5,000
 * means you owe Rs 5,000. Paying the bill is a transfer into the card.
 */
export function cardOwed(balance: number): number {
  return Math.max(0, -balance);
}

/** Credit left to spend; null when no limit is set. An overpaid card adds its credit. */
export function availableCredit(limit: number | null, balance: number): number | null {
  return limit === null ? null : Math.max(0, limit + balance);
}

/** Day `day` of the given month, clamped to the month's length (31 becomes 30 in November). */
function dayInMonth(year: number, month: number, day: number): Date {
  const last = new Date(year, month + 1, 0).getDate();
  return new Date(year, month, Math.min(day, last));
}

/** The next payment due date on or after `today`. */
export function nextDueDate(today: string, dueDay: number): string {
  const [y, m] = today.split('-').map(Number);
  const thisMonth = toISODate(dayInMonth(y, m - 1, dueDay));
  return thisMonth >= today ? thisMonth : toISODate(dayInMonth(y, m, dueDay));
}

/** The open billing cycle: from the day after the last statement to the next statement date. */
export function statementCycle(today: string, statementDay: number): { start: string; end: string } {
  const [y, m] = today.split('-').map(Number);
  const thisStatement = toISODate(dayInMonth(y, m - 1, statementDay));
  if (today <= thisStatement) {
    return { start: addDays(toISODate(dayInMonth(y, m - 2, statementDay)), 1), end: thisStatement };
  }
  return { start: addDays(thisStatement, 1), end: toISODate(dayInMonth(y, m, statementDay)) };
}

/**
 * Day of the month for the due-date reminder: three days early, and never past
 * the 28th so it fires in every month.
 */
export function reminderDay(dueDay: number): number {
  return Math.min(28, Math.max(1, dueDay - 3));
}

/** Days from `today` to `date` (both "YYYY-MM-DD"). */
export function daysUntil(today: string, date: string): number {
  const [ay, am, ad] = today.split('-').map(Number);
  const [by, bm, bd] = date.split('-').map(Number);
  return Math.round((Date.UTC(by, bm - 1, bd) - Date.UTC(ay, am - 1, ad)) / 86_400_000);
}

/** A credit limit of 0 (or an empty field) means "no limit set". */
export function positiveOrNull(amount: number | null): number | null {
  return amount !== null && amount > 0 ? amount : null;
}

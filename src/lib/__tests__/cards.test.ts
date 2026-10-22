import { availableCredit, cardOwed, daysUntil, nextDueDate, positiveOrNull, reminderDay, statementCycle } from '@/lib/cards';

describe('credit cards', () => {
  it('treats an empty or zero limit as no limit', () => {
    expect(positiveOrNull(null)).toBeNull();
    expect(positiveOrNull(0)).toBeNull();
    expect(positiveOrNull(10_000_00)).toBe(10_000_00);
  });

  it('reads what is owed from a negative balance', () => {
    expect(cardOwed(-500_000)).toBe(500_000);
    expect(cardOwed(0)).toBe(0);
    expect(cardOwed(20_000)).toBe(0);
  });

  it('computes available credit', () => {
    expect(availableCredit(10_000_000, -2_500_000)).toBe(7_500_000);
    expect(availableCredit(10_000_000, 50_000)).toBe(10_050_000);
    expect(availableCredit(10_000_000, -12_000_000)).toBe(0);
    expect(availableCredit(null, -100)).toBeNull();
  });

  it('finds the next due date, rolling into next month', () => {
    expect(nextDueDate('2026-10-22', 25)).toBe('2026-10-25');
    expect(nextDueDate('2026-10-22', 22)).toBe('2026-10-22');
    expect(nextDueDate('2026-10-22', 5)).toBe('2026-11-05');
    expect(nextDueDate('2026-12-28', 5)).toBe('2027-01-05');
  });

  it('clamps due days to short months', () => {
    expect(nextDueDate('2027-02-01', 31)).toBe('2027-02-28');
    expect(nextDueDate('2026-11-01', 31)).toBe('2026-11-30');
  });

  it('works out the open statement cycle', () => {
    expect(statementCycle('2026-10-22', 15)).toEqual({ start: '2026-10-16', end: '2026-11-15' });
    expect(statementCycle('2026-10-10', 15)).toEqual({ start: '2026-09-16', end: '2026-10-15' });
    expect(statementCycle('2026-10-15', 15)).toEqual({ start: '2026-09-16', end: '2026-10-15' });
    expect(statementCycle('2027-01-05', 20)).toEqual({ start: '2026-12-21', end: '2027-01-20' });
  });

  it('reminds three days early, within the 28th', () => {
    expect(reminderDay(25)).toBe(22);
    expect(reminderDay(2)).toBe(1);
    expect(reminderDay(31)).toBe(28);
  });

  it('counts days between dates', () => {
    expect(daysUntil('2026-10-22', '2026-10-25')).toBe(3);
    expect(daysUntil('2026-12-30', '2027-01-02')).toBe(3);
  });
});

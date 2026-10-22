import { isOverdue, loanRemaining, recentPeople, summarizeLoans } from '@/lib/loans';

type TestLoan = Parameters<typeof summarizeLoans>[0][number];

const loan = (over: Partial<TestLoan>): TestLoan => ({
  person: 'Ram',
  direction: 'lent',
  amount: 100_000,
  paid: 0,
  settled: 0,
  due_date: null,
  ...over,
});

describe('loans', () => {
  it('computes what is left, never below zero', () => {
    expect(loanRemaining({ amount: 100_000, paid: 30_000 })).toBe(70_000);
    expect(loanRemaining({ amount: 100_000, paid: 120_000 })).toBe(0);
  });

  it('is overdue only when open, past due, and not fully paid', () => {
    expect(isOverdue(loan({ due_date: '2026-10-01' }), '2026-10-22')).toBe(true);
    expect(isOverdue(loan({ due_date: '2026-10-22' }), '2026-10-22')).toBe(false);
    expect(isOverdue(loan({ due_date: '2026-10-01', settled: 1 }), '2026-10-22')).toBe(false);
    expect(isOverdue(loan({ due_date: '2026-10-01', paid: 100_000 }), '2026-10-22')).toBe(false);
    expect(isOverdue(loan({}), '2026-10-22')).toBe(false);
  });

  it('sums open loans by direction', () => {
    const loans = [
      loan({ amount: 100_000, paid: 25_000 }),
      loan({ direction: 'borrowed', amount: 50_000, due_date: '2026-09-01' }),
      loan({ amount: 999_999, settled: 1 }),
    ];
    expect(summarizeLoans(loans, '2026-10-22')).toEqual({ toReceive: 75_000, toPay: 50_000, overdue: 1 });
  });

  it('lists distinct recent people, ignoring case', () => {
    expect(recentPeople([{ person: 'Sita' }, { person: 'ram' }, { person: 'SITA ' }, { person: 'Hari' }])).toEqual([
      'Sita',
      'ram',
      'Hari',
    ]);
  });
});

type LoanLike = {
  person: string;
  direction: 'lent' | 'borrowed';
  amount: number;
  paid: number;
  settled: number;
  due_date: string | null;
};

export function loanRemaining(loan: Pick<LoanLike, 'amount' | 'paid'>): number {
  return Math.max(0, loan.amount - loan.paid);
}

export function isOverdue(loan: LoanLike, today: string): boolean {
  return !loan.settled && loan.due_date !== null && loan.due_date < today && loanRemaining(loan) > 0;
}

/** What others owe you and what you owe, over loans that are still open. */
export function summarizeLoans(loans: LoanLike[], today: string) {
  let toReceive = 0;
  let toPay = 0;
  let overdue = 0;
  for (const loan of loans) {
    if (loan.settled) continue;
    if (loan.direction === 'lent') toReceive += loanRemaining(loan);
    else toPay += loanRemaining(loan);
    if (isOverdue(loan, today)) overdue += 1;
  }
  return { toReceive, toPay, overdue };
}

/** Distinct people from past loans, most recent first, for quick picking. */
export function recentPeople(loans: Pick<LoanLike, 'person'>[], limit = 8): string[] {
  const seen = new Map<string, string>();
  for (const { person } of loans) {
    const key = person.trim().toLocaleLowerCase();
    if (key && !seen.has(key)) seen.set(key, person.trim());
  }
  return [...seen.values()].slice(0, limit);
}

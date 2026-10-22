import type { TxnType } from '@/lib/categories';

export type TxnDraft = {
  /** Paisa, or null when the typed amount is empty or invalid. */
  amount: number | null;
  type: TxnType;
  accountId: number | null;
  toAccountId: number | null;
};

export type TxnError =
  | { code: 'noAmount' }
  | { code: 'noAccount' }
  | { code: 'needTwoAccounts' }
  | { code: 'sameAccount' }
  | { code: 'insufficient'; accountName: string; available: number }
  | { code: 'overLimit'; accountName: string; available: number };

type ValidationAccount = {
  id: number;
  name: string;
  balance: number;
  kind?: string;
  credit_limit?: number | null;
};

/** Largest single amount accepted (Rs 100 crore), to catch typos like extra zeros. */
export const MAX_AMOUNT = 100_00_00_000 * 100;

/**
 * Money can't leave an account that doesn't hold it: expenses and transfers are
 * limited to the source account's current balance. A credit card instead spends
 * against its limit (its balance goes negative as you owe more); a card with no
 * limit set isn't checked. Income has no upper bound.
 */
export function validateTransaction(draft: TxnDraft, accounts: ValidationAccount[]): TxnError | null {
  if (draft.amount === null || draft.amount <= 0 || draft.amount > MAX_AMOUNT) return { code: 'noAmount' };
  const source = accounts.find((a) => a.id === draft.accountId);
  if (!source) return { code: 'noAccount' };

  if (draft.type === 'transfer') {
    if (accounts.length < 2) return { code: 'needTwoAccounts' };
    if (draft.toAccountId === null || draft.toAccountId === draft.accountId) return { code: 'sameAccount' };
  }
  if (draft.type === 'income') return null;

  if (source.kind === 'card') {
    if (source.credit_limit == null) return null;
    const available = Math.max(0, source.credit_limit + source.balance);
    return draft.amount > available ? { code: 'overLimit', accountName: source.name, available } : null;
  }
  if (draft.amount > source.balance) {
    return { code: 'insufficient', accountName: source.name, available: Math.max(0, source.balance) };
  }
  return null;
}

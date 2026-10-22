import { toLatinDigits } from '@/lib/money';

type FilterableTxn = {
  amount: number;
  category_id: number | null;
  account_id: number;
  to_account_id: number | null;
  note: string;
};

export type TxnFilter = {
  query: string;
  /** Matches transactions from or to this account; null means any account. */
  accountId: number | null;
};

/**
 * Keeps transactions matching every word of the query against the note,
 * category name, account names, and amount ("500" finds Rs 500 and Rs 1,500).
 */
export function filterTransactions<T extends FilterableTxn>(
  txns: T[],
  { query, accountId }: TxnFilter,
  names: { category: (id: number | null) => string; account: (id: number | null) => string }
): T[] {
  const words = toLatinDigits(query).toLocaleLowerCase().replace(/,/g, '').split(/\s+/).filter(Boolean);
  return txns.filter((txn) => {
    if (accountId !== null && txn.account_id !== accountId && txn.to_account_id !== accountId) return false;
    if (words.length === 0) return true;
    const rupees = txn.amount / 100;
    const haystack = [
      txn.note,
      names.category(txn.category_id),
      names.account(txn.account_id),
      names.account(txn.to_account_id),
      String(rupees),
      rupees.toFixed(2),
    ]
      .join(' ')
      .toLocaleLowerCase();
    return words.every((word) => haystack.includes(word));
  });
}

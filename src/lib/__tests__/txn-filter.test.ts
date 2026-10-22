import { filterTransactions } from '@/lib/txn-filter';

const txns = [
  { id: 1, amount: 50_000, category_id: 1, account_id: 1, to_account_id: null, note: 'Momo at Newa' },
  { id: 2, amount: 150_000, category_id: 2, account_id: 2, to_account_id: null, note: 'Bhatbhateni' },
  { id: 3, amount: 1_000_000, category_id: null, account_id: 2, to_account_id: 1, note: '' },
  { id: 4, amount: 12_550, category_id: 1, account_id: 3, to_account_id: null, note: 'Chiya' },
];
const categories: Record<number, string> = { 1: 'Food & Dining', 2: 'Groceries' };
const accounts: Record<number, string> = { 1: 'Cash', 2: 'Nabil Bank', 3: 'eSewa' };
const names = {
  category: (id: number | null) => (id === null ? '' : categories[id]),
  account: (id: number | null) => (id === null ? '' : accounts[id]),
};
const ids = (query: string, accountId: number | null = null) =>
  filterTransactions(txns, { query, accountId }, names).map((t) => t.id);

describe('filterTransactions', () => {
  it('returns everything with no query or account', () => {
    expect(ids('')).toEqual([1, 2, 3, 4]);
  });

  it('filters by account, including transfers into it', () => {
    expect(ids('', 1)).toEqual([1, 3]);
    expect(ids('', 2)).toEqual([2, 3]);
  });

  it('searches notes, categories and account names, ignoring case', () => {
    expect(ids('momo')).toEqual([1]);
    expect(ids('FOOD')).toEqual([1, 4]);
    expect(ids('nabil')).toEqual([2, 3]);
  });

  it('requires every word to match', () => {
    expect(ids('food esewa')).toEqual([4]);
  });

  it('searches amounts, with commas or Devanagari digits', () => {
    expect(ids('1,500')).toEqual([2]);
    expect(ids('५००')).toEqual([1, 2]);
    expect(ids('125.5')).toEqual([4]);
  });

  it('combines search with the account filter', () => {
    expect(ids('food', 3)).toEqual([4]);
  });
});

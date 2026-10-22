import { MAX_AMOUNT, validateTransaction } from '@/lib/validation';

const accounts = [
  { id: 1, name: 'Cash', balance: 0 },
  { id: 2, name: 'eSewa', balance: 50_000 },
];

describe('validateTransaction', () => {
  it('rejects missing, zero and absurd amounts', () => {
    const base = { type: 'income' as const, accountId: 1, toAccountId: null };
    expect(validateTransaction({ ...base, amount: null }, accounts)).toEqual({ code: 'noAmount' });
    expect(validateTransaction({ ...base, amount: 0 }, accounts)).toEqual({ code: 'noAmount' });
    expect(validateTransaction({ ...base, amount: MAX_AMOUNT + 1 }, accounts)).toEqual({ code: 'noAmount' });
  });

  it('blocks an expense from an empty account', () => {
    expect(
      validateTransaction({ amount: 25_000, type: 'expense', accountId: 1, toAccountId: null }, accounts)
    ).toEqual({ code: 'insufficient', accountName: 'Cash', available: 0 });
  });

  it('allows spending up to the exact balance but not beyond', () => {
    const draft = { type: 'expense' as const, accountId: 2, toAccountId: null };
    expect(validateTransaction({ ...draft, amount: 50_000 }, accounts)).toBeNull();
    expect(validateTransaction({ ...draft, amount: 50_001 }, accounts)).toMatchObject({ code: 'insufficient' });
  });

  it('checks transfers against the source account', () => {
    expect(
      validateTransaction({ amount: 10_000, type: 'transfer', accountId: 1, toAccountId: 2 }, accounts)
    ).toMatchObject({ code: 'insufficient', accountName: 'Cash' });
    expect(
      validateTransaction({ amount: 10_000, type: 'transfer', accountId: 2, toAccountId: 1 }, accounts)
    ).toBeNull();
    expect(
      validateTransaction({ amount: 10_000, type: 'transfer', accountId: 2, toAccountId: 2 }, accounts)
    ).toEqual({ code: 'sameAccount' });
  });

  it('needs two accounts for a transfer', () => {
    expect(
      validateTransaction({ amount: 100, type: 'transfer', accountId: 1, toAccountId: null }, [accounts[0]])
    ).toEqual({ code: 'needTwoAccounts' });
  });

  it('lets income into an empty account', () => {
    expect(validateTransaction({ amount: 5_000_000, type: 'income', accountId: 1, toAccountId: null }, accounts)).toBeNull();
  });
});

describe('validateTransaction for credit cards', () => {
  const card = { id: 9, name: 'Visa', balance: -3_000_000, kind: 'card', credit_limit: 10_000_000 };

  it('spends against the credit limit, not the balance', () => {
    const draft = { type: 'expense' as const, accountId: 9, toAccountId: null };
    expect(validateTransaction({ ...draft, amount: 7_000_000 }, [card])).toBeNull();
    expect(validateTransaction({ ...draft, amount: 7_000_001 }, [card])).toEqual({
      code: 'overLimit',
      accountName: 'Visa',
      available: 7_000_000,
    });
  });

  it('does not check a card without a limit', () => {
    const noLimit = { ...card, credit_limit: null };
    expect(
      validateTransaction({ amount: 99_000_000, type: 'expense', accountId: 9, toAccountId: null }, [noLimit])
    ).toBeNull();
  });

  it('lets a bank pay the card bill up to the bank balance', () => {
    const bank = { id: 1, name: 'Nabil', balance: 2_000_000, kind: 'bank' };
    const pay = { type: 'transfer' as const, accountId: 1, toAccountId: 9 };
    expect(validateTransaction({ ...pay, amount: 2_000_000 }, [bank, card])).toBeNull();
    expect(validateTransaction({ ...pay, amount: 3_000_000 }, [bank, card])).toMatchObject({ code: 'insufficient' });
  });
});

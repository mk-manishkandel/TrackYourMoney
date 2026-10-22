import { parseBankSms } from '@/lib/sms';

const accounts = [
  { id: 1, name: 'Cash', kind: 'cash' },
  { id: 2, name: 'Nabil Bank', kind: 'bank' },
  { id: 3, name: 'NIC Asia', kind: 'bank' },
  { id: 4, name: 'eSewa', kind: 'wallet' },
];
const ctx = { receivedOn: '2026-10-22', accounts };

describe('parseBankSms', () => {
  it('reads a debit and ignores the balance figure', () => {
    const sms =
      'Dear Customer, your A/C ##1234 has been debited by NPR 1,500.00 on 21-10-2026. Remarks: Bhatbhateni. Avl Bal: NPR 25,300.50';
    expect(parseBankSms(sms, { ...ctx, sender: 'NABIL_ALERT' })).toEqual({
      amount: 150_000,
      type: 'expense',
      accountId: 2,
      toAccountId: null,
      date: '2026-10-21',
      note: 'Bhatbhateni',
      categoryKey: 'groceries',
    });
  });

  it('reads a credit with the balance listed first', () => {
    const sms = 'Bal: NPR 9,000.00. NPR 45,000.00 has been credited to your A/C 12XXXX56 on 2026/10/20. Remarks: Salary Oct';
    expect(parseBankSms(sms, { ...ctx, sender: 'NICASIA' })).toMatchObject({
      amount: 4_500_000,
      type: 'income',
      accountId: 3,
      date: '2026-10-20',
      note: 'Salary Oct',
    });
  });

  it('treats an ATM withdrawal as a transfer to cash', () => {
    const sms = 'NPR 5,000 withdrawn from your A/C ##1234 at ATM on 22-Oct-2026.';
    expect(parseBankSms(sms, { ...ctx, sender: 'NABIL' })).toMatchObject({
      amount: 500_000,
      type: 'transfer',
      accountId: 2,
      toAccountId: 1,
      note: 'ATM',
    });
  });

  it('reads wallet payments with a merchant', () => {
    const sms = 'You have successfully paid Rs. 450.00 to Himalayan Java via eSewa.';
    expect(parseBankSms(sms, { ...ctx, sender: 'eSewa' })).toMatchObject({
      amount: 45_000,
      type: 'expense',
      accountId: 4,
      note: 'Himalayan Java',
      date: '2026-10-22',
    });
  });

  it('converts Bikram Sambat dates', () => {
    const sms = 'Your A/C has been debited by NPR 200 on 2083/07/05.';
    expect(parseBankSms(sms, ctx)?.date).toBe('2026-10-22');
  });

  it('falls back to the received date for future or invalid dates', () => {
    expect(parseBankSms('NPR 100 debited on 30-12-2027', ctx)?.date).toBe('2026-10-22');
    expect(parseBankSms('NPR 100 debited on 45-13-2026', ctx)?.date).toBe('2026-10-22');
  });

  it('skips OTPs and messages without an amount', () => {
    expect(parseBankSms('Your OTP for NPR 500 payment is 482913.', ctx)).toBeNull();
    expect(parseBankSms('Dashain offer! Visit your nearest branch.', ctx)).toBeNull();
  });

  it('handles Devanagari digits', () => {
    expect(parseBankSms('रु ५०० debited from your account', ctx)?.amount).toBe(50_000);
  });
});

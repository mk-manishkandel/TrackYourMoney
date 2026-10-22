import { parseEntry } from '@/lib/parser';

const context = {
  today: '2026-10-22',
  accounts: [
    { id: 1, name: 'Cash' },
    { id: 2, name: 'eSewa' },
    { id: 3, name: 'Khalti' },
    { id: 4, name: 'Nabil Bank' },
  ],
};

describe('parseEntry', () => {
  it('reads a simple Romanized Nepali expense', () => {
    expect(parseEntry('khana 250', context)).toMatchObject({
      amount: 25_000,
      type: 'expense',
      categoryKey: 'food',
      accountId: null,
      date: '2026-10-22',
      note: 'khana',
    });
  });

  it('understands hajar, lakh and k multipliers', () => {
    expect(parseEntry('bhada 15 hajar', context).amount).toBe(1_500_000);
    expect(parseEntry('1.5 lakh loan kista', context).amount).toBe(15_000_000);
    expect(parseEntry('petrol 2k', context)).toMatchObject({ amount: 200_000, categoryKey: 'transport' });
  });

  it('reads Devanagari text and digits', () => {
    expect(parseEntry('तलब ५०००० आयो', context)).toMatchObject({
      amount: 5_000_000,
      type: 'income',
      categoryKey: 'salary',
    });
    expect(parseEntry('रु२५० चिया', context)).toMatchObject({ amount: 25_000, categoryKey: 'food' });
  });

  it('handles yesterday and the day before', () => {
    expect(parseEntry('hijo tarkari 340', context)).toMatchObject({ date: '2026-10-21', categoryKey: 'groceries' });
    expect(parseEntry('asti bus 50', context).date).toBe('2026-10-20');
    expect(parseEntry('हिजो बिजुली १२००', context)).toMatchObject({ date: '2026-10-21', categoryKey: 'utilities' });
  });

  it('prefers the marked or largest number over quantities', () => {
    expect(parseEntry('2 plate momo 300', context).amount).toBe(30_000);
    expect(parseEntry('3 kg chamal rs 450', context).amount).toBe(45_000);
    expect(parseEntry('school fee 1,25,000', context)).toMatchObject({ amount: 12_500_000, categoryKey: 'education' });
  });

  it('matches accounts by name and alias', () => {
    expect(parseEntry('ncell recharge 500 esewa', context)).toMatchObject({
      accountId: 2,
      categoryKey: 'internet_mobile',
    });
    expect(parseEntry('nagad 100 chiya', context).accountId).toBe(1);
    expect(parseEntry('nabil bank bata emi 12000', context).accountId).toBe(4);
  });

  it('detects income and transfers', () => {
    expect(parseEntry('got salary 50000', context)).toMatchObject({ type: 'income', categoryKey: 'salary' });
    expect(parseEntry('esewa load 2000', context)).toMatchObject({ type: 'transfer', categoryKey: null });
    expect(parseEntry('remittance 1 lakh aayo', context)).toMatchObject({
      type: 'income',
      categoryKey: 'remittance',
      amount: 10_000_000,
    });
  });

  it('prefers a specific category over a generic one', () => {
    expect(parseEntry('bus bhada 30', context).categoryKey).toBe('transport');
    expect(parseEntry('kotha bhada 12000', context).categoryKey).toBe('rent');
  });

  it('returns no amount when there is none', () => {
    expect(parseEntry('kati kharcha bhayo?', context).amount).toBeNull();
  });
});

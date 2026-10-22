import {
  bsMonthOf,
  bsMonthRange,
  daysLeftInBsMonth,
  formatDate,
  formatDateShort,
  shiftBsMonth,
} from '@/lib/dates';
import { formatAmount, groupLakh, parseAmountInput } from '@/lib/money';

describe('money', () => {
  it('groups digits in lakh/crore style', () => {
    expect(groupLakh('100')).toBe('100');
    expect(groupLakh('1000')).toBe('1,000');
    expect(groupLakh('100000')).toBe('1,00,000');
    expect(groupLakh('12345678')).toBe('1,23,45,678');
  });

  it('formats paisa amounts', () => {
    expect(formatAmount(12_345_600)).toBe('Rs 1,23,456');
    expect(formatAmount(25_050)).toBe('Rs 250.50');
    expect(formatAmount(-5_000)).toBe('-Rs 50');
    expect(formatAmount(10_000_000, { numerals: 'devanagari' })).toBe('रु १,००,०००');
  });

  it('parses typed amounts', () => {
    expect(parseAmountInput('1,50,000')).toBe(15_000_000);
    expect(parseAmountInput('२५०')).toBe(25_000);
    expect(parseAmountInput('99.5')).toBe(9_950);
    expect(parseAmountInput('abc')).toBeNull();
    expect(parseAmountInput('0')).toBeNull();
  });
});

describe('dates', () => {
  it('converts AD to the Bikram Sambat month', () => {
    expect(bsMonthOf('2026-10-22')).toEqual({ year: 2083, month: 6 });
  });

  it('wraps across BS years', () => {
    expect(shiftBsMonth({ year: 2082, month: 11 }, 1)).toEqual({ year: 2083, month: 0 });
    expect(shiftBsMonth({ year: 2083, month: 0 }, -1)).toEqual({ year: 2082, month: 11 });
  });

  it('gives contiguous BS month ranges', () => {
    const kartik = bsMonthRange({ year: 2083, month: 6 });
    const mangsir = bsMonthRange({ year: 2083, month: 7 });
    expect(kartik.start <= '2026-10-22' && '2026-10-22' <= kartik.end).toBe(true);
    expect(bsMonthOf(kartik.start)).toEqual({ year: 2083, month: 6 });
    expect(bsMonthOf(kartik.end)).toEqual({ year: 2083, month: 6 });
    expect(bsMonthOf(mangsir.start)).toEqual({ year: 2083, month: 7 });
  });

  it('formats dates with both calendars', () => {
    expect(formatDate('2026-10-22', { calendar: 'BS', lang: 'en', numerals: 'latin' })).toBe(
      '05 Kartik 2083 (22 Oct 2026)'
    );
    expect(formatDate('2026-10-22', { calendar: 'AD', lang: 'en', numerals: 'latin' })).toBe(
      '22 Oct 2026 (05 Kartik 2083)'
    );
    expect(formatDate('2026-10-22', { calendar: 'BS', lang: 'ne', numerals: 'devanagari' })).toBe(
      '०५ कार्तिक २०८३ (२२ अक्टोबर २०२६)'
    );
    expect(formatDateShort('2026-10-22', { calendar: 'BS', lang: 'en', numerals: 'latin' })).toBe('05 Kartik · 22 Oct');
  });

  it('counts days left in the BS month', () => {
    const { end } = bsMonthRange({ year: 2083, month: 6 });
    expect(daysLeftInBsMonth(end)).toBe(1);
  });
});

import { parseAmountInput, sanitizeAmountInput } from '@/lib/money';

describe('sanitizeAmountInput', () => {
  it('drops letters and symbols', () => {
    expect(sanitizeAmountInput('test')).toBe('');
    expect(sanitizeAmountInput('12a3')).toBe('123');
    expect(sanitizeAmountInput('Rs 500-')).toBe('500');
  });

  it('keeps lakh commas and Devanagari digits', () => {
    expect(sanitizeAmountInput('1,25,000')).toBe('1,25,000');
    expect(sanitizeAmountInput('५००')).toBe('५००');
  });

  it('allows one decimal point with at most two places', () => {
    expect(sanitizeAmountInput('12.5.6')).toBe('12.56');
    expect(sanitizeAmountInput('99.999')).toBe('99.99');
    expect(sanitizeAmountInput('10.')).toBe('10.');
  });

  it('produces values the parser accepts', () => {
    expect(parseAmountInput(sanitizeAmountInput('Rs 1,250.50 only'))).toBe(125_050);
  });
});

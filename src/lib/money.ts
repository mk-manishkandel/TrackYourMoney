/**
 * Money is stored as integer paisa (1 NPR = 100 paisa) so sums never drift.
 */

const DEVANAGARI_DIGITS = '०१२३४५६७८९';

export type Numerals = 'latin' | 'devanagari';

export function toPaisa(rupees: number): number {
  return Math.round(rupees * 100);
}

export function toRupees(paisa: number): number {
  return paisa / 100;
}

export function toDevanagariDigits(text: string): string {
  return text.replace(/[0-9]/g, (d) => DEVANAGARI_DIGITS[Number(d)]);
}

export function toLatinDigits(text: string): string {
  return text.replace(/[०-९]/g, (d) => String(DEVANAGARI_DIGITS.indexOf(d)));
}

/** Groups digits the South Asian way: 1234567 -> "12,34,567". */
export function groupLakh(integerDigits: string): string {
  if (integerDigits.length <= 3) return integerDigits;
  const lastThree = integerDigits.slice(-3);
  const rest = integerDigits.slice(0, -3);
  return rest.replace(/\B(?=(\d{2})+(?!\d))/g, ',') + ',' + lastThree;
}

export function formatAmount(
  paisa: number,
  { numerals = 'latin', symbol = true }: { numerals?: Numerals; symbol?: boolean } = {}
): string {
  const negative = paisa < 0;
  const abs = Math.abs(paisa);
  const whole = Math.floor(abs / 100);
  const fraction = abs % 100;
  let text = groupLakh(String(whole));
  if (fraction) text += '.' + String(fraction).padStart(2, '0');
  if (symbol) text = (numerals === 'devanagari' ? 'रु ' : 'Rs ') + text;
  if (negative) text = '-' + text;
  return numerals === 'devanagari' ? toDevanagariDigits(text) : text;
}

/** Parses user-typed amounts like "1,50,000", "250.5" or "२५०" into paisa. */
/**
 * Filters what can be typed or pasted into an amount field: digits (Latin or
 * Devanagari), lakh-style commas, and one decimal point with at most two places.
 */
export function sanitizeAmountInput(input: string): string {
  const kept = input.replace(/[^0-9०-९.,]/g, '');
  const dot = kept.indexOf('.');
  if (dot === -1) return kept;
  const decimals = kept.slice(dot + 1).replace(/[.,]/g, '').slice(0, 2);
  return `${kept.slice(0, dot)}.${decimals}`;
}

export function parseAmountInput(input: string): number | null {
  const cleaned = toLatinDigits(input).replace(/[,\s]/g, '');
  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) return null;
  const paisa = toPaisa(Number(cleaned));
  return paisa > 0 ? paisa : null;
}

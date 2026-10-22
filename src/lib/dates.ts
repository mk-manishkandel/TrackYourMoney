import NepaliDate from 'nepali-date-converter';

import { toDevanagariDigits, toLatinDigits, type Numerals } from '@/lib/money';

export type Calendar = 'BS' | 'AD';
export type Lang = 'en' | 'ne';

/** Bikram Sambat year and 0-based month (0 = Baisakh). */
export type BsMonth = { year: number; month: number };

const AD_MONTHS_EN = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const AD_MONTHS_NE = [
  'जनवरी', 'फेब्रुअरी', 'मार्च', 'अप्रिल', 'मे', 'जुन',
  'जुलाई', 'अगस्ट', 'सेप्टेम्बर', 'अक्टोबर', 'नोभेम्बर', 'डिसेम्बर',
];

/** Local calendar date as "YYYY-MM-DD" (no timezone shifts). */
export function toISODate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function fromISODate(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(iso: string, days: number): string {
  const date = fromISODate(iso);
  date.setDate(date.getDate() + days);
  return toISODate(date);
}

export function bsMonthOf(iso: string): BsMonth {
  const bs = new NepaliDate(fromISODate(iso));
  return { year: bs.getYear(), month: bs.getMonth() };
}

export function shiftBsMonth({ year, month }: BsMonth, delta: number): BsMonth {
  const index = year * 12 + month + delta;
  return { year: Math.floor(index / 12), month: index % 12 };
}

/** First and last AD dates ("YYYY-MM-DD") of a BS month, inclusive. */
export function bsMonthRange(bsMonth: BsMonth): { start: string; end: string } {
  const next = shiftBsMonth(bsMonth, 1);
  const start = toISODate(new NepaliDate(bsMonth.year, bsMonth.month, 1).toJsDate());
  const nextStart = toISODate(new NepaliDate(next.year, next.month, 1).toJsDate());
  return { start, end: addDays(nextStart, -1) };
}

export function formatBsMonth({ year, month }: BsMonth, lang: Lang): string {
  const date = new NepaliDate(year, month, 1);
  return date.format('MMMM YYYY', lang === 'ne' ? 'np' : 'en');
}

type DateFormat = { calendar: Calendar; lang: Lang; numerals: Numerals };

function formatSingle(iso: string, calendar: Calendar, lang: Lang, withYear: boolean): string {
  if (calendar === 'BS') {
    const bs = new NepaliDate(fromISODate(iso));
    return bs.format(withYear ? 'DD MMMM YYYY' : 'DD MMMM', lang === 'ne' ? 'np' : 'en');
  }
  const ad = fromISODate(iso);
  const months = lang === 'ne' ? AD_MONTHS_NE : AD_MONTHS_EN;
  return `${ad.getDate()} ${months[ad.getMonth()]}${withYear ? ` ${ad.getFullYear()}` : ''}`;
}

function applyNumerals(text: string, numerals: Numerals): string {
  return numerals === 'devanagari' ? toDevanagariDigits(text) : toLatinDigits(text);
}

/** Primary calendar first, the other in brackets: "05 Kartik 2083 (22 Oct 2026)". */
export function formatDate(iso: string, { calendar, lang, numerals }: DateFormat): string {
  const other: Calendar = calendar === 'BS' ? 'AD' : 'BS';
  const text = `${formatSingle(iso, calendar, lang, true)} (${formatSingle(iso, other, lang, true)})`;
  return applyNumerals(text, numerals);
}

/** Compact dual date for lists: "05 Kartik · 22 Oct". */
export function formatDateShort(iso: string, { calendar, lang, numerals }: DateFormat): string {
  const other: Calendar = calendar === 'BS' ? 'AD' : 'BS';
  const text = `${formatSingle(iso, calendar, lang, false)} · ${formatSingle(iso, other, lang, false)}`;
  return applyNumerals(text, numerals);
}

/** Days from `iso` to the end of its BS month, inclusive of today. */
export function daysLeftInBsMonth(iso: string): number {
  const { end } = bsMonthRange(bsMonthOf(iso));
  return Math.round((fromISODate(end).getTime() - fromISODate(iso).getTime()) / 86_400_000) + 1;
}

/** "Thursday" / "बिहीबार" for headers. */
export function weekdayName(iso: string, lang: Lang): string {
  return new NepaliDate(fromISODate(iso)).format('dddd', lang === 'ne' ? 'np' : 'en');
}

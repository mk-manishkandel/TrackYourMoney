import NepaliDate from 'nepali-date-converter';

import type { TxnType } from '@/lib/categories';
import { toISODate } from '@/lib/dates';
import { toLatinDigits, toPaisa } from '@/lib/money';
import { parseEntry } from '@/lib/parser';

type SmsAccount = { id: number; name: string; kind: string };

export type SmsTransaction = {
  amount: number;
  type: TxnType;
  accountId: number | null;
  /** Set for ATM withdrawals, which move money from the bank to Cash. */
  toAccountId: number | null;
  date: string;
  note: string;
  categoryKey: string | null;
};

const NOT_A_TRANSACTION = /\b(otp|one[\s-]?time|password|pin code|verification code)\b/i;
const ATM = /\b(atm|cash withdrawal|withdrawn at atm)\b/i;
const DEBIT = /\b(debited|debit|dr\.?|withdrawn|withdrawal|paid|payment of|purchase|spent|sent|deducted|transferred to)\b/i;
const CREDIT = /\b(credited|credit|cr\.?|deposited|deposit|received|refund(?:ed)?|transferred from)\b/i;

// "NPR 1,500.00", "Rs.500", "रु ५००", and "NPR. 1500"
const AMOUNT = /(?:npr|rs|inr|रु|रू)\.?\s*:?\s*([0-9][0-9,]*(?:\.[0-9]{1,2})?)/gi;
// Balance figures look like amounts but aren't the transaction.
const BALANCE_BEFORE = /(bal|balance|avl|available|limit)[^0-9]{0,15}$/i;

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

function findAmount(text: string): number | null {
  for (const match of text.matchAll(AMOUNT)) {
    const before = text.slice(Math.max(0, match.index - 25), match.index);
    if (BALANCE_BEFORE.test(before)) continue;
    const value = Number(match[1].replace(/,/g, ''));
    if (value > 0) return toPaisa(value);
  }
  return null;
}

/** Builds an ISO date, treating years 2070+ as Bikram Sambat. Null if invalid. */
function makeDate(year: number, month: number, day: number): string | null {
  if (year < 100) year += 2000;
  if (month < 1 || month > 12 || day < 1 || day > 32) return null;
  if (year >= 2070) {
    try {
      return toISODate(new NepaliDate(year, month - 1, day).toJsDate());
    } catch {
      return null;
    }
  }
  const date = new Date(year, month - 1, day);
  return date.getMonth() === month - 1 ? toISODate(date) : null;
}

function findDate(text: string): string | null {
  let m = text.match(/\b(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})\b/);
  if (m) return makeDate(+m[1], +m[2], +m[3]);
  m = text.match(/\b(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})\b/);
  if (m) return makeDate(+m[3], +m[2], +m[1]);
  m = text.match(/\b(\d{1,2})[-\s]([a-z]{3})[a-z]*[-\s,]+(\d{2,4})\b/i);
  if (m) {
    const month = MONTHS.indexOf(m[2].toLowerCase()) + 1;
    if (month > 0) return makeDate(+m[3], month, +m[1]);
  }
  return null;
}

/** The merchant or purpose: "Remarks: X", "at X", "to X", "for X". */
function findNote(text: string): string {
  const m =
    text.match(/\b(?:remarks?|narration|details?|desc)\s*[:\-]\s*([^.\n]+)/i) ??
    text.match(/\b(?:at|to|for|from)\s+([A-Za-z][^.\n,]*?)(?=\s+on\b|\s+via\b|[.,\n]|$)/i);
  const note = m?.[1].trim().replace(/\s+/g, ' ') ?? '';
  // Account numbers are not a useful note.
  return /^(your\s+)?a\/?c\b|^\W*x{2,}|^#/i.test(note) ? '' : note.slice(0, 60);
}

function findAccount(text: string, sender: string, accounts: SmsAccount[]): number | null {
  const haystack = `${sender} ${text}`.toLowerCase();
  const named = accounts.find((a) =>
    a.name
      .toLowerCase()
      .split(/\s+/)
      .some((word) => word.length >= 3 && !['bank', 'ltd', 'limited', 'account'].includes(word) && haystack.includes(word))
  );
  return named?.id ?? accounts.find((a) => a.kind === 'bank')?.id ?? null;
}

/** Cheap check for lists and counts: has an amount and isn't an OTP. */
export function looksLikeTransaction(body: string): boolean {
  const text = toLatinDigits(body);
  return !NOT_A_TRANSACTION.test(text) && findAmount(text) !== null;
}

/**
 * Reads a bank or wallet SMS. Returns null for messages that aren't a completed
 * transaction (OTPs, promotions, or anything without an amount).
 */
export function parseBankSms(
  body: string,
  { sender = '', receivedOn, accounts }: { sender?: string; receivedOn: string; accounts: SmsAccount[] }
): SmsTransaction | null {
  const text = toLatinDigits(body);
  if (NOT_A_TRANSACTION.test(text)) return null;
  const amount = findAmount(text);
  if (amount === null) return null;

  const debit = text.search(DEBIT);
  const credit = text.search(CREDIT);
  const isAtm = ATM.test(text);
  let type: TxnType = 'expense';
  if (isAtm) type = 'transfer';
  else if (credit !== -1 && (debit === -1 || credit < debit)) type = 'income';

  const date = findDate(text);
  const note = isAtm ? 'ATM' : findNote(text);
  const accountId = findAccount(text, sender, accounts);
  const cash = accounts.find((a) => a.kind === 'cash' && a.id !== accountId);

  return {
    amount,
    type: type === 'transfer' && !cash ? 'expense' : type,
    accountId,
    toAccountId: type === 'transfer' ? (cash?.id ?? null) : null,
    // Dates in the future or missing fall back to when the SMS arrived.
    date: date && date <= receivedOn ? date : receivedOn,
    note,
    categoryKey: note ? parseEntry(note, { today: receivedOn, accounts: [] }).categoryKey : null,
  };
}

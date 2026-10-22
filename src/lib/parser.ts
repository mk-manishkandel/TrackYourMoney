/**
 * Offline, rules-based parser for quick entries such as "khana 250", "hijo bhada 15 hajar"
 * or "तलब ५०००० आयो". It works on every phone; an on-device LLM can refine it later.
 */
import { DEFAULT_CATEGORIES, type TxnType } from '@/lib/categories';
import { addDays } from '@/lib/dates';
import { toLatinDigits, toPaisa } from '@/lib/money';

export type ParseContext = {
  /** Today as "YYYY-MM-DD". */
  today: string;
  accounts: { id: number; name: string }[];
};

export type ParsedEntry = {
  /** Amount in paisa, or null when no amount was found. */
  amount: number | null;
  type: TxnType;
  /** Key of a default category, or null when nothing matched. */
  categoryKey: string | null;
  accountId: number | null;
  date: string;
  note: string;
};

const MULTIPLIERS: Record<string, number> = {
  k: 1_000,
  hajar: 1_000,
  hazar: 1_000,
  hajaar: 1_000,
  'हजार': 1_000,
  lakh: 100_000,
  lac: 100_000,
  lakhs: 100_000,
  'लाख': 100_000,
  crore: 10_000_000,
  cr: 10_000_000,
  karod: 10_000_000,
  'करोड': 10_000_000,
};

const CURRENCY_WORDS = new Set(['rs', 'rs.', 'npr', 'रु', 'रू', 'rupees', 'rupiya', 'रुपैयाँ', 'रुपैयां']);

const INCOME_WORDS = new Set([
  'salary', 'talab', 'तलब', 'income', 'received', 'receive', 'got', 'earned', 'payo', 'paayo', 'पायो',
  'kamaye', 'kamai', 'कमाइ', 'आम्दानी', 'refund', 'bonus', 'remittance', 'remit',
]);

const TRANSFER_WORDS = new Set(['transfer', 'transferred', 'ट्रान्सफर', 'withdraw', 'withdrew', 'atm', 'load', 'loaded']);

const DAY_OFFSETS: Record<string, number> = {
  today: 0,
  aaja: 0,
  aja: 0,
  'आज': 0,
  yesterday: -1,
  hijo: -1,
  hijjo: -1,
  'हिजो': -1,
  asti: -2,
  'अस्ति': -2,
};

const ACCOUNT_ALIASES: Record<string, string> = {
  nagad: 'cash',
  'नगद': 'cash',
  'इसेवा': 'esewa',
  'खल्ती': 'khalti',
};

const NUMBER_TOKEN = /^\d+(?:,\d+)*(?:\.\d+)?$/;

function tokenize(text: string): string[] {
  return toLatinDigits(text)
    .toLowerCase()
    // Separate glued tokens: "250rs", "रु२५०", "1.5k", "rs.500".
    .replace(/([\p{L}\p{M}]\.?)(\d)/gu, '$1 $2')
    .replace(/(\d)([\p{L}\p{M}])/gu, '$1 $2')
    .split(/[^\p{L}\p{M}\p{N}.,-]+/u)
    .map((t) => t.replace(/^[.,-]+|[.,-]+$/g, ''))
    .filter(Boolean);
}

function findAmount(tokens: string[]): { paisa: number | null; used: Set<number> } {
  const candidates: { rupees: number; marked: boolean; used: number[] }[] = [];
  tokens.forEach((token, i) => {
    if (!NUMBER_TOKEN.test(token)) return;
    let rupees = Number(token.replace(/,/g, ''));
    const used = [i];
    const multiplier = MULTIPLIERS[tokens[i + 1] ?? ''];
    if (multiplier) {
      rupees *= multiplier;
      used.push(i + 1);
    }
    if (CURRENCY_WORDS.has(tokens[i - 1] ?? '')) used.push(i - 1);
    if (CURRENCY_WORDS.has(tokens[i + 1] ?? '')) used.push(i + 1);
    candidates.push({ rupees, marked: used.length > 1, used });
  });
  if (candidates.length === 0) return { paisa: null, used: new Set() };
  // Prefer amounts marked with a currency or multiplier, then the largest ("2 plate momo 300" -> 300).
  candidates.sort((a, b) => Number(b.marked) - Number(a.marked) || b.rupees - a.rupees);
  const best = candidates[0];
  return { paisa: best.rupees > 0 ? toPaisa(best.rupees) : null, used: new Set(best.used) };
}

function findCategory(tokens: string[], type: TxnType): string | null {
  if (type === 'transfer') return null;
  for (const category of DEFAULT_CATEGORIES) {
    if (category.kind !== type) continue;
    if (tokens.some((t) => category.keywords.includes(t))) return category.key;
  }
  return null;
}

function findAccount(tokens: string[], accounts: ParseContext['accounts']): number | null {
  const normalized = tokens.map((t) => ACCOUNT_ALIASES[t] ?? t);
  for (const account of accounts) {
    const nameTokens = tokenize(account.name);
    if (nameTokens.length && nameTokens.every((t) => normalized.includes(t))) return account.id;
  }
  return null;
}

export function parseEntry(text: string, context: ParseContext): ParsedEntry {
  const tokens = tokenize(text);
  const { paisa, used } = findAmount(tokens);

  let type: TxnType = 'expense';
  if (tokens.some((t) => TRANSFER_WORDS.has(t))) type = 'transfer';
  else if (tokens.some((t) => INCOME_WORDS.has(t))) type = 'income';

  let date = context.today;
  for (const token of tokens) {
    if (token in DAY_OFFSETS) {
      date = addDays(context.today, DAY_OFFSETS[token]);
      break;
    }
  }

  const note = tokens
    .filter((t, i) => !used.has(i) && !(t in DAY_OFFSETS))
    .join(' ')
    .trim();

  return {
    amount: paisa,
    type,
    categoryKey: findCategory(tokens, type),
    accountId: findAccount(tokens, context.accounts),
    date,
    note,
  };
}

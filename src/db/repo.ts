import type { SQLiteDatabase } from 'expo-sqlite';

import { LEGACY_COLOR } from '@/db/migrations';
import type { CategoryGroup, TxnType } from '@/lib/categories';
import type { BsMonth } from '@/lib/dates';
import { looksLikeTransaction } from '@/lib/sms';

export type Account = {
  id: number;
  name: string;
  kind: 'cash' | 'wallet' | 'bank' | 'card';
  opening_balance: number;
  balance: number;
  /**
   * 1 for savings: its transactions are recorded and listed, but its balance and
   * activity are left out of totals and budgets. Its balance shows only in Settings.
   */
  is_savings: number;
  /** Credit cards only: limit in paisa and billing days of the month (1-31); null when unset. */
  credit_limit: number | null;
  statement_day: number | null;
  due_day: number | null;
};

export type CardSettings = { creditLimit: number | null; statementDay: number | null; dueDay: number | null };

/** The account a new entry defaults to: the first one that isn't savings. */
export function defaultAccount(accounts: Account[]): Account | undefined {
  return accounts.find((a) => !a.is_savings) ?? accounts[0];
}

/** SQL condition that leaves savings-account activity out of totals and budgets. */
const NOT_SAVINGS = 'account_id NOT IN (SELECT id FROM accounts WHERE is_savings = 1)';

export type Category = {
  id: number;
  key: string | null;
  name: string;
  kind: 'expense' | 'income';
  icon: string;
  grp: CategoryGroup;
};

export type Transaction = {
  id: number;
  amount: number;
  type: TxnType;
  category_id: number | null;
  account_id: number;
  to_account_id: number | null;
  date: string;
  note: string;
};

export type NewTransaction = Omit<Transaction, 'id'>;

export type BudgetLine = {
  category: Category;
  limit: number | null;
  spent: number;
};

export async function listAccounts(db: SQLiteDatabase): Promise<Account[]> {
  return db.getAllAsync<Account>(`
    SELECT a.id, a.name, a.kind, a.opening_balance, a.is_savings, a.credit_limit, a.statement_day, a.due_day,
      a.opening_balance
        + COALESCE((SELECT SUM(amount) FROM transactions WHERE type = 'income' AND account_id = a.id), 0)
        - COALESCE((SELECT SUM(amount) FROM transactions WHERE type IN ('expense', 'transfer') AND account_id = a.id), 0)
        + COALESCE((SELECT SUM(amount) FROM transactions WHERE type = 'transfer' AND to_account_id = a.id), 0)
        + COALESCE((SELECT SUM(CASE direction WHEN 'borrowed' THEN amount ELSE -amount END)
                    FROM loans WHERE account_id = a.id), 0)
        + COALESCE((SELECT SUM(CASE l.direction WHEN 'lent' THEN p.amount ELSE -p.amount END)
                    FROM loan_payments p JOIN loans l ON l.id = p.loan_id WHERE p.account_id = a.id), 0)
        AS balance
    FROM accounts a
    WHERE a.archived = 0
    ORDER BY a.id
  `);
}

export async function addAccount(
  db: SQLiteDatabase,
  name: string,
  kind: Account['kind'],
  openingBalance: number,
  isSavings = false,
  card: CardSettings = { creditLimit: null, statementDay: null, dueDay: null }
): Promise<number> {
  const result = await db.runAsync(
    `INSERT INTO accounts (name, kind, opening_balance, is_savings, credit_limit, statement_day, due_day)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    name.trim(),
    kind,
    openingBalance,
    isSavings ? 1 : 0,
    card.creditLimit,
    card.statementDay,
    card.dueDay
  );
  return result.lastInsertRowId;
}

export async function updateCardSettings(db: SQLiteDatabase, id: number, card: CardSettings) {
  await db.runAsync(
    'UPDATE accounts SET credit_limit = ?, statement_day = ?, due_day = ? WHERE id = ?',
    card.creditLimit,
    card.statementDay,
    card.dueDay,
    id
  );
}

/** Transactions from or to one account, newest first. */
export async function listAccountTransactions(db: SQLiteDatabase, accountId: number, limit = 30): Promise<Transaction[]> {
  return db.getAllAsync<Transaction>(
    `SELECT id, amount, type, category_id, account_id, to_account_id, date, note
     FROM transactions WHERE account_id = ? OR to_account_id = ?
     ORDER BY date DESC, id DESC LIMIT ?`,
    accountId,
    accountId,
    limit
  );
}

/** Expenses charged to one account within a date range. */
export async function accountSpending(
  db: SQLiteDatabase,
  accountId: number,
  range: { start: string; end: string }
): Promise<number> {
  const row = await db.getFirstAsync<{ total: number | null }>(
    "SELECT SUM(amount) AS total FROM transactions WHERE account_id = ? AND type = 'expense' AND date BETWEEN ? AND ?",
    accountId,
    range.start,
    range.end
  );
  return row?.total ?? 0;
}

export async function setAccountSavings(db: SQLiteDatabase, id: number, isSavings: boolean) {
  await db.runAsync('UPDATE accounts SET is_savings = ? WHERE id = ?', isSavings ? 1 : 0, id);
}

/**
 * Active categories for pickers. Screens that label past transactions pass
 * `includeRemoved` so a removed category still names its old entries.
 */
export async function listCategories(
  db: SQLiteDatabase,
  { includeRemoved = false }: { includeRemoved?: boolean } = {}
): Promise<Category[]> {
  return db.getAllAsync<Category>(
    `SELECT id, key, name, kind, icon, grp FROM categories ${includeRemoved ? '' : 'WHERE archived = 0'} ORDER BY id`
  );
}

/** "Other" categories are the fallback for unmatched entries, so they can't be removed. */
export const PROTECTED_CATEGORY_KEYS = ['other_expense', 'other_income'];

export async function addCategory(
  db: SQLiteDatabase,
  category: { name: string; kind: Category['kind']; icon: string }
) {
  await db.runAsync(
    'INSERT INTO categories (name, kind, icon, color, grp) VALUES (?, ?, ?, ?, ?)',
    category.name.trim(),
    category.kind,
    category.icon,
    LEGACY_COLOR,
    category.kind === 'income' ? 'income' : 'other'
  );
}

/** Hides a category from pickers and budgets; its past transactions keep the label. */
export async function setCategoryRemoved(db: SQLiteDatabase, id: number, removed: boolean) {
  await db.runAsync(
    `UPDATE categories SET archived = ? WHERE id = ? AND (key IS NULL OR key NOT IN ('${PROTECTED_CATEGORY_KEYS.join("', '")}'))`,
    removed ? 1 : 0,
    id
  );
}

/** Returns the new transaction's id. */
export async function addTransaction(db: SQLiteDatabase, txn: NewTransaction): Promise<number> {
  const result = await db.runAsync(
    `INSERT INTO transactions (amount, type, category_id, account_id, to_account_id, date, note)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    txn.amount,
    txn.type,
    txn.type === 'transfer' ? null : txn.category_id,
    txn.account_id,
    txn.type === 'transfer' ? txn.to_account_id : null,
    txn.date,
    txn.note
  );
  return result.lastInsertRowId;
}

export async function deleteTransaction(db: SQLiteDatabase, id: number) {
  await db.runAsync('DELETE FROM transactions WHERE id = ?', id);
}

export async function listTransactions(
  db: SQLiteDatabase,
  range: { start: string; end: string },
  limit = 500
): Promise<Transaction[]> {
  return db.getAllAsync<Transaction>(
    `SELECT id, amount, type, category_id, account_id, to_account_id, date, note
     FROM transactions WHERE date BETWEEN ? AND ?
     ORDER BY date DESC, id DESC LIMIT ?`,
    range.start,
    range.end,
    limit
  );
}

export async function totalsForRange(
  db: SQLiteDatabase,
  range: { start: string; end: string }
): Promise<{ income: number; expense: number }> {
  const row = await db.getFirstAsync<{ income: number | null; expense: number | null }>(
    `SELECT
       SUM(CASE WHEN type = 'income' THEN amount END) AS income,
       SUM(CASE WHEN type = 'expense' THEN amount END) AS expense
     FROM transactions WHERE date BETWEEN ? AND ? AND ${NOT_SAVINGS}`,
    range.start,
    range.end
  );
  return { income: row?.income ?? 0, expense: row?.expense ?? 0 };
}

export async function categorySpending(
  db: SQLiteDatabase,
  range: { start: string; end: string }
): Promise<{ category: Category; spent: number }[]> {
  const rows = await db.getAllAsync<Category & { spent: number }>(
    `SELECT c.id, c.key, c.name, c.kind, c.icon, c.grp, SUM(t.amount) AS spent
     FROM transactions t JOIN categories c ON c.id = t.category_id
     WHERE t.type = 'expense' AND t.date BETWEEN ? AND ? AND t.${NOT_SAVINGS}
     GROUP BY c.id ORDER BY spent DESC`,
    range.start,
    range.end
  );
  return rows.map(({ spent, ...category }) => ({ category, spent }));
}

export async function budgetLines(
  db: SQLiteDatabase,
  bsMonth: BsMonth,
  range: { start: string; end: string }
): Promise<BudgetLine[]> {
  const rows = await db.getAllAsync<Category & { limit_amount: number | null; spent: number }>(
    `SELECT c.id, c.key, c.name, c.kind, c.icon, c.grp,
       b.amount AS limit_amount,
       COALESCE((SELECT SUM(t.amount) FROM transactions t
                 WHERE t.category_id = c.id AND t.type = 'expense' AND t.date BETWEEN ? AND ?
                   AND t.${NOT_SAVINGS}), 0) AS spent
     FROM categories c
     LEFT JOIN budgets b ON b.category_id = c.id AND b.bs_year = ? AND b.bs_month = ?
     WHERE c.kind = 'expense' AND c.archived = 0
     ORDER BY (b.amount IS NULL), spent DESC, c.id`,
    range.start,
    range.end,
    bsMonth.year,
    bsMonth.month
  );
  return rows.map(({ limit_amount, spent, ...category }) => ({ category, limit: limit_amount, spent }));
}

export async function setBudget(db: SQLiteDatabase, categoryId: number, bsMonth: BsMonth, amount: number | null) {
  if (amount === null) {
    await db.runAsync(
      'DELETE FROM budgets WHERE category_id = ? AND bs_year = ? AND bs_month = ?',
      categoryId,
      bsMonth.year,
      bsMonth.month
    );
    return;
  }
  await db.runAsync(
    `INSERT INTO budgets (category_id, bs_year, bs_month, amount) VALUES (?, ?, ?, ?)
     ON CONFLICT (category_id, bs_year, bs_month) DO UPDATE SET amount = excluded.amount`,
    categoryId,
    bsMonth.year,
    bsMonth.month,
    amount
  );
}

export async function getSettings(db: SQLiteDatabase): Promise<Record<string, string>> {
  const rows = await db.getAllAsync<{ key: string; value: string }>('SELECT key, value FROM settings');
  return Object.fromEntries(rows.map((r) => [r.key, r.value]));
}

export async function setSetting(db: SQLiteDatabase, key: string, value: string) {
  await db.runAsync(
    'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT (key) DO UPDATE SET value = excluded.value',
    key,
    value
  );
}

const PINNED_CATEGORIES = 'pinned_categories';

export async function getPinnedCategories(db: SQLiteDatabase): Promise<number[]> {
  const row = await db.getFirstAsync<{ value: string }>('SELECT value FROM settings WHERE key = ?', PINNED_CATEGORIES);
  if (!row) return [];
  try {
    const ids: unknown = JSON.parse(row.value);
    return Array.isArray(ids) ? ids.filter((id): id is number => typeof id === 'number') : [];
  } catch {
    return [];
  }
}

export async function setPinnedCategories(db: SQLiteDatabase, ids: number[]) {
  await setSetting(db, PINNED_CATEGORIES, JSON.stringify(ids));
}

export type InboxSms = { id: number; body: string; sender: string; received_at: string };

/**
 * Queues an SMS. Identical texts are kept: two real payments of the same amount
 * can produce the same message. Only a manual paste of text that is already
 * waiting is refused (`skipIfPending`), since that is almost always a double tap.
 */
export async function addInboxSms(
  db: SQLiteDatabase,
  body: string,
  sender: string,
  { skipIfPending = false }: { skipIfPending?: boolean } = {}
): Promise<'added' | 'alreadyPending'> {
  const text = body.trim();
  if (skipIfPending) {
    const waiting = await db.getFirstAsync<{ id: number }>(
      "SELECT id FROM sms_inbox WHERE body = ? AND status = 'pending'",
      text
    );
    if (waiting) return 'alreadyPending';
  }
  await db.runAsync(
    'INSERT INTO sms_inbox (body, sender, received_at) VALUES (?, ?, ?)',
    text,
    sender.trim(),
    new Date().toISOString()
  );
  return 'added';
}

export async function listPendingSms(db: SQLiteDatabase): Promise<InboxSms[]> {
  return db.getAllAsync<InboxSms>(
    "SELECT id, body, sender, received_at FROM sms_inbox WHERE status = 'pending' ORDER BY received_at DESC"
  );
}

export async function getInboxSms(db: SQLiteDatabase, id: number): Promise<InboxSms | null> {
  return db.getFirstAsync<InboxSms>('SELECT id, body, sender, received_at FROM sms_inbox WHERE id = ?', id);
}

/** Pending SMS that look like transactions; other forwarded messages don't count. */
export async function countPendingSms(db: SQLiteDatabase): Promise<number> {
  const pending = await listPendingSms(db);
  return pending.filter((sms) => looksLikeTransaction(sms.body)).length;
}

export async function resolveInboxSms(
  db: SQLiteDatabase,
  id: number,
  outcome: { status: 'recorded'; transactionId: number } | { status: 'dismissed' | 'pending' }
) {
  await db.runAsync(
    'UPDATE sms_inbox SET status = ?, transaction_id = ? WHERE id = ?',
    outcome.status,
    outcome.status === 'recorded' ? outcome.transactionId : null,
    id
  );
}

export type LoanDirection = 'lent' | 'borrowed';

export type Loan = {
  id: number;
  person: string;
  direction: LoanDirection;
  amount: number;
  /** Where the money left or arrived; null records the loan without moving any balance. */
  account_id: number | null;
  date: string;
  due_date: string | null;
  note: string;
  settled: number;
  /** Sum of repayments so far. */
  paid: number;
};

export type LoanPayment = { id: number; loan_id: number; amount: number; account_id: number | null; date: string };

const LOAN_COLUMNS = `l.id, l.person, l.direction, l.amount, l.account_id, l.date, l.due_date, l.note, l.settled,
  COALESCE((SELECT SUM(p.amount) FROM loan_payments p WHERE p.loan_id = l.id), 0) AS paid`;

export async function listLoans(db: SQLiteDatabase): Promise<Loan[]> {
  return db.getAllAsync<Loan>(`SELECT ${LOAN_COLUMNS} FROM loans l ORDER BY l.settled, l.date DESC, l.id DESC`);
}

export async function getLoan(db: SQLiteDatabase, id: number): Promise<Loan | null> {
  return db.getFirstAsync<Loan>(`SELECT ${LOAN_COLUMNS} FROM loans l WHERE l.id = ?`, id);
}

export async function listLoanPayments(db: SQLiteDatabase, loanId: number): Promise<LoanPayment[]> {
  return db.getAllAsync<LoanPayment>(
    'SELECT id, loan_id, amount, account_id, date FROM loan_payments WHERE loan_id = ? ORDER BY date DESC, id DESC',
    loanId
  );
}

export async function addLoan(db: SQLiteDatabase, loan: Omit<Loan, 'id' | 'settled' | 'paid'>): Promise<number> {
  const result = await db.runAsync(
    'INSERT INTO loans (person, direction, amount, account_id, date, due_date, note) VALUES (?, ?, ?, ?, ?, ?, ?)',
    loan.person.trim(),
    loan.direction,
    loan.amount,
    loan.account_id,
    loan.date,
    loan.due_date,
    loan.note.trim()
  );
  return result.lastInsertRowId;
}

/** Records a repayment and marks the loan settled once it is fully repaid. */
export async function addLoanPayment(db: SQLiteDatabase, payment: Omit<LoanPayment, 'id'>) {
  await db.withTransactionAsync(async () => {
    await db.runAsync(
      'INSERT INTO loan_payments (loan_id, amount, account_id, date) VALUES (?, ?, ?, ?)',
      payment.loan_id,
      payment.amount,
      payment.account_id,
      payment.date
    );
    await db.runAsync(
      `UPDATE loans SET settled = 1 WHERE id = ?
         AND amount <= (SELECT COALESCE(SUM(amount), 0) FROM loan_payments WHERE loan_id = ?)`,
      payment.loan_id,
      payment.loan_id
    );
  });
}

export async function setLoanSettled(db: SQLiteDatabase, id: number, settled: boolean) {
  await db.runAsync('UPDATE loans SET settled = ? WHERE id = ?', settled ? 1 : 0, id);
}

export async function deleteLoan(db: SQLiteDatabase, id: number) {
  await db.runAsync('DELETE FROM loans WHERE id = ?', id);
}

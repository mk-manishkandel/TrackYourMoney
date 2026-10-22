import type { SQLiteDatabase } from 'expo-sqlite';

import { DEFAULT_ACCOUNTS, DEFAULT_CATEGORIES } from '@/lib/categories';

/** `categories.color` predates theme-driven colors; new rows still need a value. */
export const LEGACY_COLOR = '#657168';

/**
 * Each entry upgrades the schema by one version. Never edit a shipped migration;
 * append a new one instead.
 */
const MIGRATIONS: ((db: SQLiteDatabase) => Promise<void>)[] = [
  async (db) => {
    await db.execAsync(`
      CREATE TABLE accounts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE,
        kind TEXT NOT NULL CHECK (kind IN ('cash', 'wallet', 'bank', 'card')),
        opening_balance INTEGER NOT NULL DEFAULT 0,
        archived INTEGER NOT NULL DEFAULT 0
      );
      CREATE TABLE categories (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        key TEXT UNIQUE,
        name TEXT NOT NULL,
        kind TEXT NOT NULL CHECK (kind IN ('expense', 'income')),
        icon TEXT NOT NULL,
        color TEXT NOT NULL,
        archived INTEGER NOT NULL DEFAULT 0
      );
      CREATE TABLE transactions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        amount INTEGER NOT NULL CHECK (amount > 0),
        type TEXT NOT NULL CHECK (type IN ('expense', 'income', 'transfer')),
        category_id INTEGER REFERENCES categories(id),
        account_id INTEGER NOT NULL REFERENCES accounts(id),
        to_account_id INTEGER REFERENCES accounts(id),
        date TEXT NOT NULL,
        note TEXT NOT NULL DEFAULT '',
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
      CREATE INDEX transactions_date ON transactions(date);
      CREATE TABLE budgets (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        category_id INTEGER NOT NULL REFERENCES categories(id),
        bs_year INTEGER NOT NULL,
        bs_month INTEGER NOT NULL,
        amount INTEGER NOT NULL CHECK (amount > 0),
        UNIQUE (category_id, bs_year, bs_month)
      );
      CREATE TABLE settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );
    `);
    for (const account of DEFAULT_ACCOUNTS) {
      await db.runAsync('INSERT INTO accounts (name, kind) VALUES (?, ?)', account.name, account.kind);
    }
    for (const c of DEFAULT_CATEGORIES) {
      await db.runAsync(
        'INSERT INTO categories (key, name, kind, icon, color) VALUES (?, ?, ?, ?, ?)',
        c.key,
        c.key,
        c.kind,
        c.icon,
        LEGACY_COLOR
      );
    }
  },
  // v2: emoji icons became native symbol ids; only Cash is a default account now.
  async (db) => {
    for (const c of DEFAULT_CATEGORIES) {
      await db.runAsync('UPDATE categories SET icon = ? WHERE key = ?', c.icon, c.key);
    }
    await db.runAsync(
      `DELETE FROM accounts
       WHERE name IN ('eSewa', 'Khalti', 'Bank') AND opening_balance = 0
         AND id NOT IN (SELECT account_id FROM transactions)
         AND id NOT IN (SELECT to_account_id FROM transactions WHERE to_account_id IS NOT NULL)`
    );
  },
  // v3: categories take their color from a design-system palette group instead of a hex.
  async (db) => {
    await db.execAsync("ALTER TABLE categories ADD COLUMN grp TEXT NOT NULL DEFAULT 'other'");
    for (const c of DEFAULT_CATEGORIES) {
      await db.runAsync('UPDATE categories SET grp = ? WHERE key = ?', c.group, c.key);
    }
  },
  // v4: bank SMS forwarded by an iOS Shortcut wait here until the user records them.
  async (db) => {
    await db.execAsync(`
      CREATE TABLE sms_inbox (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        body TEXT NOT NULL UNIQUE,
        sender TEXT NOT NULL DEFAULT '',
        received_at TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'recorded', 'dismissed')),
        transaction_id INTEGER REFERENCES transactions (id) ON DELETE SET NULL
      );
    `);
  },
  // v5: two real payments can send identical SMS, so body is no longer unique.
  async (db) => {
    await db.execAsync(`
      CREATE TABLE sms_inbox_v5 (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        body TEXT NOT NULL,
        sender TEXT NOT NULL DEFAULT '',
        received_at TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'recorded', 'dismissed')),
        transaction_id INTEGER REFERENCES transactions (id) ON DELETE SET NULL
      );
      INSERT INTO sms_inbox_v5 SELECT id, body, sender, received_at, status, transaction_id FROM sms_inbox;
      DROP TABLE sms_inbox;
      ALTER TABLE sms_inbox_v5 RENAME TO sms_inbox;
      CREATE INDEX sms_inbox_status ON sms_inbox (status, received_at);
    `);
  },
  // v6: savings accounts are kept out of totals and budgets.
  async (db) => {
    await db.execAsync('ALTER TABLE accounts ADD COLUMN is_savings INTEGER NOT NULL DEFAULT 0');
  },
  // v7: money lent to or borrowed from people, with repayments. Neither counts as
  // income or expense; they only move account balances (when an account is set).
  async (db) => {
    await db.execAsync(`
      CREATE TABLE loans (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        person TEXT NOT NULL,
        direction TEXT NOT NULL CHECK (direction IN ('lent', 'borrowed')),
        amount INTEGER NOT NULL CHECK (amount > 0),
        account_id INTEGER REFERENCES accounts (id),
        date TEXT NOT NULL,
        due_date TEXT,
        note TEXT NOT NULL DEFAULT '',
        settled INTEGER NOT NULL DEFAULT 0
      );
      CREATE TABLE loan_payments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        loan_id INTEGER NOT NULL REFERENCES loans (id) ON DELETE CASCADE,
        amount INTEGER NOT NULL CHECK (amount > 0),
        account_id INTEGER REFERENCES accounts (id),
        date TEXT NOT NULL
      );
      CREATE INDEX loan_payments_loan ON loan_payments (loan_id);
    `);
  },
  // v8: credit card details. A card's balance goes negative as you owe more.
  async (db) => {
    await db.execAsync(`
      ALTER TABLE accounts ADD COLUMN credit_limit INTEGER;
      ALTER TABLE accounts ADD COLUMN statement_day INTEGER;
      ALTER TABLE accounts ADD COLUMN due_day INTEGER;
    `);
  },
  // v9: indexes for the per-account balance sums and per-category budget sums.
  async (db) => {
    await db.execAsync(`
      CREATE INDEX IF NOT EXISTS transactions_account ON transactions (account_id, type);
      CREATE INDEX IF NOT EXISTS transactions_to_account ON transactions (to_account_id);
      CREATE INDEX IF NOT EXISTS transactions_category ON transactions (category_id, date);
      CREATE INDEX IF NOT EXISTS loans_account ON loans (account_id);
      CREATE INDEX IF NOT EXISTS loan_payments_account ON loan_payments (account_id);
    `);
  },
];

/** Display preferences survive "Erase all data"; everything else in settings is cleared. */
const KEPT_SETTINGS = ['lang', 'calendar', 'numerals', 'theme', 'hideAmounts'];

/**
 * Deletes every record and puts back the starting Cash account and categories,
 * as on a fresh install. Language and display preferences are kept.
 */
export async function eraseAllData(db: SQLiteDatabase) {
  await db.withTransactionAsync(async () => {
    await db.execAsync(`
      DELETE FROM loan_payments;
      DELETE FROM loans;
      DELETE FROM sms_inbox;
      DELETE FROM transactions;
      DELETE FROM budgets;
      DELETE FROM accounts;
      DELETE FROM categories;
      DELETE FROM settings WHERE key NOT IN ('${KEPT_SETTINGS.join("', '")}');
      DELETE FROM sqlite_sequence;
    `);
    for (const account of DEFAULT_ACCOUNTS) {
      await db.runAsync('INSERT INTO accounts (name, kind) VALUES (?, ?)', account.name, account.kind);
    }
    for (const c of DEFAULT_CATEGORIES) {
      await db.runAsync(
        'INSERT INTO categories (key, name, kind, icon, color, grp) VALUES (?, ?, ?, ?, ?, ?)',
        c.key,
        c.key,
        c.kind,
        c.icon,
        LEGACY_COLOR,
        c.group
      );
    }
  });
}

export async function migrateDbIfNeeded(db: SQLiteDatabase) {
  await db.execAsync('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');
  const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  let version = row?.user_version ?? 0;
  while (version < MIGRATIONS.length) {
    const next = version + 1;
    // Bumping the version inside the migration's transaction means a crash can't
    // leave a migration applied but unrecorded (and then re-run on next launch).
    await db.withTransactionAsync(async () => {
      await MIGRATIONS[version](db);
      await db.execAsync(`PRAGMA user_version = ${next}`);
    });
    version = next;
  }
}

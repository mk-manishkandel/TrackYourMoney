# Hisab — Track Your Money

A personal expense tracker built for Nepal. Record spending in Nepali or English, see your month in the
Bikram Sambat calendar, and keep cards, loans and budgets in one place. Everything is stored on the
phone — no account, no server.

Built with [Expo](https://expo.dev) (SDK 57), Expo Router and SQLite. iOS first; Android also runs.

## Features

- **Smart entry** — type `khana 250`, `hijo bhada 15 hajar` or `तलब ५० हजार` and the amount, category,
  account and date are filled in for you.
- **Quick actions** on Home for expense, income, transfer and loans.
- **Accounts** — cash, wallets (eSewa, Khalti), banks and credit cards. Expenses can't exceed an
  account's balance. Savings accounts are kept out of your spendable total.
- **Credit cards** — limit, amount owed, available credit, statement spending, a one-tap "Pay card bill"
  transfer, and a monthly reminder three days before the due date.
- **Lend & borrow** — track money lent to or borrowed from people, with partial repayments and due dates.
- **Budgets** per category for each BS month, with daily allowance and warnings.
- **Bank SMS import** — an iOS Shortcut forwards bank SMS to the app; they wait in an inbox, pre-filled,
  until you record or dismiss them. Optional daily reminder at a preset or custom time.
- **Transactions** — search across all history, filter by account, delete with undo.
- **Categories** — add your own, remove ones you don't use, pin favourites to the front.
- **Nepali and English**, BS or AD dates, Devanagari or Latin numerals, light/dark theme, and a
  hide-amounts privacy switch.
- **Erase all data** from Settings for a clean start.

## Getting started

Requirements: Node.js 20+ and the **Expo Go** app on your phone.

```bash
npm install
npx expo start
```

Scan the QR code with the iPhone camera (or Expo Go on Android). On Windows PowerShell, use `npx.cmd`
if `npx` is blocked by the execution policy.

## Scripts

| Command | What it does |
|---|---|
| `npx expo start` | Start the dev server |
| `npx expo lint` | Lint |
| `npx tsc --noEmit` | Type-check |
| `npm test` | Run unit tests (Jest) |
| `npx expo-doctor` | Check dependencies and config |

Install packages with `npx expo install <package>` so versions match the Expo SDK.

## Setting up SMS import (iOS)

iOS doesn't let apps read SMS, so a personal automation forwards them:

1. Open **Shortcuts → Automation → New → Message**, set *Message Contains* to `NPR` (or your bank's
   sender), and choose *Run Immediately*.
2. Add **URL Encode** on *Shortcut Input*.
3. Add **Text** with the link from **Settings → SMS → Set up** in the app, followed by the
   *URL Encoded Text* variable. In Expo Go the link starts with `exp://`; in an installed build it is
   `hisab://sms?text=`.
4. Add **Open URLs**.

Forwarded messages appear in the inbox (tray icon on Home).

## Project structure

```
src/
  app/            Screens (Expo Router). (tabs)/ holds Home, Transactions, Budgets, Settings
  components/     Shared UI (ui.tsx) and feature components
  constants/      Theme tokens — colors, type, spacing, radii
  db/             SQLite schema migrations and queries (repo.ts)
  hooks/          Small React hooks
  i18n/           English and Nepali strings, user preferences
  lib/            Pure logic: entry parser, SMS parser, dates (BS/AD), money, cards, loans, validation
  lib/__tests__/  Unit tests
docs/
  design-system.md  Colors, typography and component rules all UI follows
```

Amounts are stored as integer paisa. The database schema upgrades itself through numbered migrations in
`src/db/migrations.ts`; never edit a shipped migration, append a new one.

## Building for the App Store

Builds use [EAS](https://docs.expo.dev/eas/) and need an Apple Developer account:

```bash
npx eas-cli@latest build --platform ios
npx eas-cli@latest submit --platform ios
```

Before the first release, set `ios.bundleIdentifier` in `app.json` and replace the placeholder app icon
and splash image in `assets/`.

## Privacy

All data stays in a SQLite database on the device. The app makes no network requests and has no
analytics.

## License

[MIT](LICENSE)

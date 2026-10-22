import { router, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext, type SQLiteDatabase } from 'expo-sqlite';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import {
  Amount,
  Button,
  Chip,
  ChipRow,
  Icon,
  IconButton,
  IconTile,
  Input,
  Notice,
  SectionHeader,
  Segmented,
  withAlpha,
} from '@/components/ui';
import { Radius, ScreenPadding, Space, Type } from '@/constants/theme';
import {
  addTransaction,
  getInboxSms,
  getPinnedCategories,
  listAccounts,
  listCategories,
  resolveInboxSms,
  setPinnedCategories,
  defaultAccount,
  type Account,
  type Category,
  type InboxSms,
} from '@/db/repo';
import { useSingleFlight } from '@/hooks/use-single-flight';
import { useKeyboardVisible } from '@/hooks/use-keyboard-visible';
import { useTheme } from '@/hooks/use-theme';
import { usePrefs } from '@/i18n/prefs';
import { cardOwed } from '@/lib/cards';
import { orderByPins, togglePin, type TxnType } from '@/lib/categories';
import { addDays, toISODate } from '@/lib/dates';
import { haptic } from '@/lib/haptics';
import { ACCOUNT_KIND_ICON, categoryColor } from '@/lib/icons';
import { formatAmount, parseAmountInput, sanitizeAmountInput } from '@/lib/money';
import { parseEntry } from '@/lib/parser';
import { syncInboxReminder } from '@/lib/reminders';
import { parseBankSms } from '@/lib/sms';
import { txnErrorMessage } from '@/lib/txn-error-message';
import { validateTransaction } from '@/lib/validation';

const TXN_TYPES = ['expense', 'income', 'transfer'] as const;

type Form = {
  amountText: string;
  type: TxnType;
  categoryId: number | null;
  accountId: number | null;
  toAccountId: number | null;
  date: string;
  note: string;
};

function fallbackCategory(categories: Category[], type: TxnType): number | null {
  if (type === 'transfer') return null;
  return categories.find((c) => c.key === (type === 'income' ? 'other_income' : 'other_expense'))?.id ?? null;
}

function otherAccount(accounts: Account[], id: number | null): number | null {
  return accounts.find((a) => a.id !== id)?.id ?? null;
}

function initialForm(text: string | undefined, accounts: Account[], categories: Category[]): Form {
  const today = toISODate(new Date());
  const firstAccount = defaultAccount(accounts)?.id ?? null;
  if (!text) {
    return {
      amountText: '',
      type: 'expense',
      categoryId: fallbackCategory(categories, 'expense'),
      accountId: firstAccount,
      toAccountId: null,
      date: today,
      note: '',
    };
  }
  const parsed = parseEntry(text, { today, accounts });
  const named = parsed.accountId ?? firstAccount;
  const isTransfer = parsed.type === 'transfer';
  // "esewa load 2000" names where the money went; take it from another account.
  const from = isTransfer
    ? (accounts.find((a) => a.id !== named && a.kind === 'bank')?.id ?? otherAccount(accounts, named))
    : named;
  return {
    amountText: parsed.amount ? formatAmount(parsed.amount, { symbol: false }) : '',
    type: parsed.type,
    categoryId:
      categories.find((c) => c.key === parsed.categoryKey)?.id ?? fallbackCategory(categories, parsed.type),
    accountId: from,
    toAccountId: isTransfer ? named : null,
    date: parsed.date,
    note: parsed.note,
  };
}

function formFromSms(sms: InboxSms, accounts: Account[], categories: Category[]): Form {
  const receivedOn = toISODate(new Date(sms.received_at));
  const parsed = parseBankSms(sms.body, { sender: sms.sender, receivedOn, accounts });
  if (!parsed) return { ...initialForm(undefined, accounts, categories), date: receivedOn };
  return {
    amountText: formatAmount(parsed.amount, { symbol: false }),
    type: parsed.type,
    categoryId:
      categories.find((c) => c.key === parsed.categoryKey)?.id ?? fallbackCategory(categories, parsed.type),
    accountId: parsed.accountId ?? defaultAccount(accounts)?.id ?? null,
    toAccountId: parsed.toAccountId,
    date: parsed.date,
    note: parsed.note,
  };
}

/** "Pay card bill": a transfer of the amount owed from a bank (or other non-card account) to the card. */
function cardPaymentForm(cardId: number, accounts: Account[], categories: Category[]): Form {
  const card = accounts.find((a) => a.id === cardId);
  const payers = accounts.filter((a) => a.id !== cardId && a.kind !== 'card');
  const from = payers.find((a) => a.kind === 'bank' && !a.is_savings) ?? payers.find((a) => !a.is_savings) ?? payers[0];
  const owed = card ? cardOwed(card.balance) : 0;
  return {
    ...initialForm(undefined, accounts, categories),
    type: 'transfer',
    categoryId: null,
    accountId: from?.id ?? null,
    toAccountId: card?.id ?? null,
    amountText: owed > 0 ? formatAmount(owed, { symbol: false }) : '',
  };
}

function typedForm(type: TxnType, accounts: Account[], categories: Category[]): Form {
  const form = initialForm(undefined, accounts, categories);
  return {
    ...form,
    type,
    categoryId: fallbackCategory(categories, type),
    toAccountId: type === 'transfer' ? otherAccount(accounts, form.accountId) : null,
  };
}

async function loadLists(db: SQLiteDatabase, smsId: number | null) {
  const [accounts, categories, pinned, sms] = await Promise.all([
    listAccounts(db),
    listCategories(db),
    getPinnedCategories(db),
    smsId === null ? null : getInboxSms(db, smsId),
  ]);
  return { accounts, categories, pinned, sms };
}

export default function AddTransactionSheet() {
  const db = useSQLiteContext();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { t, date, money, categoryName, lang } = usePrefs();
  const params = useLocalSearchParams<{ text?: string; sms?: string; payCard?: string; type?: string }>();
  const { text } = params;
  const smsId = params.sms ? Number(params.sms) : null;
  const payCardId = params.payCard ? Number(params.payCard) : null;
  // Home's quick actions open the form on a given type.
  const startType = TXN_TYPES.find((v) => v === params.type) ?? null;
  const [lists, setLists] = useState<{
    accounts: Account[];
    categories: Category[];
    pinned: number[];
    sms: InboxSms | null;
  } | null>(null);
  const [form, setForm] = useState<Form | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [runSave, saving] = useSingleFlight();
  const keyboardVisible = useKeyboardVisible();

  useEffect(() => {
    loadLists(db, smsId).then((loaded) => {
      setLists(loaded);
      setForm(
        loaded.sms
          ? formFromSms(loaded.sms, loaded.accounts, loaded.categories)
          : payCardId !== null
            ? cardPaymentForm(payCardId, loaded.accounts, loaded.categories)
            : startType
              ? typedForm(startType, loaded.accounts, loaded.categories)
              : initialForm(text, loaded.accounts, loaded.categories)
      );
    });
  }, [db, text, smsId, payCardId, startType]);

  if (!lists || !form) return null;
  const { accounts, categories, pinned, sms } = lists;

  function togglePinned(id: number) {
    haptic.tap();
    const next = togglePin(pinned, id);
    setLists((l) => (l ? { ...l, pinned: next } : l));
    setPinnedCategories(db, next);
  }

  // Rows scroll sideways and fill column by column; a long list gets a second row.
  const shown = orderByPins(
    categories.filter((c) => c.kind === form.type),
    pinned
  );
  const columns: Category[][] = [];
  const rows = shown.length > 10 ? 2 : 1;
  for (let i = 0; i < shown.length; i += rows) columns.push(shown.slice(i, i + rows));

  const update = (patch: Partial<Form>) => {
    setError(null);
    setForm((f) => (f ? { ...f, ...patch } : f));
  };

  const typeColor = form.type === 'expense' ? theme.expense : form.type === 'income' ? theme.income : theme.info;
  const sign = form.type === 'expense' ? '−' : form.type === 'income' ? '+' : '';
  const today = toISODate(new Date());
  const dateOptions = [
    { iso: today, label: t('add.today') },
    { iso: addDays(today, -1), label: t('add.yesterday') },
    { iso: addDays(today, -2), label: t('add.dayBefore') },
  ];

  async function save() {
    if (!form) return;
    const amount = parseAmountInput(form.amountText);
    // Balances can change between opening the sheet and saving, so re-read them.
    const invalid = validateTransaction({ ...form, amount }, await listAccounts(db));
    if (invalid || amount === null || form.accountId === null) {
      haptic.warn();
      setError(invalid ? txnErrorMessage(invalid, t, money) : t('add.noAmount'));
      return;
    }
    const transactionId = await addTransaction(db, {
      amount,
      type: form.type,
      category_id: form.categoryId,
      account_id: form.accountId,
      to_account_id: form.toAccountId,
      date: form.date,
      note: form.note.trim(),
    });
    if (sms) {
      await resolveInboxSms(db, sms.id, { status: 'recorded', transactionId });
      syncInboxReminder(db, t);
    }
    haptic.success();
    router.back();
  }

  const accountChips = (list: Account[], selected: number | null, onSelect: (id: number) => void) => (
    <ChipRow>
      {list.map((a) => (
        <Chip
          key={a.id}
          label={a.name}
          icon={ACCOUNT_KIND_ICON[a.kind]}
          selected={a.id === selected}
          onPress={() => onSelect(a.id)}
        />
      ))}
    </ChipRow>
  );

  return (
    // The ScrollView must be the sheet's root: a flex: 1 wrapper gets no height inside a
    // form sheet in Expo Go, collapsing the list. The title row pins as a sticky header.
    <ScrollView
      style={{ backgroundColor: theme.background }}
      contentContainerStyle={{ paddingBottom: keyboardVisible ? Space.lg : Space.huge }}
      stickyHeaderIndices={[0]}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="interactive"
      automaticallyAdjustKeyboardInsets>
      {/* ScrollView replaces a sticky child's own style, so the row layout lives one level down. */}
      <View style={{ backgroundColor: theme.background, borderBottomColor: theme.border, borderBottomWidth: StyleSheet.hairlineWidth }}>
        <View style={[styles.header, { paddingTop: insets.top + Space.sm }]}>
          <ThemedText type="h2" accessibilityRole="header" numberOfLines={1} style={styles.title}>
            {t('add.title')}
          </ThemedText>
          <IconButton icon="close" label={t('add.close')} onPress={() => router.back()} />
        </View>
      </View>
      <View style={styles.container}>

      {sms || text ? (
        <View style={[styles.understood, { backgroundColor: withAlpha(theme.goldSoft, 0.16) }]}>
          <Icon id={sms ? 'tray' : 'sparkles'} size={16} color={theme.gold} />
          <ThemedText style={styles.flex} numberOfLines={sms ? 4 : 2}>
            {sms ? t('add.fromSms') : t('add.understood')}: “{sms?.body ?? text}”
          </ThemedText>
        </View>
      ) : null}

      <Segmented
        accessibilityLabel={t('add.title')}
        options={TXN_TYPES.map((v) => ({ value: v, label: t(`type.${v}`) }))}
        value={form.type}
        onChange={(type) =>
          update({
            type,
            categoryId: fallbackCategory(categories, type),
            toAccountId: type === 'transfer' ? otherAccount(accounts, form.accountId) : null,
          })
        }
      />

      <View style={styles.amountBlock}>
        <Amount type="h2" color={typeColor}>{`${sign}${lang === 'ne' ? 'रु' : 'Rs'}`}</Amount>
        <TextInput
          value={form.amountText}
          onChangeText={(value) => update({ amountText: sanitizeAmountInput(value) })}
          placeholder="0"
          placeholderTextColor={theme.disabled}
          keyboardType="decimal-pad"
          autoFocus={!text}
          accessibilityLabel={`${t(`type.${form.type}`)}, ${t('add.amount')}`}
          style={[styles.amountInput, { color: typeColor }]}
        />
      </View>

      {form.type !== 'transfer' && (
        <>
          <View style={styles.categoryHeading}>
            <SectionHeader title={t('add.category')} />
            <ThemedText type="caption" themeColor="textSecondary">
              {t('add.pinHint')}
            </ThemedText>
          </View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.strip}
            contentContainerStyle={styles.stripContent}>
            {columns.map((column) => (
              <View key={column[0].id} style={styles.column}>
                {column.map((c) => {
                const selected = c.id === form.categoryId;
                const isPinned = pinned.includes(c.id);
                return (
                  <Pressable
                    key={c.id}
                    accessibilityRole="radio"
                    accessibilityState={{ checked: selected }}
                    accessibilityLabel={categoryName(c)}
                    accessibilityActions={[{ name: 'longpress', label: isPinned ? t('add.unpin') : t('add.pin') }]}
                    onAccessibilityAction={() => togglePinned(c.id)}
                    onPress={() => {
                      haptic.select();
                      update({ categoryId: c.id });
                    }}
                    onLongPress={() => togglePinned(c.id)}
                    delayLongPress={350}
                    style={[
                      styles.gridItem,
                      {
                        backgroundColor: theme.surface,
                        borderColor: selected ? theme.brand : theme.border,
                        borderWidth: selected ? 2 : 1,
                      },
                    ]}>
                    <IconTile icon={c.icon} color={categoryColor(c.grp, theme)} size={36} />
                    <ThemedText type="caption" numberOfLines={2} style={styles.gridLabel}>
                      {categoryName(c)}
                    </ThemedText>
                    {isPinned && (
                      <View style={styles.pin}>
                        <Icon id="pin" size={11} color={theme.gold} />
                      </View>
                    )}
                    {selected && (
                      <View style={[styles.check, { backgroundColor: theme.brand }]}>
                        <Icon id="checkmark" size={10} color={theme.onBrand} weight="bold" />
                      </View>
                    )}
                  </Pressable>
                );
                })}
              </View>
            ))}
          </ScrollView>
        </>
      )}

      {form.type === 'transfer' ? (
        <>
          <SectionHeader title={t('add.from')} />
          {accountChips(accounts, form.accountId, (accountId) => update({ accountId }))}
          <SectionHeader title={t('add.to')} />
          {accountChips(accounts, form.toAccountId, (toAccountId) => update({ toAccountId }))}
        </>
      ) : (
        <>
          <SectionHeader title={form.type === 'income' ? t('add.receivedIn') : t('add.paidFrom')} />
          {accountChips(accounts, form.accountId, (accountId) => update({ accountId }))}
        </>
      )}

      <SectionHeader title={t('add.date')} />
      <ChipRow>
        {dateOptions.map((o) => (
          <Chip
            key={o.iso}
            label={o.label}
            icon="calendar"
            selected={form.date === o.iso}
            onPress={() => update({ date: o.iso })}
          />
        ))}
      </ChipRow>
      <ThemedText themeColor="textSecondary">{date(form.date)}</ThemedText>

      <Input
        value={form.note}
        onChangeText={(note) => update({ note })}
        placeholder={t('add.note')}
        accessibilityLabel={t('add.note')}
      />

      {error && <Notice tone="danger" message={error} />}

      <Button label={t('add.save')} icon="checkmark" loading={saving} onPress={() => runSave(save)} />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: {
    paddingHorizontal: ScreenPadding,
    paddingTop: Space.lg,
    gap: Space.lg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Space.sm,
    paddingLeft: ScreenPadding,
    paddingRight: ScreenPadding - Space.md,
    paddingBottom: Space.sm,
  },
  title: { flexShrink: 1 },
  understood: {
    flexDirection: 'row',
    gap: Space.sm,
    alignItems: 'center',
    padding: Space.md,
    borderRadius: Radius.control,
    borderCurve: 'continuous',
  },
  amountBlock: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Space.sm,
    paddingVertical: Space.sm,
  },
  amountInput: {
    ...Type.display,
    fontSize: 44,
    lineHeight: 52,
    fontVariant: ['tabular-nums'],
    minWidth: 80,
    textAlign: 'center',
  },
  categoryHeading: { gap: Space.xs },
  // Bleeds to the screen edges so tiles scroll out of view instead of being clipped by padding.
  strip: { marginHorizontal: -ScreenPadding },
  stripContent: { paddingHorizontal: ScreenPadding, gap: Space.sm },
  column: { gap: Space.sm },
  gridItem: {
    width: 80,
    height: 92,
    alignItems: 'center',
    gap: Space.xs,
    paddingVertical: Space.md,
    paddingHorizontal: Space.xs,
    borderRadius: Radius.control,
    borderCurve: 'continuous',
  },
  gridLabel: { textAlign: 'center' },
  pin: { position: 'absolute', top: 6, left: 6 },
  check: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 16,
    height: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

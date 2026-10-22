import { router } from 'expo-router';
import { useSQLiteContext, type SQLiteDatabase } from 'expo-sqlite';
import { useCallback, useEffect, useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { TransactionRow } from '@/components/transaction-row';
import {
  Amount,
  Card,
  Chip,
  ChipRow,
  EmptyState,
  Fab,
  Icon,
  Input,
  MonthSwitcher,
  Screen,
  UndoBar,
} from '@/components/ui';
import { Space } from '@/constants/theme';
import {
  addTransaction,
  deleteTransaction,
  listAccounts,
  listCategories,
  listTransactions,
  type Transaction,
} from '@/db/repo';
import { useFocusData } from '@/hooks/use-focus-data';
import { useResetOnBlur } from '@/hooks/use-reset-on-blur';
import { useTheme } from '@/hooks/use-theme';
import { usePrefs } from '@/i18n/prefs';
import { bsMonthOf, bsMonthRange, formatBsMonth, shiftBsMonth, toISODate } from '@/lib/dates';
import { haptic } from '@/lib/haptics';
import { ACCOUNT_KIND_ICON } from '@/lib/icons';
import { filterTransactions } from '@/lib/txn-filter';

const UNDO_MS = 5000;
const ALL_TIME = { start: '0000-01-01', end: '9999-12-31' };

function groupByDate(
  txns: Transaction[],
  counts: (txn: Transaction) => boolean
): { date: string; txns: Transaction[]; net: number }[] {
  const groups: { date: string; txns: Transaction[]; net: number }[] = [];
  for (const txn of txns) {
    let group = groups.at(-1);
    if (!group || group.date !== txn.date) {
      group = { date: txn.date, txns: [], net: 0 };
      groups.push(group);
    }
    group.txns.push(txn);
    if (counts(txn)) group.net += txn.type === 'income' ? txn.amount : txn.type === 'expense' ? -txn.amount : 0;
  }
  return groups;
}

export default function TransactionsScreen() {
  const db = useSQLiteContext();
  const theme = useTheme();
  const { t, num, lang, money, date, categoryName } = usePrefs();
  const [month, setMonth] = useState(() => bsMonthOf(toISODate(new Date())));
  const [deleted, setDeleted] = useState<Transaction | null>(null);
  const [query, setQuery] = useState('');
  const [accountId, setAccountId] = useState<number | null>(null);
  // A keyword search looks across all months; browsing stays on one month.
  const searching = query.trim().length > 0;

  useResetOnBlur(() => {
    setQuery('');
    setAccountId(null);
  });

  const load = useCallback(
    async (db: SQLiteDatabase) => {
      const [accounts, categories, txns] = await Promise.all([
        listAccounts(db),
        listCategories(db, { includeRemoved: true }),
        searching ? listTransactions(db, ALL_TIME, 5000) : listTransactions(db, bsMonthRange(month)),
      ]);
      return {
        accounts: new Map(accounts.map((a) => [a.id, a])),
        categories: new Map(categories.map((c) => [c.id, c])),
        txns,
      };
    },
    [month, searching]
  );
  const [data, reload] = useFocusData(load);

  useEffect(() => {
    if (!deleted) return;
    const timer = setTimeout(() => setDeleted(null), UNDO_MS);
    return () => clearTimeout(timer);
  }, [deleted]);

  function confirmDelete(txn: Transaction) {
    haptic.warn();
    Alert.alert(t('txn.deleteTitle'), money(txn.amount), [
      { text: t('add.cancel'), style: 'cancel' },
      {
        text: t('txn.delete'),
        style: 'destructive',
        onPress: async () => {
          await deleteTransaction(db, txn.id);
          setDeleted(txn);
          reload();
        },
      },
    ]);
  }

  async function undoDelete() {
    if (!deleted) return;
    const { id: _id, ...restored } = deleted;
    await addTransaction(db, restored);
    haptic.success();
    setDeleted(null);
    reload();
  }

  const shown = data
    ? filterTransactions(
        data.txns,
        { query, accountId },
        {
          category: (id) => {
            const category = id === null ? undefined : data.categories.get(id);
            return category ? categoryName(category) : '';
          },
          account: (id) => (id === null ? '' : (data.accounts.get(id)?.name ?? '')),
        }
      )
    : [];
  // Savings activity is listed but left out of totals, unless that savings account is the filter.
  const filteringSavings = accountId !== null && Boolean(data?.accounts.get(accountId)?.is_savings);
  const counts = (x: Transaction) => filteringSavings || !data?.accounts.get(x.account_id)?.is_savings;
  const counted = shown.filter(counts);
  const income = counted.filter((x) => x.type === 'income').reduce((s, x) => s + x.amount, 0);
  const expense = counted.filter((x) => x.type === 'expense').reduce((s, x) => s + x.amount, 0);
  const net = income - expense;
  const groups = groupByDate(shown, counts);

  return (
    <Screen
      title={t('tab.transactions')}
      overlay={
        deleted ? (
          <UndoBar message={t('txn.deleted')} actionLabel={t('txn.undo')} onAction={undoDelete} />
        ) : (
          <Fab onPress={() => router.push('/add')} accessibilityLabel={t('add.title')} />
        )
      }>
      <View>
        <Input
          value={query}
          onChangeText={setQuery}
          placeholder={t('txn.search')}
          accessibilityLabel={t('txn.search')}
          returnKeyType="search"
          clearButtonMode="while-editing"
          autoCorrect={false}
          style={styles.searchInput}
        />
        <View pointerEvents="none" style={styles.searchIcon}>
          <Icon id="search" size={16} color={theme.textSecondary} />
        </View>
      </View>

      <ChipRow>
        <Chip label={t('txn.allAccounts')} selected={accountId === null} onPress={() => setAccountId(null)} />
        {[...(data?.accounts.values() ?? [])].map((a) => (
          <Chip
            key={a.id}
            label={a.name}
            icon={ACCOUNT_KIND_ICON[a.kind]}
            selected={accountId === a.id}
            onPress={() => setAccountId(accountId === a.id ? null : a.id)}
          />
        ))}
      </ChipRow>

      {searching ? (
        <ThemedText type="label" themeColor="textSecondary" style={styles.hint}>
          {t('txn.allMonths')}
        </ThemedText>
      ) : (
        <MonthSwitcher
          label={num(formatBsMonth(month, lang))}
          onPrev={() => setMonth((m) => shiftBsMonth(m, -1))}
          onNext={() => setMonth((m) => shiftBsMonth(m, 1))}
        />
      )}

      <Card style={styles.summary}>
        <Summary label={t('txn.in')} value={`+${money(income)}`} color={theme.income} />
        <View style={[styles.divider, { backgroundColor: theme.border }]} />
        <Summary label={t('txn.out')} value={`−${money(expense)}`} color={theme.expense} />
        <View style={[styles.divider, { backgroundColor: theme.border }]} />
        <Summary
          label={t('txn.net')}
          value={`${net > 0 ? '+' : net < 0 ? '−' : ''}${money(Math.abs(net))}`}
          color={theme.text}
        />
      </Card>

      {data && groups.length === 0 && (
        <Card>
          {searching || accountId !== null ? (
            <EmptyState icon="search" title={t('txn.noResults')} subtitle={t('txn.noResultsHint')} />
          ) : (
            <EmptyState icon="tray" title={t('txn.emptyTitle')} subtitle={t('txn.emptySubtitle')} />
          )}
        </Card>
      )}

      {data &&
        groups.map((group) => (
          <View key={group.date} style={styles.group}>
            <View style={styles.groupHeader}>
              <ThemedText type="label" themeColor="textSecondary" style={styles.flex} numberOfLines={1}>
                {date(group.date)}
              </ThemedText>
              <ThemedText type="label" themeColor="textSecondary" style={styles.tabular}>
                {group.net > 0 ? '+' : group.net < 0 ? '−' : ''}
                {money(Math.abs(group.net))}
              </ThemedText>
            </View>
            <Card style={styles.groupCard}>
              {group.txns.map((txn) => (
                <TransactionRow
                  key={txn.id}
                  txn={txn}
                  categories={data.categories}
                  accounts={data.accounts}
                  onLongPress={() => confirmDelete(txn)}
                />
              ))}
            </Card>
          </View>
        ))}

      {groups.length > 0 && (
        <ThemedText type="label" themeColor="textSecondary" style={styles.hint}>
          {t('txn.hint')}
        </ThemedText>
      )}
    </Screen>
  );
}

function Summary({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <View style={styles.summaryItem}>
      <ThemedText type="label" themeColor="textSecondary">
        {label}
      </ThemedText>
      <Amount color={color}>{value}</Amount>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  tabular: { fontVariant: ['tabular-nums'] },
  summary: { flexDirection: 'row', alignItems: 'center', gap: Space.sm },
  summaryItem: { flex: 1, alignItems: 'center', gap: 2 },
  divider: { width: 1, alignSelf: 'stretch' },
  group: { gap: Space.sm },
  groupHeader: { flexDirection: 'row', alignItems: 'center', gap: Space.sm, paddingHorizontal: Space.xs },
  groupCard: { gap: Space.xs, paddingVertical: Space.sm },
  hint: { textAlign: 'center' },
  searchInput: { paddingLeft: Space.xxxl },
  searchIcon: { position: 'absolute', left: Space.md, top: 0, bottom: 0, justifyContent: 'center' },
});

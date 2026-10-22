import { router, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext, type SQLiteDatabase } from 'expo-sqlite';
import { useCallback, useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import {
  Amount,
  Button,
  Card,
  Chip,
  ChipRow,
  IconButton,
  Input,
  Notice,
  ProgressBar,
  Screen,
  SectionHeader,
  SummaryCard,
} from '@/components/ui';
import { Size, Space } from '@/constants/theme';
import {
  addLoanPayment,
  defaultAccount,
  deleteLoan,
  getLoan,
  listAccounts,
  listLoanPayments,
  setLoanSettled,
} from '@/db/repo';
import { useSingleFlight } from '@/hooks/use-single-flight';
import { useFocusData } from '@/hooks/use-focus-data';
import { useTheme } from '@/hooks/use-theme';
import { usePrefs } from '@/i18n/prefs';
import { toISODate } from '@/lib/dates';
import { haptic } from '@/lib/haptics';
import { ACCOUNT_KIND_ICON } from '@/lib/icons';
import { isOverdue, loanRemaining } from '@/lib/loans';
import { formatAmount, parseAmountInput, sanitizeAmountInput } from '@/lib/money';
import { txnErrorMessage } from '@/lib/txn-error-message';
import { validateTransaction } from '@/lib/validation';

export default function LoanDetailScreen() {
  const db = useSQLiteContext();
  const theme = useTheme();
  const { t, money, date } = usePrefs();
  const id = Number(useLocalSearchParams<{ id: string }>().id);

  const load = useCallback(
    async (db: SQLiteDatabase) => {
      const [loan, payments, accounts] = await Promise.all([getLoan(db, id), listLoanPayments(db, id), listAccounts(db)]);
      return { loan, payments, accounts };
    },
    [id]
  );
  const [data, reload] = useFocusData(load);
  const [repaying, setRepaying] = useState(false);
  const [runRepayment, savingRepayment] = useSingleFlight();
  const [amountText, setAmountText] = useState('');
  const [accountId, setAccountId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!data) return null;
  const { loan, payments, accounts } = data;
  if (!loan) {
    return (
      <Screen
        title={t('loan.title')}
        headerLeft={<IconButton icon="chevronLeft" label={t('add.close')} onPress={() => router.back()} />}>
        {null}
      </Screen>
    );
  }

  const lent = loan.direction === 'lent';
  const color = lent ? theme.income : theme.expense;
  const remaining = loanRemaining(loan);
  const today = toISODate(new Date());
  const overdue = isOverdue(loan, today);
  const accountName = (accountId: number | null) =>
    accountId === null ? t('loan.noAccount') : (accounts.find((a) => a.id === accountId)?.name ?? '—');

  function startRepayment() {
    haptic.select();
    setAmountText(formatAmount(remaining, { symbol: false }));
    setAccountId(loan?.account_id ?? defaultAccount(accounts)?.id ?? null);
    setError(null);
    setRepaying(true);
  }

  async function saveRepayment() {
    if (!loan) return;
    const amount = parseAmountInput(amountText);
    if (amount === null) {
      haptic.warn();
      setError(t('add.noAmount'));
      return;
    }
    if (amount > remaining) {
      haptic.warn();
      setError(t('loan.tooMuch').replace('{amount}', money(remaining)));
      return;
    }
    // Repaying what you borrowed takes money out; being repaid brings it in.
    if (!lent && accountId !== null) {
      const invalid = validateTransaction(
        { amount, type: 'expense', accountId, toAccountId: null },
        await listAccounts(db)
      );
      if (invalid?.code === 'insufficient' || invalid?.code === 'overLimit') {
        haptic.warn();
        setError(txnErrorMessage(invalid, t, money));
        return;
      }
    }
    await addLoanPayment(db, { loan_id: loan.id, amount, account_id: accountId, date: today });
    haptic.success();
    setRepaying(false);
    reload();
  }

  async function toggleSettled() {
    if (!loan) return;
    haptic.select();
    await setLoanSettled(db, loan.id, !loan.settled);
    reload();
  }

  function confirmDelete() {
    if (!loan) return;
    haptic.warn();
    Alert.alert(t('loan.deleteTitle'), t('loan.deleteBody'), [
      { text: t('add.cancel'), style: 'cancel' },
      {
        text: t('loan.delete'),
        style: 'destructive',
        onPress: async () => {
          await deleteLoan(db, loan.id);
          router.back();
        },
      },
    ]);
  }

  return (
    <Screen
      eyebrow={lent ? t('loan.youLent') : t('loan.youBorrowed')}
      title={loan.person}
      headerLeft={<IconButton icon="chevronLeft" label={t('add.close')} onPress={() => router.back()} />}>
      <SummaryCard>
        <ThemedText type="label" style={{ color: theme.onSummaryMuted }}>
          {loan.settled ? t('loan.isSettled') : lent ? t('loan.toReceive') : t('loan.toPay')}
        </ThemedText>
        <Amount type="display" color={theme.onSummary}>
          {money(loan.settled ? loan.amount : remaining)}
        </Amount>
        <ProgressBar fraction={loan.paid / loan.amount} color={theme.gold} />
        <ThemedText type="label" style={{ color: theme.onSummaryMuted }}>
          {t('loan.paidOf').replace('{paid}', money(loan.paid)).replace('{total}', money(loan.amount))}
        </ThemedText>
      </SummaryCard>

      <Card>
        <DetailRow label={lent ? t('loan.given') : t('loan.taken')} value={date(loan.date)} />
        {loan.due_date && (
          <DetailRow
            label={t('loan.due')}
            value={date(loan.due_date)}
            color={overdue ? theme.expense : undefined}
          />
        )}
        <DetailRow label={t('loan.account')} value={accountName(loan.account_id)} />
        {loan.note ? <DetailRow label={t('add.note')} value={loan.note} /> : null}
      </Card>

      <SectionHeader title={t('loan.repayments')} />
      <Card>
        {payments.length === 0 && (
          <ThemedText themeColor="textSecondary">{t('loan.noRepayments')}</ThemedText>
        )}
        {payments.map((p) => (
          <View key={p.id} style={styles.payment}>
            <View style={styles.flex}>
              <ThemedText type="bodyMedium">{date(p.date)}</ThemedText>
              <ThemedText type="label" themeColor="textSecondary">
                {accountName(p.account_id)}
              </ThemedText>
            </View>
            <Amount color={color}>{money(p.amount)}</Amount>
          </View>
        ))}

        {!loan.settled &&
          (repaying ? (
            <View style={[styles.form, { borderTopColor: theme.border }]}>
              <Input
                value={amountText}
                onChangeText={(v) => {
                  setError(null);
                  setAmountText(sanitizeAmountInput(v));
                }}
                placeholder={t('loan.repaymentAmount')}
                accessibilityLabel={t('loan.repaymentAmount')}
                keyboardType="decimal-pad"
                autoFocus
              />
              <ThemedText type="label" themeColor="textSecondary">
                {lent ? t('loan.receivedInto') : t('loan.paidFrom')}
              </ThemedText>
              <ChipRow>
                {accounts.map((a) => (
                  <Chip
                    key={a.id}
                    label={a.name}
                    icon={ACCOUNT_KIND_ICON[a.kind]}
                    selected={accountId === a.id}
                    onPress={() => {
                      setError(null);
                      setAccountId(a.id);
                    }}
                  />
                ))}
                <Chip
                  label={t('loan.noAccount')}
                  icon="pencil"
                  selected={accountId === null}
                  onPress={() => setAccountId(null)}
                />
              </ChipRow>
              {error && <Notice tone="danger" message={error} />}
              <View style={styles.actions}>
                <View style={styles.flex}>
                  <Button label={t('add.cancel')} variant="secondary" onPress={() => setRepaying(false)} />
                </View>
                <View style={styles.flex}>
                  <Button
                    label={t('loan.saveRepayment')}
                    icon="checkmark"
                    loading={savingRepayment}
                    onPress={() => runRepayment(saveRepayment)}
                  />
                </View>
              </View>
            </View>
          ) : (
            <Button label={t('loan.recordRepayment')} icon="plus" onPress={startRepayment} />
          ))}
      </Card>

      <Button
        label={loan.settled ? t('loan.reopen') : t('loan.markSettled')}
        icon={loan.settled ? 'undo' : 'checkmark'}
        variant="secondary"
        onPress={toggleSettled}
      />
      <Button label={t('loan.delete')} icon="trash" variant="destructive" onPress={confirmDelete} />
    </Screen>
  );
}

function DetailRow({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <View style={styles.detail}>
      <ThemedText themeColor="textSecondary">{label}</ThemedText>
      <ThemedText type="bodyMedium" style={[styles.detailValue, color ? { color } : null]}>
        {value}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  detail: { flexDirection: 'row', alignItems: 'center', gap: Space.md, minHeight: Size.touch },
  detailValue: { flex: 1, textAlign: 'right' },
  payment: { flexDirection: 'row', alignItems: 'center', gap: Space.md, minHeight: Size.touch },
  form: { gap: Space.md, paddingTop: Space.md, borderTopWidth: StyleSheet.hairlineWidth },
  actions: { flexDirection: 'row', gap: Space.md },
});

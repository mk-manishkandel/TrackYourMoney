import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import {
  Amount,
  Card,
  EmptyState,
  Icon,
  IconButton,
  ProgressBar,
  Screen,
  Segmented,
  SummaryCard,
  TextButton,
} from '@/components/ui';
import { Space } from '@/constants/theme';
import { listLoans, type Loan } from '@/db/repo';
import { useFocusData } from '@/hooks/use-focus-data';
import { useTheme } from '@/hooks/use-theme';
import { usePrefs } from '@/i18n/prefs';
import { toISODate } from '@/lib/dates';
import { haptic } from '@/lib/haptics';
import { isOverdue, loanRemaining, summarizeLoans } from '@/lib/loans';

export default function LoansScreen() {
  const theme = useTheme();
  const { t, money, num } = usePrefs();
  const [loans] = useFocusData(listLoans);
  const [view, setView] = useState<'active' | 'settled'>('active');
  const today = toISODate(new Date());

  const summary = summarizeLoans(loans ?? [], today);
  const shown = loans?.filter((l) => (view === 'active' ? !l.settled : l.settled)) ?? [];

  return (
    <Screen
      title={t('loan.title')}
      headerLeft={<IconButton icon="chevronLeft" label={t('add.close')} onPress={() => router.back()} />}
      headerRight={<TextButton label={t('loan.add')} onPress={() => router.push('/loans/new')} />}>
      <SummaryCard style={styles.summary}>
        <View style={styles.summaryItem}>
          <ThemedText type="label" style={{ color: theme.onSummaryMuted }}>
            {t('loan.toReceive')}
          </ThemedText>
          <Amount type="h2" color={theme.onSummary}>
            {money(summary.toReceive)}
          </Amount>
        </View>
        <View style={[styles.divider, { backgroundColor: theme.onSummaryMuted }]} />
        <View style={styles.summaryItem}>
          <ThemedText type="label" style={{ color: theme.onSummaryMuted }}>
            {t('loan.toPay')}
          </ThemedText>
          <Amount type="h2" color={theme.onSummary}>
            {money(summary.toPay)}
          </Amount>
        </View>
      </SummaryCard>
      {summary.overdue > 0 && (
        <ThemedText type="label" style={{ color: theme.expense }}>
          {num(t('loan.overdue').replace('{count}', String(summary.overdue)))}
        </ThemedText>
      )}

      <Segmented
        accessibilityLabel={t('loan.title')}
        options={[
          { value: 'active', label: t('loan.active') },
          { value: 'settled', label: t('loan.settled') },
        ]}
        value={view}
        onChange={setView}
      />

      {loans && shown.length === 0 && (
        <Card>
          <EmptyState
            icon="family"
            title={t('loan.emptyTitle')}
            subtitle={view === 'active' ? t('loan.emptySubtitle') : t('loan.emptySettled')}
          />
        </Card>
      )}

      {shown.map((loan) => (
        <LoanCard key={loan.id} loan={loan} today={today} />
      ))}
    </Screen>
  );
}

function LoanCard({ loan, today }: { loan: Loan; today: string }) {
  const theme = useTheme();
  const { t, money, shortDate } = usePrefs();
  const lent = loan.direction === 'lent';
  const color = lent ? theme.income : theme.expense;
  const overdue = isOverdue(loan, today);

  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => {
        haptic.tap();
        router.push({ pathname: '/loans/[id]', params: { id: String(loan.id) } });
      }}
      style={({ pressed }) => pressed && { opacity: 0.7 }}>
      <Card>
        <View style={styles.row}>
          <View style={styles.flex}>
            <ThemedText type="h4" numberOfLines={1}>
              {loan.person}
            </ThemedText>
            <ThemedText type="label" themeColor="textSecondary">
              {lent ? t('loan.youLent') : t('loan.youBorrowed')} · {shortDate(loan.date)}
            </ThemedText>
          </View>
          <View style={styles.right}>
            <Amount color={loan.settled ? theme.textSecondary : color}>
              {loan.settled ? money(loan.amount) : t('loan.left').replace('{amount}', money(loanRemaining(loan)))}
            </Amount>
            <Icon id="chevronRight" size={14} color={theme.textSecondary} />
          </View>
        </View>
        {!loan.settled && (
          <>
            <ProgressBar fraction={loan.paid / loan.amount} color={color} />
            <View style={styles.row}>
              <ThemedText type="label" themeColor="textSecondary" style={styles.flex}>
                {t('loan.paidOf').replace('{paid}', money(loan.paid)).replace('{total}', money(loan.amount))}
              </ThemedText>
              {loan.due_date && (
                <ThemedText type="label" style={{ color: overdue ? theme.expense : theme.textSecondary }}>
                  {(overdue ? t('loan.overdueSince') : t('loan.dueOn')).replace('{date}', shortDate(loan.due_date))}
                </ThemedText>
              )}
            </View>
          </>
        )}
      </Card>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  summary: { flexDirection: 'row', alignItems: 'center' },
  summaryItem: { flex: 1, alignItems: 'center', gap: Space.xs },
  divider: { width: StyleSheet.hairlineWidth, alignSelf: 'stretch', opacity: 0.4 },
  row: { flexDirection: 'row', alignItems: 'center', gap: Space.md },
  right: { flexDirection: 'row', alignItems: 'center', gap: Space.xs },
});

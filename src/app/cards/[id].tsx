import { router, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext, type SQLiteDatabase } from 'expo-sqlite';
import { useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { TransactionRow } from '@/components/transaction-row';
import {
  Amount,
  Button,
  Card,
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
  accountSpending,
  listAccounts,
  listAccountTransactions,
  listCategories,
  updateCardSettings,
} from '@/db/repo';
import { useFocusData } from '@/hooks/use-focus-data';
import { useTheme } from '@/hooks/use-theme';
import { usePrefs } from '@/i18n/prefs';
import { availableCredit, cardOwed, daysUntil, nextDueDate, positiveOrNull, statementCycle } from '@/lib/cards';
import { toISODate } from '@/lib/dates';
import { haptic } from '@/lib/haptics';
import { formatAmount, parseAmountInput, sanitizeAmountInput, toLatinDigits } from '@/lib/money';
import { ensureNotificationPermission, syncCardReminders } from '@/lib/reminders';

function parseDay(text: string): number | null | 'invalid' {
  if (!text.trim()) return null;
  const day = Number(toLatinDigits(text));
  return Number.isInteger(day) && day >= 1 && day <= 31 ? day : 'invalid';
}

export default function CardScreen() {
  const db = useSQLiteContext();
  const theme = useTheme();
  const { t, money, num, date, shortDate } = usePrefs();
  const id = Number(useLocalSearchParams<{ id: string }>().id);
  const today = toISODate(new Date());

  const load = useCallback(
    async (db: SQLiteDatabase) => {
      const [accounts, categories, txns] = await Promise.all([
        listAccounts(db),
        listCategories(db, { includeRemoved: true }),
        listAccountTransactions(db, id, 30),
      ]);
      const card = accounts.find((a) => a.id === id) ?? null;
      const cycle = card?.statement_day ? statementCycle(toISODate(new Date()), card.statement_day) : null;
      const cycleSpent = cycle ? await accountSpending(db, id, cycle) : 0;
      return {
        card,
        cycle,
        cycleSpent,
        txns,
        accounts: new Map(accounts.map((a) => [a.id, a])),
        categories: new Map(categories.map((c) => [c.id, c])),
      };
    },
    [id]
  );
  const [data, reload] = useFocusData(load);
  const [editing, setEditing] = useState(false);
  const [limitText, setLimitText] = useState('');
  const [dueText, setDueText] = useState('');
  const [statementText, setStatementText] = useState('');
  const [message, setMessage] = useState<{ tone: 'danger' | 'info'; text: string } | null>(null);

  if (!data) return null;
  const { card } = data;
  if (!card) return null;

  const owed = cardOwed(card.balance);
  const available = availableCredit(card.credit_limit, card.balance);
  const due = card.due_day ? nextDueDate(today, card.due_day) : null;
  const daysLeft = due ? daysUntil(today, due) : null;
  const dueSoon = owed > 0 && daysLeft !== null && daysLeft <= 3;

  function startEditing() {
    if (!card) return;
    haptic.select();
    setLimitText(card.credit_limit ? formatAmount(card.credit_limit, { symbol: false }) : '');
    setDueText(card.due_day ? String(card.due_day) : '');
    setStatementText(card.statement_day ? String(card.statement_day) : '');
    setMessage(null);
    setEditing(true);
  }

  async function saveSettings() {
    const dueDay = parseDay(dueText);
    const statementDay = parseDay(statementText);
    if (dueDay === 'invalid' || statementDay === 'invalid') {
      haptic.warn();
      setMessage({ tone: 'danger', text: t('card.badDay') });
      return;
    }
    await updateCardSettings(db, id, {
      creditLimit: positiveOrNull(parseAmountInput(limitText)),
      dueDay,
      statementDay,
    });
    if (dueDay !== null) await ensureNotificationPermission();
    await syncCardReminders(db, t);
    haptic.success();
    setEditing(false);
    setMessage({ tone: 'info', text: t('card.saved') });
    reload();
  }

  return (
    <Screen
      eyebrow={t('card.eyebrow')}
      title={card.name}
      headerLeft={<IconButton icon="chevronLeft" label={t('add.close')} onPress={() => router.back()} />}>
      <SummaryCard>
        <ThemedText type="label" style={{ color: theme.onSummaryMuted }}>
          {t('card.owed')}
        </ThemedText>
        <Amount type="display" color={theme.onSummary}>
          {money(owed)}
        </Amount>
        {card.credit_limit !== null && available !== null ? (
          <>
            <ProgressBar fraction={owed / card.credit_limit} color={theme.gold} />
            <ThemedText type="label" style={{ color: theme.onSummaryMuted }}>
              {t('card.available').replace('{amount}', money(available)).replace('{limit}', money(card.credit_limit))}
            </ThemedText>
          </>
        ) : (
          <ThemedText type="label" style={{ color: theme.onSummaryMuted }}>
            {t('card.noLimit')}
          </ThemedText>
        )}
      </SummaryCard>

      <Card>
        <ThemedText type="bodyMedium" style={dueSoon ? { color: theme.expense } : undefined}>
          {owed === 0
            ? t('card.paid')
            : due === null
              ? t('card.noDue')
              : daysLeft === 0
                ? t('card.dueToday')
                : num(t('card.dueIn').replace('{date}', date(due)).replace('{days}', String(daysLeft)))}
        </ThemedText>
        {data.cycle && (
          <View style={styles.row}>
            <View style={styles.flex}>
              <ThemedText type="label" themeColor="textSecondary">
                {t('card.spentThisStatement')}
              </ThemedText>
              <ThemedText type="label" themeColor="textSecondary">
                {t('card.statementRange')
                  .replace('{start}', shortDate(data.cycle.start))
                  .replace('{end}', shortDate(data.cycle.end))}
              </ThemedText>
            </View>
            <Amount color={theme.expense}>{money(data.cycleSpent)}</Amount>
          </View>
        )}
        <Button
          label={t('card.payBill')}
          icon="send"
          disabled={owed === 0}
          onPress={() => router.push({ pathname: '/add', params: { payCard: String(card.id) } })}
        />
        <ThemedText type="label" themeColor="textSecondary">
          {t('card.howTo')}
        </ThemedText>
      </Card>

      {message && <Notice tone={message.tone} message={message.text} />}

      <SectionHeader
        title={t('card.settings')}
        action={editing ? undefined : { label: t('card.edit'), onPress: startEditing }}
      />
      <Card>
        {editing ? (
          <View style={styles.form}>
            <Input
              value={limitText}
              onChangeText={(v) => setLimitText(sanitizeAmountInput(v))}
              placeholder={t('card.limit')}
              accessibilityLabel={t('card.limit')}
              keyboardType="decimal-pad"
            />
            <Input
              value={dueText}
              onChangeText={(v) => setDueText(v.replace(/[^0-9०-९]/g, '').slice(0, 2))}
              placeholder={t('card.dueDay')}
              accessibilityLabel={t('card.dueDay')}
              keyboardType="number-pad"
            />
            <Input
              value={statementText}
              onChangeText={(v) => setStatementText(v.replace(/[^0-9०-९]/g, '').slice(0, 2))}
              placeholder={t('card.statementDay')}
              accessibilityLabel={t('card.statementDay')}
              keyboardType="number-pad"
            />
            <View style={styles.row}>
              <View style={styles.flex}>
                <Button label={t('add.cancel')} variant="secondary" onPress={() => setEditing(false)} />
              </View>
              <View style={styles.flex}>
                <Button label={t('card.save')} icon="checkmark" onPress={saveSettings} />
              </View>
            </View>
          </View>
        ) : (
          <>
            <Detail label={t('card.limit')} value={card.credit_limit ? money(card.credit_limit) : '—'} />
            <Detail label={t('card.dueDay')} value={card.due_day ? num(String(card.due_day)) : '—'} />
            <Detail label={t('card.statementDay')} value={card.statement_day ? num(String(card.statement_day)) : '—'} />
          </>
        )}
      </Card>

      <SectionHeader title={t('card.recent')} />
      <Card style={styles.list}>
        {data.txns.length === 0 && <ThemedText themeColor="textSecondary">{t('card.noActivity')}</ThemedText>}
        {data.txns.map((txn) => (
          <TransactionRow
            key={txn.id}
            txn={txn}
            categories={data.categories}
            accounts={data.accounts}
            showDate
          />
        ))}
      </Card>
    </Screen>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.detail}>
      <ThemedText themeColor="textSecondary" style={styles.flex}>
        {label}
      </ThemedText>
      <ThemedText type="bodyMedium">{value}</ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  row: { flexDirection: 'row', alignItems: 'center', gap: Space.md },
  form: { gap: Space.md },
  detail: { flexDirection: 'row', alignItems: 'center', gap: Space.md, minHeight: Size.touch },
  list: { gap: Space.xs },
});

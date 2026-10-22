import { router, type Href } from 'expo-router';
import type { SQLiteDatabase } from 'expo-sqlite';
import { useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { TransactionRow } from '@/components/transaction-row';
import {
  Amount,
  Button,
  Card,
  Chip,
  ChipRow,
  EmptyState,
  Fab,
  Icon,
  IconButton,
  IconTile,
  ProgressBar,
  Screen,
  SectionHeader,
  SummaryCard,
  withAlpha,
} from '@/components/ui';
import { Radius, Size, Space, Type } from '@/constants/theme';
import {
  budgetLines,
  countPendingSms,
  listLoans,
  listAccounts,
  listCategories,
  listTransactions,
  totalsForRange,
} from '@/db/repo';
import { useFocusData } from '@/hooks/use-focus-data';
import { useResetOnBlur } from '@/hooks/use-reset-on-blur';
import { useTheme } from '@/hooks/use-theme';
import { usePrefs } from '@/i18n/prefs';
import { cardOwed, daysUntil, nextDueDate } from '@/lib/cards';
import { bsMonthOf, bsMonthRange, daysLeftInBsMonth, toISODate } from '@/lib/dates';
import { haptic } from '@/lib/haptics';
import { ACCOUNT_KIND_COLOR, ACCOUNT_KIND_ICON, type IconId } from '@/lib/icons';
import { summarizeLoans } from '@/lib/loans';

const ALL_TIME = { start: '0000-01-01', end: '9999-12-31' };
const EXAMPLES = ['khana 250', 'hijo bhada 15 hajar', 'तलब ५० हजार', 'pathao 180'];
/** Budget usage at which the bar switches to the warning color. */
const WARN_AT = 0.85;
/** A card bill is flagged on Home this many days before it is due. */
const CARD_ALERT_DAYS = 3;

async function loadHome(db: SQLiteDatabase) {
  const today = toISODate(new Date());
  const month = bsMonthOf(today);
  const range = bsMonthRange(month);
  const [accounts, categories, totals, budgets, recent, pendingSms, loans] = await Promise.all([
    listAccounts(db),
    listCategories(db, { includeRemoved: true }),
    totalsForRange(db, range),
    budgetLines(db, month, range),
    listTransactions(db, ALL_TIME, 5),
    countPendingSms(db),
    listLoans(db),
  ]);
  const planned = budgets.filter((b) => b.limit !== null);
  const budget = planned.length
    ? {
        limit: planned.reduce((s, b) => s + (b.limit ?? 0), 0),
        spent: planned.reduce((s, b) => s + b.spent, 0),
        daysLeft: daysLeftInBsMonth(today),
      }
    : null;
  const loanSummary = summarizeLoans(loans, today);
  const hasLoans = loans.some((l) => !l.settled);
  return { today, month, accounts, categories, totals, budget, recent, pendingSms, loanSummary, hasLoans };
}

export default function HomeScreen() {
  const theme = useTheme();
  const { t, money, num, shortDate, hideAmounts, setPref } = usePrefs();
  const [data] = useFocusData(loadHome);
  const [entry, setEntry] = useState('');
  const [entryFocused, setEntryFocused] = useState(false);

  useResetOnBlur(() => setEntry(''));

  function submit(text: string) {
    if (!text.trim()) return;
    haptic.tap();
    setEntry('');
    router.push({ pathname: '/add', params: { text: text.trim() } });
  }

  if (!data) return <Screen title={t('home.greeting')}>{null}</Screen>;

  // Savings accounts are tracked in Settings but kept out of the spendable total, and card
  // debt is shown on its own card rather than subtracted from it.
  const balance = data.accounts
    .filter((a) => !a.is_savings && a.kind !== 'card')
    .reduce((sum, a) => sum + a.balance, 0);
  const cardRows = data.accounts
    .filter((a) => a.kind === 'card')
    .map((card) => {
      const due = card.due_day ? nextDueDate(data.today, card.due_day) : null;
      return { card, owed: cardOwed(card.balance), due, daysLeft: due ? daysUntil(data.today, due) : null };
    });
  const dueSoon = cardRows.filter((c) => c.owed > 0 && c.daysLeft !== null && c.daysLeft <= CARD_ALERT_DAYS);
  const categoryMap = new Map(data.categories.map((c) => [c.id, c]));
  const accountMap = new Map(data.accounts.map((a) => [a.id, a]));
  const hidden = hideAmounts === 'on';
  const isNew = data.recent.length === 0;

  const quickActions: { icon: IconId; label: string; color: string; href: Href }[] = [
    {
      icon: 'arrowUp',
      label: t('type.expense'),
      color: theme.expense,
      href: { pathname: '/add', params: { type: 'expense' } },
    },
    {
      icon: 'arrowDown',
      label: t('type.income'),
      color: theme.income,
      href: { pathname: '/add', params: { type: 'income' } },
    },
    {
      icon: 'transfer',
      label: t('type.transfer'),
      color: theme[ACCOUNT_KIND_COLOR.bank],
      href: { pathname: '/add', params: { type: 'transfer' } },
    },
    { icon: 'family', label: t('home.quickLoan'), color: theme.gold, href: '/loans/new' },
  ];

  return (
    <Screen
      title={t('home.greeting')}
      headerRight={<IconButton icon="tray" label={t('sms.open')} onPress={() => router.push('/inbox')} />}
      overlay={<Fab onPress={() => router.push('/add')} accessibilityLabel={t('add.title')} />}>
      <SummaryCard>
        <View style={styles.summaryTop}>
          <ThemedText type="label" style={[styles.flex, { color: theme.onSummaryMuted }]}>
            {t('home.available')}
          </ThemedText>
          <IconButton
            icon={hidden ? 'eyeSlash' : 'eye'}
            label={hidden ? t('home.showBalance') : t('home.hideBalance')}
            color={theme.onSummary}
            onPress={() => setPref('hideAmounts', hidden ? 'off' : 'on')}
          />
        </View>
        <Amount type="display" color={theme.onSummary}>
          {money(balance)}
        </Amount>
        <View style={[styles.flowRow, { borderTopColor: withAlpha('#FFFFFF', 0.14) }]}>
          <FlowStat icon="arrowDown" label={t('home.earned')} value={`+${money(data.totals.income)}`} />
          <FlowStat icon="arrowUp" label={t('home.spent')} value={`−${money(data.totals.expense)}`} />
        </View>
      </SummaryCard>

      <View style={styles.quickRow} accessibilityLabel={t('home.quickActions')}>
        {quickActions.map((action) => (
          <Pressable
            key={action.label}
            accessibilityRole="button"
            accessibilityLabel={action.label}
            onPress={() => {
              haptic.tap();
              router.push(action.href);
            }}
            style={({ pressed }) => [
              styles.quickAction,
              { backgroundColor: theme.surface, borderColor: theme.border },
              pressed && { opacity: 0.6 },
            ]}>
            <IconTile icon={action.icon} color={action.color} size={36} />
            <ThemedText type="label" numberOfLines={1}>
              {action.label}
            </ThemedText>
          </Pressable>
        ))}
      </View>

      <View
        style={[
          styles.smartInput,
          { backgroundColor: theme.surface, borderColor: entryFocused ? theme.brand : theme.border },
        ]}>
        <Icon id="sparkles" size={18} color={theme.gold} />
        <TextInput
          value={entry}
          onChangeText={setEntry}
          placeholder={t('home.placeholder')}
          placeholderTextColor={theme.textSecondary}
          returnKeyType="send"
          onFocus={() => setEntryFocused(true)}
          onBlur={() => setEntryFocused(false)}
          onSubmitEditing={() => submit(entry)}
          accessibilityLabel={t('home.smartTitle')}
          accessibilityHint={t('home.smartHint')}
          style={[styles.smartTextInput, { color: theme.text }]}
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('add.title')}
          accessibilityState={{ disabled: !entry.trim() }}
          onPress={() => submit(entry)}
          disabled={!entry.trim()}
          style={[styles.sendButton, { backgroundColor: entry.trim() ? theme.brand : theme.disabled }]}>
          <Icon id="send" size={18} color={theme.onBrand} weight="semibold" />
        </Pressable>
      </View>
      {/* Examples teach the smart entry; once there's history they're just clutter. */}
      {isNew && (
        <ChipRow>
          {EXAMPLES.map((example) => (
            <Chip key={example} label={example} selected={false} onPress={() => submit(example)} />
          ))}
        </ChipRow>
      )}

      {data.pendingSms > 0 && (
        <Alert
          icon="tray"
          color={theme.gold}
          text={
            data.pendingSms === 1
              ? t('inbox.bannerOne')
              : num(t('inbox.banner').replace('{count}', String(data.pendingSms)))
          }
          onPress={() => router.push('/inbox')}
        />
      )}
      {dueSoon.map(({ card, owed, due, daysLeft }) => (
        <Alert
          key={card.id}
          icon="card"
          color={theme.expense}
          text={
            daysLeft === 0
              ? t('home.cardDueToday').replace('{card}', card.name).replace('{amount}', money(owed))
              : t('home.cardDue')
                  .replace('{card}', card.name)
                  .replace('{amount}', money(owed))
                  .replace('{date}', shortDate(due!))
          }
          onPress={() => router.push({ pathname: '/cards/[id]', params: { id: String(card.id) } })}
        />
      ))}
      {data.loanSummary.overdue > 0 && (
        <Alert
          icon="family"
          color={theme.expense}
          text={`${t('loan.title')}: ${num(t('loan.overdue').replace('{count}', String(data.loanSummary.overdue)))}`}
          onPress={() => router.push('/loans')}
        />
      )}

      <Card>
        <View style={styles.rowCenter}>
          <ThemedText type="h4" style={styles.flex}>
            {t('home.budgetStatus')}
          </ThemedText>
          {data.budget && (
            <ThemedText type="label" themeColor="textSecondary">
              {num(data.budget.daysLeft)} {t('budget.daysLeft')}
            </ThemedText>
          )}
        </View>
        {data.budget ? (
          <BudgetStatus {...data.budget} />
        ) : (
          <View style={styles.rowCenter}>
            <ThemedText type="label" themeColor="textSecondary" style={styles.flex}>
              {t('home.noBudget')}
            </ThemedText>
            <Button variant="secondary" icon="target" label={t('home.setBudget')} onPress={() => router.navigate('/budgets')} />
          </View>
        )}
      </Card>

      <SectionHeader
        title={t('home.recent')}
        action={isNew ? undefined : { label: t('home.seeAll'), onPress: () => router.navigate('/transactions') }}
      />
      <Card>
        {isNew ? (
          <EmptyState icon="tray" title={t('home.emptyTitle')} subtitle={t('home.emptySubtitle')} />
        ) : (
          data.recent.map((txn) => (
            <TransactionRow key={txn.id} txn={txn} categories={categoryMap} accounts={accountMap} showDate />
          ))
        )}
      </Card>

      <SectionHeader title={t('home.debts')} />
      <Card style={styles.list}>
        {cardRows.map(({ card, owed, due }) => (
          <LinkRow
            key={card.id}
            icon={ACCOUNT_KIND_ICON.card}
            color={theme[ACCOUNT_KIND_COLOR.card]}
            title={card.name}
            subtitle={owed === 0 ? t('card.paid') : due ? t('card.dueShort').replace('{date}', shortDate(due)) : t('card.noDue')}
            amount={money(owed)}
            amountColor={owed > 0 ? theme.expense : undefined}
            onPress={() => router.push({ pathname: '/cards/[id]', params: { id: String(card.id) } })}
          />
        ))}
        <LinkRow
          icon="family"
          color={theme.gold}
          title={t('loan.title')}
          subtitle={
            data.hasLoans
              ? `${t('loan.toReceive')} ${money(data.loanSummary.toReceive)} · ${t('loan.toPay')} ${money(data.loanSummary.toPay)}`
              : t('loan.cardEmpty')
          }
          onPress={() => router.push('/loans')}
        />
      </Card>
    </Screen>
  );
}

/** Tappable notice for something that needs attention today. */
function Alert({ icon, color, text, onPress }: { icon: IconId; color: string; text: string; onPress: () => void }) {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => {
        haptic.tap();
        onPress();
      }}
      style={({ pressed }) => [styles.alert, { backgroundColor: withAlpha(color, 0.14) }, pressed && { opacity: 0.7 }]}>
      <Icon id={icon} size={18} color={color} />
      <ThemedText type="bodyMedium" style={styles.flex}>
        {text}
      </ThemedText>
      <Icon id="chevronRight" size={14} color={theme.textSecondary} />
    </Pressable>
  );
}

function LinkRow({
  icon,
  color,
  title,
  subtitle,
  amount,
  amountColor,
  onPress,
}: {
  icon: IconId;
  color: string;
  title: string;
  subtitle: string;
  amount?: string;
  amountColor?: string;
  onPress: () => void;
}) {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => {
        haptic.tap();
        onPress();
      }}
      style={({ pressed }) => [styles.linkRow, pressed && { opacity: 0.6 }]}>
      <IconTile icon={icon} color={color} />
      <View style={styles.flex}>
        <ThemedText type="bodyMedium">{title}</ThemedText>
        <ThemedText type="label" themeColor="textSecondary">
          {subtitle}
        </ThemedText>
      </View>
      {amount !== undefined && <Amount color={amountColor}>{amount}</Amount>}
      <Icon id="chevronRight" size={14} color={theme.textSecondary} />
    </Pressable>
  );
}

function FlowStat({ icon, label, value }: { icon: 'arrowUp' | 'arrowDown'; label: string; value: string }) {
  const theme = useTheme();
  return (
    <View style={styles.flowStat}>
      <View style={[styles.flowIcon, { backgroundColor: withAlpha('#FFFFFF', 0.12) }]}>
        <Icon id={icon} size={14} color={theme.onSummary} weight="semibold" />
      </View>
      <View style={styles.flex}>
        <ThemedText type="label" style={{ color: theme.onSummaryMuted }}>
          {label}
        </ThemedText>
        <Amount color={theme.onSummary}>{value}</Amount>
      </View>
    </View>
  );
}

function BudgetStatus({ limit, spent, daysLeft }: { limit: number; spent: number; daysLeft: number }) {
  const theme = useTheme();
  const { t, money } = usePrefs();
  const fraction = limit ? spent / limit : 0;
  const over = spent > limit;
  const color = over ? theme.danger : fraction >= WARN_AT ? theme.warning : theme.brand;
  const remaining = limit - spent;
  return (
    <>
      <View style={styles.rowBaseline}>
        <Amount type="h3" color={over ? theme.danger : theme.text}>
          {over ? `${t('budget.over')} ${money(-remaining)}` : money(remaining)}
        </Amount>
        {!over && <ThemedText themeColor="textSecondary">{t('home.remaining')}</ThemedText>}
      </View>
      <ProgressBar fraction={fraction} color={color} />
      <View style={styles.rowCenter}>
        <ThemedText type="label" themeColor="textSecondary" style={styles.flex}>
          {money(spent)} {t('home.ofBudget')} {money(limit)}
        </ThemedText>
        {!over && daysLeft > 0 && (
          <ThemedText type="label" themeColor="textSecondary">
            {money(Math.floor(remaining / daysLeft / 100) * 100)} {t('budget.perDay')}
          </ThemedText>
        )}
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  alert: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space.md,
    minHeight: Size.button,
    paddingHorizontal: Space.lg,
    paddingVertical: Space.sm,
    borderRadius: Radius.control,
    borderCurve: 'continuous',
  },
  rowCenter: { flexDirection: 'row', alignItems: 'center', gap: Space.md },
  rowBaseline: { flexDirection: 'row', alignItems: 'baseline', gap: Space.sm },
  summaryTop: { flexDirection: 'row', alignItems: 'center', marginRight: -Space.md, marginTop: -Space.sm },
  flowRow: {
    flexDirection: 'row',
    gap: Space.md,
    marginTop: Space.sm,
    paddingTop: Space.lg,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  flowStat: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: Space.sm },
  flowIcon: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  quickRow: { flexDirection: 'row', gap: Space.sm },
  quickAction: {
    flex: 1,
    alignItems: 'center',
    gap: Space.xs,
    paddingVertical: Space.md,
    paddingHorizontal: Space.xs,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Radius.control,
    borderCurve: 'continuous',
  },
  smartInput: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space.sm,
    borderWidth: 1,
    borderRadius: Radius.control,
    paddingLeft: Space.lg,
    paddingRight: Space.xs,
    minHeight: Size.input,
    borderCurve: 'continuous',
  },
  smartTextInput: { ...Type.bodyLarge, flex: 1, paddingVertical: Space.md },
  sendButton: {
    width: Size.touch - 2,
    height: Size.touch - 2,
    borderRadius: Radius.control - 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  list: { gap: Space.xs },
  linkRow: { flexDirection: 'row', alignItems: 'center', gap: Space.md, minHeight: Size.touch },
});

import { router } from 'expo-router';
import { useSQLiteContext, type SQLiteDatabase } from 'expo-sqlite';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { Amount, Button, Chip, ChipRow, IconButton, Input, Notice, SectionHeader, Segmented } from '@/components/ui';
import { ScreenPadding, Space, Type } from '@/constants/theme';
import { addLoan, defaultAccount, listAccounts, listLoans, type Account, type LoanDirection } from '@/db/repo';
import { useSingleFlight } from '@/hooks/use-single-flight';
import { useKeyboardVisible } from '@/hooks/use-keyboard-visible';
import { useTheme } from '@/hooks/use-theme';
import { usePrefs } from '@/i18n/prefs';
import { addDays, toISODate } from '@/lib/dates';
import { haptic } from '@/lib/haptics';
import { ACCOUNT_KIND_ICON } from '@/lib/icons';
import { recentPeople } from '@/lib/loans';
import { parseAmountInput, sanitizeAmountInput } from '@/lib/money';
import { txnErrorMessage } from '@/lib/txn-error-message';
import { validateTransaction } from '@/lib/validation';

async function loadForm(db: SQLiteDatabase) {
  const [accounts, loans] = await Promise.all([listAccounts(db), listLoans(db)]);
  return { accounts, people: recentPeople(loans) };
}

const DUE_OPTIONS = [
  { key: 'loan.dueNone', days: null },
  { key: 'loan.due1w', days: 7 },
  { key: 'loan.due1m', days: 30 },
  { key: 'loan.due3m', days: 90 },
] as const;

export default function NewLoanSheet() {
  const db = useSQLiteContext();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { t, date, money, lang } = usePrefs();
  const keyboardVisible = useKeyboardVisible();
  const [lists, setLists] = useState<{ accounts: Account[]; people: string[] } | null>(null);
  const [direction, setDirection] = useState<LoanDirection>('lent');
  const [person, setPerson] = useState('');
  const [amountText, setAmountText] = useState('');
  const [accountId, setAccountId] = useState<number | null>(null);
  const [day, setDay] = useState(() => toISODate(new Date()));
  const [dueDays, setDueDays] = useState<number | null>(null);
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [runSave, saving] = useSingleFlight();

  useEffect(() => {
    loadForm(db).then((loaded) => {
      setLists(loaded);
      setAccountId(defaultAccount(loaded.accounts)?.id ?? null);
    });
  }, [db]);

  if (!lists) return null;

  const today = toISODate(new Date());
  const dayOptions = [
    { iso: today, label: t('add.today') },
    { iso: addDays(today, -1), label: t('add.yesterday') },
    { iso: addDays(today, -2), label: t('add.dayBefore') },
  ];
  const color = direction === 'lent' ? theme.expense : theme.income;
  const clearError = () => setError(null);

  async function save() {
    const amount = parseAmountInput(amountText);
    if (!person.trim()) {
      haptic.warn();
      setError(t('loan.needPerson'));
      return;
    }
    if (accountId !== null) {
      // Lending takes money out like an expense; borrowing brings it in like income.
      const invalid = validateTransaction(
        { amount, type: direction === 'lent' ? 'expense' : 'income', accountId, toAccountId: null },
        await listAccounts(db)
      );
      if (invalid) {
        haptic.warn();
        setError(txnErrorMessage(invalid, t, money));
        return;
      }
    } else if (amount === null) {
      haptic.warn();
      setError(t('add.noAmount'));
      return;
    }
    await addLoan(db, {
      person,
      direction,
      amount: amount as number,
      account_id: accountId,
      date: day,
      due_date: dueDays === null ? null : addDays(day, dueDays),
      note,
    });
    haptic.success();
    router.back();
  }

  return (
    <ScrollView
      style={{ backgroundColor: theme.background }}
      contentContainerStyle={{ paddingBottom: keyboardVisible ? Space.lg : Space.huge }}
      stickyHeaderIndices={[0]}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="interactive"
      automaticallyAdjustKeyboardInsets>
      {/* ScrollView replaces a sticky child's own style, so the row layout lives one level down. */}
      <View
        style={{
          backgroundColor: theme.background,
          borderBottomColor: theme.border,
          borderBottomWidth: StyleSheet.hairlineWidth,
        }}>
        <View style={[styles.header, { paddingTop: insets.top + Space.sm }]}>
          <ThemedText type="h2" accessibilityRole="header" numberOfLines={1} style={styles.title}>
            {t('loan.new')}
          </ThemedText>
          <IconButton icon="close" label={t('add.close')} onPress={() => router.back()} />
        </View>
      </View>

      <View style={styles.container}>
        <Segmented
          accessibilityLabel={t('loan.new')}
          options={[
            { value: 'lent', label: t('loan.lent') },
            { value: 'borrowed', label: t('loan.borrowed') },
          ]}
          value={direction}
          onChange={(v) => {
            clearError();
            setDirection(v);
          }}
        />

        <View style={styles.amountBlock}>
          <Amount type="h2" color={color}>
            {lang === 'ne' ? 'रु' : 'Rs'}
          </Amount>
          <TextInput
            value={amountText}
            onChangeText={(v) => {
              clearError();
              setAmountText(sanitizeAmountInput(v));
            }}
            placeholder="0"
            placeholderTextColor={theme.disabled}
            keyboardType="decimal-pad"
            accessibilityLabel={t('add.amount')}
            style={[styles.amountInput, { color }]}
          />
        </View>

        <SectionHeader title={t('loan.person')} />
        <Input
          value={person}
          onChangeText={(v) => {
            clearError();
            setPerson(v);
          }}
          placeholder={t('loan.personPlaceholder')}
          accessibilityLabel={t('loan.person')}
          maxLength={40}
        />
        {lists.people.length > 0 && (
          <ChipRow>
            {lists.people.map((name) => (
              <Chip key={name} label={name} selected={person.trim() === name} onPress={() => setPerson(name)} />
            ))}
          </ChipRow>
        )}

        <SectionHeader title={direction === 'lent' ? t('loan.fromAccount') : t('loan.toAccount')} />
        <ChipRow>
          {lists.accounts.map((a) => (
            <Chip
              key={a.id}
              label={a.name}
              icon={ACCOUNT_KIND_ICON[a.kind]}
              selected={accountId === a.id}
              onPress={() => {
                clearError();
                setAccountId(a.id);
              }}
            />
          ))}
          <Chip
            label={t('loan.noAccount')}
            icon="pencil"
            selected={accountId === null}
            onPress={() => {
              clearError();
              setAccountId(null);
            }}
          />
        </ChipRow>
        {accountId === null && (
          <ThemedText type="label" themeColor="textSecondary">
            {t('loan.noAccountHint')}
          </ThemedText>
        )}

        <SectionHeader title={t('loan.date')} />
        <ChipRow>
          {dayOptions.map((o) => (
            <Chip key={o.iso} label={o.label} icon="calendar" selected={day === o.iso} onPress={() => setDay(o.iso)} />
          ))}
        </ChipRow>
        <ThemedText themeColor="textSecondary">{date(day)}</ThemedText>

        <SectionHeader title={t('loan.due')} />
        <ChipRow>
          {DUE_OPTIONS.map((o) => (
            <Chip key={o.key} label={t(o.key)} selected={dueDays === o.days} onPress={() => setDueDays(o.days)} />
          ))}
        </ChipRow>
        {dueDays !== null && <ThemedText themeColor="textSecondary">{date(addDays(day, dueDays))}</ThemedText>}

        <Input value={note} onChangeText={setNote} placeholder={t('loan.note')} accessibilityLabel={t('loan.note')} />

        {error && <Notice tone="danger" message={error} />}

        <Button label={t('loan.save')} icon="checkmark" loading={saving} onPress={() => runSave(save)} />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { paddingHorizontal: ScreenPadding, paddingTop: Space.lg, gap: Space.lg },
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
});

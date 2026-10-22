import { router } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useState, type ReactNode } from 'react';
import { Alert, Pressable, StyleSheet, View } from 'react-native';

import { CategoryManager } from '@/components/category-manager';
import { SmsSettings } from '@/components/sms-settings';
import { ThemedText } from '@/components/themed-text';
import {
  Amount,
  Button,
  Card,
  Chip,
  ChipRow,
  Icon,
  IconButton,
  IconTile,
  Input,
  Notice,
  Screen,
  SectionHeader,
  Segmented,
  TextButton,
  UndoBar,
} from '@/components/ui';
import { Radius, Size, Space } from '@/constants/theme';
import {
  addAccount,
  listAccounts,
  setAccountSavings,
  setCategoryRemoved,
  type Account,
  type Category,
} from '@/db/repo';
import { useFocusData } from '@/hooks/use-focus-data';
import { useSingleFlight } from '@/hooks/use-single-flight';
import { useResetOnBlur } from '@/hooks/use-reset-on-blur';
import { useTheme } from '@/hooks/use-theme';
import { usePrefs } from '@/i18n/prefs';
import { haptic } from '@/lib/haptics';
import { ACCOUNT_KIND_COLOR, ACCOUNT_KIND_ICON, type IconId } from '@/lib/icons';
import { parseAmountInput, sanitizeAmountInput, toLatinDigits } from '@/lib/money';
import { eraseAllData } from '@/db/migrations';
import { cancelAllReminders, ensureNotificationPermission, syncCardReminders } from '@/lib/reminders';
import { cardOwed, positiveOrNull } from '@/lib/cards';

// Cash is a single built-in account; new accounts are wallets, banks or cards.
const ACCOUNT_KINDS: Account['kind'][] = ['wallet', 'bank', 'card'];
const UNDO_MS = 5000;

export default function SettingsScreen() {
  const db = useSQLiteContext();
  const theme = useTheme();
  const { t, money, lang, calendar, numerals, theme: themeMode, setPref } = usePrefs();
  const [accounts, reload] = useFocusData(listAccounts);
  const [adding, setAdding] = useState(false);
  const [accountError, setAccountError] = useState<string | null>(null);
  const [runCreate, creating] = useSingleFlight();
  const [name, setName] = useState('');
  const [kind, setKind] = useState<Account['kind']>('wallet');
  const [opening, setOpening] = useState('');
  const [isSavings, setIsSavings] = useState(false);
  const [limitText, setLimitText] = useState('');
  const [dueText, setDueText] = useState('');
  const [removedCategory, setRemovedCategory] = useState<Category | null>(null);
  const [categoriesVersion, setCategoriesVersion] = useState(0);

  useEffect(() => {
    if (!removedCategory) return;
    const timer = setTimeout(() => setRemovedCategory(null), UNDO_MS);
    return () => clearTimeout(timer);
  }, [removedCategory]);

  async function undoRemoveCategory() {
    if (!removedCategory) return;
    await setCategoryRemoved(db, removedCategory.id, false);
    haptic.success();
    setRemovedCategory(null);
    setCategoriesVersion((v) => v + 1);
  }

  useResetOnBlur(() => {
    setAdding(false);
    setName('');
    setKind('wallet');
    setOpening('');
    setIsSavings(false);
    setLimitText('');
    setDueText('');
    setAccountError(null);
  });

  async function createAccount() {
    if (!name.trim()) return;
    // Account names are unique in the database; say so instead of failing silently.
    const taken = (accounts ?? []).some((a) => a.name.toLocaleLowerCase() === name.trim().toLocaleLowerCase());
    if (taken) {
      haptic.warn();
      setAccountError(t('settings.accountExists'));
      return;
    }
    const amount = opening.trim() ? (parseAmountInput(opening) ?? 0) : 0;
    const isCard = kind === 'card';
    const dueDay = Number(toLatinDigits(dueText));
    await addAccount(
      db,
      name,
      kind,
      // A card's opening figure is what you already owe, so its balance starts negative.
      isCard ? -amount : amount,
      !isCard && isSavings,
      {
        creditLimit: isCard ? positiveOrNull(parseAmountInput(limitText)) : null,
        statementDay: null,
        dueDay: isCard && dueDay >= 1 && dueDay <= 31 ? dueDay : null,
      }
    );
    if (isCard && dueDay >= 1 && dueDay <= 31) {
      await ensureNotificationPermission();
      await syncCardReminders(db, t);
    }
    haptic.success();
    setName('');
    setOpening('');
    setIsSavings(false);
    setLimitText('');
    setDueText('');
    setAdding(false);
    reload();
  }

  function confirmErase() {
    haptic.warn();
    Alert.alert(t('settings.eraseTitle'), t('settings.eraseBody'), [
      { text: t('settings.cancel'), style: 'cancel' },
      {
        text: t('settings.eraseConfirm'),
        style: 'destructive',
        onPress: async () => {
          await eraseAllData(db);
          await cancelAllReminders();
          haptic.success();
          setAdding(false);
          setCategoriesVersion((v) => v + 1);
          reload();
          router.navigate('/');
        },
      },
    ]);
  }

  async function toggleSavings(account: Account) {
    haptic.select();
    await setAccountSavings(db, account.id, !account.is_savings);
    reload();
  }

  return (
    <Screen
      title={t('tab.settings')}
      overlay={
        removedCategory && (
          <UndoBar
            message={t('settings.categoryRemoved')}
            actionLabel={t('txn.undo')}
            onAction={undoRemoveCategory}
          />
        )
      }>
      <SectionHeader title={t('settings.preferences')} />
      <Card>
        <PreferenceRow icon="theme" label={t('settings.theme')}>
          <Segmented
            accessibilityLabel={t('settings.theme')}
            options={[
              { value: 'system', label: t('settings.themeSystem') },
              { value: 'light', label: t('settings.themeLight') },
              { value: 'dark', label: t('settings.themeDark') },
            ]}
            value={themeMode}
            onChange={(v) => setPref('theme', v)}
          />
        </PreferenceRow>
        <PreferenceRow icon="globe" label={t('settings.language')}>
          <Segmented
            accessibilityLabel={t('settings.language')}
            options={[
              { value: 'en', label: 'English' },
              { value: 'ne', label: 'नेपाली' },
            ]}
            value={lang}
            onChange={(v) => setPref('lang', v)}
          />
        </PreferenceRow>
        <PreferenceRow icon="calendar" label={t('settings.calendar')} hint={t('settings.calendarHint')}>
          <Segmented
            accessibilityLabel={t('settings.calendar')}
            options={[
              { value: 'BS', label: lang === 'ne' ? 'बि.सं.' : 'BS' },
              { value: 'AD', label: lang === 'ne' ? 'ई.सं.' : 'AD' },
            ]}
            value={calendar}
            onChange={(v) => setPref('calendar', v)}
          />
        </PreferenceRow>
        <PreferenceRow icon="number" label={t('settings.numerals')}>
          <Segmented
            accessibilityLabel={t('settings.numerals')}
            options={[
              { value: 'latin', label: '123' },
              { value: 'devanagari', label: '१२३' },
            ]}
            value={numerals}
            onChange={(v) => setPref('numerals', v)}
          />
        </PreferenceRow>
      </Card>

      <SectionHeader
        title={t('settings.accounts')}
        action={adding ? undefined : { label: t('settings.addAccount'), onPress: () => setAdding(true) }}
      />
      <Card>
        {accounts?.map((a) =>
          a.kind === 'card' ? (
            <Pressable
              key={a.id}
              accessibilityRole="button"
              onPress={() => {
                haptic.tap();
                router.push({ pathname: '/cards/[id]', params: { id: String(a.id) } });
              }}
              style={({ pressed }) => [styles.accountRow, pressed && { opacity: 0.6 }]}>
              <IconTile icon={ACCOUNT_KIND_ICON.card} color={theme[ACCOUNT_KIND_COLOR.card]} />
              <View style={styles.flex}>
                <ThemedText type="bodyMedium">{a.name}</ThemedText>
                <ThemedText type="label" themeColor="textSecondary">
                  {a.credit_limit ? t('card.limitShort').replace('{amount}', money(a.credit_limit)) : t('account.card')}
                </ThemedText>
              </View>
              <Amount color={cardOwed(a.balance) > 0 ? theme.expense : undefined}>
                {t('card.owedShort').replace('{amount}', money(cardOwed(a.balance)))}
              </Amount>
              <Icon id="chevronRight" size={14} color={theme.textSecondary} />
            </Pressable>
          ) : (
          <View key={a.id} style={styles.accountRow}>
            <IconTile icon={ACCOUNT_KIND_ICON[a.kind]} color={theme[ACCOUNT_KIND_COLOR[a.kind]]} />
            <View style={styles.flex}>
              <ThemedText type="bodyMedium">{a.name}</ThemedText>
              <ThemedText type="label" themeColor="textSecondary">
                {a.is_savings ? t('settings.savingsLabel') : t(`account.${a.kind}`)}
              </ThemedText>
            </View>
            <Amount color={a.balance < 0 ? theme.expense : undefined}>
              {`${a.balance < 0 ? '−' : ''}${money(Math.abs(a.balance))}`}
            </Amount>
            <IconButton
              icon={a.is_savings ? 'eyeSlash' : 'eye'}
              label={(a.is_savings ? t('settings.unmarkSavings') : t('settings.markSavings')).replace('{name}', a.name)}
              color={a.is_savings ? theme.gold : theme.textSecondary}
              onPress={() => toggleSavings(a)}
            />
          </View>
          )
        )}

        {adding ? (
          <View style={[styles.addForm, { borderTopColor: theme.border }]}>
            <Input
              value={name}
              onChangeText={(value) => {
                setName(value);
                setAccountError(null);
              }}
              placeholder={t('settings.accountName')}
              accessibilityLabel={t('settings.accountName')}
              autoFocus
            />
            <ChipRow>
              {ACCOUNT_KINDS.map((k) => (
                <Chip
                  key={k}
                  label={t(`account.${k}`)}
                  icon={ACCOUNT_KIND_ICON[k]}
                  selected={kind === k}
                  onPress={() => setKind(k)}
                />
              ))}
            </ChipRow>
            <Input
              value={opening}
              onChangeText={(value) => setOpening(sanitizeAmountInput(value))}
              placeholder={kind === 'card' ? t('card.owedNow') : t('settings.openingBalance')}
              accessibilityLabel={kind === 'card' ? t('card.owedNow') : t('settings.openingBalance')}
              keyboardType="decimal-pad"
            />
            {kind === 'card' && (
              <>
                <Input
                  value={limitText}
                  onChangeText={(value) => setLimitText(sanitizeAmountInput(value))}
                  placeholder={t('card.limit')}
                  accessibilityLabel={t('card.limit')}
                  keyboardType="decimal-pad"
                />
                <Input
                  value={dueText}
                  onChangeText={(value) => setDueText(value.replace(/[^0-9०-९]/g, '').slice(0, 2))}
                  placeholder={t('card.dueDay')}
                  accessibilityLabel={t('card.dueDay')}
                  keyboardType="number-pad"
                />
              </>
            )}
            {kind !== 'card' && (
            <Pressable
              accessibilityRole="switch"
              accessibilityState={{ checked: isSavings }}
              onPress={() => {
                haptic.select();
                setIsSavings((v) => !v);
              }}
              style={styles.savingsRow}>
              <View
                style={[
                  styles.checkbox,
                  { backgroundColor: isSavings ? theme.brand : theme.inputBackground },
                ]}>
                {isSavings && <Icon id="checkmark" size={12} color={theme.onBrand} weight="bold" />}
              </View>
              <View style={styles.flex}>
                <ThemedText type="bodyMedium">{t('settings.savingsAccount')}</ThemedText>
                <ThemedText type="label" themeColor="textSecondary">
                  {t('settings.savingsHint')}
                </ThemedText>
              </View>
            </Pressable>
            )}
            {accountError && <Notice tone="danger" message={accountError} />}
            <View style={styles.formActions}>
              <TextButton label={t('settings.cancel')} color={theme.textSecondary} onPress={() => setAdding(false)} />
              <View style={styles.flex}>
                <Button
                  label={t('settings.create')}
                  icon="plus"
                  disabled={!name.trim()}
                  loading={creating}
                  onPress={() => runCreate(createAccount)}
                />
              </View>
            </View>
          </View>
        ) : (
          <Pressable
            accessibilityRole="button"
            onPress={() => {
              haptic.select();
              setAdding(true);
            }}
            style={({ pressed }) => [styles.addRow, { borderTopColor: theme.border }, pressed && { opacity: 0.6 }]}>
            <Icon id="plus" size={16} color={theme.brand} weight="semibold" />
            <ThemedText type="button" style={{ color: theme.brand, fontSize: 15 }}>
              {t('settings.addAccount')}
            </ThemedText>
          </Pressable>
        )}
      </Card>

      <CategoryManager onRemoved={setRemovedCategory} version={categoriesVersion} />

      <SmsSettings />

      <Button label={t('settings.erase')} icon="trash" variant="destructive" onPress={confirmErase} />

      <Card style={styles.privacy}>
        <IconTile icon="lock" color={theme.brand} />
        <View style={styles.flex}>
          <ThemedText type="h4">{t('settings.privacyTitle')}</ThemedText>
          <ThemedText themeColor="textSecondary">{t('settings.privacy')}</ThemedText>
        </View>
      </Card>
    </Screen>
  );
}

function PreferenceRow({
  icon,
  label,
  hint,
  children,
}: {
  icon: IconId;
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  const theme = useTheme();
  return (
    <View style={styles.prefRow}>
      <View style={styles.prefHeader}>
        <Icon id={icon} size={18} color={theme.textSecondary} />
        <View style={styles.flex}>
          <ThemedText type="bodyMedium">{label}</ThemedText>
          {hint && (
            <ThemedText type="label" themeColor="textSecondary">
              {hint}
            </ThemedText>
          )}
        </View>
      </View>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  prefRow: { gap: Space.sm },
  prefHeader: { flexDirection: 'row', alignItems: 'center', gap: Space.md },
  accountRow: { flexDirection: 'row', alignItems: 'center', gap: Space.md, minHeight: Size.button },
  addRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Space.sm,
    minHeight: Size.touch,
    paddingTop: Space.md,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  addForm: { gap: Space.md, paddingTop: Space.lg, borderTopWidth: StyleSheet.hairlineWidth },
  formActions: { flexDirection: 'row', alignItems: 'center', gap: Space.md },
  savingsRow: { flexDirection: 'row', alignItems: 'center', gap: Space.md, minHeight: Size.touch },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: Radius.control / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  privacy: { flexDirection: 'row', alignItems: 'center' },
});

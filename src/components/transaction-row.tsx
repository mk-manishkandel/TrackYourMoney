import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Amount, IconTile } from '@/components/ui';
import { Size, Space } from '@/constants/theme';
import type { Account, Category, Transaction } from '@/db/repo';
import { useTheme } from '@/hooks/use-theme';
import { usePrefs } from '@/i18n/prefs';
import { categoryColor } from '@/lib/icons';

export function TransactionRow({
  txn,
  categories,
  accounts,
  showDate,
  onLongPress,
}: {
  txn: Transaction;
  categories: Map<number, Category>;
  accounts: Map<number, Account>;
  showDate?: boolean;
  onLongPress?: () => void;
}) {
  const { t, money, shortDate, categoryName } = usePrefs();
  const theme = useTheme();
  const category = txn.category_id != null ? categories.get(txn.category_id) : undefined;
  const account = accounts.get(txn.account_id);
  const toAccount = txn.to_account_id != null ? accounts.get(txn.to_account_id) : undefined;

  const isTransfer = txn.type === 'transfer';
  const title = isTransfer
    ? `${account?.name ?? '?'} → ${toAccount?.name ?? '?'}`
    : category
      ? categoryName(category)
      : t(`type.${txn.type}`);
  const subtitle = [txn.note, isTransfer ? null : account?.name, showDate ? shortDate(txn.date) : null]
    .filter(Boolean)
    .join(' · ');
  // Explicit signs so meaning never depends on color alone.
  const sign = txn.type === 'expense' ? '−' : txn.type === 'income' ? '+' : '';
  const amountColor = txn.type === 'expense' ? theme.expense : txn.type === 'income' ? theme.income : theme.text;
  const amount = `${sign}${money(txn.amount)}`;

  return (
    <Pressable
      accessible
      accessibilityLabel={`${t(`type.${txn.type}`)}, ${title}, ${amount}${subtitle ? `, ${subtitle}` : ''}`}
      accessibilityHint={onLongPress ? t('txn.hint') : undefined}
      onLongPress={onLongPress}
      delayLongPress={350}
      style={({ pressed }) => [styles.row, pressed && onLongPress && { opacity: 0.6 }]}>
      <IconTile
        icon={isTransfer ? 'transfer' : (category?.icon ?? 'grid')}
        color={isTransfer ? theme.info : categoryColor(category?.grp ?? 'other', theme)}
      />
      <View style={styles.middle}>
        <ThemedText type="bodyMedium" numberOfLines={1}>
          {title}
        </ThemedText>
        {subtitle ? (
          <ThemedText type="label" themeColor="textSecondary" numberOfLines={1}>
            {subtitle}
          </ThemedText>
        ) : null}
      </View>
      <Amount color={amountColor}>{amount}</Amount>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: Space.md, minHeight: Size.button },
  middle: { flex: 1, gap: 2 },
});

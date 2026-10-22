import { useSQLiteContext, type SQLiteDatabase } from 'expo-sqlite';
import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import {
  Amount,
  Button,
  Card,
  Icon,
  IconTile,
  Input,
  MonthSwitcher,
  ProgressBar,
  Screen,
  SectionHeader,
  SummaryCard,
  TextButton,
  withAlpha,
} from '@/components/ui';
import { Space } from '@/constants/theme';
import { budgetLines, setBudget, type BudgetLine } from '@/db/repo';
import { useFocusData } from '@/hooks/use-focus-data';
import { useTheme } from '@/hooks/use-theme';
import { usePrefs } from '@/i18n/prefs';
import {
  bsMonthOf,
  bsMonthRange,
  daysLeftInBsMonth,
  formatBsMonth,
  shiftBsMonth,
  toISODate,
} from '@/lib/dates';
import { haptic } from '@/lib/haptics';
import { categoryColor } from '@/lib/icons';
import { formatAmount, parseAmountInput, sanitizeAmountInput } from '@/lib/money';

const WARN_AT = 0.85;

export default function BudgetsScreen() {
  const db = useSQLiteContext();
  const theme = useTheme();
  const { t, money, num, lang, categoryName } = usePrefs();
  const today = toISODate(new Date());
  const [month, setMonth] = useState(() => bsMonthOf(today));
  const [editing, setEditing] = useState<{ categoryId: number; text: string } | null>(null);

  const load = useCallback((db: SQLiteDatabase) => budgetLines(db, month, bsMonthRange(month)), [month]);
  const [lines, reload] = useFocusData(load);

  async function saveLimit(amount: number | null) {
    if (!editing) return;
    await setBudget(db, editing.categoryId, month, amount);
    haptic.success();
    setEditing(null);
    reload();
  }

  const planned = lines?.filter((l) => l.limit !== null) ?? [];
  const unplanned = lines?.filter((l) => l.limit === null) ?? [];
  const totalLimit = planned.reduce((s, l) => s + (l.limit ?? 0), 0);
  const totalSpent = planned.reduce((s, l) => s + l.spent, 0);
  const current = bsMonthOf(today);
  const isCurrentMonth = current.year === month.year && current.month === month.month;
  const daysLeft = isCurrentMonth ? daysLeftInBsMonth(today) : null;
  const remaining = totalLimit - totalSpent;

  const startEditing = (line: BudgetLine) => {
    haptic.select();
    setEditing({ categoryId: line.category.id, text: line.limit ? formatAmount(line.limit, { symbol: false }) : '' });
  };

  const editorFor = (line: BudgetLine) =>
    editing?.categoryId === line.category.id ? (
      <View style={styles.editor}>
        <Input
          autoFocus
          keyboardType="decimal-pad"
          placeholder={t('budget.monthlyLimit')}
          accessibilityLabel={`${t('budget.monthlyLimit')}, ${categoryName(line.category)}`}
          value={editing.text}
          onChangeText={(text) => setEditing({ categoryId: line.category.id, text: sanitizeAmountInput(text) })}
          onSubmitEditing={() => saveLimit(parseAmountInput(editing.text))}
        />
        <View style={styles.editorActions}>
          {line.limit !== null && (
            <TextButton label={t('budget.remove')} color={theme.danger} onPress={() => saveLimit(null)} />
          )}
          <View style={styles.flex} />
          <TextButton label={t('settings.cancel')} color={theme.textSecondary} onPress={() => setEditing(null)} />
          <Button
            label={t('budget.save')}
            disabled={parseAmountInput(editing.text) === null}
            onPress={() => saveLimit(parseAmountInput(editing.text))}
          />
        </View>
      </View>
    ) : null;

  return (
    <Screen title={t('budget.title')}>
      <MonthSwitcher
        label={num(formatBsMonth(month, lang))}
        onPrev={() => setMonth((m) => shiftBsMonth(m, -1))}
        onNext={() => setMonth((m) => shiftBsMonth(m, 1))}
      />

      <SummaryCard>
        {planned.length === 0 ? (
          <View style={styles.rowCenter}>
            <Icon id="target" size={24} color={theme.goldSoft} />
            <ThemedText type="bodyLarge" style={[styles.flex, { color: theme.onSummary }]}>
              {t('budget.noBudgets')}
            </ThemedText>
          </View>
        ) : (
          <>
            <ThemedText type="label" style={{ color: theme.onSummaryMuted }}>
              {remaining >= 0 ? t('home.remaining') : t('budget.over')}
            </ThemedText>
            <Amount type="display" color={theme.onSummary}>
              {money(Math.abs(remaining))}
            </Amount>
            <ThemedText style={{ color: theme.onSummaryMuted }}>
              {money(totalSpent)} {t('budget.spentOf')} {money(totalLimit)}
            </ThemedText>
            <ProgressBar fraction={totalLimit ? totalSpent / totalLimit : 0} color={theme.onSummary} />
            {daysLeft !== null && remaining > 0 && (
              <ThemedText type="label" style={{ color: theme.onSummaryMuted }}>
                {money(Math.floor(remaining / daysLeft / 100) * 100)} {t('budget.dailyLeft')} ({num(daysLeft)}{' '}
                {t('budget.daysLeft')})
              </ThemedText>
            )}
          </>
        )}
      </SummaryCard>

      {planned.length > 0 && <SectionHeader title={t('budget.planned')} />}
      {planned.map((line) => {
        const { category, spent } = line;
        const limit = line.limit ?? 0;
        const fraction = limit ? spent / limit : 0;
        const over = spent > limit;
        const warn = !over && fraction >= WARN_AT;
        const status = over ? theme.danger : warn ? theme.warning : theme.brand;
        return (
          <Card key={category.id}>
            <Pressable
              accessibilityRole="button"
              accessibilityHint={t('budget.setLimit')}
              onPress={() => startEditing(line)}
              style={styles.rowCenter}>
              <IconTile icon={category.icon} color={categoryColor(category.grp, theme)} />
              <View style={styles.flex}>
                <ThemedText type="h4" numberOfLines={1}>
                  {categoryName(category)}
                </ThemedText>
                <ThemedText type="label" themeColor="textSecondary" style={styles.tabular}>
                  {money(spent)} / {money(limit)}
                </ThemedText>
              </View>
              <ThemedText type="bodyMedium" style={[styles.tabular, { color: over || warn ? status : theme.textSecondary }]}>
                {num(Math.round(fraction * 100))}%
              </ThemedText>
            </Pressable>
            <ProgressBar fraction={fraction} color={status} />
            <View style={styles.rowCenter}>
              {(over || warn) && <Icon id="warning" size={14} color={status} />}
              <ThemedText type="label" style={[styles.flex, { color: over || warn ? status : theme.textSecondary }]}>
                {over ? `${t('budget.over')} ${money(spent - limit)}` : `${money(limit - spent)} ${t('budget.left')}`}
              </ThemedText>
            </View>
            {editorFor(line)}
          </Card>
        );
      })}

      {unplanned.length > 0 && <SectionHeader title={t('budget.unplanned')} />}
      {unplanned.length > 0 && (
        <Card style={styles.unplanned}>
          {unplanned.map((line, i) => (
            <View
              key={line.category.id}
              style={i > 0 && [styles.separator, { borderTopColor: theme.border }]}>
              <Pressable
                accessibilityRole="button"
                onPress={() => startEditing(line)}
                style={[styles.rowCenter, styles.unplannedRow]}>
                <IconTile icon={line.category.icon} color={categoryColor(line.category.grp, theme)} size={36} />
                <View style={styles.flex}>
                  <ThemedText type="bodyMedium" numberOfLines={1}>
                    {categoryName(line.category)}
                  </ThemedText>
                  {line.spent > 0 && (
                    <ThemedText type="label" themeColor="textSecondary" style={styles.tabular}>
                      {money(line.spent)}
                    </ThemedText>
                  )}
                </View>
                <View style={[styles.setPill, { backgroundColor: withAlpha(theme.brand, 0.1) }]}>
                  <Icon id="plus" size={12} color={theme.brand} weight="semibold" />
                  <ThemedText type="label" style={{ color: theme.brand }}>
                    {t('budget.setLimit')}
                  </ThemedText>
                </View>
              </Pressable>
              {editorFor(line)}
            </View>
          ))}
        </Card>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  tabular: { fontVariant: ['tabular-nums'] },
  rowCenter: { flexDirection: 'row', alignItems: 'center', gap: Space.md },
  unplanned: { gap: 0, paddingVertical: Space.xs },
  unplannedRow: { minHeight: 56 },
  separator: { borderTopWidth: StyleSheet.hairlineWidth },
  setPill: { flexDirection: 'row', alignItems: 'center', gap: Space.xs, paddingHorizontal: Space.sm, paddingVertical: Space.xs, borderRadius: 8 },
  editor: { gap: Space.sm, paddingBottom: Space.md },
  editorActions: { flexDirection: 'row', alignItems: 'center', gap: Space.sm },
});

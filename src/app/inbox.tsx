import * as Clipboard from 'expo-clipboard';
import { router } from 'expo-router';
import { useSQLiteContext, type SQLiteDatabase } from 'expo-sqlite';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import {
  Amount,
  Button,
  Card,
  EmptyState,
  Icon,
  IconButton,
  Notice,
  Screen,
  SectionHeader,
  TextButton,
  UndoBar,
} from '@/components/ui';
import { Size, Space } from '@/constants/theme';
import {
  addInboxSms,
  listAccounts,
  listPendingSms,
  resolveInboxSms,
  type InboxSms,
} from '@/db/repo';
import { useFocusData } from '@/hooks/use-focus-data';
import { useTheme } from '@/hooks/use-theme';
import { usePrefs } from '@/i18n/prefs';
import { toISODate } from '@/lib/dates';
import { haptic } from '@/lib/haptics';
import { syncInboxReminder } from '@/lib/reminders';
import { parseBankSms } from '@/lib/sms';

const UNDO_MS = 5000;

async function loadInbox(db: SQLiteDatabase) {
  const [messages, accounts] = await Promise.all([listPendingSms(db), listAccounts(db)]);
  return messages.map((sms) => ({
    sms,
    parsed: parseBankSms(sms.body, {
      sender: sms.sender,
      receivedOn: toISODate(new Date(sms.received_at)),
      accounts,
    }),
  }));
}

/**
 * Every SMS the Shortcut forwards lands here. Ones with an amount are listed
 * for recording; the rest are folded away so personal messages stay out of sight.
 */
export default function InboxScreen() {
  const db = useSQLiteContext();
  const theme = useTheme();
  const { t, money, num, shortDate } = usePrefs();
  const [items, reload] = useFocusData(loadInbox);
  const [dismissed, setDismissed] = useState<InboxSms[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [showOthers, setShowOthers] = useState(false);

  useEffect(() => {
    if (dismissed.length === 0) return;
    const timer = setTimeout(() => setDismissed([]), UNDO_MS);
    return () => clearTimeout(timer);
  }, [dismissed]);

  const transactions = items?.filter((i) => i.parsed) ?? [];
  // Identical texts may be two real payments or one SMS forwarded twice; flag them for the user.
  const textCounts = new Map<string, number>();
  for (const { sms } of items ?? []) textCounts.set(sms.body, (textCounts.get(sms.body) ?? 0) + 1);
  const others = items?.filter((i) => !i.parsed).map((i) => i.sms) ?? [];

  async function paste() {
    const text = (await Clipboard.getStringAsync()).trim();
    if (!text) {
      haptic.warn();
      setMessage(t('inbox.pasteEmpty'));
      return;
    }
    if ((await addInboxSms(db, text, '', { skipIfPending: true })) === 'alreadyPending') {
      haptic.warn();
      setMessage(t('inbox.pasteDuplicate'));
      return;
    }
    haptic.success();
    setMessage(null);
    reload();
    syncInboxReminder(db, t);
  }

  async function dismiss(messages: InboxSms[]) {
    haptic.tap();
    for (const sms of messages) await resolveInboxSms(db, sms.id, { status: 'dismissed' });
    setDismissed(messages);
    reload();
    syncInboxReminder(db, t);
  }

  async function undoDismiss() {
    for (const sms of dismissed) await resolveInboxSms(db, sms.id, { status: 'pending' });
    haptic.success();
    setDismissed([]);
    reload();
    syncInboxReminder(db, t);
  }

  const record = (sms: InboxSms) => router.push({ pathname: '/add', params: { sms: String(sms.id) } });

  return (
    <Screen
      eyebrow={t('inbox.eyebrow')}
      title={t('inbox.title')}
      headerLeft={<IconButton icon="chevronLeft" label={t('add.close')} onPress={() => router.back()} />}
      headerRight={<TextButton label={t('inbox.paste')} onPress={paste} />}
      overlay={
        dismissed.length > 0 && (
          <UndoBar
            message={dismissed.length > 1 ? t('inbox.cleared') : t('inbox.dismissed')}
            actionLabel={t('txn.undo')}
            onAction={undoDismiss}
          />
        )
      }>
      {message && <Notice tone="info" message={message} />}

      {items && transactions.length === 0 && (
        <EmptyState icon="tray" title={t('inbox.emptyTitle')} subtitle={t('inbox.emptySubtitle')} />
      )}

      {transactions.map(({ sms, parsed }) => {
        if (!parsed) return null;
        const color =
          parsed.type === 'income' ? theme.income : parsed.type === 'expense' ? theme.expense : theme.info;
        const sign = parsed.type === 'income' ? '+' : parsed.type === 'expense' ? '−' : '';
        return (
          <Card key={sms.id}>
            <View style={styles.top}>
              <View style={styles.flex}>
                <Amount type="h3" color={color}>{`${sign}${money(parsed.amount)}`}</Amount>
                {parsed.note ? <ThemedText type="bodyMedium">{parsed.note}</ThemedText> : null}
              </View>
              <ThemedText type="label" themeColor="textSecondary">
                {shortDate(parsed.date)}
              </ThemedText>
            </View>
            <ThemedText type="caption" themeColor="textSecondary" numberOfLines={3}>
              {sms.sender ? `${sms.sender}: ` : ''}
              {sms.body}
            </ThemedText>
            {(textCounts.get(sms.body) ?? 0) > 1 && (
              <Notice tone="warning" message={t('inbox.sameText')} />
            )}
            <View style={styles.actions}>
              <TextButton label={t('inbox.dismiss')} color={theme.textSecondary} onPress={() => dismiss([sms])} />
              <View style={styles.flex}>
                <Button label={t('inbox.record')} icon="checkmark" onPress={() => record(sms)} />
              </View>
            </View>
          </Card>
        );
      })}

      {others.length > 0 && (
        <>
          <SectionHeader
            title={num(t('inbox.others').replace('{count}', String(others.length)))}
            action={{ label: t('inbox.clearOthers'), onPress: () => dismiss(others) }}
          />
          <Card>
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ expanded: showOthers }}
              onPress={() => {
                haptic.select();
                setShowOthers((v) => !v);
              }}
              style={styles.toggle}>
              <ThemedText type="label" themeColor="textSecondary" style={styles.flex}>
                {t('inbox.othersHint')}
              </ThemedText>
              <Icon id={showOthers ? 'chevronLeft' : 'chevronRight'} size={14} color={theme.textSecondary} />
            </Pressable>
            {showOthers &&
              others.map((sms) => (
                <View key={sms.id} style={[styles.other, { borderTopColor: theme.border }]}>
                  <ThemedText type="caption" numberOfLines={2} style={styles.flex}>
                    {sms.sender ? `${sms.sender}: ` : ''}
                    {sms.body}
                  </ThemedText>
                  <IconButton icon="plus" label={t('inbox.record')} color={theme.brand} onPress={() => record(sms)} />
                  <IconButton
                    icon="close"
                    label={t('inbox.dismiss')}
                    color={theme.textSecondary}
                    onPress={() => dismiss([sms])}
                  />
                </View>
              ))}
          </Card>
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  top: { flexDirection: 'row', alignItems: 'flex-start', gap: Space.md },
  actions: { flexDirection: 'row', alignItems: 'center', gap: Space.md },
  toggle: { flexDirection: 'row', alignItems: 'center', gap: Space.md, minHeight: Size.touch },
  other: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space.xs,
    paddingTop: Space.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
});

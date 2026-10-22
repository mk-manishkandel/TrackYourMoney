import * as Notifications from 'expo-notifications';
import type { SQLiteDatabase } from 'expo-sqlite';

import { countPendingSms, getSettings, listAccounts } from '@/db/repo';
import type { StringKey } from '@/i18n/strings';
import { reminderDay } from '@/lib/cards';

export const SMS_REMINDER_SETTING = 'sms_reminder';
const REMINDER_ID = 'sms-inbox-reminder';

/** Times offered in Settings, as "HH:MM"; "off" disables the reminder. */
export const REMINDER_TIMES = ['08:00', '12:00', '18:00', '20:00', '21:00'] as const;

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

/** Removes every scheduled reminder (SMS and card), e.g. after erasing all data. */
export async function cancelAllReminders() {
  await Notifications.cancelAllScheduledNotificationsAsync().catch(() => {});
}

export async function ensureNotificationPermission(): Promise<boolean> {
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  const requested = await Notifications.requestPermissionsAsync();
  return requested.granted;
}

/**
 * Keeps one daily reminder scheduled while SMS are waiting, with the current
 * count, and removes it once the inbox is empty. Call after the inbox changes.
 */
export async function syncInboxReminder(db: SQLiteDatabase, t: (key: StringKey) => string) {
  await scheduleInboxReminder(db, t).catch(() => {});
}

async function scheduleInboxReminder(db: SQLiteDatabase, t: (key: StringKey) => string) {
  const [settings, pending] = await Promise.all([getSettings(db), countPendingSms(db)]);
  await Notifications.cancelScheduledNotificationAsync(REMINDER_ID).catch(() => {});
  const time = settings[SMS_REMINDER_SETTING];
  if (!time || time === 'off' || pending === 0) return;

  const [hour, minute] = time.split(':').map(Number);
  await Notifications.scheduleNotificationAsync({
    identifier: REMINDER_ID,
    content: {
      title: t('inbox.reminderTitle'),
      body: t('inbox.reminderBody').replace('{count}', String(pending)),
      data: { url: '/inbox' },
    },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.DAILY, hour, minute },
  });
}

/**
 * One monthly reminder per credit card with a due day, three days before it.
 * Call after card details change.
 */
export async function syncCardReminders(db: SQLiteDatabase, t: (key: StringKey) => string) {
  await scheduleCardReminders(db, t).catch(() => {});
}

async function scheduleCardReminders(db: SQLiteDatabase, t: (key: StringKey) => string) {
  const accounts = await listAccounts(db);
  for (const card of accounts.filter((a) => a.kind === 'card')) {
    const id = `card-due-${card.id}`;
    await Notifications.cancelScheduledNotificationAsync(id).catch(() => {});
    if (card.due_day === null) continue;
    await Notifications.scheduleNotificationAsync({
      identifier: id,
      content: {
        title: t('card.reminderTitle').replace('{card}', card.name),
        body: t('card.reminderBody').replace('{card}', card.name).replace('{day}', String(card.due_day)),
        data: { url: `/cards/${card.id}` },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.MONTHLY,
        day: reminderDay(card.due_day),
        hour: 9,
        minute: 0,
      },
    });
  }
}

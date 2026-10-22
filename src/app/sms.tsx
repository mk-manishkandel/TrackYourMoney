import { router, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect } from 'react';

import { addInboxSms } from '@/db/repo';
import { usePrefs } from '@/i18n/prefs';
import { haptic } from '@/lib/haptics';
import { syncInboxReminder } from '@/lib/reminders';

/**
 * Entry point for the iOS Shortcut: hisab://sms?text=<message>&from=<sender>.
 * Queues the SMS, then returns to the one inbox screen instead of stacking a
 * new copy for every forwarded message.
 */
export default function SmsIntake() {
  const db = useSQLiteContext();
  const { t } = usePrefs();
  const { text, from } = useLocalSearchParams<{ text?: string; from?: string }>();

  useEffect(() => {
    // With no text (e.g. a test run from the Shortcuts editor) just show the list.
    const save = text?.trim()
      ? addInboxSms(db, text, from ?? '').then(() => syncInboxReminder(db, t))
      : Promise.resolve();
    save
      .catch(() => {})
      .finally(() => {
        if (text?.trim()) haptic.success();
        router.dismissTo('/inbox');
      });
    // Runs once per incoming link; `t` only labels the reminder.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [db, text, from]);

  return null;
}

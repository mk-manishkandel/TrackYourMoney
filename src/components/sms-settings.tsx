import DateTimePicker from '@react-native-community/datetimepicker';
import * as Clipboard from 'expo-clipboard';
import * as Linking from 'expo-linking';
import { router } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useState } from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Button, Card, Chip, ChipRow, Icon, Notice, SectionHeader } from '@/components/ui';
import { Radius, Size, Space } from '@/constants/theme';
import { getSettings, setSetting } from '@/db/repo';
import { useFocusData } from '@/hooks/use-focus-data';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useTheme } from '@/hooks/use-theme';
import { usePrefs } from '@/i18n/prefs';
import { haptic } from '@/lib/haptics';
import {
  ensureNotificationPermission,
  REMINDER_TIMES,
  SMS_REMINDER_SETTING,
  syncInboxReminder,
} from '@/lib/reminders';

const STEPS = ['sms.step1', 'sms.step2', 'sms.step3', 'sms.step4', 'sms.step5'] as const;

function formatTime(time: string): string {
  const [hour, minute] = time.split(':').map(Number);
  const suffix = hour < 12 ? 'AM' : 'PM';
  return `${hour % 12 || 12}:${String(minute).padStart(2, '0')} ${suffix}`;
}

function timeToDate(time: string): Date {
  const [hour, minute] = time.split(':').map(Number);
  const date = new Date();
  date.setHours(hour, minute, 0, 0);
  return date;
}

function dateToTime(date: Date): string {
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

/** Settings section for the SMS inbox: reminder time and iOS Shortcut setup. */
export function SmsSettings() {
  const db = useSQLiteContext();
  const theme = useTheme();
  const { t, num } = usePrefs();
  const [settings, reload] = useFocusData(getSettings);
  const [showSetup, setShowSetup] = useState(false);
  const [copied, setCopied] = useState(false);
  const [denied, setDenied] = useState(false);
  const [picking, setPicking] = useState(false);
  const [pickedTime, setPickedTime] = useState('20:00');
  const scheme = useColorScheme();

  // Expo Go yields exp://<computer>/--/sms; an installed build yields hisab://sms.
  const link = `${Linking.createURL('sms')}?text=`;
  const isDevLink = link.startsWith('exp');
  const reminder = settings?.[SMS_REMINDER_SETTING] ?? 'off';
  const isCustom = reminder !== 'off' && !(REMINDER_TIMES as readonly string[]).includes(reminder);

  function openPicker() {
    haptic.select();
    setPickedTime(reminder === 'off' ? '20:00' : reminder);
    setPicking((v) => !v);
  }

  async function chooseReminder(value: string) {
    haptic.select();
    setDenied(false);
    setPicking(false);
    if (value !== 'off' && !(await ensureNotificationPermission())) {
      setDenied(true);
      return;
    }
    await setSetting(db, SMS_REMINDER_SETTING, value);
    reload();
    await syncInboxReminder(db, t);
  }

  async function copyLink() {
    await Clipboard.setStringAsync(link);
    haptic.success();
    setCopied(true);
  }

  return (
    <>
      <SectionHeader title={t('sms.title')} />
      <Card>
        <View style={styles.header}>
          <Icon id="tray" size={18} color={theme.textSecondary} />
          <View style={styles.flex}>
            <ThemedText type="bodyMedium">{t('sms.reminder')}</ThemedText>
            <ThemedText type="label" themeColor="textSecondary">
              {t('sms.reminderHint')}
            </ThemedText>
          </View>
        </View>
        <ChipRow>
          {['off', ...REMINDER_TIMES].map((value) => (
            <Chip
              key={value}
              label={value === 'off' ? t('sms.off') : num(formatTime(value))}
              selected={reminder === value}
              onPress={() => chooseReminder(value)}
            />
          ))}
          <Chip
            label={isCustom ? num(formatTime(reminder)) : t('sms.custom')}
            icon="pencil"
            selected={isCustom || picking}
            onPress={openPicker}
          />
        </ChipRow>
        {picking && Platform.OS === 'ios' && (
          <View style={styles.picker}>
            <DateTimePicker
              mode="time"
              display="spinner"
              value={timeToDate(pickedTime)}
              onValueChange={(_event, date) => setPickedTime(dateToTime(date))}
              themeVariant={scheme === 'dark' ? 'dark' : 'light'}
              accentColor={theme.brand}
            />
            <Button
              label={t('sms.setTime').replace('{time}', num(formatTime(pickedTime)))}
              icon="checkmark"
              onPress={() => chooseReminder(pickedTime)}
            />
          </View>
        )}
        {picking && Platform.OS !== 'ios' && (
          // Android shows the picker as a dialog; picking a time saves it straight away.
          <DateTimePicker
            mode="time"
            value={timeToDate(pickedTime)}
            onValueChange={(_event, date) => chooseReminder(dateToTime(date))}
            onDismiss={() => setPicking(false)}
          />
        )}
        {denied && <Notice tone="warning" message={t('sms.permission')} />}

        <Pressable
          accessibilityRole="button"
          onPress={() => {
            haptic.select();
            router.push('/inbox');
          }}
          style={({ pressed }) => [styles.setupRow, { borderTopColor: theme.border }, pressed && { opacity: 0.6 }]}>
          <ThemedText type="bodyMedium" style={[styles.flex, { color: theme.brand }]}>
            {t('sms.open')}
          </ThemedText>
          <Icon id="chevronRight" size={14} color={theme.textSecondary} />
        </Pressable>

        <Pressable
          accessibilityRole="button"
          accessibilityState={{ expanded: showSetup }}
          onPress={() => {
            haptic.select();
            setShowSetup((v) => !v);
          }}
          style={({ pressed }) => [styles.setupRow, { borderTopColor: theme.border }, pressed && { opacity: 0.6 }]}>
          <ThemedText type="bodyMedium" style={[styles.flex, { color: theme.brand }]}>
            {t('sms.setup')}
          </ThemedText>
          <Icon id={showSetup ? 'chevronLeft' : 'chevronRight'} size={14} color={theme.textSecondary} />
        </Pressable>

        {showSetup && (
          <View style={styles.setup}>
            {STEPS.map((key, i) => (
              <View key={key} style={styles.step}>
                <ThemedText type="bodyMedium" style={[styles.stepNumber, { color: theme.brand }]}>
                  {num(String(i + 1))}
                </ThemedText>
                <ThemedText style={styles.flex}>{t(key)}</ThemedText>
              </View>
            ))}
            <View style={[styles.link, { backgroundColor: theme.inputBackground }]}>
              <ThemedText type="caption" selectable>
                {link}
              </ThemedText>
            </View>
            {isDevLink && <Notice tone="info" message={t('sms.expoGoNote')} />}
            <Button
              label={copied ? t('sms.copied') : t('sms.copyLink')}
              icon={copied ? 'checkmark' : undefined}
              variant="secondary"
              onPress={copyLink}
            />
          </View>
        )}
      </Card>
    </>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', gap: Space.md },
  setupRow: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: Size.touch,
    paddingTop: Space.md,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  setup: { gap: Space.md },
  picker: { gap: Space.sm, alignItems: 'stretch' },
  step: { flexDirection: 'row', gap: Space.md },
  stepNumber: { width: 18 },
  link: { padding: Space.md, borderRadius: Radius.control, borderCurve: 'continuous' },
});

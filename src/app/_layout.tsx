// Per-weight imports so only the four weights in the type scale are bundled.
import { Inter_400Regular } from '@expo-google-fonts/inter/400Regular';
import { Inter_500Medium } from '@expo-google-fonts/inter/500Medium';
import { Inter_600SemiBold } from '@expo-google-fonts/inter/600SemiBold';
import { Inter_700Bold } from '@expo-google-fonts/inter/700Bold';
import { useFonts } from 'expo-font';
import * as Notifications from 'expo-notifications';
import { DarkTheme, DefaultTheme, router, Stack, ThemeProvider, type Href } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { SQLiteProvider } from 'expo-sqlite';
import { useEffect } from 'react';
import { useColorScheme } from 'react-native';

import { Colors } from '@/constants/theme';
import { migrateDbIfNeeded } from '@/db/migrations';
import { PrefsProvider } from '@/i18n/prefs';
// Registers the notification handler so reminders show while the app is open.
import '@/lib/reminders';

SplashScreen.preventAutoHideAsync();

export const unstable_settings = { anchor: '(tabs)' };

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme === 'dark' ? 'dark' : 'light'];
  const [fontsLoaded, fontError] = useFonts({ Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold });
  const ready = fontsLoaded || fontError != null;
  const notificationResponse = Notifications.useLastNotificationResponse();

  // Tapping a reminder opens the screen it points at (the SMS inbox or a card).
  useEffect(() => {
    const url = notificationResponse?.notification.request.content.data?.url;
    if (
      ready &&
      typeof url === 'string' &&
      url.startsWith('/') &&
      notificationResponse?.actionIdentifier === Notifications.DEFAULT_ACTION_IDENTIFIER
    ) {
      router.push(url as Href);
      Notifications.clearLastNotificationResponse();
    }
  }, [ready, notificationResponse]);

  useEffect(() => {
    if (ready) SplashScreen.hideAsync();
  }, [ready]);

  if (!ready) return null;

  const navigationTheme = colorScheme === 'dark' ? DarkTheme : DefaultTheme;
  return (
    <SQLiteProvider databaseName="hisab.db" onInit={migrateDbIfNeeded}>
      <PrefsProvider>
        <ThemeProvider
          value={{
            ...navigationTheme,
            colors: {
              ...navigationTheme.colors,
              primary: colors.brand,
              background: colors.background,
              card: colors.surface,
              text: colors.text,
              border: colors.border,
            },
          }}>
          <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }}>
            <Stack.Screen name="(tabs)" />
            <Stack.Screen name="inbox" />
            <Stack.Screen name="sms" options={{ animation: 'none' }} />
            <Stack.Screen name="loans" />
            <Stack.Screen name="loans/[id]" />
            <Stack.Screen name="cards/[id]" />
            {/* Entry forms are pushed like other pages, not shown as sheets: iOS grows a sheet when the
                keyboard opens (which looks like a zoom), and a pushed page can be swiped back. The swipe
                works from anywhere on the page, not just the edge. */}
            <Stack.Screen name="loans/new" options={{ fullScreenGestureEnabled: true }} />
            <Stack.Screen name="add" options={{ fullScreenGestureEnabled: true }} />
          </Stack>
        </ThemeProvider>
      </PrefsProvider>
    </SQLiteProvider>
  );
}

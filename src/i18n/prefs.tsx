import { getLocales } from 'expo-localization';
import { useSQLiteContext } from 'expo-sqlite';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Appearance } from 'react-native';

import { getSettings, setSetting, type Category } from '@/db/repo';
import { formatDate, formatDateShort, type Calendar, type Lang } from '@/lib/dates';
import { formatAmount, toDevanagariDigits, type Numerals } from '@/lib/money';
import { STRINGS, type StringKey } from '@/i18n/strings';

export type ThemeMode = 'system' | 'light' | 'dark';

type Prefs = {
  lang: Lang;
  calendar: Calendar;
  numerals: Numerals;
  theme: ThemeMode;
  /** Balance privacy: masks every amount shown in the app. */
  hideAmounts: 'on' | 'off';
};

type PrefsContextValue = Prefs & {
  setPref: <K extends keyof Prefs>(key: K, value: Prefs[K]) => void;
  t: (key: StringKey) => string;
  money: (paisa: number) => string;
  date: (iso: string) => string;
  shortDate: (iso: string) => string;
  num: (text: string | number) => string;
  categoryName: (category: Pick<Category, 'key' | 'name'>) => string;
};

const PrefsContext = createContext<PrefsContextValue | null>(null);

function defaultPrefs(): Prefs {
  const lang: Lang = getLocales()[0]?.languageCode === 'ne' ? 'ne' : 'en';
  return {
    lang,
    calendar: 'BS',
    numerals: lang === 'ne' ? 'devanagari' : 'latin',
    theme: 'system',
    hideAmounts: 'off',
  };
}

export function PrefsProvider({ children }: { children: ReactNode }) {
  const db = useSQLiteContext();
  const [prefs, setPrefs] = useState<Prefs>(defaultPrefs);

  useEffect(() => {
    getSettings(db).then((stored) => setPrefs((p) => ({ ...p, ...(stored as Partial<Prefs>) })));
  }, [db]);

  useEffect(() => {
    Appearance.setColorScheme(prefs.theme === 'system' ? 'unspecified' : prefs.theme);
  }, [prefs.theme]);

  const setPref = useCallback(
    <K extends keyof Prefs>(key: K, value: Prefs[K]) => {
      setPrefs((p) => ({ ...p, [key]: value }));
      setSetting(db, key, value);
    },
    [db]
  );

  const value = useMemo<PrefsContextValue>(() => {
    const t = (key: StringKey) => STRINGS[prefs.lang][key];
    const symbol = prefs.numerals === 'devanagari' ? 'रु' : 'Rs';
    return {
      ...prefs,
      setPref,
      t,
      money: (paisa) =>
        prefs.hideAmounts === 'on' ? `${symbol} ••••` : formatAmount(paisa, { numerals: prefs.numerals }),
      date: (iso) => formatDate(iso, prefs),
      shortDate: (iso) => formatDateShort(iso, prefs),
      num: (text) => (prefs.numerals === 'devanagari' ? toDevanagariDigits(String(text)) : String(text)),
      categoryName: (c) => (c.key ? (t(`cat.${c.key}` as StringKey) ?? c.name) : c.name),
    };
  }, [prefs, setPref]);

  return <PrefsContext.Provider value={value}>{children}</PrefsContext.Provider>;
}

export function usePrefs(): PrefsContextValue {
  const value = useContext(PrefsContext);
  if (!value) throw new Error('usePrefs must be used inside PrefsProvider');
  return value;
}

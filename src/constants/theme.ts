/**
 * Design tokens from docs/design-system.md (Midnight Emerald + Champagne Gold).
 * Screens must use these tokens instead of hard-coded values.
 */

import '@/global.css';

import { Platform } from 'react-native';

export const Colors = {
  light: {
    background: '#F6F3EB',
    surface: '#FFFFFF',
    surfaceElevated: '#F0EDE4',
    text: '#17231D',
    textSecondary: '#657168',
    brand: '#176B50',
    brandPressed: '#10533E',
    onBrand: '#FFFFFF',
    gold: '#8D6A2F',
    goldSoft: '#D6B879',
    border: '#E3E0D6',
    inputBackground: '#F0EDE4',
    overlay: 'rgba(23, 35, 29, 0.4)',
    /** Deep green summary/balance card and the text on it. */
    summary: '#10533E',
    onSummary: '#F6F3EB',
    onSummaryMuted: 'rgba(246, 243, 235, 0.72)',

    income: '#16805D',
    expense: '#C84B50',
    savings: '#176B50',
    warning: '#A66A12',
    danger: '#B42332',
    info: '#4569B0',
    disabled: '#A8AEA9',

    catEssentials: '#176B50',
    catLifestyle: '#8D6A2F',
    catTransport: '#6486A4',
    catSubscriptions: '#8B78B8',
    catOther: '#657168',
    catIncome: '#16805D',

    shadow: '0px 1px 2px rgba(23, 35, 29, 0.04)',
  },
  dark: {
    background: '#0B1513',
    surface: '#15211D',
    surfaceElevated: '#202B27',
    text: '#F3F5F1',
    textSecondary: '#AAB8B0',
    brand: '#65C49A',
    brandPressed: '#8BD6B0',
    onBrand: '#0B1513',
    gold: '#D6B879',
    goldSoft: '#D6B879',
    border: '#304039',
    inputBackground: '#202B27',
    overlay: 'rgba(0, 0, 0, 0.55)',
    summary: '#173B2F',
    onSummary: '#F3F5F1',
    onSummaryMuted: 'rgba(243, 245, 241, 0.7)',

    income: '#65C49A',
    expense: '#F08080',
    savings: '#65C49A',
    warning: '#E9B765',
    danger: '#FF858B',
    info: '#91B5FF',
    disabled: '#68766E',

    catEssentials: '#65C49A',
    catLifestyle: '#D6B879',
    catTransport: '#6486A4',
    catSubscriptions: '#8B78B8',
    catOther: '#A7B4AC',
    catIncome: '#65C49A',

    shadow: '0px 0px 0px rgba(0, 0, 0, 0)',
  },
} as const;

export type ThemeColors = { [K in keyof typeof Colors.light]: string };
export type ThemeColor = keyof ThemeColors;

/** Inter family names per weight; custom fonts need an explicit family on Android. */
export const FontFamily = {
  regular: 'Inter_400Regular',
  medium: 'Inter_500Medium',
  semibold: 'Inter_600SemiBold',
  bold: 'Inter_700Bold',
} as const;

/** Type scale (size / line height / family) from the design system. */
export const Type = {
  display: { fontSize: 32, lineHeight: 40, fontFamily: FontFamily.bold },
  h1: { fontSize: 28, lineHeight: 36, fontFamily: FontFamily.semibold },
  h2: { fontSize: 22, lineHeight: 30, fontFamily: FontFamily.semibold },
  h3: { fontSize: 18, lineHeight: 26, fontFamily: FontFamily.semibold },
  h4: { fontSize: 16, lineHeight: 24, fontFamily: FontFamily.semibold },
  bodyLarge: { fontSize: 16, lineHeight: 24, fontFamily: FontFamily.regular },
  body: { fontSize: 14, lineHeight: 20, fontFamily: FontFamily.regular },
  bodyMedium: { fontSize: 14, lineHeight: 20, fontFamily: FontFamily.medium },
  label: { fontSize: 12, lineHeight: 16, fontFamily: FontFamily.medium },
  caption: { fontSize: 11, lineHeight: 16, fontFamily: FontFamily.regular },
  button: { fontSize: 16, lineHeight: 22, fontFamily: FontFamily.semibold },
} as const;

export type TypeVariant = keyof typeof Type;

export const Fonts = Platform.select({
  ios: { mono: 'ui-monospace' },
  default: { mono: 'monospace' },
  web: { mono: 'var(--font-mono)' },
});

/** 4px scale: 4, 8, 12, 16, 20, 24, 32, 40. */
export const Space = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
  huge: 40,
} as const;

export const Radius = {
  control: 12,
  card: 16,
  summary: 20,
  pill: 999,
} as const;

export const Size = {
  touch: 44,
  input: 50,
  button: 52,
  progress: 8,
} as const;

/** Subtle transitions only (150–220 ms). */
export const Motion = { duration: 200 } as const;

export const ScreenPadding = Space.xl;
export const BottomTabInset = Platform.select({ ios: 40, android: 80 }) ?? 0;
export const MaxContentWidth = 800;

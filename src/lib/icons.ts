import type { AndroidSymbol, SFSymbol } from 'expo-symbols';

import type { ThemeColor, ThemeColors } from '@/constants/theme';
import type { CategoryGroup } from '@/lib/categories';

export type IconSpec = { ios: SFSymbol; android: AndroidSymbol };

/** Icons are stored by id in the database so iOS and Android can each use their native set. */
export const ICONS = {
  food: { ios: 'fork.knife', android: 'restaurant' },
  cart: { ios: 'cart.fill', android: 'shopping_cart' },
  bus: { ios: 'bus.fill', android: 'directions_bus' },
  house: { ios: 'house.fill', android: 'home' },
  bolt: { ios: 'bolt.fill', android: 'bolt' },
  wifi: { ios: 'wifi', android: 'wifi' },
  school: { ios: 'graduationcap.fill', android: 'school' },
  health: { ios: 'cross.case.fill', android: 'medical_services' },
  bag: { ios: 'bag.fill', android: 'shopping_bag' },
  film: { ios: 'film.fill', android: 'movie' },
  gift: { ios: 'gift.fill', android: 'redeem' },
  family: { ios: 'figure.2.and.child.holdinghands', android: 'family_restroom' },
  bank: { ios: 'building.columns.fill', android: 'account_balance' },
  grid: { ios: 'square.grid.2x2.fill', android: 'category' },
  briefcase: { ios: 'briefcase.fill', android: 'work' },
  plane: { ios: 'airplane', android: 'flight' },
  store: { ios: 'storefront.fill', android: 'storefront' },
  cash: { ios: 'banknote.fill', android: 'payments' },
  transfer: { ios: 'arrow.left.arrow.right', android: 'swap_horiz' },
  wallet: { ios: 'wallet.pass.fill', android: 'account_balance_wallet' },
  card: { ios: 'creditcard.fill', android: 'credit_card' },
  sparkles: { ios: 'sparkles', android: 'auto_awesome' },
  plus: { ios: 'plus', android: 'add' },
  arrowUp: { ios: 'arrow.up.right', android: 'north_east' },
  arrowDown: { ios: 'arrow.down.left', android: 'south_west' },
  chevronLeft: { ios: 'chevron.left', android: 'chevron_left' },
  chevronRight: { ios: 'chevron.right', android: 'chevron_right' },
  calendar: { ios: 'calendar', android: 'calendar_month' },
  globe: { ios: 'globe', android: 'language' },
  number: { ios: 'textformat.123', android: 'pin' },
  lock: { ios: 'lock.shield.fill', android: 'shield_lock' },
  tray: { ios: 'tray', android: 'inbox' },
  checkmark: { ios: 'checkmark', android: 'check' },
  pencil: { ios: 'pencil', android: 'edit' },
  pin: { ios: 'pin.fill', android: 'push_pin' },
  target: { ios: 'target', android: 'track_changes' },
  send: { ios: 'arrow.up', android: 'arrow_upward' },
  eye: { ios: 'eye', android: 'visibility' },
  eyeSlash: { ios: 'eye.slash', android: 'visibility_off' },
  gear: { ios: 'gearshape', android: 'settings' },
  close: { ios: 'xmark', android: 'close' },
  trash: { ios: 'trash', android: 'delete' },
  search: { ios: 'magnifyingglass', android: 'search' },
  undo: { ios: 'arrow.uturn.backward', android: 'undo' },
  theme: { ios: 'circle.lefthalf.filled', android: 'contrast' },
  warning: { ios: 'exclamationmark.triangle.fill', android: 'warning' },
} satisfies Record<string, IconSpec>;

export type IconId = keyof typeof ICONS;

export function iconFor(id: string): IconSpec {
  return ICONS[id as IconId] ?? ICONS.grid;
}

export const ACCOUNT_KIND_ICON: Record<'cash' | 'wallet' | 'bank' | 'card', IconId> = {
  cash: 'cash',
  wallet: 'wallet',
  bank: 'bank',
  card: 'card',
};

/** Theme tokens, so account colors follow light/dark mode. */
export const ACCOUNT_KIND_COLOR: Record<'cash' | 'wallet' | 'bank' | 'card', ThemeColor> = {
  cash: 'catEssentials',
  wallet: 'catSubscriptions',
  bank: 'catTransport',
  card: 'gold',
};

const GROUP_COLOR: Record<CategoryGroup, ThemeColor> = {
  essentials: 'catEssentials',
  lifestyle: 'catLifestyle',
  transport: 'catTransport',
  subscriptions: 'catSubscriptions',
  other: 'catOther',
  income: 'catIncome',
};

/** A category's color from the design-system palette, for the active theme. */
export function categoryColor(grp: string, theme: ThemeColors): string {
  return theme[GROUP_COLOR[grp as CategoryGroup] ?? 'catOther'];
}

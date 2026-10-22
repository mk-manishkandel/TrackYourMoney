/**
 * Shared components implementing docs/design-system.md. Screens compose these
 * rather than styling raw views, so tokens stay consistent.
 */
import { SymbolView, type SymbolWeight } from 'expo-symbols';
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type ViewProps,
  type ViewStyle,
} from 'react-native';
import Animated, { FadeInDown, FadeOutDown, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import {
  BottomTabInset,
  MaxContentWidth,
  Motion,
  Radius,
  ScreenPadding,
  Size,
  Space,
  Type,
  type TypeVariant,
} from '@/constants/theme';
import { useKeyboardVisible } from '@/hooks/use-keyboard-visible';
import { useTheme } from '@/hooks/use-theme';
import { haptic } from '@/lib/haptics';
import { iconFor, type IconId } from '@/lib/icons';

/** Appends an alpha channel to a #RRGGBB color. */
export function withAlpha(hex: string, alpha: number): string {
  return hex + Math.round(alpha * 255).toString(16).padStart(2, '0');
}

export function Icon({
  id,
  size = 20,
  color,
  weight = 'medium',
}: {
  id: IconId | string;
  size?: number;
  color: string;
  weight?: SymbolWeight;
}) {
  return <SymbolView name={iconFor(id)} size={size} tintColor={color} weight={weight} />;
}

/** Category/account symbol on a soft tint of its palette color. */
export function IconTile({ icon, color, size = 40 }: { icon: string; color: string; size?: number }) {
  return (
    <View
      style={[
        styles.tile,
        { width: size, height: size, borderRadius: Radius.control, backgroundColor: withAlpha(color, 0.12) },
      ]}>
      <Icon id={icon} size={size * 0.46} color={color} />
    </View>
  );
}

/**
 * Space at the bottom of the screen hidden behind the tab bar. Measured, because
 * whether tab content draws under the bar depends on the iOS version.
 */
const TabClearance = createContext(0);

export function Screen({
  title,
  eyebrow,
  headerLeft,
  headerRight,
  overlay,
  children,
}: {
  title: string;
  eyebrow?: string;
  headerLeft?: ReactNode;
  headerRight?: ReactNode;
  overlay?: ReactNode;
  children: ReactNode;
}) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const root = useRef<View>(null);
  const [extendsUnderTabBar, setExtendsUnderTabBar] = useState(true);
  const clearance = extendsUnderTabBar ? BottomTabInset + insets.bottom : 0;
  // The keyboard covers the tab bar and FAB, so iOS's keyboard inset replaces that clearance.
  const keyboardVisible = useKeyboardVisible();
  const bottomPadding = keyboardVisible ? Space.lg : floatingBottom(clearance) + FAB_SIZE + Space.lg;
  return (
    <TabClearance.Provider value={clearance}>
    <View
      ref={root}
      onLayout={() =>
        root.current?.measureInWindow((_x, y, _w, height) =>
          setExtendsUnderTabBar(y + height >= Dimensions.get('window').height - 1)
        )
      }
      style={[styles.screen, { backgroundColor: theme.background }]}>
      <SafeAreaView edges={['top']} style={styles.safeArea}>
        <ScrollView
          contentContainerStyle={[styles.scroll, { paddingBottom: bottomPadding }]}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
          automaticallyAdjustKeyboardInsets
          showsVerticalScrollIndicator={false}>
          <View style={styles.header}>
            {headerLeft}
            <View style={styles.flex}>
              {eyebrow ? (
                <ThemedText type="label" themeColor="textSecondary">
                  {eyebrow}
                </ThemedText>
              ) : null}
              <ThemedText type="h1" accessibilityRole="header">
                {title}
              </ThemedText>
            </View>
            {headerRight}
          </View>
          {children}
        </ScrollView>
        {overlay}
      </SafeAreaView>
    </View>
    </TabClearance.Provider>
  );
}

export function Card({ style, ...rest }: ViewProps) {
  const theme = useTheme();
  return (
    <View
      style={[
        styles.card,
        { backgroundColor: theme.surface, borderColor: theme.border, boxShadow: theme.shadow },
        style,
      ]}
      {...rest}
    />
  );
}

/** Deep green balance/summary surface. */
export function SummaryCard({ style, ...rest }: ViewProps) {
  const theme = useTheme();
  return <View style={[styles.summary, { backgroundColor: theme.summary }, style]} {...rest} />;
}

export function SectionHeader({ title, action }: { title: string; action?: { label: string; onPress: () => void } }) {
  return (
    <View style={styles.sectionHeader}>
      <ThemedText type="h3" accessibilityRole="header" style={styles.flex}>
        {title}
      </ThemedText>
      {action && <TextButton label={action.label} onPress={action.onPress} />}
    </View>
  );
}

/** Financial figure: Inter with tabular numerals so digits never shift. */
export function Amount({
  children,
  type = 'h4',
  color,
  accessibilityLabel,
}: {
  children: string;
  type?: TypeVariant;
  color?: string;
  accessibilityLabel?: string;
}) {
  return (
    <ThemedText
      type={type}
      numberOfLines={1}
      accessibilityLabel={accessibilityLabel}
      style={[styles.tabular, color ? { color } : null]}>
      {children}
    </ThemedText>
  );
}

export function Segmented<T extends string>({
  options,
  value,
  onChange,
  accessibilityLabel,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
  accessibilityLabel?: string;
}) {
  const theme = useTheme();
  return (
    <View
      accessibilityRole="radiogroup"
      accessibilityLabel={accessibilityLabel}
      style={[styles.segmented, { backgroundColor: theme.surfaceElevated }]}>
      {options.map((o) => {
        const selected = o.value === value;
        return (
          <Pressable
            key={o.value}
            accessibilityRole="radio"
            accessibilityState={{ checked: selected }}
            onPress={() => {
              if (!selected) haptic.select();
              onChange(o.value);
            }}
            // Flat selection: a soft brand tint, no border or shadow (a light rim read as a glow in dark mode).
            style={[styles.segment, selected && { backgroundColor: withAlpha(theme.brand, 0.16) }]}>
            <ThemedText
              type={selected ? 'h4' : 'bodyMedium'}
              style={[styles.segmentLabel, { color: selected ? theme.brand : theme.textSecondary }]}>
              {o.label}
            </ThemedText>
          </Pressable>
        );
      })}
    </View>
  );
}

export function Chip({
  label,
  icon,
  selected,
  onPress,
}: {
  label: string;
  icon?: string;
  selected: boolean;
  onPress: () => void;
}) {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={() => {
        haptic.select();
        onPress();
      }}
      style={({ pressed }) => [
        styles.chip,
        {
          backgroundColor: selected ? withAlpha(theme.brand, 0.12) : theme.surface,
          borderColor: selected ? theme.brand : theme.border,
        },
        pressed && { opacity: 0.7 },
      ]}>
      {icon && <Icon id={icon} size={16} color={selected ? theme.brand : theme.textSecondary} />}
      <ThemedText type="bodyMedium" style={{ color: selected ? theme.brand : theme.text }}>
        {label}
      </ThemedText>
      {selected && <Icon id="checkmark" size={13} color={theme.brand} weight="semibold" />}
    </Pressable>
  );
}

export function ChipRow({ children }: { children: ReactNode }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
      {children}
    </ScrollView>
  );
}

export function Button({
  label,
  icon,
  onPress,
  variant = 'primary',
  disabled,
  loading,
}: {
  label: string;
  icon?: IconId;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'destructive';
  disabled?: boolean;
  loading?: boolean;
}) {
  const theme = useTheme();
  const inactive = disabled || loading;
  const fg = inactive
    ? variant === 'primary' ? theme.onBrand : theme.disabled
    : variant === 'primary' ? theme.onBrand : variant === 'destructive' ? theme.danger : theme.text;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: inactive, busy: loading }}
      disabled={inactive}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        variant === 'primary'
          ? { backgroundColor: inactive ? theme.disabled : pressed ? theme.brandPressed : theme.brand }
          : {
              backgroundColor: pressed ? theme.surfaceElevated : 'transparent',
              borderWidth: 1,
              borderColor: variant === 'destructive' ? theme.danger : theme.border,
            },
      ]}>
      {loading ? (
        <ActivityIndicator color={fg} />
      ) : (
        <>
          {icon && <Icon id={icon} size={18} color={fg} weight="semibold" />}
          <ThemedText type="button" style={{ color: fg }}>
            {label}
          </ThemedText>
        </>
      )}
    </Pressable>
  );
}

export function TextButton({ label, onPress, color }: { label: string; onPress: () => void; color?: string }) {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.textButton, pressed && { opacity: 0.6 }]}>
      <ThemedText type="button" style={{ color: color ?? theme.brand, fontSize: 15 }}>
        {label}
      </ThemedText>
    </Pressable>
  );
}

export function IconButton({
  icon,
  label,
  onPress,
  color,
}: {
  icon: IconId;
  label: string;
  onPress: () => void;
  color?: string;
}) {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={() => {
        haptic.select();
        onPress();
      }}
      style={({ pressed }) => [styles.iconButton, pressed && { backgroundColor: theme.surfaceElevated }]}>
      <Icon id={icon} size={20} color={color ?? theme.text} />
    </Pressable>
  );
}

export function Input({ style, onFocus, onBlur, ...rest }: TextInputProps) {
  const theme = useTheme();
  const [focused, setFocused] = useState(false);
  return (
    <TextInput
      placeholderTextColor={theme.textSecondary}
      onFocus={(e) => {
        setFocused(true);
        onFocus?.(e);
      }}
      onBlur={(e) => {
        setFocused(false);
        onBlur?.(e);
      }}
      style={[
        styles.input,
        {
          color: theme.text,
          backgroundColor: theme.inputBackground,
          borderColor: focused ? theme.brand : theme.border,
        },
        style,
      ]}
      {...rest}
    />
  );
}

export function ProgressBar({ fraction, color }: { fraction: number; color: string }) {
  const theme = useTheme();
  const width = useSharedValue(0);
  useEffect(() => {
    width.value = withTiming(Math.max(0, Math.min(fraction, 1)), { duration: Motion.duration });
  }, [fraction, width]);
  const fill = useAnimatedStyle(() => ({ width: `${width.value * 100}%` }));
  return (
    <View
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: 100, now: Math.round(Math.min(fraction, 1) * 100) }}
      style={[styles.track, { backgroundColor: theme.surfaceElevated }]}>
      <Animated.View style={[styles.fill, { backgroundColor: color }, fill]} />
    </View>
  );
}

export function EmptyState({ icon, title, subtitle }: { icon: IconId; title: string; subtitle?: string }) {
  const theme = useTheme();
  return (
    <View style={styles.empty}>
      <IconTile icon={icon} color={theme.brand} size={52} />
      <ThemedText type="h4">{title}</ThemedText>
      {subtitle && (
        <ThemedText themeColor="textSecondary" style={styles.center}>
          {subtitle}
        </ThemedText>
      )}
    </View>
  );
}

/** Inline message that pairs semantic color with an icon, never color alone. */
export function Notice({ tone, message }: { tone: 'danger' | 'warning' | 'info'; message: string }) {
  const theme = useTheme();
  const color = theme[tone];
  return (
    <View accessibilityRole="alert" style={[styles.notice, { backgroundColor: withAlpha(color, 0.1) }]}>
      <Icon id={tone === 'info' ? 'sparkles' : 'warning'} size={16} color={color} />
      <ThemedText type="bodyMedium" style={[styles.flex, { color }]}>
        {message}
      </ThemedText>
    </View>
  );
}

export function MonthSwitcher({ label, onPrev, onNext }: { label: string; onPrev: () => void; onNext: () => void }) {
  const theme = useTheme();
  return (
    <View style={[styles.monthSwitcher, { backgroundColor: theme.surface, borderColor: theme.border }]}>
      <IconButton icon="chevronLeft" label="Previous month" onPress={onPrev} />
      <ThemedText type="h4" style={styles.monthLabel}>
        {label}
      </ThemedText>
      <IconButton icon="chevronRight" label="Next month" onPress={onNext} />
    </View>
  );
}

const FAB_SIZE = 56;

/** Floating controls sit 10px above the tab bar. */
function floatingBottom(tabClearance: number) {
  return tabClearance + 10;
}

export function Fab({ onPress, accessibilityLabel }: { onPress: () => void; accessibilityLabel: string }) {
  const theme = useTheme();
  const clearance = useContext(TabClearance);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={() => {
        haptic.tap();
        onPress();
      }}
      style={({ pressed }) => [
        styles.fab,
        {
          bottom: floatingBottom(clearance), backgroundColor: pressed ? theme.brandPressed : theme.brand, boxShadow: '0px 4px 12px rgba(11, 21, 19, 0.18)' },
      ]}>
      <Icon id="plus" size={24} color={theme.onBrand} weight="semibold" />
    </Pressable>
  );
}

/** Bottom snackbar with an action, e.g. "Transaction deleted · Undo". */
export function UndoBar({
  message,
  actionLabel,
  onAction,
  style,
}: {
  message: string;
  actionLabel: string;
  onAction: () => void;
  style?: StyleProp<ViewStyle>;
}) {
  const theme = useTheme();
  const clearance = useContext(TabClearance);
  return (
    <Animated.View
      entering={FadeInDown.duration(Motion.duration)}
      exiting={FadeOutDown.duration(Motion.duration)}
      accessibilityLiveRegion="polite"
      style={[
        styles.undoBar,
        {
          bottom: floatingBottom(clearance), backgroundColor: theme.surfaceElevated, borderColor: theme.border, boxShadow: '0px 4px 12px rgba(11, 21, 19, 0.12)' },
        style,
      ]}>
      <ThemedText style={styles.flex}>{message}</ThemedText>
      <Pressable accessibilityRole="button" onPress={onAction} style={styles.undoAction}>
        <Icon id="undo" size={16} color={theme.brand} />
        <ThemedText type="button" style={{ color: theme.brand, fontSize: 15 }}>
          {actionLabel}
        </ThemedText>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  center: { textAlign: 'center' },
  tabular: { fontVariant: ['tabular-nums'] },
  screen: { flex: 1, flexDirection: 'row', justifyContent: 'center' },
  safeArea: { flex: 1, maxWidth: MaxContentWidth },
  scroll: {
    paddingHorizontal: ScreenPadding,
    paddingTop: Space.sm,
    gap: Space.lg,
  },
  header: { flexDirection: 'row', alignItems: 'center', gap: Space.md, minHeight: Size.touch },
  tile: { alignItems: 'center', justifyContent: 'center', borderCurve: 'continuous' },
  card: {
    borderRadius: Radius.card,
    borderWidth: 1,
    padding: Space.lg,
    gap: Space.md,
    borderCurve: 'continuous',
  },
  summary: { borderRadius: Radius.summary, padding: Space.xxl, gap: Space.sm, borderCurve: 'continuous' },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', marginTop: Space.sm, minHeight: Size.touch },
  segmented: { flexDirection: 'row', borderRadius: Radius.control, padding: Space.xs, borderCurve: 'continuous' },
  segment: {
    flex: 1,
    minHeight: Size.touch - Space.sm,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Radius.control - Space.xs,
    borderCurve: 'continuous',
  },
  segmentLabel: { fontSize: 14, lineHeight: 20 },
  chip: {
    minHeight: Size.touch,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space.sm,
    borderWidth: 1,
    borderRadius: Radius.control,
    paddingHorizontal: Space.md,
    borderCurve: 'continuous',
  },
  chipRow: { gap: Space.sm, paddingRight: Space.xl },
  button: {
    height: Size.button,
    flexDirection: 'row',
    gap: Space.sm,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Space.xl,
    borderRadius: Radius.control,
    borderCurve: 'continuous',
  },
  textButton: { minHeight: Size.touch, minWidth: Size.touch, justifyContent: 'center', paddingHorizontal: Space.xs },
  iconButton: {
    width: Size.touch,
    height: Size.touch,
    borderRadius: Size.touch / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  input: {
    ...Type.bodyLarge,
    minHeight: Size.input,
    borderWidth: 1,
    borderRadius: Radius.control,
    paddingHorizontal: Space.lg,
    paddingVertical: Space.md,
    borderCurve: 'continuous',
  },
  track: { height: Size.progress, borderRadius: Size.progress / 2, overflow: 'hidden' },
  fill: { height: Size.progress, borderRadius: Size.progress / 2 },
  empty: { alignItems: 'center', gap: Space.sm, paddingVertical: Space.xxl },
  notice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space.sm,
    padding: Space.md,
    borderRadius: Radius.control,
    borderCurve: 'continuous',
  },
  monthSwitcher: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: Radius.card,
    paddingHorizontal: Space.xs,
    borderCurve: 'continuous',
  },
  monthLabel: { flex: 1, textAlign: 'center' },
  fab: {
    position: 'absolute',
    right: ScreenPadding,
    width: FAB_SIZE,
    height: FAB_SIZE,
    borderRadius: FAB_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  undoBar: {
    position: 'absolute',
    left: ScreenPadding,
    right: ScreenPadding,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space.md,
    paddingLeft: Space.lg,
    paddingRight: Space.xs,
    borderWidth: 1,
    borderRadius: Radius.control,
    minHeight: Size.button,
    borderCurve: 'continuous',
  },
  undoAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space.xs,
    minHeight: Size.touch,
    paddingHorizontal: Space.md,
  },
});

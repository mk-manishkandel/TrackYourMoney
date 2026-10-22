import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Button, Card, Icon, IconButton, IconTile, Input, Notice, SectionHeader, Segmented, TextButton, withAlpha } from '@/components/ui';
import { Radius, Size, Space } from '@/constants/theme';
import {
  addCategory,
  listCategories,
  PROTECTED_CATEGORY_KEYS,
  setCategoryRemoved,
  type Category,
} from '@/db/repo';
import { useFocusData } from '@/hooks/use-focus-data';
import { useResetOnBlur } from '@/hooks/use-reset-on-blur';
import { useTheme } from '@/hooks/use-theme';
import { usePrefs } from '@/i18n/prefs';
import { haptic } from '@/lib/haptics';
import { categoryColor, type IconId } from '@/lib/icons';

/** Icons offered for new categories: the defaults' set plus a few general ones. */
const ICON_CHOICES: IconId[] = [
  'food', 'cart', 'bus', 'house', 'bolt', 'wifi', 'school', 'health', 'family', 'film',
  'bag', 'gift', 'plane', 'store', 'briefcase', 'cash', 'bank', 'target', 'sparkles', 'grid',
];

/**
 * Settings section for adding and removing categories. Removal hides a category
 * (with undo) rather than deleting it, so past transactions keep their label.
 */
export function CategoryManager({
  onRemoved,
  version,
}: {
  onRemoved: (category: Category) => void;
  /** Bumped by the parent after it restores a category, to refresh the list. */
  version: number;
}) {
  const db = useSQLiteContext();
  const theme = useTheme();
  const { t, categoryName } = usePrefs();
  const [categories, reload] = useFocusData(listCategories);
  const [kind, setKind] = useState<Category['kind']>('expense');
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');
  const [icon, setIcon] = useState<IconId>('grid');
  const [error, setError] = useState<string | null>(null);

  function resetForm() {
    setAdding(false);
    setName('');
    setIcon('grid');
    setError(null);
  }

  useResetOnBlur(resetForm);

  useEffect(() => {
    if (version > 0) reload();
  }, [version, reload]);

  const shown = categories?.filter((c) => c.kind === kind) ?? [];

  async function create() {
    const trimmed = name.trim();
    if (!trimmed) return;
    if (shown.some((c) => categoryName(c).toLocaleLowerCase() === trimmed.toLocaleLowerCase())) {
      haptic.warn();
      setError(t('settings.categoryExists'));
      return;
    }
    await addCategory(db, { name: trimmed, kind, icon });
    haptic.success();
    resetForm();
    reload();
  }

  async function remove(category: Category) {
    haptic.tap();
    await setCategoryRemoved(db, category.id, true);
    reload();
    onRemoved(category);
  }

  return (
    <>
      <SectionHeader
        title={t('settings.categories')}
        action={adding ? undefined : { label: t('settings.addCategory'), onPress: () => setAdding(true) }}
      />
      <Card>
        <Segmented
          accessibilityLabel={t('settings.categories')}
          options={(['expense', 'income'] as const).map((v) => ({ value: v, label: t(`type.${v}`) }))}
          value={kind}
          onChange={(v) => {
            setKind(v);
            setError(null);
          }}
        />
        <ThemedText type="label" themeColor="textSecondary">
          {t('settings.categoryHint')}
        </ThemedText>

        {shown.map((c) => (
          <View key={c.id} style={styles.row}>
            <IconTile icon={c.icon} color={categoryColor(c.grp, theme)} />
            <ThemedText type="bodyMedium" style={styles.flex} numberOfLines={1}>
              {categoryName(c)}
            </ThemedText>
            {c.key && PROTECTED_CATEGORY_KEYS.includes(c.key) ? null : (
              <IconButton
                icon="trash"
                label={`${t('settings.removeCategory')} ${categoryName(c)}`}
                color={theme.expense}
                onPress={() => remove(c)}
              />
            )}
          </View>
        ))}

        {adding ? (
          <View style={[styles.form, { borderTopColor: theme.border }]}>
            <Input
              value={name}
              onChangeText={(v) => {
                setName(v);
                setError(null);
              }}
              placeholder={t('settings.categoryName')}
              accessibilityLabel={t('settings.categoryName')}
              maxLength={30}
              autoFocus
            />
            <ThemedText type="label" themeColor="textSecondary">
              {t('settings.categoryIcon')}
            </ThemedText>
            <View style={styles.icons}>
              {ICON_CHOICES.map((id) => {
                const selected = id === icon;
                return (
                  <Pressable
                    key={id}
                    accessibilityRole="radio"
                    accessibilityState={{ checked: selected }}
                    accessibilityLabel={id}
                    onPress={() => {
                      haptic.select();
                      setIcon(id);
                    }}
                    style={[
                      styles.iconChoice,
                      {
                        backgroundColor: selected ? withAlpha(theme.brand, 0.16) : theme.inputBackground,
                      },
                    ]}>
                    <Icon id={id} size={20} color={selected ? theme.brand : theme.textSecondary} />
                  </Pressable>
                );
              })}
            </View>
            {error && <Notice tone="danger" message={error} />}
            <View style={styles.actions}>
              <TextButton label={t('settings.cancel')} color={theme.textSecondary} onPress={resetForm} />
              <View style={styles.flex}>
                <Button label={t('settings.createCategory')} icon="plus" disabled={!name.trim()} onPress={create} />
              </View>
            </View>
          </View>
        ) : (
          <Pressable
            accessibilityRole="button"
            onPress={() => {
              haptic.select();
              setAdding(true);
            }}
            style={({ pressed }) => [styles.addRow, { borderTopColor: theme.border }, pressed && { opacity: 0.6 }]}>
            <Icon id="plus" size={16} color={theme.brand} weight="semibold" />
            <ThemedText type="button" style={{ color: theme.brand, fontSize: 15 }}>
              {t('settings.addCategory')}
            </ThemedText>
          </Pressable>
        )}
      </Card>
    </>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  row: { flexDirection: 'row', alignItems: 'center', gap: Space.md, minHeight: Size.button },
  form: { gap: Space.md, paddingTop: Space.lg, borderTopWidth: StyleSheet.hairlineWidth },
  icons: { flexDirection: 'row', flexWrap: 'wrap', gap: Space.sm },
  iconChoice: {
    width: Size.touch,
    height: Size.touch,
    borderRadius: Radius.control,
    borderCurve: 'continuous',
    alignItems: 'center',
    justifyContent: 'center',
  },
  actions: { flexDirection: 'row', alignItems: 'center', gap: Space.md },
  addRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Space.sm,
    minHeight: Size.touch,
    paddingTop: Space.md,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
});

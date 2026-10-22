import { useFocusEffect } from 'expo-router';
import { useSQLiteContext, type SQLiteDatabase } from 'expo-sqlite';
import { useCallback, useState } from 'react';

/**
 * Loads data whenever the screen gains focus (so other tabs' edits show up)
 * and returns a `reload` for refreshing after local changes.
 */
export function useFocusData<T>(load: (db: SQLiteDatabase) => Promise<T>): [T | null, () => void] {
  const db = useSQLiteContext();
  const [data, setData] = useState<T | null>(null);

  const reload = useCallback(() => {
    load(db).then(setData);
  }, [db, load]);

  useFocusEffect(reload);

  return [data, reload];
}

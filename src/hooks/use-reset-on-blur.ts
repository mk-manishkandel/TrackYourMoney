import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef } from 'react';

/**
 * Tab screens stay mounted when you switch tabs, so half-finished input would
 * still be there on return. Runs `reset` whenever the screen loses focus.
 */
export function useResetOnBlur(reset: () => void) {
  const latest = useRef(reset);
  useEffect(() => {
    latest.current = reset;
  });
  useFocusEffect(useCallback(() => () => latest.current(), []));
}

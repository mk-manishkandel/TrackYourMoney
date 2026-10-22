import { useCallback, useRef, useState } from 'react';

/**
 * Runs one async action at a time, ignoring repeat calls while it is in flight,
 * so a quick double tap on Save can't record the same entry twice.
 */
export function useSingleFlight() {
  const busy = useRef(false);
  const [running, setRunning] = useState(false);
  const run = useCallback(async (task: () => Promise<void>) => {
    if (busy.current) return;
    busy.current = true;
    setRunning(true);
    try {
      await task();
    } finally {
      busy.current = false;
      setRunning(false);
    }
  }, []);
  return [run, running] as const;
}

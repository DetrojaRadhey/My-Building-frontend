import { useCallback } from 'react';
import api from '../utils/api';

/**
 * Fire-and-forget activity logger for frontend events.
 * Call logEvent() when a user opens a screen, taps a button, etc.
 *
 * Usage:
 *   const { logEvent } = useActivityLog();
 *   useFocusEffect(useCallback(() => { logEvent('open_maintenance', 'maintenance'); }, []));
 */
export function useActivityLog() {
  const logEvent = useCallback(
    (action: string, module: string, detail: Record<string, any> = {}) => {
      // Fire and forget — never await, never block UI
      api.post('/activity-logs/event', { action, module, detail }).catch(() => {});
    },
    []
  );

  return { logEvent };
}

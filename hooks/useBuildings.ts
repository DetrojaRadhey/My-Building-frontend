import { useEffect, useState } from 'react';
import api from '../utils/api';

export type Building = { id: string; name: string; address?: string };

export function useBuildings(enabled: boolean) {
  const [buildings, setBuildings] = useState<Building[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!enabled) return;
    setLoading(true);
    api.get('/buildings')
      .then((r) => setBuildings(r.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [enabled]);

  return { buildings, loading };
}

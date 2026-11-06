import { useCallback, useEffect, useRef, useState } from 'react';
import { activeSessionToken, registerSessionResetHook, type Session } from '../auth';
import { preparationOrderMaterials } from '../preparationReadApi';

type Material = Awaited<ReturnType<typeof preparationOrderMaterials>>[number];
export function usePreparationOrderMaterials(session: Session, orderId: string) {
  const [materials, setMaterials] = useState<Material[] | null>(null), [loading, setLoading] = useState(false), [error, setError] = useState('');
  const valid = useRef(true);
  useEffect(() => {
    valid.current = true;
    const unregister = registerSessionResetHook(async () => { valid.current = false; setMaterials(null); setError('Akkaunt o‘zgargan. Sahifani qayta oching'); });
    return () => { valid.current = false; unregister(); };
  }, [session, orderId]);
  const load = useCallback(async () => {
    if (!valid.current || !activeSessionToken(session)) return;
    setLoading(true); setError('');
    try {
      const values = await preparationOrderMaterials(session, orderId);
      if (!valid.current || !activeSessionToken(session)) return;
      if (!values.length) setError('Bu orderda sizga biriktirilgan homashyo topilmadi.');
      else setMaterials(values);
    } catch (reason) { if (valid.current) setError(reason instanceof Error ? reason.message : String(reason)); }
    finally { if (valid.current) setLoading(false); }
  }, [session, orderId]);
  return { materials, loading, error, load };
}

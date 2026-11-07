import { useEffect, useState } from 'react';
import type { preparationWarehouseChoices } from './preparationLogic';
import { preparationMaterialsErrorMessage } from './usePreparationMaterials';

type Choices = ReturnType<typeof preparationWarehouseChoices>;

export function usePreparationWarehouseChoices(initialChoices: Choices, load: () => Promise<Choices | null>) {
  const [choices, setChoices] = useState(initialChoices), [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null), [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    void load().then(result => {
      if (!active) return;
      if (result) { setChoices(result); setError(null); }
      else setError('Omborlar ro‘yxatini olib bo‘lmadi. Qayta urinib ko‘ring');
    }).catch(reason => { if (active) setError(preparationMaterialsErrorMessage(reason)); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [load, attempt]);
  const retry = () => { setError(null); setLoading(true); setAttempt(value => value + 1); };
  return { choices, loading, error, retry };
}

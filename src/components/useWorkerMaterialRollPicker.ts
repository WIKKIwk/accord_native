import { useState } from 'react';
import { useWorkerOrderText } from './useWorkerOrderText';
export function useWorkerMaterialRollPicker() {
  const [selected, setSelected] = useState<string[]>([]), { t } = useWorkerOrderText();
  return { selected, t, toggle: (barcode: string) => setSelected(previous => previous.includes(barcode) ? previous.filter(item => item !== barcode) : [...previous, barcode]) };
}

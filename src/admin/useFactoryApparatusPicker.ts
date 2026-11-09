import { useMemo, useState } from 'react';
import { factoryPickerRows, factoryPickerText, toggleFactoryPickerSelection } from './factoryApparatusPickerModel';
import type { FactoryApparatusPickerProps } from './factoryApparatusPickerTypes';

export function useFactoryApparatusPicker({ apparatus, initialSelected, onConfirm }: FactoryApparatusPickerProps, locale: string) {
  const [query, setQuery] = useState(''), [selected, setSelected] = useState(() => new Set(initialSelected));
  const rows = useMemo(() => factoryPickerRows(apparatus, query, locale), [apparatus, query, locale]);
  return { query, setQuery, selected, rows, text: factoryPickerText(locale, selected.size),
    toggle: (id: string) => setSelected(current => toggleFactoryPickerSelection(current, id)),
    confirm: () => onConfirm(new Set(selected)) };
}

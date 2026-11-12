import { useWorkerOrderText } from './useWorkerOrderText';
import { RoleFab, type RoleFabAction } from '../shared/navigation/RoleFab.android';

type Props = { onSelect: (id: string) => void; onScan: () => void; showPaddons: boolean; bottomOffset?: number };
const actions: RoleFabAction[] = [
  { id: 'scan', label: 'QR scan qilish', icon: 'qr_code_scanner', width: 246 },
  { id: 'daily', label: 'Kunlik ish', icon: 'today', width: 188 },
  { id: 'paddons', label: 'Paddonlar', icon: 'inventory_2', width: 164 },
];

export function WorkerFab({ onSelect, onScan, showPaddons, bottomOffset = 96 }: Props) {
  const { t } = useWorkerOrderText();
  return <RoleFab actions={actions.filter(action => action.id !== 'paddons' || showPaddons).map(action => ({ ...action, label: t(action.label) }))} bottomOffset={bottomOffset} testIDPrefix="worker-fab"
    onSelect={id => { if (id === 'scan') onScan(); else if (id !== 'paddons' || showPaddons) onSelect(id); }} />;
}

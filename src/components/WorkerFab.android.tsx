import { RoleFab, type RoleFabAction } from '../shared/navigation/RoleFab.android';

type Props = { onSelect: (id: string) => void; onScan: () => void; bottomOffset?: number };
const actions: RoleFabAction[] = [
  { id: 'scan', label: 'QR kodni skanerlash', icon: 'qr_code_scanner', width: 246 },
  { id: 'daily', label: 'Kunlik ishlar', icon: 'today', width: 188 },
  { id: 'paddons', label: 'Paddonlar', icon: 'inventory_2', width: 164 },
];

export function WorkerFab({ onSelect, onScan, bottomOffset = 96 }: Props) {
  return <RoleFab actions={actions} bottomOffset={bottomOffset} testIDPrefix="worker-fab"
    onSelect={id => { if (id === 'scan') onScan(); else onSelect(id); }} />;
}

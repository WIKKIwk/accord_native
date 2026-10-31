import { Text } from 'react-native';
import { WorkerFormDialog } from './WorkerFormDialog';
import { WorkerRadioChoice } from './WorkerRadioChoice';
import { useWorkerColors } from './useWorkerColors';
import type { WorkerDeliveryDialogProps } from './workerDialogTypes';

export function WorkerDeliveryDialog({ visible, name, barcode, choices, selected, error, busy, canConfirm, onChoose, onCancel, onConfirm }: WorkerDeliveryDialogProps) {
  const colors = useWorkerColors();
  return <WorkerFormDialog visible={visible} title="Bu homashyoni kim olib keldi?" onCancel={onCancel} cancelDisabled={busy}
    confirmLabel={busy ? 'Yuborilmoqda…' : 'Tasdiqlash'} confirmDisabled={!canConfirm} onConfirm={onConfirm}>
    <Text style={{ color: colors.text, fontSize: 14, fontWeight: '500' }}>{name}</Text>
    <Text style={{ color: colors.muted }}>{barcode}</Text>
    <Text style={{ color: colors.muted }}>Homashyo apparat oldiga kelganini tasdiqlang va olib kelgan xodimni tanlang.</Text>
    {choices.map(choice => <WorkerRadioChoice key={choice.key} label={choice.label} selected={selected === choice.key} disabled={busy} onPress={() => onChoose(choice.key)} />)}
    {!!error && <Text style={{ color: '#a52626' }}>{error}</Text>}
  </WorkerFormDialog>;
}

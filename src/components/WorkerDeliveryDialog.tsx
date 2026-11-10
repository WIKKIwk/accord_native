import { Text } from 'react-native';
import { WorkerFormDialog } from './WorkerFormDialog';
import { WorkerRadioChoice } from './WorkerRadioChoice';
import { useWorkerColors } from './useWorkerColors';
import type { WorkerDeliveryDialogProps } from './workerDialogTypes';
import { useWorkerOrderText } from './useWorkerOrderText';

export function WorkerDeliveryDialog({ visible, name, barcode, choices, selected, error, busy, canConfirm, onChoose, onCancel, onConfirm }: WorkerDeliveryDialogProps) {
  const colors = useWorkerColors();
  const { t, p } = useWorkerOrderText();
  return <WorkerFormDialog visible={visible} title={p('worker.delivery.title')} onCancel={onCancel} cancelDisabled={busy}
    cancelLabel={p('worker.delivery.cancel')} confirmLabel={busy ? t('Yuborilmoqda…') : p('worker.delivery.confirm')} confirmDisabled={!canConfirm} onConfirm={onConfirm}>
    <Text style={{ color: colors.text, fontSize: 14, fontWeight: '500' }}>{name}</Text>
    <Text style={{ color: colors.muted }}>{barcode}</Text>
    <Text style={{ color: colors.muted }}>{p('worker.delivery.message')}</Text>
    {choices.map(choice => <WorkerRadioChoice key={choice.key} label={choice.label} selected={selected === choice.key} disabled={busy} onPress={() => onChoose(choice.key)} />)}
    {!!error && <Text style={{ color: colors.error }}>{t(error)}</Text>}
  </WorkerFormDialog>;
}

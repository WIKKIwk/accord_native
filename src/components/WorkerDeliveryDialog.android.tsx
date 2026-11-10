import { AlertDialog, Column, Host, RadioButton, Row, Text, TextButton } from '@expo/ui/jetpack-compose';
import { fillMaxWidth, selectable, verticalScroll } from '@expo/ui/jetpack-compose/modifiers';
import { useWindowDimensions } from 'react-native';
import type { WorkerDeliveryDialogProps } from './workerDialogTypes';
import { useWorkerOrderText } from './useWorkerOrderText';

export function WorkerDeliveryDialog({ visible, name, barcode, choices, selected, error, busy, canConfirm, onChoose, onCancel, onConfirm }: WorkerDeliveryDialogProps) {
  const { width, height } = useWindowDimensions();
  const { t, p } = useWorkerOrderText();
  if (!visible) return null;
  return <Host style={{ position: 'absolute', top: 0, left: 0, width, height }} pointerEvents="none">
    <AlertDialog onDismissRequest={() => { if (!busy) onCancel(); }} properties={{ dismissOnBackPress: !busy, dismissOnClickOutside: false }}>
      <AlertDialog.Title><Text>{p('worker.delivery.title')}</Text></AlertDialog.Title>
      <AlertDialog.Text><Column verticalArrangement={{ spacedBy: 12 }} modifiers={[verticalScroll()]}>
        <Text>{name}</Text><Text>{barcode}</Text>
        <Text>{p('worker.delivery.message')}</Text>
        {choices.map(choice => <Row key={choice.key} verticalAlignment="center" modifiers={[fillMaxWidth(), ...(!busy ? [selectable(selected === choice.key, () => onChoose(choice.key), 'radioButton')] : [])]}>
          <RadioButton selected={selected === choice.key} enabled={!busy} /><Text>{choice.label}</Text>
        </Row>)}
        {!!error && <Text color="#a52626">{t(error)}</Text>}
      </Column></AlertDialog.Text>
      <AlertDialog.DismissButton><TextButton enabled={!busy} onClick={onCancel}><Text>{p('worker.delivery.cancel')}</Text></TextButton></AlertDialog.DismissButton>
      <AlertDialog.ConfirmButton><TextButton enabled={canConfirm} onClick={onConfirm}><Text>{busy ? t('Yuborilmoqda…') : p('worker.delivery.confirm')}</Text></TextButton></AlertDialog.ConfirmButton>
    </AlertDialog>
  </Host>;
}

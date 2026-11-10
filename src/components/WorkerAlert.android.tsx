import { AlertDialog, Host, Text, TextButton } from '@expo/ui/jetpack-compose';
import { useWindowDimensions } from 'react-native';
import type { WorkerAlertProps } from './workerDialogTypes';

export function WorkerAlert({ alert, onDismiss, onCancel }: WorkerAlertProps) {
  const { width, height } = useWindowDimensions();
  if (!alert) return null;
  return <Host style={{ position: 'absolute', top: 0, left: 0, width, height }} pointerEvents="none">
    <AlertDialog onDismissRequest={onCancel ?? onDismiss}>
      <AlertDialog.Title><Text>{alert.title}</Text></AlertDialog.Title>
      <AlertDialog.Text><Text>{alert.message}</Text></AlertDialog.Text>
      {alert.onConfirm && <AlertDialog.DismissButton><TextButton onClick={onCancel ?? onDismiss}><Text>{alert.cancelLabel ?? 'Bekor qilish'}</Text></TextButton></AlertDialog.DismissButton>}
      <AlertDialog.ConfirmButton><TextButton onClick={() => { onDismiss(); alert.onConfirm?.(); }}><Text>{alert.confirmLabel ?? 'OK'}</Text></TextButton></AlertDialog.ConfirmButton>
    </AlertDialog>
  </Host>;
}

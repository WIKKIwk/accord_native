import { Alert, Button, Host, Text } from '@expo/ui/swift-ui';
import { useWindowDimensions } from 'react-native';
import type { WorkerAlertProps } from './workerDialogTypes';

export function WorkerAlert({ alert, onDismiss }: WorkerAlertProps) {
  const { width, height } = useWindowDimensions();
  if (!alert) return null;
  return <Host style={{ position: 'absolute', top: 0, left: 0, width, height }} pointerEvents="none">
    <Alert title={alert.title} isPresented onIsPresentedChange={presented => { if (!presented) onDismiss(); }}>
      <Alert.Trigger><Text> </Text></Alert.Trigger>
      <Alert.Message><Text>{alert.message}</Text></Alert.Message>
      <Alert.Actions>
        {alert.onConfirm && <Button label={alert.cancelLabel ?? 'Bekor qilish'} role="cancel" onPress={onDismiss} />}
        <Button label={alert.confirmLabel ?? 'OK'} onPress={() => { onDismiss(); alert.onConfirm?.(); }} />
      </Alert.Actions>
    </Alert>
  </Host>;
}

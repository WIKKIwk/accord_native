import { Button, Host } from '@expo/ui';
import { Modal, StyleSheet, Text, View } from 'react-native';
import type { WorkerAlertProps } from './workerDialogTypes';
import { useWorkerColors } from './useWorkerColors';

export function WorkerAlert({ alert, onDismiss, onCancel }: WorkerAlertProps) {
  const colors = useWorkerColors();
  if (!alert) return null;
  return <Modal visible transparent animationType="fade" onRequestClose={onCancel ?? onDismiss}>
    <View style={styles.backdrop}><View style={[styles.dialog, { backgroundColor: colors.surface }]}>
      <Text style={[styles.title, { color: colors.text }]}>{alert.title}</Text>
      <Text style={{ color: colors.muted }}>{alert.message}</Text>
      <View style={styles.actions}>
        {alert.onConfirm && <Host matchContents={{ vertical: true }} style={styles.action}><Button variant="text" label={alert.cancelLabel ?? 'Bekor qilish'} onPress={onCancel ?? onDismiss} /></Host>}
        <Host matchContents={{ vertical: true }} style={styles.action}><Button variant="text" label={alert.confirmLabel ?? 'OK'} onPress={() => { onDismiss(); alert.onConfirm?.(); }} /></Host>
      </View>
    </View></View>
  </Modal>;
}

const styles = StyleSheet.create({ backdrop: { flex: 1, justifyContent: 'center', paddingHorizontal: 24, backgroundColor: 'rgba(0,0,0,0.32)' }, dialog: { borderRadius: 28, padding: 24, gap: 16 }, title: { fontSize: 20, fontWeight: '600' }, actions: { flexDirection: 'row', justifyContent: 'flex-end' }, action: { minWidth: 88 } });

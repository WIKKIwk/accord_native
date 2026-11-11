import { Button, Host } from '@expo/ui';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { WorkerFormDialogProps } from './workerDialogTypes';
import { useWorkerColors } from './useWorkerColors';

export function WorkerFormDialog({ visible, title, children, confirmLabel, onConfirm, confirmDisabled, cancelLabel = 'Bekor qilish', onCancel, cancelDisabled, preventDismiss, onDismiss, onShow, scrollRef, dismissOnBackdrop }: WorkerFormDialogProps) {
  const colors = useWorkerColors();
  return <Modal visible={visible} transparent animationType="fade" onDismiss={onDismiss} onShow={onShow} onRequestClose={() => { if (!cancelDisabled && !preventDismiss) onCancel(); }}>
    <View style={styles.backdrop}>
      {dismissOnBackdrop && <Pressable accessible={false} style={StyleSheet.absoluteFill} disabled={cancelDisabled || preventDismiss} onPress={onCancel} />}
      <View style={[styles.dialog, { backgroundColor: colors.surface }]}><ScrollView ref={scrollRef} keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
      <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
      {children}
      <View style={styles.actions}><View style={styles.action}><Host matchContents={{ vertical: true }} style={styles.host}><Button label={cancelLabel} variant="outlined" disabled={cancelDisabled} onPress={onCancel} /></Host></View><View style={styles.action}><Host matchContents={{ vertical: true }} style={styles.host}><Button label={confirmLabel} variant="filled" disabled={confirmDisabled} onPress={onConfirm} /></Host></View></View>
    </ScrollView></View></View>
  </Modal>;
}

const styles = StyleSheet.create({ backdrop: { flex: 1, justifyContent: 'center', paddingHorizontal: 24, backgroundColor: 'rgba(0,0,0,0.32)' }, dialog: { borderRadius: 28, maxHeight: '85%' }, content: { padding: 24, gap: 12 }, title: { fontSize: 20, fontWeight: '600', marginBottom: 4 }, actions: { flexDirection: 'row', gap: 8 }, action: { flex: 1 }, host: { width: '100%' } });

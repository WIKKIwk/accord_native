import { Button as UniversalButton, Host as UniversalHost } from '@expo/ui';
import { BottomSheet, Group, Host, RNHostView } from '@expo/ui/swift-ui';
import { interactiveDismissDisabled, presentationDetents } from '@expo/ui/swift-ui/modifiers';
import { ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import type { WorkerFormDialogProps } from './workerDialogTypes';
import { useWorkerColors } from './useWorkerColors';

export function WorkerFormDialog({ visible, title, children, confirmLabel, onConfirm, confirmDisabled, cancelLabel = 'Bekor qilish', onCancel, cancelDisabled }: WorkerFormDialogProps) {
  const { width, height } = useWindowDimensions();
  const colors = useWorkerColors();
  return <Host style={{ position: 'absolute', top: 0, left: 0, width, height }} pointerEvents="none">
    <BottomSheet isPresented={visible} onIsPresentedChange={presented => { if (!presented && !cancelDisabled) onCancel(); }}>
      <Group modifiers={[presentationDetents(['large']), interactiveDismissDisabled(!!cancelDisabled)]}>
        <RNHostView><View style={[styles.content, { flex: 1, backgroundColor: colors.surface }]}>
          <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.body}>{children}</ScrollView>
          <View style={styles.actions}><View style={styles.action}><UniversalHost matchContents={{ vertical: true }} style={styles.host}><UniversalButton label={cancelLabel} variant="outlined" disabled={cancelDisabled} onPress={onCancel} /></UniversalHost></View><View style={styles.action}><UniversalHost matchContents={{ vertical: true }} style={styles.host}><UniversalButton label={confirmLabel} variant="filled" disabled={confirmDisabled} onPress={onConfirm} /></UniversalHost></View></View>
        </View></RNHostView>
      </Group>
    </BottomSheet>
  </Host>;
}

const styles = StyleSheet.create({ content: { paddingHorizontal: 20, paddingTop: 24, paddingBottom: 20, gap: 12 }, title: { fontSize: 20, fontWeight: '600' }, body: { gap: 12, paddingBottom: 12 }, actions: { flexDirection: 'row', gap: 8 }, action: { flex: 1 }, host: { width: '100%' } });

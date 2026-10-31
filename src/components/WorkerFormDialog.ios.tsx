import { Button as UniversalButton, Host as UniversalHost } from '@expo/ui';
import { BottomSheet, Group, Host, RNHostView } from '@expo/ui/swift-ui';
import { buttonBorderShape, buttonStyle, controlSize, interactiveDismissDisabled, presentationDetents, presentationDragIndicator } from '@expo/ui/swift-ui/modifiers';
import { Platform, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import type { WorkerFormDialogProps } from './workerDialogTypes';
import { useWorkerColors } from './useWorkerColors';

export function WorkerFormDialog({ visible, title, children, confirmLabel, onConfirm, confirmDisabled, cancelLabel = 'Bekor qilish', onCancel, cancelDisabled, preventDismiss }: WorkerFormDialogProps) {
  const { width, height } = useWindowDimensions();
  const colors = useWorkerColors();
  const glass = Number(Platform.Version) >= 26;
  return <Host style={{ position: 'absolute', top: 0, left: 0, width, height }} pointerEvents="none">
    <BottomSheet isPresented={visible} onIsPresentedChange={presented => { if (!presented && !cancelDisabled) onCancel(); }}>
      <Group modifiers={[presentationDetents(['large']), presentationDragIndicator(cancelDisabled || preventDismiss ? 'hidden' : 'visible'), interactiveDismissDisabled(!!cancelDisabled || !!preventDismiss)]}>
        <RNHostView><View style={[styles.content, { flex: 1, backgroundColor: colors.surface }]}>
          <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
          <ScrollView keyboardShouldPersistTaps="handled" keyboardDismissMode="interactive" contentContainerStyle={styles.body}>{children}</ScrollView>
          <View style={styles.actions}>
            <View style={styles.action}><UniversalHost matchContents={{ vertical: true }} style={styles.host}>
              <UniversalButton label={cancelLabel} disabled={cancelDisabled} onPress={onCancel} style={{ width: '100%' }}
                modifiers={[buttonStyle(glass ? 'glass' : 'bordered'), buttonBorderShape('capsule'), controlSize('large')]} />
            </UniversalHost></View>
            <View style={styles.action}><UniversalHost matchContents={{ vertical: true }} style={styles.host}>
              <UniversalButton label={confirmLabel} disabled={confirmDisabled} onPress={onConfirm} style={{ width: '100%' }}
                modifiers={[buttonStyle(glass ? 'glassProminent' : 'borderedProminent'), buttonBorderShape('capsule'), controlSize('large')]} />
            </UniversalHost></View>
          </View>
        </View></RNHostView>
      </Group>
    </BottomSheet>
  </Host>;
}

const styles = StyleSheet.create({ content: { paddingHorizontal: 20, paddingTop: 24, paddingBottom: 16, gap: 16 }, title: { fontSize: 22, fontWeight: '600' }, body: { gap: 14, paddingBottom: 20 }, actions: { flexDirection: 'row', gap: 12 }, action: { flex: 1 }, host: { width: '100%' } });

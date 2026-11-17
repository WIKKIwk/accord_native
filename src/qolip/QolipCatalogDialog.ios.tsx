import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Modal, Pressable, ScrollView, View } from 'react-native';
import { useWorkerColors } from '../components/useWorkerColors';
// @v2 _MoldAddDialog
export function QolipCatalogDialog({ children, close, preventDismiss = false, dismissOnOutside = true }: { children: ReactNode; close(): void; preventDismiss?: boolean; dismissOnOutside?: boolean }) {
  const colors = useWorkerColors();
  return <Modal visible transparent animationType="fade" onRequestClose={() => { if (!preventDismiss) close(); }}>
    <KeyboardAvoidingView behavior="padding" style={{ flex: 1, justifyContent: 'center', paddingHorizontal: 24, backgroundColor: '#00000052' }}>
      <Pressable style={{ position: 'absolute', inset: 0 }} onPress={() => { if (dismissOnOutside && !preventDismiss) close(); }} />
      <View accessibilityViewIsModal style={{ maxHeight: '85%', borderRadius: 22, backgroundColor: colors.surface }}><ScrollView keyboardShouldPersistTaps="handled">{children}</ScrollView></View>
    </KeyboardAvoidingView>
  </Modal>;
}

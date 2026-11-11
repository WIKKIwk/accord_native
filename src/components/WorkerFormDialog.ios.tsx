import { Button, Text as NativeText } from '@expo/ui/swift-ui';
import { buttonBorderShape, buttonStyle, controlSize, disabled, font, frame } from '@expo/ui/swift-ui/modifiers';
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { WorkerFormDialogProps } from './workerDialogTypes';
import { BaseHost } from './BaseHost';
import { useWorkerColors } from './useWorkerColors';
import { useWorkerOrderText } from './useWorkerOrderText';

/** Report dialogs require explicit actions; individual V2 confirmations may allow backdrop dismissal. */
export function WorkerFormDialog({ visible, title, children, confirmLabel, onConfirm, confirmDisabled, cancelLabel = 'Bekor qilish', onCancel, cancelDisabled, preventDismiss, onDismiss, onShow, scrollRef, dismissOnBackdrop }: WorkerFormDialogProps) {
  const { width, height } = useWindowDimensions(), insets = useSafeAreaInsets(), colors = useWorkerColors();
  const { t } = useWorkerOrderText();
  const glass = parseInt(String(Platform.Version), 10) >= 26;
  return <Modal visible={visible} transparent animationType="fade" presentationStyle="overFullScreen" statusBarTranslucent
    onDismiss={onDismiss} onShow={onShow}
    onRequestClose={() => { if (!cancelDisabled && !preventDismiss) onCancel(); }}>
    <KeyboardAvoidingView behavior="padding" style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0007', paddingTop: insets.top + 12, paddingBottom: insets.bottom + 12 }}>
      {dismissOnBackdrop && <Pressable accessible={false} style={StyleSheet.absoluteFill} disabled={cancelDisabled || preventDismiss} onPress={onCancel} />}
      <View accessibilityViewIsModal style={{ flexShrink: 1, width: Math.min(width - 32, 560), maxHeight: height - insets.top - insets.bottom - 24, backgroundColor: colors.surface, borderRadius: 26, padding: 20, gap: 16 }}>
        <BaseHost matchContents={{ vertical: true }} style={{ width: '100%' }}><NativeText modifiers={[font({ size: 22, weight: 'semibold' }), frame({ maxWidth: Infinity, alignment: 'leading' })]}>{t(title)}</NativeText></BaseHost>
        <ScrollView ref={scrollRef} keyboardShouldPersistTaps="handled" keyboardDismissMode="interactive" style={{ flexShrink: 1 }} contentContainerStyle={{ gap: 14, paddingBottom: 8 }}>{children}</ScrollView>
        <View style={{ flexDirection: 'row', gap: 12 }}>
          <BaseHost matchContents={{ vertical: true }} style={{ flex: 1 }}><Button label={t(cancelLabel)} onPress={onCancel}
            modifiers={[buttonStyle(glass ? 'glass' : 'bordered'), buttonBorderShape('capsule'), controlSize('large'), disabled(!!cancelDisabled), frame({ maxWidth: Infinity })]} /></BaseHost>
          <BaseHost matchContents={{ vertical: true }} style={{ flex: 1 }}><Button label={t(confirmLabel)} onPress={onConfirm}
            modifiers={[buttonStyle(glass ? 'glassProminent' : 'borderedProminent'), buttonBorderShape('capsule'), controlSize('large'), disabled(!!confirmDisabled), frame({ maxWidth: Infinity })]} /></BaseHost>
        </View>
      </View>
    </KeyboardAvoidingView>
  </Modal>;
}

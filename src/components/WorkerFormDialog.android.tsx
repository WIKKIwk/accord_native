import { AlertDialog, Host, RNHostView, Text, TextButton } from '@expo/ui/jetpack-compose';
import { ScrollView, useWindowDimensions, View } from 'react-native';
import type { WorkerFormDialogProps } from './workerDialogTypes';

export function WorkerFormDialog({ visible, title, children, confirmLabel, onConfirm, confirmDisabled, cancelLabel = 'Bekor qilish', onCancel, cancelDisabled }: WorkerFormDialogProps) {
  const { width, height } = useWindowDimensions();
  if (!visible) return null;
  return <Host style={{ position: 'absolute', top: 0, left: 0, width, height }} pointerEvents="none">
    <AlertDialog onDismissRequest={() => { if (!cancelDisabled) onCancel(); }} properties={{ dismissOnBackPress: !cancelDisabled, dismissOnClickOutside: false }}>
      <AlertDialog.Title><Text>{title}</Text></AlertDialog.Title>
      <AlertDialog.Text><RNHostView matchContents>
        <View style={{ width: Math.max(1, Math.min(width - 112, 480)) }}>
          <ScrollView nestedScrollEnabled keyboardShouldPersistTaps="handled" style={{ maxHeight: height * 0.55 }} contentContainerStyle={{ gap: 12 }}>{children}</ScrollView>
        </View>
      </RNHostView></AlertDialog.Text>
      <AlertDialog.DismissButton><TextButton enabled={!cancelDisabled} onClick={onCancel}><Text>{cancelLabel}</Text></TextButton></AlertDialog.DismissButton>
      <AlertDialog.ConfirmButton><TextButton enabled={!confirmDisabled} onClick={onConfirm}><Text>{confirmLabel}</Text></TextButton></AlertDialog.ConfirmButton>
    </AlertDialog>
  </Host>;
}

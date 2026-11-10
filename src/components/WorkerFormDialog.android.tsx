import { AlertDialog, Host, RNHostView, Text, TextButton } from '@expo/ui/jetpack-compose';
import { ScrollView, useWindowDimensions, View } from 'react-native';
import type { WorkerFormDialogProps } from './workerDialogTypes';
import { useWorkerOrderText } from './useWorkerOrderText';

export function WorkerFormDialog({ visible, title, children, confirmLabel, onConfirm, confirmDisabled, cancelLabel = 'Bekor qilish', onCancel, cancelDisabled, preventDismiss, scrollRef }: WorkerFormDialogProps) {
  const { width, height } = useWindowDimensions();
  const { t } = useWorkerOrderText();
  if (!visible) return null;
  return <Host style={{ position: 'absolute', top: 0, left: 0, width, height }} pointerEvents="none">
    <AlertDialog onDismissRequest={() => { if (!cancelDisabled && !preventDismiss) onCancel(); }} properties={{ dismissOnBackPress: !cancelDisabled && !preventDismiss, dismissOnClickOutside: false }}>
      <AlertDialog.Title><Text>{t(title)}</Text></AlertDialog.Title>
      <AlertDialog.Text><RNHostView matchContents>
        <View style={{ width: Math.max(1, Math.min(width - 112, 480)) }}>
          <ScrollView ref={scrollRef} nestedScrollEnabled keyboardShouldPersistTaps="handled" style={{ maxHeight: height * 0.55 }} contentContainerStyle={{ gap: 12 }}>{children}</ScrollView>
        </View>
      </RNHostView></AlertDialog.Text>
      <AlertDialog.DismissButton><TextButton enabled={!cancelDisabled} onClick={onCancel}><Text>{t(cancelLabel)}</Text></TextButton></AlertDialog.DismissButton>
      <AlertDialog.ConfirmButton><TextButton enabled={!confirmDisabled} onClick={onConfirm}><Text>{t(confirmLabel)}</Text></TextButton></AlertDialog.ConfirmButton>
    </AlertDialog>
  </Host>;
}

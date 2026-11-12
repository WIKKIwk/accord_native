import { AlertDialog, Box, Button, Host, Icon, OutlinedButton, RNHostView, Row, Shape, Text, TextButton, useMaterialColors } from '@expo/ui/jetpack-compose';
import { background, clip, fillMaxWidth, height as fixedHeight, size, weight } from '@expo/ui/jetpack-compose/modifiers';
import { ScrollView, useWindowDimensions, View } from 'react-native';
import type { WorkerFormDialogProps } from './workerDialogTypes';
import { useWorkerOrderText } from './useWorkerOrderText';

export function WorkerFormDialog({ visible, title, children, confirmLabel, onConfirm, confirmDisabled, cancelLabel = 'Bekor qilish', onCancel, cancelDisabled, preventDismiss, scrollRef, dismissOnBackdrop = false, progressAction }: WorkerFormDialogProps) {
  const { width, height } = useWindowDimensions();
  const { t } = useWorkerOrderText();
  const colors = useMaterialColors({});
  if (!visible) return null;
  return <Host style={{ position: 'absolute', top: 0, left: 0, width, height }} pointerEvents="none">
    <AlertDialog onDismissRequest={() => { if (!cancelDisabled && !preventDismiss) onCancel(); }} properties={{ dismissOnBackPress: !cancelDisabled && !preventDismiss, dismissOnClickOutside: dismissOnBackdrop && !cancelDisabled && !preventDismiss }}>
      <AlertDialog.Title>{progressAction ? <Row verticalAlignment="center" horizontalArrangement={{ spacedBy: 12 }} modifiers={[fillMaxWidth()]}>
        <Box contentAlignment="center" modifiers={[size(42, 42), clip({ type: 'roundedCorner', radius: 12 }), background(colors.primaryContainer)]}>
          <Icon source={progressAction === 'pause' ? require('../../assets/icons/gscale/pause_circle.xml') : require('../../assets/icons/gscale/check_circle.xml')}
            size={22} tint={colors.onPrimaryContainer} />
        </Box>
        <Text color={colors.onSurface} style={{ typography: 'titleLarge', fontWeight: '700' }} modifiers={[weight(1)]}>{t(title)}</Text>
      </Row> : <Text>{t(title)}</Text>}</AlertDialog.Title>
      <AlertDialog.Text><RNHostView matchContents>
        <View style={{ width: Math.max(1, Math.min(width - (progressAction ? 80 : 112), progressAction ? 432 : 480)) }}>
          <ScrollView ref={scrollRef} nestedScrollEnabled keyboardShouldPersistTaps="handled" style={{ maxHeight: height * (progressAction ? 0.6 : 0.55) }} contentContainerStyle={{ gap: 12 }}>{children}</ScrollView>
        </View>
      </RNHostView></AlertDialog.Text>
      {progressAction ? <AlertDialog.ConfirmButton><Row horizontalArrangement={{ spacedBy: 10 }} modifiers={[fillMaxWidth()]}>
        <OutlinedButton enabled={!cancelDisabled} onClick={onCancel} modifiers={[weight(1), fixedHeight(48)]}
          shape={Shape.RoundedCorner({ cornerRadii: { topStart: 14, topEnd: 14, bottomStart: 14, bottomEnd: 14 } })}><Text maxLines={1} overflow="ellipsis">{t(cancelLabel)}</Text></OutlinedButton>
        <Button enabled={!confirmDisabled} onClick={onConfirm} modifiers={[weight(1), fixedHeight(48)]}
          shape={Shape.RoundedCorner({ cornerRadii: { topStart: 14, topEnd: 14, bottomStart: 14, bottomEnd: 14 } })}><Text maxLines={1} overflow="ellipsis">{t(confirmLabel)}</Text></Button>
      </Row></AlertDialog.ConfirmButton> : <>
        <AlertDialog.DismissButton><TextButton enabled={!cancelDisabled} onClick={onCancel}><Text>{t(cancelLabel)}</Text></TextButton></AlertDialog.DismissButton>
        <AlertDialog.ConfirmButton><TextButton enabled={!confirmDisabled} onClick={onConfirm}><Text>{t(confirmLabel)}</Text></TextButton></AlertDialog.ConfirmButton>
      </>}
    </AlertDialog>
  </Host>;
}

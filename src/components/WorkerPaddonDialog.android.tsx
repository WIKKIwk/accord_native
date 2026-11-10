import { AlertDialog, Host, RNHostView, Text, TextButton } from '@expo/ui/jetpack-compose';
import { ScrollView, View, useWindowDimensions } from 'react-native';
import { WorkerOrderButton } from './WorkerOrderControls';
import type { WorkerPaddonDialogProps } from './workerPaddonPresentation';

// @v2 _PaddonScannedWipsDialog
export function WorkerPaddonDialog({ data, visible, close, children }: WorkerPaddonDialogProps) {
  const { width, height } = useWindowDimensions();
  if (!data || !visible) return null;
  return <Host style={{ position: 'absolute', width, height }} pointerEvents="box-none"><AlertDialog onDismissRequest={() => close(null)}>
    <AlertDialog.Title><Text>{data.title}</Text></AlertDialog.Title>
    <AlertDialog.Text>{children || data.choices ? <RNHostView matchContents><View style={{ width: Math.max(1, Math.min(480, width - 112)) }}>
      {children ? <View style={{ height: Math.min(400, Math.max(160, height * 0.45)) }}>{children}</View>
        : <ScrollView style={{ maxHeight: height * 0.6 }} contentContainerStyle={{ gap: 6 }}>{data.choices?.map(choice => <WorkerOrderButton key={choice.id}
          label={choice.title} variant="text" onPress={() => close(choice.id)} />)}</ScrollView>}
    </View></RNHostView> : <Text>{data.message ?? ''}</Text>}</AlertDialog.Text>
    {!data.choices ? <AlertDialog.DismissButton><TextButton onClick={() => close(null)}><Text>{data.cancelLabel ?? ''}</Text></TextButton></AlertDialog.DismissButton> : null}
    {!data.choices ? <AlertDialog.ConfirmButton><TextButton enabled={!data.confirmDisabled} onClick={() => close('confirm')}><Text>{data.confirmLabel ?? ''}</Text></TextButton></AlertDialog.ConfirmButton> : null}
  </AlertDialog></Host>;
}

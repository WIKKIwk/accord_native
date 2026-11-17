import { AlertDialog, Button, Column, Host, OutlinedButton, RNHostView, Text, TextButton, useMaterialColors } from '@expo/ui/jetpack-compose';
import { fillMaxWidth } from '@expo/ui/jetpack-compose/modifiers';
import { ScrollView, Text as NativeText, useWindowDimensions } from 'react-native';
import { useWorkerColors } from '../components/useWorkerColors';
import type { StorageConfirmation } from './qolipStorageViewProps';
export function QolipStorageConfirm({ value }: { value: StorageConfirmation }) {
  const { width, height } = useWindowDimensions(), colors = useWorkerColors(), material = useMaterialColors();
  return <Host style={{ position: 'absolute', top: 0, left: 0, width, height }} pointerEvents="none"><AlertDialog onDismissRequest={() => value.resolve(false)}>
    <AlertDialog.Title><Text>{value.title}</Text></AlertDialog.Title>
    <AlertDialog.Text><RNHostView matchContents><ScrollView style={{ maxHeight: height * 0.5 }}><NativeText style={{ color: colors.text, fontSize: 16, lineHeight: 23 }}>{value.message}</NativeText></ScrollView></RNHostView></AlertDialog.Text>
    {value.destructive ? <AlertDialog.ConfirmButton><Column verticalArrangement={{ spacedBy: 10 }} modifiers={[fillMaxWidth()]}>
      <Button onClick={() => value.resolve(true)} colors={{ containerColor: material.error, contentColor: material.onError }} modifiers={[fillMaxWidth()]}><Text>{value.confirm}</Text></Button>
      <OutlinedButton onClick={() => value.resolve(false)} modifiers={[fillMaxWidth()]}><Text>{value.cancel}</Text></OutlinedButton>
    </Column></AlertDialog.ConfirmButton> : <>
      <AlertDialog.DismissButton><TextButton onClick={() => value.resolve(false)}><Text>{value.cancel}</Text></TextButton></AlertDialog.DismissButton>
      <AlertDialog.ConfirmButton><Button onClick={() => value.resolve(true)}><Text>{value.confirm}</Text></Button></AlertDialog.ConfirmButton>
    </>}
  </AlertDialog></Host>;
}

/** @v2 _StorageOverlay — the expired dialog has only the source message. */
export function QolipStorageExpiredDialog({ message, close, barrierDismissible = true }: { message: string; close(): void; barrierDismissible?: boolean }) {
  const { width, height } = useWindowDimensions();
  return <Host style={{ position: 'absolute', top: 0, left: 0, width, height }} pointerEvents="none"><AlertDialog onDismissRequest={close} properties={{ dismissOnClickOutside: barrierDismissible }}>
    <AlertDialog.Text><Text>{message}</Text></AlertDialog.Text>
  </AlertDialog></Host>;
}

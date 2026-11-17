import { AlertDialog, Column, Button, Host, OutlinedButton, Text, TextButton } from '@expo/ui/jetpack-compose';
import { fillMaxWidth, height, paddingAll } from '@expo/ui/jetpack-compose/modifiers';
import { useWindowDimensions } from 'react-native';
import type { QolipCatalogConfirmation } from './qolipCatalogConfirmation';
export function QolipCatalogConfirm({ value }: { value: QolipCatalogConfirmation | null }) {
  const { width, height: windowHeight } = useWindowDimensions(); if (!value) return null;
  return <Host style={{ position: 'absolute', top: 0, width, height: windowHeight }} pointerEvents="none"><AlertDialog properties={{ dismissOnClickOutside: value.dismissible, dismissOnBackPress: true }} onDismissRequest={() => value.resolve(false)}>
    <AlertDialog.Title><Text>{value.title}</Text></AlertDialog.Title><AlertDialog.Text><Text>{value.message}</Text></AlertDialog.Text>
    {!value.vertical && value.cancel && <AlertDialog.DismissButton><TextButton onClick={() => value.resolve(false)}><Text>{value.cancel}</Text></TextButton></AlertDialog.DismissButton>}
    <AlertDialog.ConfirmButton>{value.vertical ? <Column verticalArrangement={{ spacedBy: 8 }} modifiers={[fillMaxWidth(), paddingAll(0)]}>
      <Button onClick={() => value.resolve(true)} modifiers={[fillMaxWidth(), height(54)]}><Text>{value.confirm}</Text></Button>
      {value.cancel && <OutlinedButton onClick={() => value.resolve(false)} modifiers={[fillMaxWidth(), height(54)]}><Text>{value.cancel}</Text></OutlinedButton>}
    </Column> : <Button onClick={() => value.resolve(true)}><Text>{value.confirm}</Text></Button>}</AlertDialog.ConfirmButton>
  </AlertDialog></Host>;
}

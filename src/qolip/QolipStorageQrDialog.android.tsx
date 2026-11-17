import { QolipStorageExpiredDialog } from './QolipStorageConfirm';
import { useQolipPassiveBoundary } from './useQolipPassiveBoundary';
import { AlertDialog, Host, RNHostView, Text, TextButton } from '@expo/ui/jetpack-compose';
import { Image } from 'expo-image';
import * as Clipboard from 'expo-clipboard';
import { useMemo } from 'react';
import { View, useWindowDimensions } from 'react-native';
import { extensionText } from '../shared/localization';
import { useQolipText } from './useQolipText';
import { useQolipRole } from './QolipRoleContext';
import { qolipStorageQr, type QolipStorageQrDialogProps } from './qolipStorageQr';
export function QolipStorageQrDialog({ code, paddon = false, close }: QolipStorageQrDialogProps) {
  const { width, height } = useWindowDimensions(), role = useQolipRole(), { locale } = useQolipText();
  const lifetime = useQolipPassiveBoundary(role.boundary);
  const qr = useMemo(() => qolipStorageQr(paddon ? `qolip-paddon:${code}` : code), [code, paddon]);
  if (!lifetime.valid) return <QolipStorageExpiredDialog message={extensionText('qolipStorageText', 'session_changed', locale)} close={close} />;
  return <Host style={{ position: 'absolute', top: 0, left: 0, width, height }} pointerEvents="none"><AlertDialog onDismissRequest={close}>
    <AlertDialog.Title><Text>{code}</Text></AlertDialog.Title><AlertDialog.Text><RNHostView matchContents>
      <View style={{ alignItems: 'center' }}><Image source={{ uri: qr }} style={{ width: 240, height: 240, backgroundColor: '#fff' }} contentFit="contain" /></View>
    </RNHostView></AlertDialog.Text><AlertDialog.ConfirmButton><TextButton onClick={() => { if (role.isCurrent()) void Clipboard.setStringAsync(code); }}>
      <Text>{extensionText('qolipStorageText', 'copy', locale)}</Text></TextButton></AlertDialog.ConfirmButton>
  </AlertDialog></Host>;
}

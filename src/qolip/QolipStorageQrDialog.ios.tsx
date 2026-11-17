import { QolipStorageExpiredDialog } from './QolipStorageConfirm';
import { useQolipPassiveBoundary } from './useQolipPassiveBoundary';
import { Button, Host } from '@expo/ui/swift-ui';
import { buttonStyle, frame } from '@expo/ui/swift-ui/modifiers';
import { Image } from 'expo-image';
import * as Clipboard from 'expo-clipboard';
import { useMemo } from 'react';
import { Modal, Pressable, Text, View } from 'react-native';
import { extensionText } from '../shared/localization';
import { useWorkerColors } from '../components/useWorkerColors';
import { useQolipText } from './useQolipText';
import { useQolipRole } from './QolipRoleContext';
import { qolipStorageQr, type QolipStorageQrDialogProps } from './qolipStorageQr';
export function QolipStorageQrDialog({ code, paddon = false, close }: QolipStorageQrDialogProps) {
  const role = useQolipRole(), { locale } = useQolipText(), colors = useWorkerColors();
  const lifetime = useQolipPassiveBoundary(role.boundary);
  const qr = useMemo(() => qolipStorageQr(paddon ? `qolip-paddon:${code}` : code), [code, paddon]);
  if (!lifetime.valid) return <QolipStorageExpiredDialog message={extensionText('qolipStorageText', 'session_changed', locale)} close={close} />;
  return <Modal visible transparent animationType="fade" onRequestClose={close}><View style={{ flex: 1, justifyContent: 'center', padding: 24, backgroundColor: '#0006' }}>
    <Pressable style={{ position: 'absolute', inset: 0 }} onPress={close} /><View style={{ borderRadius: 24, backgroundColor: colors.surface, padding: 24, gap: 16, alignItems: 'center' }}>
      <Text style={{ color: colors.text, fontSize: 22, fontWeight: '600' }}>{code}</Text>
      <Image source={{ uri: qr }} style={{ width: 240, height: 240, backgroundColor: '#fff' }} contentFit="contain" />
      <Host matchContents style={{ width: '100%' }}><Button label={extensionText('qolipStorageText', 'copy', locale)}
        modifiers={[buttonStyle('bordered'), frame({ maxWidth: Infinity, minHeight: 48 })]} onPress={() => { if (role.isCurrent()) void Clipboard.setStringAsync(code); }} /></Host>
    </View></View></Modal>;
}

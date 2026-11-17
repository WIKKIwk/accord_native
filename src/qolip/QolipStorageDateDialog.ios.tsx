import { useQolipRole } from './QolipRoleContext';
import { QolipStorageExpiredDialog } from './QolipStorageConfirm';
import { useQolipPassiveBoundary } from './useQolipPassiveBoundary';
import { Button, DatePicker, Host, VStack } from '@expo/ui/swift-ui';
import { buttonStyle, frame } from '@expo/ui/swift-ui/modifiers';
import { useState } from 'react';
import { Modal, View } from 'react-native';
import type { QolipStorageDateRange } from './qolipStorageReadState';
import { useQolipText } from './useQolipText';
import { extensionText } from '../shared/localization';
import { useWorkerColors } from '../components/useWorkerColors';
export function QolipStorageDateDialog({ initial, close }: { initial: QolipStorageDateRange | null; close(value: QolipStorageDateRange | null): void }) {
  const role = useQolipRole(), lifetime = useQolipPassiveBoundary(role.boundary);
  const { locale } = useQolipText(), colors = useWorkerColors(), t = (key: string) => extensionText('qolipStorageText', key, locale);
  const [from, setFrom] = useState(initial?.from ?? new Date()), [to, setTo] = useState(initial?.to ?? new Date());
  const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1);
  if (!lifetime.valid) return <QolipStorageExpiredDialog message={t('session_changed')} close={() => close(null)} />;
  return <Modal visible transparent animationType="fade" onRequestClose={() => close(null)}><View style={{ flex: 1, justifyContent: 'center', padding: 24, backgroundColor: '#0006' }}>
    <Host matchContents style={{ backgroundColor: colors.surface, borderRadius: 24, padding: 20 }}><VStack spacing={18}>
      <DatePicker title={t('dates')} selection={from} range={{ start: new Date(2000, 0, 1), end: to }} onDateChange={setFrom} />
      <DatePicker title="" selection={to} range={{ start: from, end: tomorrow }} onDateChange={setTo} />
      <Button label={t('confirm')} onPress={() => close({ from, to })} modifiers={[buttonStyle('borderedProminent'), frame({ maxWidth: Infinity, minHeight: 48 })]} />
      <Button label={t('cancel')} role="cancel" onPress={() => close(null)} modifiers={[buttonStyle('bordered'), frame({ maxWidth: Infinity, minHeight: 48 })]} />
    </VStack></Host></View></Modal>;
}

import { Button, ContextMenu, Section, Text, VStack } from '@expo/ui/swift-ui';
import { disabled } from '@expo/ui/swift-ui/modifiers';
import { Stack } from 'expo-router';
import { useState } from 'react';
import { Alert } from 'react-native';
import { useNativeSheet } from '../nativeSheet';
import { usePreparationContext } from './PreparationContext';
import { PreparationInputSheet, PreparationList, PreparationStatus, preparationAlert, usePreparationText } from './PreparationUI';
import { preparationReverseReceipt } from './preparationCommandApi';
import { preparationReverseHistory } from './preparationLogic';

// @v2 PreparationHistoryScreen
export function PreparationHistory() {
  const { home, session } = usePreparationContext(), t = usePreparationText(), sheet = useNativeSheet();
  const [busy, setBusy] = useState(false);
  const [localHistory, setLocalHistory] = useState<Record<string, unknown>[] | null>(null);
  const history = localHistory ?? home.snapshot?.history ?? [];
  const reverse = (doc: Record<string, unknown>) => sheet.open(<PreparationInputSheet title="Kirimni bekor qilish" label="Sabab"
    maxLength={500} emptyError="Sabab kiriting" close={sheet.close} save={async reason => {
      sheet.close();
      Alert.alert(t('Kirimni bekor qilish'), `${String(doc.kg ?? '0')} kg kirim bekor qilinsinmi? Bu amal tarixda saqlanadi.`, [
        { text: t('Qaytish'), style: 'cancel' }, { text: t('Bekor qilish'), style: 'destructive', onPress: () => {
          setBusy(true);
          void preparationReverseReceipt(session, String(doc.id ?? ''), reason).then(async result => {
            setLocalHistory(preparationReverseHistory(history, doc.id == null ? null : String(doc.id), result, new Date().toISOString()));
            await home.controller.reload(); Alert.alert(t('Kirim bekor qilindi'));
          }).catch(preparationAlert).finally(() => setBusy(false));
        } },
      ]);
    }} />, { compact: true, dismissible: false });
  const refresh = async () => { await home.controller.reload(); setLocalHistory(null); };
  return <><Stack.Screen options={{ title: t('Tarix') }} /><PreparationList refresh={refresh}>
    <Section><Text>{t('Oxirgi 100 ta kirim va sarf')}</Text></Section>
    <PreparationStatus loading={home.loading} error={home.error} retry={() => { void refresh(); }} />
    <Section>{!history.length && <Text>{t('Hali kirim yoki sarf yo‘q.')}</Text>}
      {history.slice(0, 100).map((doc, index) => {
        const content = <VStack alignment="leading"><Text>{String(doc.name ?? doc.item_code ?? doc.kind ?? '')}</Text>
          <Text>{String(doc.warehouse ?? '')} · {String(doc.kg ?? '')} kg · {String(doc.created_at ?? '')}</Text>
          {doc.reversed === true && <Text>{t('Bekor qilingan')}</Text>}</VStack>;
        return doc.kind === 'receipt' && doc.reversed !== true ? <ContextMenu key={String(doc.id ?? index)}>
          <ContextMenu.Trigger>{content}</ContextMenu.Trigger><ContextMenu.Items>
            <Button label={t('Kirimni bekor qilish')} role="destructive" modifiers={[disabled(doc.can_reverse !== true || home.locked || busy)]}
              onPress={() => reverse(doc)} />
          </ContextMenu.Items></ContextMenu> : <VStack key={String(doc.id ?? index)}>{content}</VStack>;
      })}
    </Section>
  </PreparationList></>;
}

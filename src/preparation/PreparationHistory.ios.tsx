import { Button, Host, HStack, Section, Text, TextField, VStack, useNativeState } from '@expo/ui/swift-ui';
import { disabled, onLongPressGesture } from '@expo/ui/swift-ui/modifiers';
import { Stack } from 'expo-router';
import { useRef, useState } from 'react';
import { KeyboardAvoidingView, Modal, PlatformColor, Pressable, StyleSheet, View } from 'react-native';
import { useWorkerColors } from '../components/useWorkerColors';
import { useNativeSheet } from '../nativeSheet';
import { usePreparationContext } from './PreparationContext';
import { PreparationNotice } from './PreparationNotice';
import { PreparationList, usePreparationText } from './PreparationUI';
import { preparationReverseReceipt } from './preparationCommandApi';
import { preparationHistoryCard, preparationReceiptActionSubtitle, preparationReceiptReverseMessage } from './preparationHistoryModel';
import { preparationInputError, preparationReverseHistory } from './preparationLogic';
import { usePreparationNotice } from './usePreparationNotice';

type Entry = Record<string, unknown>;

function HistoryRow({ doc, onLongPress }: { doc: Entry; onLongPress: () => void }) {
  const card = preparationHistoryCard(doc);
  const actions = doc.kind === 'receipt' && doc.reversed !== true ? [onLongPressGesture(onLongPress)] : [];
  return <VStack alignment="leading" modifiers={actions}>
    <Text>{card.title}</Text><Text>{card.subtitle}</Text><Text>{card.value}</Text>
  </VStack>;
}

function ReceiptActions({ doc, reverse, close }: { doc: Entry; reverse: () => void; close: () => void }) {
  const t = usePreparationText();
  return <Host matchContents={{ vertical: true }}><VStack spacing={12}>
    <Text>{`Kirim — ${String(doc.name ?? '')}`}</Text><Text>{preparationReceiptActionSubtitle(doc)}</Text>
    <Button role="destructive" modifiers={[disabled(doc.can_reverse !== true)]} onPress={reverse}>
      <VStack alignment="leading"><Text>{t('Kirimni bekor qilish')}</Text><Text>{t(doc.can_reverse === true
        ? 'Ishlatilmagan va orderga ulanmagan kirim' : 'Bu kirim ishlatilgan yoki orderga ulangan')}</Text></VStack>
    </Button>
    <Button label={t('Yopish')} onPress={close} />
  </VStack></Host>;
}

function ReverseDialog({ doc, close, confirm }: { doc: Entry; close: () => void; confirm: (reason: string) => void }) {
  const t = usePreparationText(), colors = useWorkerColors(), nativeValue = useNativeState('');
  const [reason, setReason] = useState(''), [error, setError] = useState<string | null>(null);
  const [phase, setPhase] = useState<'reason' | 'cancel' | 'waiting' | 'confirm'>('reason');
  const next = () => {
    const issue = preparationInputError(reason, { emptyError: 'Sabab kiriting', maxLength: 500 });
    if (issue) { setError(issue); return; }
    setPhase('waiting');
  };
  const cancelReason = () => setPhase('cancel');
  return <><Modal visible={phase === 'reason'} transparent animationType="fade" onRequestClose={cancelReason}
    onDismiss={() => { if (phase === 'waiting') setPhase('confirm'); else close(); }}>
    <KeyboardAvoidingView behavior="padding" style={styles.backdrop}>
      <Pressable style={StyleSheet.absoluteFill} onPress={cancelReason} />
      <View accessibilityViewIsModal style={[styles.dialog, { backgroundColor: colors.surface }]}>
        <Host matchContents={{ vertical: true }}><VStack spacing={14}>
          <Text>{t('Kirimni bekor qilish')}</Text>
          <TextField text={nativeValue} autoFocus placeholder={t('Sabab')} onTextChange={setReason} />
          {!!error && <Text>{t(error)}</Text>}
          <Button label={t('Saqlash')} onPress={next} />
          <Button label={t('Bekor qilish')} role="cancel" onPress={cancelReason} />
        </VStack></Host>
      </View>
    </KeyboardAvoidingView>
  </Modal><Modal visible={phase === 'confirm'} transparent animationType="fade" onRequestClose={close}>
    <View style={styles.backdrop}>
      <Pressable style={StyleSheet.absoluteFill} onPress={close} />
      <View accessibilityViewIsModal style={[styles.dialog, { backgroundColor: colors.surface }]}>
        <Host matchContents={{ vertical: true }}><VStack spacing={14}>
          <Text>{t('Kirimni bekor qilish')}</Text><Text>{preparationReceiptReverseMessage(doc)}</Text>
          <HStack><Button label={t('Qaytish')} role="cancel" onPress={close} />
            <Button label={t('Bekor qilish')} role="destructive" onPress={() => confirm(reason.trim())} /></HStack>
        </VStack></Host>
      </View>
    </View>
  </Modal></>;
}

// @v2 PreparationHistoryScreen
export function PreparationHistory() {
  const { home, session } = usePreparationContext(), t = usePreparationText(), sheet = useNativeSheet(), notice = usePreparationNotice();
  const [history, setHistory] = useState<Entry[]>(() => [...(home.snapshot?.history ?? [])]);
  const [reverseDoc, setReverseDoc] = useState<Entry | null>(null);
  const afterSheet = useRef<(() => void) | null>(null);
  const openActions = (doc: Entry) => {
    sheet.open(<ReceiptActions doc={doc} close={sheet.close} reverse={() => {
      afterSheet.current = () => setReverseDoc(doc); sheet.close();
    }} />, { compact: true, dismissible: true, onDismiss: () => {
      const next = afterSheet.current; afterSheet.current = null; next?.();
    } });
  };
  const reverse = (doc: Entry, reason: string) => {
    setReverseDoc(null);
    void preparationReverseReceipt(session, String(doc.id ?? ''), reason).then(async result => {
      setHistory(current => preparationReverseHistory(current, doc.id == null ? null : String(doc.id), result, new Date().toISOString()));
      await home.controller.reload(); notice.show(t('Kirim bekor qilindi'));
    }).catch(error => notice.show(String(error)));
  };
  return <View style={{ flex: 1 }}><Stack.Screen options={{ title: t('Tarix') }} /><PreparationList refresh={() => home.controller.reload()}>
    <Section><Text>{t('Oxirgi 100 ta kirim va sarf')}</Text></Section>
    <Section>{!history.length && <Text>{t('Hali kirim yoki sarf yo‘q.')}</Text>}
      {history.map((doc, index) => <HistoryRow key={`${String(doc.id ?? '')}-${index}`} doc={doc} onLongPress={() => openActions(doc)} />)}
    </Section>
  </PreparationList><PreparationNotice message={notice.message} />
    {reverseDoc && <ReverseDialog doc={reverseDoc} close={() => setReverseDoc(null)} confirm={reason => reverse(reverseDoc, reason)} />}
  </View>;
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'center', paddingHorizontal: 24, backgroundColor: PlatformColor('systemFill') },
  dialog: { borderRadius: 20, padding: 24 },
});

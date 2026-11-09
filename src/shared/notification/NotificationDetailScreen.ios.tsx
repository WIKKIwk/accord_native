import { Button, Host, HStack, ProgressView, Section, Spacer, Text, TextField, VStack, useNativeState } from '@expo/ui/swift-ui';
import { disabled, lineLimit } from '@expo/ui/swift-ui/modifiers';
import { Stack } from 'expo-router';
import { useEffect, useState, useSyncExternalStore } from 'react';
import { KeyboardAvoidingView, Modal, PlatformColor, Pressable, StyleSheet, View } from 'react-native';
import { WorkerAlert } from '../../components/WorkerAlert';
import type { WorkerAlertData } from '../../components/workerDialogTypes';
import { useWorkerColors } from '../../components/useWorkerColors';
import { PreparationList, usePreparationText } from '../../preparation/PreparationUI';
import { PreparationNotice } from '../../preparation/PreparationNotice';
import { localizedGetter } from '../localization';
import { localeController } from '../localization/runtime';
import { RoleHeaderButton } from '../navigation/RoleHeaderButton';
import { notificationRoleHasDock, notificationStatusLabel, notificationWerkaAction, trimNotificationText } from './notificationDetailModel';
import type { NotificationDetailScreenProps } from './notificationDetailTypes';
import { useNotificationDetail } from './useNotificationDetail';

function ReasonDialog({ close, confirm }: { close: () => void; confirm: (value: string) => void }) {
  const t = usePreparationText(), colors = useWorkerColors(), input = useNativeState('');
  const [reason, setReason] = useState('');
  return <Modal visible transparent animationType="fade" onRequestClose={close}>
    <KeyboardAvoidingView behavior="padding" style={styles.backdrop}>
      <Pressable accessibilityRole="button" accessibilityLabel={t('Yo‘q')} style={StyleSheet.absoluteFill} onPress={close} />
      <View accessibilityViewIsModal style={[styles.dialog, { backgroundColor: colors.surface }]}>
        <Host matchContents={{ vertical: true }}><VStack alignment="leading" spacing={16}>
          <Text>{t('Rad etish')}</Text>
          <TextField text={input} axis="vertical" placeholder={t('Sabab (ixtiyoriy)')} onTextChange={setReason}
            modifiers={[lineLimit({ min: 2, max: 4 })]} />
          <HStack spacing={16}><Button label={t('Yo‘q')} role="cancel" onPress={close} />
            <Button label={t('Rad etish')} onPress={() => confirm(reason)} /></HStack>
        </VStack></Host>
      </View>
    </KeyboardAvoidingView>
  </Modal>;
}

const subscribeLocale = (listener: () => void) => localeController.addListener(listener);
const currentLocale = () => localeController.locale;

// @v2 NotificationDetailScreen
export function NotificationDetailScreen(props: NotificationDetailScreenProps) {
  const { controller, state, policy, role, notice } = useNotificationDetail(props);
  const t = usePreparationText(), locale = useSyncExternalStore(subscribeLocale, currentLocale, currentLocale);
  const input = useNativeState('');
  const [alert, setAlert] = useState<WorkerAlertData | null>(null), [rejecting, setRejecting] = useState(false);
  useEffect(() => { if (!state.comment) input.set(''); }, [input, state.comment]);
  const confirm = (kind: 'approve' | 'acknowledge') => setAlert({ title: 'Tasdiqlash',
    message: kind === 'approve' ? 'Haqiqatan ham tasdiqlaysizmi?' : 'Haqiqatan ham shu holatni tasdiqlaysizmi?',
    cancelLabel: 'Yo‘q', confirmLabel: 'Ha', onConfirm: () => {
      if (kind === 'approve') void controller.respond(true); else void controller.acknowledge();
    } });
  const detail = state.detail, record = detail?.record;
  const werkaAction = record && policy ? notificationWerkaAction(policy, record, props.onWerkaDetail) : null;
  return <View style={{ flex: 1 }}>
    <Stack.Screen options={{ title: 'Batafsil', headerLeft: () => <RoleHeaderButton icon="back" label={t('Orqaga')}
      onPress={props.onBack} tintColor={PlatformColor('label')} /> }} />
    <PreparationList refresh={!state.loading && state.error == null ? () => controller.reload() : undefined}>
      {state.loading && <ProgressView />}
      {!state.loading && state.error != null && <Section>
        <Text>{localizedGetter('serverDisconnectedRetry', locale)}</Text>
        <Button label={localizedGetter('retry', locale)} onPress={() => { void controller.reload(); }} />
      </Section>}
      {!state.loading && record && detail && policy && <>
        <Section><HStack><Text>{record.supplier_name}</Text><Spacer /><Text>{notificationStatusLabel(record.status)}</Text></HStack>
          <HStack><Text>Supplier</Text><Spacer /><Text>{record.supplier_name}</Text></HStack>
          <HStack><Text>Mahsulot</Text><Spacer /><Text>{`${record.item_code} • ${record.item_name}`}</Text></HStack>
          <HStack><Text>Jo‘natilgan</Text><Spacer /><Text>{`${record.sent_qty.toFixed(2)} ${record.uom}`}</Text></HStack>
          <HStack><Text>Qabul qilingan</Text><Spacer /><Text>{`${record.accepted_qty.toFixed(2)} ${record.uom}`}</Text></HStack>
        </Section>
        {!!trimNotificationText(record.note) && <Section><Text>{record.note}</Text></Section>}
        {policy.showHighlight && <Section><Text>{record.highlight}</Text></Section>}
        {werkaAction && <Section><Button label={t('Qabul qilishga o‘tish')} onPress={werkaAction} /></Section>}
        {policy.canRespond && <Section><HStack spacing={12}>
          <Button label={t('Rad etaman')} modifiers={[disabled(state.sending)]} onPress={() => setRejecting(true)} />
          <Button label={t(state.sending ? 'Yuborilmoqda...' : 'Tasdiqlayman')} modifiers={[disabled(state.sending)]}
            onPress={() => confirm('approve')} />
        </HStack></Section>}
        {policy.canAcknowledge && <Section><Button label={t(state.sending ? 'Yuborilmoqda...' : 'Tasdiqlayman')}
          modifiers={[disabled(state.sending)]} onPress={() => confirm('acknowledge')} /></Section>}
        {policy.canWriteIssueComment && <Section>
          <Text>{t('Izohlar')}</Text>
          {detail.comments.length === 0 ? <Text>{t('Hozircha izoh yo‘q.')}</Text> : detail.comments.map((comment, index) =>
            <VStack key={`${comment.id}:${index}`} alignment="leading" spacing={8}>
              <Text>{comment.author_label}</Text><Text>{comment.body}</Text><Text>{comment.created_label}</Text>
            </VStack>)}
          <TextField text={input} axis="vertical" placeholder={t('Izoh yozing')} onTextChange={controller.setComment.bind(controller)}
            modifiers={[lineLimit({ min: 3, max: 5 })]} />
          {!!trimNotificationText(state.comment) && <Button label={t(state.sending ? 'Yuborilmoqda...' : 'Comment yuborish')}
            modifiers={[disabled(state.sending)]} onPress={() => { void controller.sendComment(); }} />}
        </Section>}
      </>}
    </PreparationList>
    {notificationRoleHasDock(role) ? props.footer : null}
    <PreparationNotice message={t(notice)} />
    <WorkerAlert alert={alert} onDismiss={() => setAlert(null)} />
    {rejecting && <ReasonDialog close={() => setRejecting(false)} confirm={reason => {
      setRejecting(false); void controller.respond(false, reason);
    }} />}
  </View>;
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'center', paddingHorizontal: 28, backgroundColor: 'rgba(0,0,0,0.28)' },
  dialog: { borderRadius: 28, padding: 24 },
});

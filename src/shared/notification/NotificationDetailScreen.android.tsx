import { AlertDialog, Button, Host, OutlinedButton, OutlinedTextField, Text, TextButton, useMaterialColors, useNativeState } from '@expo/ui/jetpack-compose';
import { fillMaxWidth, testID } from '@expo/ui/jetpack-compose/modifiers';
import { useEffect, useState, useSyncExternalStore } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { WorkerAlert } from '../../components/WorkerAlert';
import type { WorkerAlertData } from '../../components/workerDialogTypes';
import { PreparationRow, PreparationText, usePreparationText } from '../../preparation/PreparationUI';
import { PreparationNotice } from '../../preparation/PreparationNotice';
import { localizedGetter } from '../localization';
import { localeController } from '../localization/runtime';
import { RoleHeader } from '../navigation/RoleHeader.android';
import { notificationStatusLabel, trimNotificationText } from './notificationDetailModel';
import type { NotificationDetailScreenProps } from './notificationDetailTypes';
import { useNotificationDetail } from './useNotificationDetail';

function ReasonDialog({ close, confirm }: { close: () => void; confirm: (value: string) => void }) {
  const t = usePreparationText(), { width, height } = useWindowDimensions(), input = useNativeState('');
  const [reason, setReason] = useState('');
  return <Host style={{ position: 'absolute', top: 0, left: 0, width, height }} pointerEvents="none">
    <AlertDialog onDismissRequest={close} properties={{ dismissOnBackPress: true, dismissOnClickOutside: true }}>
      <AlertDialog.Title><Text>{t('Rad etish')}</Text></AlertDialog.Title>
      <AlertDialog.Text><OutlinedTextField value={input} minLines={2} maxLines={4} onValueChange={setReason} modifiers={[fillMaxWidth()]}>
        <OutlinedTextField.Placeholder><Text>{t('Sabab (ixtiyoriy)')}</Text></OutlinedTextField.Placeholder>
      </OutlinedTextField></AlertDialog.Text>
      <AlertDialog.DismissButton><TextButton onClick={close}><Text>{t('Yo‘q')}</Text></TextButton></AlertDialog.DismissButton>
      <AlertDialog.ConfirmButton><TextButton onClick={() => confirm(reason)}><Text>{t('Rad etish')}</Text></TextButton></AlertDialog.ConfirmButton>
    </AlertDialog>
  </Host>;
}

const subscribeLocale = (listener: () => void) => localeController.addListener(listener);
const currentLocale = () => localeController.locale;

// @v2 NotificationDetailScreen
export function NotificationDetailScreen(props: NotificationDetailScreenProps) {
  const { controller, state, policy, notice } = useNotificationDetail(props);
  const t = usePreparationText(), locale = useSyncExternalStore(subscribeLocale, currentLocale, currentLocale);
  const colors = useMaterialColors(), insets = useSafeAreaInsets(), input = useNativeState('');
  const [alert, setAlert] = useState<WorkerAlertData | null>(null), [rejecting, setRejecting] = useState(false);
  useEffect(() => { if (!state.comment) input.set(''); }, [input, state.comment]);
  const confirm = (kind: 'approve' | 'acknowledge') => setAlert({ title: 'Tasdiqlash',
    message: kind === 'approve' ? 'Haqiqatan ham tasdiqlaysizmi?' : 'Haqiqatan ham shu holatni tasdiqlaysizmi?',
    cancelLabel: 'Yo‘q', confirmLabel: 'Ha', onConfirm: () => {
      if (kind === 'approve') void controller.respond(true); else void controller.acknowledge();
    } });
  const detail = state.detail, record = detail?.record;
  return <View style={{ flex: 1, backgroundColor: colors.surfaceContainerLow, paddingTop: insets.top }}>
    <RoleHeader title="Batafsil" navigation={{ icon: 'back', label: t('Orqaga'), onPress: props.onBack }} />
    {state.loading ? <View style={{ flex: 1, justifyContent: 'center' }}><ActivityIndicator /></View>
      : state.error != null ? <View style={{ flex: 1, padding: 24, gap: 16 }}>
        <PreparationText>{localizedGetter('serverDisconnectedRetry', locale)}</PreparationText>
        <Host matchContents={{ vertical: true }}><TextButton onClick={() => { void controller.reload(); }}>
          <Text>{localizedGetter('retry', locale)}</Text></TextButton></Host>
      </View>
        : <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ flexGrow: 1, paddingHorizontal: 12, paddingBottom: 24, gap: 12 }}
          refreshControl={<RefreshControl refreshing={state.loading} onRefresh={() => { void controller.reload(); }} />}>
          {record && detail && policy && <>
            <PreparationText title>{record.supplier_name}</PreparationText>
            <PreparationText>{notificationStatusLabel(record.status)}</PreparationText>
            <PreparationRow title="Supplier" subtitle={record.supplier_name} />
            <PreparationRow title="Mahsulot" subtitle={`${record.item_code} • ${record.item_name}`} />
            <PreparationRow title="Jo‘natilgan" subtitle={`${record.sent_qty.toFixed(2)} ${record.uom}`} />
            <PreparationRow title="Qabul qilingan" subtitle={`${record.accepted_qty.toFixed(2)} ${record.uom}`} />
            {!!trimNotificationText(record.note) && <PreparationRow title={record.note} />}
            {policy.showHighlight && <PreparationRow title={record.highlight} />}
            {policy.canConfirm && <Host matchContents={{ vertical: true }}><Button modifiers={[fillMaxWidth(), testID('notification-werka-detail')]}
              onClick={() => props.onWerkaDetail(record)}><Text>{t('Qabul qilishga o‘tish')}</Text></Button></Host>}
            {policy.canRespond && <View style={{ flexDirection: 'row', gap: 12 }}>
              <Host matchContents={{ vertical: true }} style={{ flex: 1 }}><OutlinedButton enabled={!state.sending}
                modifiers={[fillMaxWidth(), testID('notification-reject')]} onClick={() => setRejecting(true)}><Text>{t('Rad etaman')}</Text></OutlinedButton></Host>
              <Host matchContents={{ vertical: true }} style={{ flex: 1 }}><Button enabled={!state.sending}
                modifiers={[fillMaxWidth(), testID('notification-approve')]} onClick={() => confirm('approve')}>
                <Text>{t(state.sending ? 'Yuborilmoqda...' : 'Tasdiqlayman')}</Text></Button></Host>
            </View>}
            {policy.canAcknowledge && <Host matchContents={{ vertical: true }}><OutlinedButton enabled={!state.sending}
              modifiers={[fillMaxWidth(), testID('notification-acknowledge')]} onClick={() => confirm('acknowledge')}>
              <Text>{t(state.sending ? 'Yuborilmoqda...' : 'Tasdiqlayman')}</Text></OutlinedButton></Host>}
            {policy.canWriteIssueComment && <>
              <PreparationText title>{t('Izohlar')}</PreparationText>
              {detail.comments.length === 0 ? <PreparationText>{t('Hozircha izoh yo‘q.')}</PreparationText> : detail.comments.map((comment, index) =>
                <View key={`${comment.id}:${index}`} style={{ gap: 8 }}><PreparationText title>{comment.author_label}</PreparationText>
                  <PreparationText>{comment.body}</PreparationText><PreparationText>{comment.created_label}</PreparationText></View>)}
              <Host matchContents={{ vertical: true }}><OutlinedTextField value={input} minLines={3} maxLines={5}
                onValueChange={value => controller.setComment(value)} modifiers={[fillMaxWidth()]}>
                <OutlinedTextField.Placeholder><Text>{t('Izoh yozing')}</Text></OutlinedTextField.Placeholder>
              </OutlinedTextField></Host>
              {!!trimNotificationText(state.comment) && <Host matchContents={{ vertical: true }}><Button enabled={!state.sending}
                modifiers={[fillMaxWidth(), testID('notification-comment')]} onClick={() => { void controller.sendComment(); }}>
                <Text>{t(state.sending ? 'Yuborilmoqda...' : 'Comment yuborish')}</Text></Button></Host>}
            </>}
          </>}
        </ScrollView>}
    {props.footer}
    <PreparationNotice message={t(notice)} />
    <WorkerAlert alert={alert} onDismiss={() => setAlert(null)} />
    {rejecting && <ReasonDialog close={() => setRejecting(false)} confirm={reason => {
      setRejecting(false); void controller.respond(false, reason);
    }} />}
  </View>;
}

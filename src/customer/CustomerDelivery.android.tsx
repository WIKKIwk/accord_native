import { Button, Host } from '@expo/ui';
import { useMaterialColors } from '@expo/ui/jetpack-compose';
import { useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { RefreshControl, ScrollView, Text, View } from 'react-native';
import { WorkerAlert } from '../components/WorkerAlert';
import { WorkerQueueCard } from '../components/WorkerQueueCard.android';
import { useCustomerText } from './CustomerContext';
import { customerAcceptPartial, customerApproveAll, customerRejectAll, customerReportClaim, trimCustomerInput, type CustomerReturnInput } from './customerLogic';
import { customerDeliveryInfoRows, customerDiscussionEventId, type CustomerDeliveryInfoRow, type CustomerReturnKind } from './customerDeliveryView';
import { CustomerReturnDialog } from './CustomerReturnDialog';
import { CustomerSnackbar } from './CustomerSnackbar';
import { CustomerLoadingState, CustomerRetryState } from './CustomerStates';
import { useCustomerDelivery } from './useCustomerScreens';

type Props = { deliveryNoteID: string; onChanged: () => void; onOpenDiscussion?: (receiptId: string) => void };

// @v2 CustomerDeliveryDetailScreen
export function CustomerDeliveryDetailScreen({ deliveryNoteID, onChanged, onOpenDiscussion }: Props) {
  const state = useCustomerDelivery(deliveryNoteID, onChanged), colors = useMaterialColors(), { text } = useCustomerText();
  const [confirm, setConfirm] = useState(false), [dialog, setDialog] = useState<CustomerReturnKind | null>(null);
  const returningFromDiscussion = useRef(false), reload = state.reload;
  const openDiscussion = useCallback(() => {
    if (!onOpenDiscussion) return;
    returningFromDiscussion.current = true; onOpenDiscussion(customerDiscussionEventId(deliveryNoteID));
  }, [deliveryNoteID, onOpenDiscussion]);
  useFocusEffect(useCallback(() => { if (returningFromDiscussion.current) { returningFromDiscussion.current = false; void reload(); } }, [reload]));
  if (state.loading) return <CustomerLoadingState />;
  if (state.error || !state.detail) return <CustomerRetryState retry={state.reload} />;
  const detail = state.detail, record = detail.record;
  const hasDiscussion = ['accepted', 'partial', 'rejected'].includes(record.status);
  const onReturn = (input: CustomerReturnInput) => {
    const current = dialog; setDialog(null);
    if (current === 'reject') void state.send(customerRejectAll(deliveryNoteID, record.sent_qty, input));
    else if (current === 'partial') void state.send(customerAcceptPartial(deliveryNoteID, record.sent_qty, input));
    else if (current === 'claim') void state.send(customerReportClaim(deliveryNoteID, input));
  };
  const line = (row: CustomerDeliveryInfoRow) => <View key={row.labelKey} style={{ paddingHorizontal: 16, paddingVertical: 7, gap: 6 }}>
    <Text style={{ color: colors.onSurfaceVariant, fontSize: 12, fontWeight: '600' }}>{row.label}</Text>
    <View style={row.highlighted ? { alignSelf: 'flex-start', backgroundColor: colors.secondaryContainer, borderRadius: 14,
      paddingHorizontal: 12, paddingVertical: 8 } : undefined}>
      <Text style={{ color: row.highlighted ? colors.onSecondaryContainer : colors.onSurface, fontSize: row.highlighted ? 16 : 20,
        fontWeight: row.highlighted ? '700' : '600' }}>{row.value}</Text>
    </View></View>;
  const action = (label: string, onPress: () => void, blocked = false) => <Host key={label} matchContents={{ vertical: true }} style={{ width: '100%' }}>
    <Button label={text(label)} disabled={blocked} onPress={onPress} style={{ width: '100%' }} /></Host>;
  return <>
    <ScrollView contentContainerStyle={{ paddingVertical: 8, paddingBottom: 24, gap: 12 }}
      refreshControl={<RefreshControl refreshing={state.loading} onRefresh={() => { void state.reload(); }} />}>
      <WorkerQueueCard backgroundColor={colors.surfaceContainerLow} first last><View style={{ flex: 1, gap: 6, paddingVertical: 12 }}>
        <Text style={{ color: colors.onSurface, fontSize: 20, paddingHorizontal: 16 }}>{text('shipmentInfoTitle')}</Text>
        {customerDeliveryInfoRows(record, text).map(line)}
        {trimCustomerInput(record.note) ? <View style={{ paddingHorizontal: 16, gap: 6 }}><Text style={{ color: colors.onSurface }}>{text('noteTitle')}</Text>
          <Text style={{ color: colors.onSurface }}>{record.note}</Text></View> : null}
        {hasDiscussion && onOpenDiscussion ? <View style={{ paddingHorizontal: 16, gap: 8 }}><Text style={{ color: colors.onSurface }}>{text('commentsTitle')}</Text>
          <Host matchContents={{ vertical: true }} style={{ width: '100%' }}>
            <Button label={text('openDiscussionAction')} onPress={openDiscussion} style={{ width: '100%' }} />
          </Host></View> : null}
        {detail.canApprove || detail.canPartiallyAccept || detail.canReject || detail.canReportClaim ? <View style={{ paddingHorizontal: 16, gap: 12 }}>
          <Text style={{ color: colors.onSurface }}>{text('responseTitle')}</Text>
          {detail.canApprove ? action(state.submitting ? 'sending' : 'approveAction', () => setConfirm(true), state.submitting) : null}
          {detail.canPartiallyAccept ? action('partialAcceptAction', () => setDialog('partial'), state.submitting) : null}
          {detail.canReject ? action('rejectAction', () => setDialog('reject'), state.submitting) : null}
          {detail.canReportClaim ? action('reportIssueAction', () => setDialog('claim'), state.submitting) : null}
        </View> : null}
      </View></WorkerQueueCard>
    </ScrollView>
    <WorkerAlert alert={confirm ? { title: text('confirmTitle'), message: text('confirmQuestion'), cancelLabel: text('no'),
      confirmLabel: text('yes'), onConfirm: () => { void state.send(customerApproveAll(deliveryNoteID)); } } : null} onDismiss={() => setConfirm(false)} />
    <CustomerReturnDialog kind={dialog} sentQty={record.sent_qty} uom={record.uom} onCancel={() => setDialog(null)} onConfirm={onReturn} />
    <CustomerSnackbar message={state.message} onDismiss={state.clearMessage} />
  </>;
}

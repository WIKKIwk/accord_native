import { Button, FilledTonalButton, Host, OutlinedButton, Text as NativeText, useMaterialColors } from '@expo/ui/jetpack-compose';
import { fillMaxWidth, testID } from '@expo/ui/jetpack-compose/modifiers';
import { useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { RefreshControl, ScrollView, Text, View } from 'react-native';
import { WorkerAlert } from '../components/WorkerAlert';
import { WorkerQueueCard } from '../components/WorkerQueueCard.android';
import { useCustomerText } from './CustomerContext';
import { customerAcceptPartial, customerApproveAll, customerRejectAll, customerReportClaim, trimCustomerInput, type CustomerReturnInput } from './customerLogic';
import { customerDeliveryInfoRows, customerDeliveryResponseActions, customerDiscussionEventId, type CustomerDeliveryInfoRow,
  type CustomerDeliveryResponseAction, type CustomerReturnKind } from './customerDeliveryView';
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
  const actions = customerDeliveryResponseActions(detail, state.submitting);
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
  const action = (key: string, label: string, appearance: CustomerDeliveryResponseAction['appearance'], onPress: () => void,
    blocked = false, spacingBefore = 0) => {
    const NativeButton = appearance === 'tonal' ? FilledTonalButton : appearance === 'outlined' ? OutlinedButton : Button;
    return <Host key={key} matchContents={{ vertical: true }} style={{ width: '100%', marginTop: spacingBefore }}>
      <NativeButton enabled={!blocked} onClick={blocked ? undefined : onPress} modifiers={[fillMaxWidth(), testID(`customer-response-${key}`)]}>
        <NativeText>{text(label)}</NativeText>
      </NativeButton>
    </Host>;
  };
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
            <OutlinedButton enabled onClick={openDiscussion} modifiers={[fillMaxWidth(), testID('customer-discussion')]}>
              <NativeText>{text('openDiscussionAction')}</NativeText>
            </OutlinedButton>
          </Host></View> : null}
        {actions.length ? <View style={{ paddingHorizontal: 16, gap: 12 }}>
          <Text style={{ color: colors.onSurface }}>{text('responseTitle')}</Text>
          <View>{actions.map(item => action(item.kind, item.labelKey, item.appearance,
            () => { if (item.kind === 'approve') setConfirm(true); else setDialog(item.kind); }, state.submitting, item.spacingBefore))}</View>
        </View> : null}
      </View></WorkerQueueCard>
    </ScrollView>
    <WorkerAlert alert={confirm ? { title: text('confirmTitle'), message: text('confirmQuestion'), cancelLabel: text('no'),
      confirmLabel: text('yes'), onConfirm: () => { void state.send(customerApproveAll(deliveryNoteID)); } } : null} onDismiss={() => setConfirm(false)} />
    <CustomerReturnDialog kind={dialog} sentQty={record.sent_qty} uom={record.uom} onCancel={() => setDialog(null)} onConfirm={onReturn} />
    <CustomerSnackbar message={state.message} onDismiss={state.clearMessage} />
  </>;
}

import { Text } from '@expo/ui';
import { Button, Host, List, ProgressView, Section, VStack } from '@expo/ui/swift-ui';
import { background, disabled, fixedSize, font, foregroundStyle, frame, lineLimit, listStyle, padding, refreshable, shapes } from '@expo/ui/swift-ui/modifiers';
import { useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { PlatformColor } from 'react-native';
import { WorkerAlert } from '../components/WorkerAlert';
import { useCustomerText } from './CustomerContext';
import { customerAcceptPartial, customerApproveAll, customerRejectAll, customerReportClaim, trimCustomerInput, type CustomerReturnInput } from './customerLogic';
import { customerDeliveryInfoRows, customerDiscussionEventId, type CustomerReturnKind } from './customerDeliveryView';
import { CustomerReturnDialog } from './CustomerReturnDialog';
import { CustomerSnackbar } from './CustomerSnackbar';
import { useCustomerDelivery } from './useCustomerScreens';

type Props = { deliveryNoteID: string; onChanged: () => void; onOpenDiscussion?: (receiptId: string) => void };

// @v2 CustomerDeliveryDetailScreen
export function CustomerDeliveryDetailScreen({ deliveryNoteID, onChanged, onOpenDiscussion }: Props) {
  const state = useCustomerDelivery(deliveryNoteID, onChanged), { text } = useCustomerText();
  const [confirm, setConfirm] = useState(false), [dialog, setDialog] = useState<CustomerReturnKind | null>(null);
  const returningFromDiscussion = useRef(false), reload = state.reload;
  useFocusEffect(useCallback(() => { if (returningFromDiscussion.current) { returningFromDiscussion.current = false; void reload(); } }, [reload]));
  if (state.loading) return <Host style={{ flex: 1 }}><ProgressView /></Host>;
  if (state.error || !state.detail) return <Host style={{ flex: 1 }}><List><Section>
    <Text>{text('serverDisconnectedRetry')}</Text><Button label={text('retry')} onPress={() => { void state.reload(); }} />
  </Section></List></Host>;
  const detail = state.detail, record = detail.record;
  const hasDiscussion = ['accepted', 'partial', 'rejected'].includes(record.status);
  const onReturn = (input: CustomerReturnInput) => {
    const current = dialog; setDialog(null);
    if (current === 'reject') void state.send(customerRejectAll(deliveryNoteID, record.sent_qty, input));
    else if (current === 'partial') void state.send(customerAcceptPartial(deliveryNoteID, record.sent_qty, input));
    else if (current === 'claim') void state.send(customerReportClaim(deliveryNoteID, input));
  };
  return <>
    <Host style={{ flex: 1 }}><List modifiers={[listStyle('insetGrouped'), refreshable(state.reload)]}>
      <Section title={text('shipmentInfoTitle')}>
        {customerDeliveryInfoRows(record, text).map(row => <VStack key={row.labelKey} alignment="leading" spacing={6}
          modifiers={[frame({ maxWidth: Infinity, alignment: 'leading' })]}>
          <Text modifiers={[font({ textStyle: 'caption', weight: 'semibold' }), foregroundStyle(PlatformColor('secondaryLabel')),
            lineLimit(), fixedSize({ horizontal: false, vertical: true })]}>{row.label}</Text>
          <Text modifiers={[font({ textStyle: row.highlighted ? 'headline' : 'title3', weight: 'semibold' }), lineLimit(),
            fixedSize({ horizontal: false, vertical: true }), ...(row.highlighted ? [padding({ horizontal: 12, vertical: 8 }),
              background(PlatformColor('secondarySystemFill'), shapes.roundedRectangle({ cornerRadius: 14 }))] : [])]}>{row.value}</Text>
        </VStack>)}
      </Section>
      {trimCustomerInput(record.note) ? <Section title={text('noteTitle')}><Text>{record.note}</Text></Section> : null}
      {hasDiscussion && onOpenDiscussion ? <Section title={text('commentsTitle')}><Button label={text('openDiscussionAction')} onPress={() => {
        returningFromDiscussion.current = true; onOpenDiscussion(customerDiscussionEventId(deliveryNoteID));
      }} /></Section> : null}
      {detail.canApprove || detail.canPartiallyAccept || detail.canReject || detail.canReportClaim ? <Section title={text('responseTitle')}>
        {detail.canApprove ? <Button label={text(state.submitting ? 'sending' : 'approveAction')} modifiers={[disabled(state.submitting)]} onPress={() => setConfirm(true)} /> : null}
        {detail.canPartiallyAccept ? <Button label={text('partialAcceptAction')} modifiers={[disabled(state.submitting)]} onPress={() => setDialog('partial')} /> : null}
        {detail.canReject ? <Button label={text('rejectAction')} modifiers={[disabled(state.submitting)]} onPress={() => setDialog('reject')} /> : null}
        {detail.canReportClaim ? <Button label={text('reportIssueAction')} modifiers={[disabled(state.submitting)]} onPress={() => setDialog('claim')} /> : null}
      </Section> : null}
    </List></Host>
    <WorkerAlert alert={confirm ? { title: text('confirmTitle'), message: text('confirmQuestion'), cancelLabel: text('no'),
      confirmLabel: text('yes'), onConfirm: () => { void state.send(customerApproveAll(deliveryNoteID)); } } : null} onDismiss={() => setConfirm(false)} />
    <CustomerReturnDialog kind={dialog} sentQty={record.sent_qty} uom={record.uom} onCancel={() => setDialog(null)} onConfirm={onReturn} />
    <CustomerSnackbar message={state.message} onDismiss={state.clearMessage} />
  </>;
}

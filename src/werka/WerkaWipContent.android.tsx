import { ScrollView } from 'react-native';
import { PreparationRow } from '../preparation/PreparationUI.android';
import { uiText } from '../shared/localization';
import { WerkaReceiveFooter } from './WerkaReceiveFooter.android';
import { werkaWipContentActions, werkaWipLabel, werkaWipPresentation, type WerkaWipContentProps } from './werkaWipPresentation';

/** Partial body; shell, confirmation, guarded mutation and routes remain with the future screen. */
export function WerkaWipContent(props: WerkaWipContentProps) {
  const { preview, state } = props, view = werkaWipPresentation(preview, state), actions = werkaWipContentActions(props);
  const t = (value: string) => uiText(value, props.locale), label = (value: string) => werkaWipLabel(value, preview.apparatusNames);
  const receipt = state.receipt;
  const details = [t(view.order), t(view.qr), view.quantity, t(view.location), view.worker ? t(view.worker) : '', view.description, view.status].filter(Boolean).join('\n');
  return <ScrollView contentContainerStyle={{ paddingHorizontal: 8, paddingTop: 4, paddingBottom: 140, gap: 10 }}>
    <WerkaReceiveFooter {...props} warehouses={preview.warehouses} warehouseLabel={label}
      receiptWarehouse={label(String(receipt?.warehouse ?? ''))} receiptAcceptedBy={String(receipt?.accepted_by_display_name ?? '')}
      canReceive={actions.canReceive} beforeReceipt={<PreparationRow title={view.product} subtitle={details} />} />
  </ScrollView>;
}

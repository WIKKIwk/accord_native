import { Section, Text, VStack } from '@expo/ui/swift-ui';
import { PreparationList } from '../preparation/PreparationUI.ios';
import { uiText } from '../shared/localization';
import { WerkaReceiveFooter } from './WerkaReceiveFooter.ios';
import { werkaWipContentActions, werkaWipLabel, werkaWipPresentation, type WerkaWipContentProps } from './werkaWipPresentation';

/** Partial body; shell, confirmation, guarded mutation and routes remain with the future screen. */
export function WerkaWipContent(props: WerkaWipContentProps) {
  const { preview, state } = props, view = werkaWipPresentation(preview, state), actions = werkaWipContentActions(props);
  const t = (value: string) => uiText(value, props.locale), label = (value: string) => werkaWipLabel(value, preview.apparatusNames);
  const receipt = state.receipt;
  return <PreparationList><WerkaReceiveFooter {...props} warehouses={preview.warehouses} warehouseLabel={label}
    receiptWarehouse={label(String(receipt?.warehouse ?? ''))} receiptAcceptedBy={String(receipt?.accepted_by_display_name ?? '')}
    canReceive={actions.canReceive} beforeReceipt={<Section><VStack alignment="leading" spacing={6}>
      <Text>{view.product}</Text><Text>{t(view.order)}</Text><Text>{t(view.qr)}</Text><Text>{view.quantity}</Text>
      <Text>{t(view.location)}</Text>{view.worker ? <Text>{t(view.worker)}</Text> : null}
      {view.description ? <Text>{view.description}</Text> : null}<Text>{view.status}</Text>
    </VStack></Section>} /></PreparationList>;
}

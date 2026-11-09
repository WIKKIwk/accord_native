import { ScrollView } from 'react-native';
import { WorkerSheetButton } from '../components/WorkerSheetButton';
import { PreparationField, PreparationText } from '../preparation/PreparationUI.android';
import { werkaUnannouncedPresentation, type WerkaUnannouncedContentProps } from './werkaUnannouncedPresentation';

/** Unwired body: no picker, validation, confirmation, write or navigation is performed here. */
export function WerkaUnannouncedContent(props: WerkaUnannouncedContentProps) {
  const view = werkaUnannouncedPresentation(props);
  return <ScrollView contentContainerStyle={{ paddingHorizontal: 10, paddingTop: 4, paddingBottom: 136, gap: 10 }}>
    <PreparationText>{view.supplierLabel}</PreparationText>
    <WorkerSheetButton label={view.supplierName} disabled={!view.canPickSupplier}
      onPress={() => { if (view.canPickSupplier) props.onPickSupplier(); }} />
    {view.showItem ? <><PreparationText>{view.itemLabel}</PreparationText>
      <WorkerSheetButton label={view.itemName} disabled={!view.canPickItem}
        onPress={() => { if (view.canPickItem) props.onPickItem(); }} /></> : null}
    {view.showQuantity ? <PreparationField key={props.quantityFieldKey} label={view.quantityLabel} initial={props.initialQuantity}
      suffix={props.item?.uom} decimal onChange={props.onQuantityChange} /> : null}
    <WorkerSheetButton label={view.submitLabel} variant="filled" disabled={!view.canSubmit}
      onPress={() => { if (view.canSubmit) props.onRequestSubmit(); }} />
  </ScrollView>;
}

import { Button, RNHostView, Section, Text, VStack } from '@expo/ui/swift-ui';
import { disabled } from '@expo/ui/swift-ui/modifiers';
import { WorkerFormField } from '../components/WorkerFormField';
import { PreparationList } from '../preparation/PreparationUI.ios';
import { werkaUnannouncedPresentation, type WerkaUnannouncedContentProps } from './werkaUnannouncedPresentation';

/** Unwired body: no picker, validation, confirmation, write or navigation is performed here. */
export function WerkaUnannouncedContent(props: WerkaUnannouncedContentProps) {
  const view = werkaUnannouncedPresentation(props);
  return <PreparationList><Section><VStack alignment="leading" spacing={10}>
    <Text>{view.supplierLabel}</Text>
    <Button label={view.supplierName} modifiers={[disabled(!view.canPickSupplier)]}
      onPress={() => { if (view.canPickSupplier) props.onPickSupplier(); }} />
    {view.showItem ? <><Text>{view.itemLabel}</Text>
      <Button label={view.itemName} modifiers={[disabled(!view.canPickItem)]}
        onPress={() => { if (view.canPickItem) props.onPickItem(); }} /></> : null}
    {view.showQuantity ? <><RNHostView matchContents><WorkerFormField key={props.quantityFieldKey} label={view.quantityLabel}
      keyboardType="decimal-pad" initialValue={props.initialQuantity} onChangeText={props.onQuantityChange} /></RNHostView>
      <Text>{props.item?.uom}</Text></> : null}
    <Button label={view.submitLabel} modifiers={[disabled(!view.canSubmit)]}
      onPress={() => { if (view.canSubmit) props.onRequestSubmit(); }} />
  </VStack></Section></PreparationList>;
}

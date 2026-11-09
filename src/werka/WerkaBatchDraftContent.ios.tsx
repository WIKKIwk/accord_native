import { Button, HStack, Image, RNHostView, Section, Spacer, Text, VStack } from '@expo/ui/swift-ui';
import { accessibilityLabel, disabled, font } from '@expo/ui/swift-ui/modifiers';
import { PreparationList } from '../preparation/PreparationUI.ios';
import { WerkaBatchQuantityField } from './WerkaBatchQuantityField';
import { werkaBatchDraftPresentation, type WerkaBatchDraftContentProps } from './werkaBatchDraftModel';

/** Controlled form only. Picker owners, review navigation and submission remain unbound. */
export function WerkaBatchDraftContent(props: WerkaBatchDraftContentProps) {
  const { state } = props, view = werkaBatchDraftPresentation(state, props.locale);
  return <PreparationList><Section><VStack alignment="leading" spacing={10}>
    <Text modifiers={[font({ textStyle: 'title2' })]}>{view.title}</Text>
    {view.hasDrafts ? <HStack><Text>{view.draftCountLabel}</Text><Spacer />
      <Button modifiers={[disabled(true), accessibilityLabel(view.viewListTooltip)]}><Image systemName="list.bullet.rectangle" /></Button>
    </HStack> : null}
    <Text>{view.itemLabel}</Text><HStack><Button label={view.itemName} onPress={props.onPickItem} /><Spacer />
      {state.item !== null ? <Button onPress={props.onClearItem} modifiers={[accessibilityLabel(view.clearItemTooltip)]}>
        <Image systemName="xmark" /></Button> : null}</HStack>
    <Text>{view.customerLabel}</Text><HStack><Button label={view.customerName} onPress={props.onPickCustomer} /><Spacer />
      {state.customer !== null ? <Button onPress={props.onClearCustomer} modifiers={[accessibilityLabel(view.clearCustomerTooltip)]}>
        <Image systemName="xmark" /></Button> : null}</HStack>
    {view.phone !== null ? <Text>{view.phone}</Text> : null}
    {state.item !== null ? <><Text>{view.amountLabel}</Text><RNHostView matchContents>
      <WerkaBatchQuantityField key={props.quantityFieldKey} label={view.amountLabel} initial={state.quantityText} unit={state.item.uom}
        onChange={props.onQuantityChange} />
    </RNHostView></> : null}
    {view.hasDrafts ? <HStack><Button label={view.saveLabel} modifiers={[disabled(!view.sourceCanSave)]}
      onPress={() => { if (view.sourceCanSave) props.onSaveLine(); }} />
      <Button label={view.confirmLabel} modifiers={[disabled(true)]} /></HStack>
      : <Button label={view.saveLabel} modifiers={[disabled(!view.sourceCanSave)]}
        onPress={() => { if (view.sourceCanSave) props.onSaveLine(); }} />}
  </VStack></Section></PreparationList>;
}

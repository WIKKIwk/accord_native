import { Button, FilledTonalIconButton, Host, RNHostView, Text, useMaterialColors } from '@expo/ui/jetpack-compose';
import { fillMaxWidth, semantics } from '@expo/ui/jetpack-compose/modifiers';
import { SymbolView } from 'expo-symbols';
import { ScrollView, View } from 'react-native';
import { WorkerSheetButton } from '../components/WorkerSheetButton';
import { PreparationText } from '../preparation/PreparationUI.android';
import { WerkaBatchQuantityField } from './WerkaBatchQuantityField';
import { werkaBatchDraftPresentation, type WerkaBatchDraftContentProps } from './werkaBatchDraftModel';

/** Controlled form only. Picker owners, review navigation and submission remain unbound. */
export function WerkaBatchDraftContent(props: WerkaBatchDraftContentProps) {
  const { state } = props, view = werkaBatchDraftPresentation(state, props.locale), colors = useMaterialColors();
  const clear = (label: string, onPress: () => void) => <Host matchContents>
    <FilledTonalIconButton onClick={onPress} modifiers={[semantics({ contentDescription: label })]}>
      <RNHostView matchContents><SymbolView name={{ android: 'close' }} size={20} tintColor={colors.onSecondaryContainer} /></RNHostView>
    </FilledTonalIconButton></Host>;
  return <ScrollView contentContainerStyle={{ paddingHorizontal: 22, paddingTop: 20, paddingBottom: 24, gap: 10 }}>
    <PreparationText title>{view.title}</PreparationText>
    {view.hasDrafts ? <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}><PreparationText>{view.draftCountLabel ?? ''}</PreparationText>
      <Host matchContents><FilledTonalIconButton enabled={false} modifiers={[semantics({ contentDescription: view.viewListTooltip })]}>
        <RNHostView matchContents><SymbolView name={{ android: 'list_alt' }} size={20} tintColor={colors.onSurfaceVariant} /></RNHostView>
      </FilledTonalIconButton></Host></View> : null}
    <PreparationText>{view.itemLabel}</PreparationText><View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
      <View style={{ flex: 1 }}><WorkerSheetButton label={view.itemName} onPress={props.onPickItem} /></View>
      {state.item !== null ? clear(view.clearItemTooltip, props.onClearItem) : null}
    </View>
    <PreparationText>{view.customerLabel}</PreparationText><View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
      <View style={{ flex: 1 }}><WorkerSheetButton label={view.customerName} onPress={props.onPickCustomer} /></View>
      {state.customer !== null ? clear(view.clearCustomerTooltip, props.onClearCustomer) : null}
    </View>
    {view.phone !== null ? <PreparationText>{view.phone}</PreparationText> : null}
    {state.item !== null ? <><PreparationText>{view.amountLabel}</PreparationText>
      <WerkaBatchQuantityField key={props.quantityFieldKey} label={view.amountLabel} initial={state.quantityText} unit={state.item.uom}
        onChange={props.onQuantityChange} /></> : null}
    {view.hasDrafts ? <View style={{ flexDirection: 'row', gap: 12 }}>
      <View style={{ flex: 1 }}><WorkerSheetButton label={view.saveLabel} disabled={!view.sourceCanSave}
        onPress={() => { if (view.sourceCanSave) props.onSaveLine(); }} /></View>
      <View style={{ flex: 1 }}><Host matchContents={{ vertical: true }} style={{ width: '100%' }}>
        <Button enabled={false} modifiers={[fillMaxWidth()]}><Text>{view.confirmLabel}</Text></Button></Host></View>
    </View> : <WorkerSheetButton label={view.saveLabel} variant="filled" disabled={!view.sourceCanSave}
      onPress={() => { if (view.sourceCanSave) props.onSaveLine(); }} />}
  </ScrollView>;
}

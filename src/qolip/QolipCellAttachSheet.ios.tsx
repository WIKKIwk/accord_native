import { Button, Host, HStack, Image, ProgressView, Spacer, Text, VStack } from '@expo/ui/swift-ui';
import { buttonStyle, disabled, frame } from '@expo/ui/swift-ui/modifiers';
import { useEffect, useRef } from 'react';
import { Alert, View } from 'react-native';
import { PreparationNotice } from '../preparation/PreparationNotice';
import { QolipCellPicker } from './QolipCellPicker';
import type { QolipCellAttachSheetProps } from './qolipCellAttachSheetProps';
import { qolipPlacementFormProductLabel } from './qolipCellPlacement';
import { useQolipCellAttach } from './useQolipCellAttach';

// Cell placement only. Scanner and the home-grid caller remain open.
export function QolipCellAttachSheet(props: QolipCellAttachSheetProps) {
  const state = useQolipCellAttach(props, QolipCellPicker), latest = useRef(state);
  useEffect(() => { latest.current = state; }, [state]);
  const { pending } = state;
  useEffect(() => {
    if (!pending) return;
    const current = latest.current, target = pending.target;
    Alert.alert(current.text('home.place_confirm_title'), current.text('home.place_confirm_message', {
      count: pending.products.length, block: target.block.name, cell: `${target.rowLetter}${target.columnNumber}`,
    }), [
      { text: current.text('action.cancel'), style: 'cancel', onPress: () => latest.current.cancelConfirm() },
      { text: current.text('action.place'), onPress: () => latest.current.confirm() },
    ], { cancelable: true, onDismiss: () => latest.current.cancelConfirm() });
  }, [pending]);
  const item = state.selected[0], selectedLabel = state.selected.length > 1
    ? state.text('products.mold_count', { count: state.selected.length }) : item ? qolipPlacementFormProductLabel(item)
      : state.text('home.mold_code_or_product_hint');
  return <View style={{ padding: 16 }}><Host matchContents={{ vertical: true }}><VStack alignment="leading" spacing={12}>
    <Text>{state.text('home.cell_attach')}</Text>
    {state.block && state.rowLetter !== null && state.columnNumber !== null && <VStack alignment="leading">
      <Text>{state.text('home.location')}</Text><Text>{`${state.block.name} • ${state.rowLetter}${state.columnNumber}`}</Text>
    </VStack>}
    <Text>{state.text('home.code_or_product')}</Text>
    <Button onPress={state.openPicker} modifiers={[disabled(state.saving), frame({ maxWidth: Infinity, alignment: 'leading' })]}>
      <HStack><Text>{selectedLabel}</Text><Spacer /><Image systemName="magnifyingglass" /></HStack>
    </Button>
    {state.showMold && <VStack alignment="leading"><Text>{state.text('home.mold_label')}</Text><Text>{state.selected.length === 1
      ? `${item.qolip_code} • ${item.size}` : state.text('products.mold_count', { count: state.selected.length })}</Text></VStack>}
    {state.saving ? <ProgressView /> : <Button label={state.text('action.save')} onPress={state.save}
      modifiers={[buttonStyle('borderedProminent'), disabled(!state.canSave), frame({ maxWidth: Infinity })]} />}
  </VStack></Host><PreparationNotice message={state.notice} /></View>;
}

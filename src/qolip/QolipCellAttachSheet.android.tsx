import { AlertDialog, Button, CircularProgressIndicator, Column, Host, OutlinedButton, Text, TextButton } from '@expo/ui/jetpack-compose';
import { fillMaxWidth, size, testID } from '@expo/ui/jetpack-compose/modifiers';
import { View, useWindowDimensions } from 'react-native';
import { PreparationNotice } from '../preparation/PreparationNotice';
import { QolipCellPicker } from './QolipCellPicker';
import type { QolipCellAttachSheetProps } from './qolipCellAttachSheetProps';
import { qolipPlacementFormProductLabel } from './qolipCellPlacement';
import { useQolipCellAttach } from './useQolipCellAttach';

// Cell placement only. Scanner and the home-grid caller remain open.
export function QolipCellAttachSheet(props: QolipCellAttachSheetProps) {
  const state = useQolipCellAttach(props, QolipCellPicker), { width, height } = useWindowDimensions();
  const item = state.selected[0], selectedLabel = state.selected.length > 1
    ? state.text('products.mold_count', { count: state.selected.length }) : item ? qolipPlacementFormProductLabel(item)
      : state.text('home.mold_code_or_product_hint');
  return <View style={{ padding: 16 }}><Host matchContents={{ vertical: true }}><Column>
    <Text>{state.text('home.cell_attach')}</Text>
    {state.block && state.rowLetter !== null && state.columnNumber !== null && <Column>
      <Text>{state.text('home.location')}</Text><Text>{`${state.block.name} • ${state.rowLetter}${state.columnNumber}`}</Text>
    </Column>}
    <Text>{state.text('home.code_or_product')}</Text>
    <OutlinedButton enabled={!state.saving} onClick={state.openPicker} modifiers={[fillMaxWidth(), testID('qolip-attach-picker')]}>
      <Text>{selectedLabel}</Text>
    </OutlinedButton>
    {state.showMold && <Column><Text>{state.text('home.mold_label')}</Text><Text>{state.selected.length === 1
      ? `${item.qolip_code} • ${item.size}` : state.text('products.mold_count', { count: state.selected.length })}</Text></Column>}
    <Button enabled={state.canSave && !state.saving} onClick={state.save} modifiers={[fillMaxWidth(), testID('qolip-attach-save')]}>
      {state.saving ? <CircularProgressIndicator modifiers={[size(18, 18)]} /> : <Text>{state.text('action.save')}</Text>}
    </Button>
  </Column></Host><PreparationNotice message={state.notice} />
  {state.pending && <Host style={{ position: 'absolute', top: 0, left: 0, width, height }} pointerEvents="none">
    <AlertDialog onDismissRequest={state.cancelConfirm}>
      <AlertDialog.Title><Text>{state.text('home.place_confirm_title')}</Text></AlertDialog.Title>
      <AlertDialog.Text><Text>{state.text('home.place_confirm_message', { count: state.pending.products.length,
        block: state.pending.target.block.name, cell: `${state.pending.target.rowLetter}${state.pending.target.columnNumber}` })}</Text></AlertDialog.Text>
      <AlertDialog.DismissButton><TextButton onClick={state.cancelConfirm}><Text>{state.text('action.cancel')}</Text></TextButton></AlertDialog.DismissButton>
      <AlertDialog.ConfirmButton><TextButton onClick={state.confirm} modifiers={[testID('qolip-attach-confirm')]}><Text>{state.text('action.place')}</Text></TextButton></AlertDialog.ConfirmButton>
    </AlertDialog>
  </Host>}
  </View>;
}

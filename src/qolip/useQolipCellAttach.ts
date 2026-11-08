import { createElement, useRef, useState, type ComponentType } from 'react';
import { useNativeSheet } from '../nativeSheet';
import { extensionText } from '../shared/localization';
import type { QolipCellAttachSheetProps } from './qolipCellAttachSheetProps';
import type { QolipCellPickerProps } from './qolipCellPickerProps';
import type { QolipPlacementProduct } from './qolipCellPlacement';
import type { QolipCellPlacementPrepared, QolipCellPlacementResult } from './qolipCellPlacementState';
import { qolipErrorMessage } from './qolipErrorMessage';
import { useQolipCellPlacement } from './useQolipCellPlacement';
import { useQolipNotice } from './useQolipNotice';
import { useQolipText } from './useQolipText';

type PickerResult = { kind: 'single'; item: QolipPlacementProduct } | { kind: 'multi'; items: QolipPlacementProduct[] };
export function useQolipCellAttach(props: QolipCellAttachSheetProps, Picker: ComponentType<QolipCellPickerProps>) {
  const state = useQolipCellPlacement(props.session, props.blocks, { initialBlock: props.initialBlock, rowLetter: props.rowLetter,
    columnNumber: props.columnNumber, product: props.initialProduct });
  const { text, locale } = useQolipText(), sheet = useNativeSheet(), notice = useQolipNotice();
  const [pending, setPending] = useState<QolipCellPlacementPrepared | null>(null);
  const picked = useRef<PickerResult | null>(null);
  const finish = (result: QolipCellPlacementResult) => {
    if (!result) return;
    if (result.kind === 'saved') props.saved(result);
    else if (result.kind === 'partial') notice.show(text('home.place_partial', { success: result.saved, failed: result.failed }));
    else if (result.kind === 'failed') notice.show(qolipErrorMessage(result.error, locale, text('home.place_all_failed')));
    else notice.show(extensionText('qolipReworkText', 'session_changed', locale));
  };
  const openPicker = () => {
    if (state.controller.getSnapshot().saving || sheet.isOpen()) return;
    picked.current = null;
    sheet.open(createElement(Picker, { placement: state.controller, close: () => sheet.close(),
      single: (item: QolipPlacementProduct) => { picked.current = { kind: 'single', item }; sheet.close(); },
      multiple: (items: QolipPlacementProduct[]) => { picked.current = { kind: 'multi', items }; sheet.close(); } }),
    { dismissible: true, onDismiss: () => {
      const result = picked.current; picked.current = null;
      if (result?.kind === 'single') state.controller.selectProduct(result.item);
      else if (result?.kind === 'multi') setPending(state.controller.prepareMulti(result.items));
    } });
  };
  const save = () => { void state.controller.saveSelected().then(finish); };
  const confirm = () => { if (!pending) return; const value = pending; setPending(null); void state.controller.confirmMulti(value).then(finish); };
  return { ...state, showMold: state.selected.length > 0 && state.selected.every(product => product.has_qolip_spec), text, locale, notice: notice.message, pending, openPicker, save, confirm, cancelConfirm: () => setPending(null) };
}

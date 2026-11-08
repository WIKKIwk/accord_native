import { AlertDialog, Column, Host, OutlinedTextField, Text, TextButton, useMaterialColors, useNativeState } from '@expo/ui/jetpack-compose';
import { fillMaxWidth, testID } from '@expo/ui/jetpack-compose/modifiers';
import { SymbolView } from 'expo-symbols';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text as NativeText, View, useWindowDimensions } from 'react-native';
import { useSharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { WorkerQueueCard } from '../components/WorkerQueueCard.android';
import { useNativeSheet } from '../nativeSheet';
import { PreparationNotice } from '../preparation/PreparationNotice';
import { OrdersHeader } from '../shared/orders/OrdersHeader';
import { OrdersList } from '../shared/orders/OrdersList';
import type { QolipBlock } from './qolipBlocksApi';
import type { QolipBlocksScreenProps } from './qolipBlocksScreenProps';
import { qolipErrorMessage } from './qolipErrorMessage';
import { useQolipBlocks } from './useQolipBlocks';
import { useQolipText } from './useQolipText';

type Texts = ReturnType<typeof useQolipText>['text'];
function Actions({ text, choose }: { text: Texts; choose: (action: 'edit' | 'delete') => void }) {
  return <Host matchContents={{ vertical: true }}><Column>
    <TextButton onClick={() => choose('edit')}><Text>{text('action.edit')}</Text></TextButton>
    <TextButton onClick={() => choose('delete')}><Text>{text('action.delete')}</Text></TextButton>
  </Column></Host>;
}
function EditDialog({ block, text, close, save }: { block: QolipBlock; text: Texts; close: () => void; save: (name: string) => void }) {
  const value = useNativeState(block.name), { width, height } = useWindowDimensions();
  return <Host style={{ position: 'absolute', top: 0, left: 0, width, height }} pointerEvents="none">
    <AlertDialog onDismissRequest={close}>
      <AlertDialog.Title><Text>{text('blocks.edit_title')}</Text></AlertDialog.Title>
      <AlertDialog.Text><OutlinedTextField value={value} autoFocus singleLine modifiers={[fillMaxWidth()]}
        keyboardOptions={{ capitalization: 'characters', imeAction: 'done' }} keyboardActions={{ onDone: save }}>
        <OutlinedTextField.Label><Text>{text('blocks.name')}</Text></OutlinedTextField.Label>
      </OutlinedTextField></AlertDialog.Text>
      <AlertDialog.DismissButton><TextButton onClick={close}><Text>{text('action.cancel')}</Text></TextButton></AlertDialog.DismissButton>
      <AlertDialog.ConfirmButton><TextButton onClick={() => save(value.get())} modifiers={[testID('qolip-block-save')]}>
        <Text>{text('action.save')}</Text></TextButton></AlertDialog.ConfirmButton>
    </AlertDialog>
  </Host>;
}
function DeleteDialog({ block, text, close, confirm }: { block: QolipBlock; text: Texts; close: () => void; confirm: () => void }) {
  const { width, height } = useWindowDimensions();
  return <Host style={{ position: 'absolute', top: 0, left: 0, width, height }} pointerEvents="none">
    <AlertDialog onDismissRequest={close}>
      <AlertDialog.Title><Text>{text('blocks.delete_title')}</Text></AlertDialog.Title>
      <AlertDialog.Text><Text>{text('blocks.delete_message', { name: block.name })}</Text></AlertDialog.Text>
      <AlertDialog.DismissButton><TextButton onClick={close}><Text>{text('action.cancel')}</Text></TextButton></AlertDialog.DismissButton>
      <AlertDialog.ConfirmButton><TextButton onClick={confirm} modifiers={[testID('qolip-block-delete')]}>
        <Text>{text('action.delete')}</Text></TextButton></AlertDialog.ConfirmButton>
    </AlertDialog>
  </Host>;
}
const passthrough = () => true;

// QolipBlocksScreen remains unwired until the role navigation and focus behavior are complete.
export function QolipBlocksScreen({ session, onMenu, onProfile, dock }: QolipBlocksScreenProps) {
  const { text, locale } = useQolipText(), state = useQolipBlocks(session), sheet = useNativeSheet();
  const [editing, setEditing] = useState<QolipBlock | null>(null), [deleting, setDeleting] = useState<QolipBlock | null>(null);
  const afterSheet = useRef<(() => void) | null>(null), colors = useMaterialColors(), insets = useSafeAreaInsets();
  const headerOffset = useSharedValue(0), headerHeight = useSharedValue(0);
  useEffect(() => {
    if (!state.notice) return;
    const timer = setTimeout(state.dismissNotice, 4000);
    return () => clearTimeout(timer);
  }, [state.notice, state.dismissNotice]);
  const notice = state.notice ? 'error' in state.notice
    ? qolipErrorMessage(state.notice.error, locale, text(`blocks.${state.notice.kind}`))
    : text(`blocks.${state.notice.kind}`) : '';
  const openActions = (block: QolipBlock) => {
    if (state.saving) return;
    sheet.open(<Actions text={text} choose={action => {
      afterSheet.current = () => { if (action === 'edit') setEditing(block); else setDeleting(block); }; sheet.close();
    }} />, { compact: true, dismissible: true, onDismiss: () => { const next = afterSheet.current; afterSheet.current = null; next?.(); } });
  };
  return <View style={{ flex: 1, backgroundColor: colors.surfaceContainerLow, paddingTop: insets.top }}>
    <OrdersHeader search={state.query} searchPlaceholder={text('blocks.search')} onSearchChange={state.controller.setQuery.bind(state.controller)}
      onMenu={onMenu} onProfile={onProfile} />
    {state.loading ? <View style={styles.center}><ActivityIndicator /></View>
      : state.error ? <View style={styles.center}><Host matchContents={{ vertical: true }}><Column>
        <Text>{text('blocks.load_failed')}</Text><TextButton onClick={() => { void state.controller.reload().catch(() => {}); }}
          modifiers={[testID('qolip-block-retry')]}><Text>{text('action.retry')}</Text></TextButton>
      </Column></Host></View> : <OrdersList active passthrough={passthrough}
        onRefresh={async () => { await state.controller.reload().catch(() => {}); }}
        headerOffset={headerOffset} headerHeight={headerHeight} topInset={0}>
        {!state.filtered.length && <Host matchContents={{ vertical: true }}><Text>{text('blocks.empty')}</Text></Host>}
        {state.filtered.map((block, index) => <WorkerQueueCard key={`${block.warehouse}:${block.name}:${index}`}
          backgroundColor={colors.surface} first={index === 0} last={index === state.filtered.length - 1}
          onLongPress={() => openActions(block)}>
          <SymbolView name={{ android: 'view_module' }} size={24} tintColor={colors.onSurfaceVariant} />
          <View style={styles.row}><NativeText style={{ color: colors.onSurface, fontSize: 16 }}>{block.name}</NativeText>
            <NativeText style={{ color: colors.onSurfaceVariant, fontSize: 14 }}>{block.warehouse}</NativeText></View>
        </WorkerQueueCard>)}
      </OrdersList>}
    {dock}<PreparationNotice message={notice} />
    {editing && <EditDialog key={`${editing.warehouse}:${editing.name}`} block={editing} text={text} close={() => setEditing(null)}
      save={name => { const block = editing; setEditing(null); void state.controller.edit(block, name); }} />}
    {deleting && <DeleteDialog block={deleting} text={text} close={() => setDeleting(null)} confirm={() => {
      const block = deleting; setDeleting(null); void state.controller.remove(block);
    }} />}
  </View>;
}
const styles = StyleSheet.create({ center: { flex: 1, alignItems: 'center', justifyContent: 'center' }, row: { flex: 1, marginStart: 16 } });

import { Button, Host, HStack, Image, ProgressView, Section, Text, TextField, VStack, useNativeState } from '@expo/ui/swift-ui';
import { contentShape, frame, onLongPressGesture, onSubmit, shapes, submitLabel, textInputAutocapitalization } from '@expo/ui/swift-ui/modifiers';
import { useEffect, useRef, useState } from 'react';
import { Alert, KeyboardAvoidingView, Modal, PlatformColor, Pressable, StyleSheet, View } from 'react-native';
import { useSharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useWorkerColors } from '../components/useWorkerColors';
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
  return <Host matchContents={{ vertical: true }}><VStack spacing={12}>
    <Button label={text('action.edit')} onPress={() => choose('edit')} />
    <Button label={text('action.delete')} role="destructive" onPress={() => choose('delete')} />
  </VStack></Host>;
}
function BlockRow({ block, actions }: { block: QolipBlock; actions: () => void }) {
  return <HStack modifiers={[frame({ maxWidth: Infinity, alignment: 'leading' }), contentShape(shapes.rectangle()), onLongPressGesture(actions)]}><Image systemName="square.grid.3x3" />
    <VStack alignment="leading"><Text>{block.name}</Text><Text>{block.warehouse}</Text></VStack>
  </HStack>;
}
function EditDialog({ block, text, close, save }: { block: QolipBlock; text: Texts; close: () => void; save: (name: string) => void }) {
  const colors = useWorkerColors(), value = useNativeState(block.name);
  const submit = () => save(value.get());
  return <Modal visible transparent animationType="fade" onRequestClose={close}>
    <KeyboardAvoidingView behavior="padding" style={styles.backdrop}>
      <Pressable style={StyleSheet.absoluteFill} onPress={close} />
      <View accessibilityViewIsModal style={[styles.dialog, { backgroundColor: colors.surface }]}>
        <Host matchContents={{ vertical: true }}><VStack spacing={14}>
          <Text>{text('blocks.edit_title')}</Text>
          <TextField text={value} autoFocus placeholder={text('blocks.name')}
            modifiers={[textInputAutocapitalization('characters'), submitLabel('done'), onSubmit(submit)]} />
          <Button label={text('action.save')} onPress={submit} />
          <Button label={text('action.cancel')} role="cancel" onPress={close} />
        </VStack></Host>
      </View>
    </KeyboardAvoidingView>
  </Modal>;
}

// QolipBlocksScreen remains unwired until the role navigation and focus behavior are complete.
export function QolipBlocksScreen({ session, onMenu, onProfile, dock }: QolipBlocksScreenProps) {
  const { text, locale } = useQolipText(), state = useQolipBlocks(session), sheet = useNativeSheet();
  const [editing, setEditing] = useState<QolipBlock | null>(null), afterSheet = useRef<(() => void) | null>(null);
  const insets = useSafeAreaInsets(), headerOffset = useSharedValue(0), headerHeight = useSharedValue(0);
  useEffect(() => {
    if (!state.notice) return;
    const timer = setTimeout(state.dismissNotice, 4000);
    return () => clearTimeout(timer);
  }, [state.notice, state.dismissNotice]);
  const notice = state.notice ? 'error' in state.notice
    ? qolipErrorMessage(state.notice.error, locale, text(`blocks.${state.notice.kind}`))
    : text(`blocks.${state.notice.kind}`) : '';
  const perform = (block: QolipBlock, action: 'edit' | 'delete') => {
    if (action === 'edit') { setEditing(block); return; }
    Alert.alert(text('blocks.delete_title'), text('blocks.delete_message', { name: block.name }), [
      { text: text('action.cancel'), style: 'cancel' },
      { text: text('action.delete'), style: 'destructive', onPress: () => { void state.controller.remove(block); } },
    ]);
  };
  const openActions = (block: QolipBlock) => {
    if (state.saving) return;
    sheet.open(<Actions text={text} choose={action => { afterSheet.current = () => perform(block, action); sheet.close(); }} />,
      { compact: true, dismissible: true, onDismiss: () => { const next = afterSheet.current; afterSheet.current = null; next?.(); } });
  };
  return <View style={{ flex: 1, paddingTop: insets.top }}>
    <OrdersHeader search={state.query} searchPlaceholder={text('blocks.search')} onSearchChange={state.controller.setQuery.bind(state.controller)}
      onMenu={onMenu} onProfile={onProfile} />
    {state.loading ? <View style={styles.center}><Host matchContents><ProgressView /></Host></View>
      : state.error ? <View style={styles.center}><Host matchContents><VStack spacing={12}>
        <Text>{text('blocks.load_failed')}</Text><Button label={text('action.retry')} onPress={() => { void state.controller.reload().catch(() => {}); }} />
      </VStack></Host></View> : <Host style={{ flex: 1 }}><OrdersList active
        onRefresh={async () => { await state.controller.reload().catch(() => {}); }}
        headerOffset={headerOffset} headerHeight={headerHeight} topInset={0}><Section>
          {!state.filtered.length && <Text>{text('blocks.empty')}</Text>}
          {state.filtered.map((block, index) => <BlockRow key={`${block.warehouse}:${block.name}:${index}`}
            block={block} actions={() => openActions(block)} />)}
        </Section></OrdersList></Host>}
    {dock}<PreparationNotice message={notice} />
    {editing && <EditDialog key={`${editing.warehouse}:${editing.name}`} block={editing} text={text} close={() => setEditing(null)}
      save={name => { const block = editing; setEditing(null); void state.controller.edit(block, name); }} />}
  </View>;
}
const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  backdrop: { flex: 1, justifyContent: 'center', paddingHorizontal: 24, backgroundColor: PlatformColor('systemFill') },
  dialog: { borderRadius: 20, padding: 24 },
});

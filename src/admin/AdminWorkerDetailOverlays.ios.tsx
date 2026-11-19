import { BottomSheet, Button, Group, HStack, Image, List, ProgressView, RNHostView, Text, TextField, VStack, useNativeState } from '@expo/ui/swift-ui';
import { accessibilityIdentifier, accessibilityLabel, background, buttonStyle, controlSize, cornerRadius, disabled, font, foregroundStyle, frame, labelStyle,
  listRowBackground, listRowInsets, listRowSeparator, listStyle, onAppear, padding, presentationDetents, presentationDragIndicator, scrollContentBackground, useScrollGeometryChange } from '@expo/ui/swift-ui/modifiers';
import { useRef, useState, type ReactNode } from 'react';
import { Modal, Platform, Pressable, StyleSheet, View } from 'react-native';
import { BaseHost } from '../components/BaseHost.ios';
import { useBaseTheme } from '../components/useBaseTheme';
import type { AdminWorkerDetailOverlay, AdminWorkerDetailScreenModel } from './useAdminWorkerDetail';
export type AdminWorkerDetailOverlaysModel = Pick<AdminWorkerDetailScreenModel, 'a' | 't' | 'current' | 'overlays'> & {
  /** Optional original selection/lifetime ticket committed only after the native warehouse picker closes. */
  prepareWarehousePickerClose?: (id: number, confirmed: boolean) => (() => void) | null;
};

function Confirmation({ overlay }: { overlay: AdminWorkerDetailOverlay }) {
  const { editor, id } = overlay, labels = editor.dialogText!, { colors } = useBaseTheme();
  return <Modal transparent visible animationType="fade" onRequestClose={() => editor.dismissDialog(id)}><View style={styles.modal}>
    <Pressable accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={StyleSheet.absoluteFill} onPress={() => editor.dismissDialog(id)} />
    <View style={[styles.card, { backgroundColor: colors.surfaceContainerHigh, borderColor: colors.outlineVariant }]}><BaseHost matchContents={{ vertical: true }} style={styles.fullWidth}>
      <VStack alignment="leading" spacing={0} modifiers={[padding({ leading: 24, top: 24, trailing: 24, bottom: 20 }), frame({ maxWidth: Infinity, alignment: 'leading' })]}>
        <Text modifiers={[font({ textStyle: 'title2' })]}>{labels.title}</Text><Text modifiers={[font({ textStyle: 'body' }), foregroundStyle('secondary'), padding({ top: 10 })]}>{labels.message}</Text>
        <HStack spacing={12} modifiers={[padding({ top: 22 }), frame({ maxWidth: Infinity })]}>
          <Button label={labels.cancel} onPress={() => editor.dismissDialog(id)} modifiers={[buttonStyle('bordered'), controlSize('large'), frame({ maxWidth: Infinity, minHeight: 56 })]} />
          <Button label={labels.confirm} onPress={() => editor.confirmRemove(id)} modifiers={[buttonStyle('borderedProminent'), controlSize('large'), frame({ maxWidth: Infinity, minHeight: 56 }), accessibilityIdentifier('admin-worker-detail-editor-remove-confirm')]} />
        </HStack>
      </VStack>
    </BaseHost></View>
  </View></Modal>;
}
function Picker({ overlay, model, children }: { overlay: AdminWorkerDetailOverlay; model: AdminWorkerDetailOverlaysModel; children: ReactNode }) {
  const { editor, id } = overlay, picker = editor.state.picker!, warehouse = picker.kind === 'warehouse', query = useNativeState(picker.query), { colors } = useBaseTheme();
  const [presented, setPresented] = useState(true), pending = useRef<null | (() => void)>(null), closing = useRef(false);
  const hide = (action: () => void, confirmed = false) => { if (!editor.canInteractOverlay(id) || closing.current) return;
    const commit = warehouse && model.prepareWarehousePickerClose ? model.prepareWarehousePickerClose(id, confirmed) : action; if (!commit) return;
    closing.current = true; pending.current = commit; setPresented(false); };
  const geometry = useScrollGeometryChange(value => { if (!warehouse) editor.materialScroll(id, value.contentHeight - value.contentOffsetY - value.containerHeight); });
  return <BottomSheet isPresented={presented} onIsPresentedChange={value => { if (!value) hide(() => editor.dismissPicker(id)); }} onDismiss={() => { const action = pending.current ?? (() => editor.dismissPicker(id)); pending.current = null; action(); }}>
    <Group modifiers={[presentationDetents([{ fraction: warehouse ? .72 : .66 }]), presentationDragIndicator('visible')]}>
      <VStack spacing={0} modifiers={[padding({ leading: warehouse ? 0 : 12, trailing: warehouse ? 0 : 12, top: 12, bottom: warehouse ? 0 : 24 }), frame({ maxWidth: Infinity, maxHeight: Infinity })]}>
        <HStack spacing={8} modifiers={[padding({ leading: warehouse ? 16 : 0, trailing: warehouse ? 8 : 0, bottom: warehouse ? 8 : 14 })]}>
          <Text modifiers={[font({ textStyle: 'title2', weight: warehouse ? 'heavy' : 'regular' }), frame({ maxWidth: Infinity, alignment: 'leading' })]}>{warehouse ? model.a('warehouse.picker_title') : 'Homashyo tanlang'}</Text>
          <Button label={model.a('action.close')} systemImage="xmark" onPress={() => hide(() => editor.dismissPicker(id))} modifiers={[buttonStyle('plain'), labelStyle('iconOnly'), frame({ minWidth: 44, minHeight: 44 }), accessibilityLabel(model.a('action.close'))]} />
        </HStack>
        <HStack spacing={16} modifiers={[padding({ horizontal: 18 }), frame({ minHeight: 58 }), background(colors.surfaceContainerHighest), cornerRadius(warehouse ? 16 : 999), padding({ horizontal: warehouse ? 16 : 0 })]}>
          <Image systemName="magnifyingglass" size={26} modifiers={[foregroundStyle('secondary')]} /><TextField text={query} placeholder={warehouse ? model.a('warehouse.picker_search') : 'Qidirish'} onTextChange={value => editor.search(id, value)}
            modifiers={[accessibilityIdentifier(warehouse ? 'admin-material-warehouses-search' : 'admin-worker-detail-material-search')]} />
        </HStack>
        <List modifiers={[listStyle('plain'), scrollContentBackground('hidden'), ...(geometry ? [geometry] : []), padding({ top: warehouse ? 10 : 14 })]}>
          {warehouse ? editor.warehouses.length ? editor.warehouses.map(name => <Button key={name} onPress={() => editor.selectWarehouse(id, name)} modifiers={[buttonStyle('plain'), listRowSeparator('hidden'), listRowBackground('transparent'), listRowInsets({ top: 0, leading: 12, bottom: 6, trailing: 12 }), accessibilityIdentifier(`admin-material-warehouse-${name.toLowerCase()}`)]}>
            <HStack spacing={16} modifiers={[frame({ maxWidth: Infinity, minHeight: 56, alignment: 'leading' }), padding({ horizontal: 16, vertical: 8 }), background(picker.kind === 'warehouse' && picker.selected === name ? colors.primaryContainer : colors.surfaceContainerHighest), cornerRadius(16)]}>
              <Image systemName="building.2" size={24} /><Text modifiers={[frame({ maxWidth: Infinity, alignment: 'leading' })]}>{name}</Text><Image systemName={picker.kind === 'warehouse' && picker.selected === name ? 'checkmark.circle.fill' : 'circle'} size={24} />
            </HStack>
          </Button>) : <Text>{model.a('warehouse.picker_empty')}</Text> : picker.loading ? <ProgressView /> : picker.error ? <VStack spacing={12}><Text>{model.t('serverDisconnectedRetry')}</Text><Button label={model.t('retry')} onPress={() => editor.retryMaterial(id)} /></VStack>
            : <><List.ForEach data={editor.materials} keyExtractor={(item, index) => `${item.id}:${index}`} estimatedItemSize={86}>{({ item, index }) => <Button onPress={() => hide(() => editor.selectMaterial(id, item))}
              modifiers={[buttonStyle('plain'), listRowSeparator('hidden'), listRowBackground('transparent'), listRowInsets({ top: 0, leading: 0, bottom: 2, trailing: 0 }),
                onAppear(() => { if (Number(Platform.Version) < 18 && index === editor.materials.length - 1) editor.materialScroll(id, 0); })]}>
              <VStack alignment="leading" spacing={6} modifiers={[padding({ horizontal: 18, vertical: 16 }), frame({ maxWidth: Infinity, alignment: 'leading' }), background(colors.surfaceContainerHighest), cornerRadius(18)]}>
                <Text modifiers={[font({ textStyle: 'title2', weight: 'bold' })]}>{item.name}</Text><Text modifiers={[font({ textStyle: 'caption' }), foregroundStyle('secondary')]}>{`${item.variants.length} mikron varianti`}</Text>
              </VStack>
            </Button>}</List.ForEach>{!editor.materials.length ? <Text>{model.t('noRecordsYet')}</Text> : null}{picker.loadingMore ? <ProgressView /> : null}</>}
        </List>
        {warehouse ? <Button label={model.a('action.confirm')} systemImage="checkmark" onPress={() => hide(() => editor.confirmWarehouse(id), true)} modifiers={[buttonStyle('borderedProminent'), controlSize('large'), disabled(picker.kind !== 'warehouse' || picker.selected === null), frame({ maxWidth: Infinity, minHeight: 56 }), padding({ leading: 16, top: 8, trailing: 16, bottom: 16 }), accessibilityIdentifier('admin-material-warehouse-confirm')]} /> : null}
      </VStack>
      {children}
    </Group>
  </BottomSheet>;
}
function OverlayStack({ model, index }: { model: AdminWorkerDetailOverlaysModel; index: number }): ReactNode {
  const overlay = model.overlays[index]; if (!overlay) return null;
  const next = <OverlayStack model={model} index={index + 1} />;
  // A second SwiftUI sheet must be attached to the first sheet's presented content.
  return overlay.type === 'picker' ? <Picker key={overlay.id} overlay={overlay} model={model}>{next}</Picker> : <Group><RNHostView matchContents><View><Confirmation overlay={overlay} /></View></RNHostView>{next}</Group>;
}
/** Independent source editors retain native presentation order instead of merging their busy states. */
export function WorkerDetailOverlays({ model }: { model: AdminWorkerDetailOverlaysModel }) {
  if (!model.overlays.length || !model.current()) return null;
  return <View pointerEvents="box-none" style={StyleSheet.absoluteFill}><BaseHost style={styles.host}><OverlayStack model={model} index={0} /></BaseHost></View>;
}
const styles = StyleSheet.create({ host: { position: 'absolute', width: '100%' }, fullWidth: { width: '100%' }, modal: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24, backgroundColor: 'rgba(0,0,0,.54)' },
  card: { width: '100%', maxWidth: 420, borderRadius: 28, borderWidth: 1, overflow: 'hidden' } });

import { BottomSheet, Button, Group, HStack, Image, LazyVStack, List, ProgressView, RNHostView, ScrollView, Spacer, Text, TextField, Toggle, VStack, useNativeState } from '@expo/ui/swift-ui';
import { accessibilityIdentifier, accessibilityLabel, animation, Animation, background, buttonStyle, clipped, controlSize, cornerRadius, disabled, font, foregroundStyle, frame,
  labelStyle, listRowBackground, listRowInsets, listRowSeparator, listStyle, onGeometryChange, opacity, padding, presentationDetents, presentationDragIndicator, scrollContentBackground, textFieldStyle } from '@expo/ui/swift-ui/modifiers';
import { useCallback, useState } from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useBaseTheme } from '../components/useBaseTheme';
import type { SupplierItem } from '../shared/catalogApi';
import { CustomerPrompt } from './AdminCustomerDetailNative.ios';
import type { AdminCustomerGroupSheet, AdminCustomerItemSheet } from './adminCustomerDetailPresentation';
import { dartPartialLower, dartTrim } from './dartJsonString';
import type { AdminCustomerDetailScreenModel } from './useAdminCustomerDetail';

function ItemRow({ item, sheet, model }: { item: SupplierItem; sheet: AdminCustomerItemSheet; model: AdminCustomerDetailScreenModel }) {
  const { colors } = useBaseTheme(), collapsing = sheet.collapsingCodes.includes(item.code), active = sheet.activeCode === item.code;
  const content = <HStack spacing={12} modifiers={[padding({ horizontal: sheet.kind === 'available' ? 16 : 14, vertical: 12 }), frame({ maxWidth: Infinity, minHeight: 72 }), background(colors.surfaceContainerHighest), cornerRadius(sheet.kind === 'available' ? 18 : 14)]}>
    <VStack alignment="leading" spacing={4} modifiers={[frame({ maxWidth: Infinity, alignment: 'leading' })]}><Text modifiers={[font({ textStyle: sheet.kind === 'assigned' ? 'headline' : 'body' })]}>{item.name}</Text><Text modifiers={[font({ textStyle: 'caption' }), foregroundStyle('secondary')]}>{item.code}</Text></VStack>
    {sheet.kind === 'available' ? active ? <ProgressView modifiers={[frame({ width: 18, height: 18 })]} /> : <Image systemName="plus" size={22} /> :
      <Button onPress={() => { void model.actOnItem(sheet.id, item); }} modifiers={[buttonStyle('plain'), disabled(active), frame({ width: 44, height: 44 }), accessibilityIdentifier(`admin-customer-unassign-item-${item.code}`)]}>
        {active ? <ProgressView modifiers={[frame({ width: 18, height: 18 })]} /> : <Image systemName="minus" size={22} />}
      </Button>}
  </HStack>;
  return <VStack modifiers={[frame({ height: collapsing ? 0 : undefined }), clipped(), animation(Animation.easeInOut({ duration: .22 }), collapsing)]}>
    <VStack modifiers={[opacity(collapsing ? 0 : 1), animation(Animation.easeInOut({ duration: .18 }), collapsing)]}>
      {!collapsing ? sheet.kind === 'available' ? <Button onPress={() => { void model.actOnItem(sheet.id, item); }} modifiers={[buttonStyle('plain'), disabled(active), accessibilityIdentifier(`admin-customer-available-item-${item.code}`)]}>{content}</Button> : content : null}
    </VStack>
  </VStack>;
}
function ItemsBody({ sheet, model, close }: { sheet: AdminCustomerItemSheet; model: AdminCustomerDetailScreenModel; close: () => void }) {
  const { height: screenHeight } = useWindowDimensions(), insets = useSafeAreaInsets();
  const estimate = Math.max(0, sheet.items.length * 72 + Math.max(0, sheet.items.length - 1) * 8);
  const [measurement, setMeasurement] = useState({ id: sheet.id, rows: estimate, header: 84 });
  const rows = measurement.id === sheet.id ? measurement.rows : estimate, header = measurement.id === sheet.id ? measurement.header : 84;
  const measureRows = ({ height }: { height: number }) => { if (model.sheetCurrent(sheet.id) && Number.isFinite(height)) setMeasurement(value => value.id === sheet.id && value.rows === height ? value : { id: sheet.id, rows: height, header: value.id === sheet.id ? value.header : 84 }); };
  const measureHeader = ({ height }: { height: number }) => { if (model.sheetCurrent(sheet.id) && Number.isFinite(height)) setMeasurement(value => value.id === sheet.id && value.header === height ? value : { id: sheet.id, rows: value.id === sheet.id ? value.rows : estimate, header: height }); };
  const render = useCallback(({ item }: { item: SupplierItem }) => <ItemRow item={item} sheet={sheet} model={model} />, [sheet, model]);
  return <VStack alignment="leading" spacing={0} modifiers={[padding({ leading: 20, top: 20, trailing: 20, bottom: 24 }), frame({ maxWidth: Infinity })]}>
    <VStack alignment="leading" spacing={0} modifiers={[onGeometryChange(measureHeader)]}>
      <HStack><Text modifiers={[font({ textStyle: 'title3' }), frame({ maxWidth: Infinity, alignment: 'leading' })]}>{model.a(sheet.kind === 'assigned' ? 'detail.items_sheet_title' : 'detail.items_add')}</Text>
        <Button label={model.a('action.close')} systemImage="xmark" onPress={close} modifiers={[buttonStyle('plain'), labelStyle('iconOnly'), frame({ width: 44, height: 44 }), accessibilityLabel(model.a('action.close')), accessibilityIdentifier('admin-customer-items-sheet-close')]} />
      </HStack><Spacer modifiers={[frame({ height: 6 })]} /><Text modifiers={[font({ textStyle: 'caption' }), foregroundStyle('secondary')]}>{sheet.detail.name}</Text><Spacer modifiers={[frame({ height: 14 })]} />
    </VStack>
    <ScrollView modifiers={[frame({ height: Math.max(0, Math.min(rows, screenHeight - insets.top - insets.bottom - 44 - header)) })]}>
      <LazyVStack spacing={8} modifiers={[onGeometryChange(measureRows)]}><LazyVStack.ForEach data={sheet.items} keyExtractor={(item, index) => `${item.code}:${index}`} estimatedItemSize={72}>{render}</LazyVStack.ForEach></LazyVStack>
    </ScrollView>
  </VStack>;
}
function GroupsBody({ sheet, model, close }: { sheet: AdminCustomerGroupSheet; model: AdminCustomerDetailScreenModel; close: (save?: boolean) => void }) {
  const { colors } = useBaseTheme(), search = useNativeState(''), groups = model.presentation.visibleGroups(sheet);
  const render = useCallback(({ item: group }: { item: string }) => {
    const key = dartPartialLower(dartTrim(group));
    return <Toggle isOn={sheet.selectedKeys.includes(key)} onIsOnChange={checked => model.toggleGroup(sheet.id, group, checked)} label={group}
      modifiers={[padding({ horizontal: 16, vertical: 10 }), frame({ minHeight: 56 }), background(colors.surfaceContainerHighest), cornerRadius(16),
        listRowInsets({ top: 0, leading: 12, bottom: 6, trailing: 12 }), listRowSeparator('hidden'), listRowBackground('clear'), accessibilityIdentifier(`admin-material-item-group-${key}`)]} />;
  }, [sheet.selectedKeys, sheet.id, model, colors.surfaceContainerHighest]);
  return <VStack spacing={0} modifiers={[frame({ maxWidth: Infinity, maxHeight: Infinity })]}>
    <Spacer modifiers={[frame({ height: 10 })]} /><Spacer modifiers={[frame({ width: 42, height: 4 }), background(colors.outlineVariant), cornerRadius(999)]} />
    <HStack modifiers={[padding({ leading: 16, top: 14, trailing: 8, bottom: 8 })]}><Text modifiers={[font({ textStyle: 'title3', weight: 'heavy' }), frame({ maxWidth: Infinity, alignment: 'leading' })]}>{model.a('detail.groups_edit_title')}</Text>
      <Button label={model.a('action.close')} systemImage="xmark" onPress={() => close()} modifiers={[buttonStyle('plain'), labelStyle('iconOnly'), frame({ width: 44, height: 44 }), accessibilityLabel(model.a('action.close')), accessibilityIdentifier('admin-material-item-groups-close')]} />
    </HStack><HStack spacing={12} modifiers={[padding({ horizontal: 16, vertical: 12 }), background(colors.surfaceContainerHighest), cornerRadius(16), padding({ horizontal: 16 })]}>
      <Image systemName="magnifyingglass" size={22} /><TextField text={search} placeholder={model.a('detail.group_search')} onTextChange={value => model.searchGroups(sheet.id, value)} modifiers={[textFieldStyle('plain'), accessibilityIdentifier('admin-material-item-groups-search')]} />
    </HStack><Spacer modifiers={[frame({ height: 10 })]} />
    {groups.length ? <List modifiers={[listStyle('plain'), scrollContentBackground('hidden')]}><List.ForEach data={groups} keyExtractor={group => group}>{render}</List.ForEach></List> :
      <VStack modifiers={[frame({ maxWidth: Infinity, maxHeight: Infinity })]}><Text>{model.a('detail.groups_not_found')}</Text></VStack>}
    <Button onPress={() => close(true)} modifiers={[buttonStyle('borderedProminent'), controlSize('large'), disabled(!sheet.selectedKeys.length), padding({ leading: 16, top: 8, trailing: 16, bottom: 16 }),
      frame({ maxWidth: Infinity, minHeight: 56 }), accessibilityIdentifier('admin-material-item-groups-save')]}><Text modifiers={[frame({ maxWidth: Infinity, minHeight: 30 })]}>{model.a('detail.groups_save_count', { count: sheet.selectedKeys.length })}</Text></Button>
  </VStack>;
}
/** A child native sheet belongs inside its parent's presented content on SwiftUI. */
export function CustomerSheetStack({ model, index = 0 }: { model: AdminCustomerDetailScreenModel; index?: number }) {
  const sheet = model.overlays.sheets[index]; if (!sheet) return null;
  const close = (save = false) => { model.beginCloseSheet(sheet.id, save); };
  return <BottomSheet isPresented={!sheet.closing} fitToContents={sheet.kind !== 'groups'} onIsPresentedChange={shown => { if (!shown) model.nativeBeginDismiss(sheet.id); }} onDismiss={() => model.finishCloseSheet(sheet.id)}>
    <Group modifiers={sheet.kind === 'groups' ? [presentationDetents([{ fraction: .78 }]), presentationDragIndicator('hidden')] : [presentationDragIndicator('hidden')]}>
      {sheet.kind === 'groups' ? <GroupsBody sheet={sheet} model={model} close={close} /> : <ItemsBody sheet={sheet} model={model} close={() => close()} />}
      {index + 1 < model.overlays.sheets.length ? <CustomerSheetStack key={model.overlays.sheets[index + 1].id} model={model} index={index + 1} /> : model.state.prompt ?
        <RNHostView matchContents><View style={styles.portal}><CustomerPrompt model={model} /></View></RNHostView> : null}
    </Group>
  </BottomSheet>;
}
const styles = StyleSheet.create({ portal: { width: 0, height: 0 } });

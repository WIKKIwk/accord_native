import { Button, Checkbox, CircularProgressIndicator, Column, IconButton, LazyColumn, ModalBottomSheet, OutlinedTextField, RNHostView, Row, Spacer, Surface, useNativeState, type ModalBottomSheetRef } from '@expo/ui/jetpack-compose';
import { defaultMinSize, fillMaxWidth, height, padding, semantics, size, testID, weight } from '@expo/ui/jetpack-compose/modifiers';
import { useCallback, useEffect, useRef } from 'react';
import { StyleSheet, useWindowDimensions } from 'react-native';
import Animated, { Easing, LinearTransition, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { BaseHost } from '../components/BaseHost.android';
import { useBaseTheme } from '../components/useBaseTheme';
import { AdminText as Text } from './AdminTypography.android';
import type { SupplierItem } from '../shared/catalogApi';
import { CustomerIcon, CustomerPromptContent, roundedCustomer } from './AdminCustomerDetailNative.android';
import type { AdminCustomerGroupSheet, AdminCustomerItemSheet } from './adminCustomerDetailPresentation';
import { dartPartialLower, dartTrim } from './dartJsonString';
import type { AdminCustomerDetailScreenModel } from './useAdminCustomerDetail';

const rowMotion = LinearTransition.duration(220).easing(Easing.inOut(Easing.cubic));
function ItemRow({ item, sheet, model }: { item: SupplierItem; sheet: AdminCustomerItemSheet; model: AdminCustomerDetailScreenModel }) {
  const { colors } = useBaseTheme(), collapsing = sheet.collapsingCodes.includes(item.code), alpha = useSharedValue(collapsing ? 0 : 1);
  useEffect(() => { alpha.value = withTiming(collapsing ? 0 : 1, { duration: 180, easing: Easing.inOut(Easing.cubic) }); }, [alpha, collapsing, item.code]);
  const fading = useAnimatedStyle(() => ({ opacity: alpha.value })), active = sheet.activeCode === item.code;
  return <RNHostView matchContents={{ vertical: true }}><Animated.View layout={rowMotion} style={[styles.row, fading]} pointerEvents={collapsing ? 'none' : 'auto'}>
    {!collapsing ? <BaseHost matchContents={{ vertical: true }} style={styles.fullWidth}><Surface color={colors.surfaceContainerHighest} shape={roundedCustomer(sheet.kind === 'available' ? 18 : 14)}
      enabled={!active} onClick={sheet.kind === 'available' ? () => { void model.actOnItem(sheet.id, item); } : undefined} modifiers={[fillMaxWidth(), testID(`admin-customer-${sheet.kind}-item-${item.code}`)]}>
      <Row verticalAlignment="center" modifiers={[fillMaxWidth(), defaultMinSize({ minHeight: 72 }), padding(sheet.kind === 'available' ? 16 : 14, sheet.kind === 'available' ? 8 : 12, sheet.kind === 'available' ? 16 : 14, sheet.kind === 'available' ? 8 : 12)]}>
        <Column modifiers={[weight(1)]} verticalArrangement={{ spacedBy: 4 }}><Text style={{ typography: sheet.kind === 'available' ? 'bodyLarge' : 'titleMedium' }}>{item.name}</Text><Text color={colors.onSurfaceVariant} style={{ typography: 'bodySmall' }}>{item.code}</Text></Column>
        {sheet.kind === 'available' ? active ? <CustomerSpinner /> : <CustomerIcon name="add" color={colors.onSurfaceVariant} /> :
          <IconButton enabled={!active} onClick={() => { void model.actOnItem(sheet.id, item); }} modifiers={[size(48, 48), testID(`admin-customer-unassign-item-${item.code}`)]}>{active ? <CustomerSpinner /> : <CustomerIcon name="remove" color={colors.onSurfaceVariant} />}</IconButton>}
      </Row>
    </Surface></BaseHost> : null}
  </Animated.View></RNHostView>;
}
function CustomerSpinner() {
  return <CircularProgressIndicator strokeWidth={2} modifiers={[size(18, 18)]} />;
}
function ItemsBody({ sheet, model, close }: { sheet: AdminCustomerItemSheet; model: AdminCustomerDetailScreenModel; close: () => void }) {
  const { colors } = useBaseTheme();
  const render = useCallback(({ item }: { item: SupplierItem }) => <ItemRow item={item} sheet={sheet} model={model} />, [sheet, model]);
  return <Column modifiers={[fillMaxWidth(), padding(20, 20, 20, 24)]}>
    <Row verticalAlignment="center" modifiers={[fillMaxWidth()]}><Text style={{ typography: 'titleLarge', fontSize: 20, fontWeight: '700' }} modifiers={[weight(1)]}>{model.a(sheet.kind === 'assigned' ? 'detail.items_sheet_title' : 'detail.items_add')}</Text>
      <IconButton onClick={close} modifiers={[size(48, 48), semantics({ contentDescription: model.a('action.close') }), testID('admin-customer-items-sheet-close')]}><CustomerIcon name="close" color={colors.onSurfaceVariant} /></IconButton>
    </Row><Spacer modifiers={[height(6)]} /><Text color={colors.onSurfaceVariant} style={{ typography: 'bodySmall' }}>{sheet.detail.name}</Text><Spacer modifiers={[height(14)]} />
    <LazyColumn verticalArrangement={{ spacedBy: 8 }} modifiers={[fillMaxWidth()]}><LazyColumn.Items data={sheet.items} keyExtractor={(item, index) => `${item.code}:${index}`} estimatedItemSize={72}>{render}</LazyColumn.Items></LazyColumn>
  </Column>;
}
function GroupsBody({ sheet, model, close }: { sheet: AdminCustomerGroupSheet; model: AdminCustomerDetailScreenModel; close: (save?: boolean) => void }) {
  const theme = useBaseTheme(), { colors } = theme, { height: screenHeight } = useWindowDimensions(), search = useNativeState('');
  const groups = model.presentation.visibleGroups(sheet), fill = theme.mode === 'dark' ? colors.surfaceContainerHigh : colors.surfaceContainerHighest;
  const render = useCallback(({ item: group }: { item: string }) => {
    const key = dartPartialLower(dartTrim(group)), checked = sheet.selectedKeys.includes(key);
    return <Surface color={colors.surfaceContainerHighest} shape={roundedCustomer(16)} onClick={() => model.toggleGroup(sheet.id, group, !checked)} modifiers={[fillMaxWidth(), testID(`admin-material-item-group-${key}`)]}>
      <Row verticalAlignment="center" modifiers={[fillMaxWidth(), defaultMinSize({ minHeight: 56 }), padding(16, 4, 16, 4)]}>
        <Checkbox value={checked} onCheckedChange={value => model.toggleGroup(sheet.id, group, value)} /><Spacer modifiers={[size(16, 1)]} /><Text style={{ typography: 'bodyLarge' }} modifiers={[weight(1)]}>{group}</Text>
      </Row>
    </Surface>;
  }, [colors.surfaceContainerHighest, sheet.id, sheet.selectedKeys, model]);
  return <Column modifiers={[fillMaxWidth(), height(screenHeight * .78)]}>
    <Spacer modifiers={[height(10)]} /><Column horizontalAlignment="center" modifiers={[fillMaxWidth()]}><Surface color={colors.outlineVariant} shape={roundedCustomer(999)} modifiers={[size(42, 4)]} /></Column>
    <Row verticalAlignment="center" modifiers={[fillMaxWidth(), padding(16, 14, 8, 8)]}><Text style={{ typography: 'titleLarge', fontSize: 20, fontWeight: '800' }} modifiers={[weight(1)]}>{model.a('detail.groups_edit_title')}</Text>
      <IconButton onClick={() => close()} modifiers={[size(48, 48), semantics({ contentDescription: model.a('action.close') }), testID('admin-material-item-groups-close')]}><CustomerIcon name="close" color={colors.onSurfaceVariant} /></IconButton>
    </Row><Column modifiers={[fillMaxWidth(), padding(16, 0, 16, 0)]}>
      <OutlinedTextField value={search} singleLine onValueChange={value => model.searchGroups(sheet.id, value)} shape={roundedCustomer(16)} textStyle={{ fontSize: 16, fontWeight: '400', color: colors.onSurface }}
        colors={{ focusedContainerColor: fill, unfocusedContainerColor: fill, focusedIndicatorColor: colors.primary, unfocusedIndicatorColor: colors.outlineVariant }} modifiers={[fillMaxWidth(), height(56), testID('admin-material-item-groups-search')]}>
        <OutlinedTextField.LeadingIcon><CustomerIcon name="search" color={colors.onSurface} /></OutlinedTextField.LeadingIcon><OutlinedTextField.Placeholder><Text color={colors.onSurfaceVariant} style={{ fontSize: 15 }}>{model.a('detail.group_search')}</Text></OutlinedTextField.Placeholder>
      </OutlinedTextField>
    </Column><Spacer modifiers={[height(10)]} />
    {groups.length ? <LazyColumn contentPadding={{ start: 12, end: 12, bottom: 12 }} verticalArrangement={{ spacedBy: 6 }} modifiers={[fillMaxWidth(), weight(1)]}>
      <LazyColumn.Items data={groups} keyExtractor={group => group} estimatedItemSize={56}>{render}</LazyColumn.Items>
    </LazyColumn> : <Column horizontalAlignment="center" verticalArrangement="center" modifiers={[fillMaxWidth(), weight(1)]}><Text>{model.a('detail.groups_not_found')}</Text></Column>}
    <Column modifiers={[fillMaxWidth(), padding(16, 8, 16, 16)]}><Button enabled={sheet.selectedKeys.length > 0} onClick={() => close(true)} shape={roundedCustomer(20)} modifiers={[fillMaxWidth(), height(56), testID('admin-material-item-groups-save')]}>
      <Text style={{ fontSize: 16, fontWeight: '500' }}>{model.a('detail.groups_save_count', { count: sheet.selectedKeys.length })}</Text>
    </Button></Column>
  </Column>;
}
/** Nested native sheets preserve the source's accepted concurrent catalog reads instead of replacing a live snapshot. */
export function CustomerSheetStack({ model, index = 0 }: { model: AdminCustomerDetailScreenModel; index?: number }) {
  const sheet = model.overlays.sheets[index], native = useRef<ModalBottomSheetRef>(null), { colors } = useBaseTheme();
  if (!sheet) return null;
  const close = async (save = false) => {
    if (!model.beginCloseSheet(sheet.id, save)) return;
    try { await native.current?.hide(); } finally { model.finishCloseSheet(sheet.id); }
  };
  return <ModalBottomSheet ref={native} skipPartiallyExpanded showDragHandle={false} containerColor={sheet.kind === 'groups' ? colors.surface : colors.surfaceContainerLow}
    onDismissRequest={() => { model.nativeBeginDismiss(sheet.id); model.finishCloseSheet(sheet.id); }}>
    {sheet.kind === 'groups' ? <GroupsBody sheet={sheet} model={model} close={save => { void close(save); }} /> : <ItemsBody sheet={sheet} model={model} close={() => { void close(); }} />}
    {index + 1 < model.overlays.sheets.length ? <CustomerSheetStack key={model.overlays.sheets[index + 1].id} model={model} index={index + 1} /> : model.state.prompt ? <CustomerPromptContent model={model} /> : null}
  </ModalBottomSheet>;
}
const styles = StyleSheet.create({ fullWidth: { width: '100%' }, row: { width: '100%', overflow: 'hidden' } });

import { Button, Column, IconButton, Row, Spacer, Surface, useNativeState } from '@expo/ui/jetpack-compose';
import { defaultMinSize, fillMaxWidth, height, padding, semantics, size, testID, weight } from '@expo/ui/jetpack-compose/modifiers';
import { useEffect, useRef } from 'react';
import { ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import { BaseHost } from '../components/BaseHost.android';
import { useBaseTheme } from '../components/useBaseTheme';
import { AdminOutlinedTextField as OutlinedTextField } from './AdminTextFields.android';
import { AdminText as Text } from './AdminTypography.android';
import { ItemCreateIcon, itemCreateRounded } from './AdminItemCreateNative.android';
import type { AdminItemCreateDialog } from './adminItemCreateFormController';
import { dartTrim } from './dartJsonString';
import type { AdminItemCreateScreenModel } from './useAdminItemCreate';

function Field({ model, name }: { model: AdminItemCreateScreenModel; name: 'code' | 'name' }) {
  const form = model.state.form, value = useNativeState(form.draft[name]), filled = useRef(form.fillVersion), { colors, mode } = useBaseTheme(), label = model.a(`item.${name}`);
  useEffect(() => { if (filled.current !== form.fillVersion && model.current()) { filled.current = form.fillVersion; value.set(form.draft[name]); } }, [value, form.fillVersion, form.draft, name, model]);
  return <OutlinedTextField value={value} singleLine onValueChange={name === 'code' ? model.changeCode : model.changeName} shape={itemCreateRounded(18)}
    textStyle={{ fontSize: 16, fontWeight: '400', color: colors.onSurface }} colors={{ focusedContainerColor: mode === 'light' ? colors.surfaceBright : colors.surfaceContainerHighest,
      unfocusedContainerColor: mode === 'light' ? colors.surfaceBright : colors.surfaceContainerHighest, focusedIndicatorColor: colors.primary, unfocusedIndicatorColor: colors.outlineVariant }}
    modifiers={[fillMaxWidth(), semantics({ contentDescription: label }), testID(`admin-item-create-${name}`)]}>
    <OutlinedTextField.Label><Text style={{ fontSize: 14, fontWeight: '400' }}>{label}</Text></OutlinedTextField.Label>
  </OutlinedTextField>;
}
function PickerBox({ model, kind, dialog }: { model: AdminItemCreateScreenModel; kind: 'group' | 'uom' | 'customer'; dialog: AdminItemCreateDialog }) {
  const { colors, mode } = useBaseTheme(), form = model.state.form, selected = kind === 'customer' ? dialog.customerView?.name ?? '' : dartTrim(form.draft[kind]);
  const catalogReady = kind === 'customer' || (kind === 'group' ? !form.groups.loading && form.groups.error === null : !form.uoms.loading && form.uoms.error === null && form.uoms.value.length > 0);
  const enabled = !dialog.savingView && catalogReady;
  const missing = kind === 'customer' ? dialog.customerView === null : !selected, placeholder = kind === 'uom' && form.uoms.error !== null ? 'item.uom_load_failed' : `item.${kind}_required${kind === 'customer' ? '_short' : ''}`;
  return <Column modifiers={[fillMaxWidth()]}><Text color={colors.onSurfaceVariant} style={{ typography: 'labelMedium', fontWeight: '700' }}>{model.a(`item.${kind}_label`)}</Text><Spacer modifiers={[height(6)]} />
    <Surface color={mode === 'light' ? colors.surfaceBright : colors.surface} shape={itemCreateRounded(18)} border={{ width: 1, color: colors.outlineVariant }} enabled={enabled} onClick={enabled ? () => model.openPicker(kind) : undefined} modifiers={[fillMaxWidth(), defaultMinSize({ minHeight: 58 }), testID(`admin-item-create-${kind}-picker`)]}>
      <Row verticalAlignment="center" modifiers={[fillMaxWidth(), padding(16, 12, 16, 12)]}><Text color={missing ? colors.onSurfaceVariant : colors.onSurface} maxLines={1} overflow="ellipsis" style={{ typography: 'bodyLarge', fontWeight: '700' }} modifiers={[weight(1)]}>{missing || kind === 'uom' && form.uoms.error !== null ? model.a(placeholder) : selected}</Text><Spacer modifiers={[size(10, 1)]} />
        {kind === 'customer' && dialog.customerView !== null ? <IconButton enabled={!dialog.savingView} onClick={model.clearCustomer} modifiers={[semantics({ contentDescription: model.a('action.clear') }), testID('admin-item-create-customer-clear')]}><ItemCreateIcon name="close" color={colors.onSurfaceVariant} /></IconButton> : <ItemCreateIcon name="expand_more" color={colors.onSurfaceVariant} />}
      </Row>
    </Surface>
  </Column>;
}
/** @v2 _ItemCreateDialogCard */
export function AdminItemCreateDialogCard({ model, dialog }: { model: AdminItemCreateScreenModel; dialog: AdminItemCreateDialog }) {
  const { colors, direction } = useBaseTheme(), { height: viewport } = useWindowDimensions();
  return <View testID="admin-item-create-dialog-card" style={[styles.card, { maxHeight: viewport * .72, backgroundColor: colors.surfaceContainerLowest, direction: direction === 'rightToLeft' ? 'rtl' : 'ltr' }]}>
    <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content} style={styles.scroll}><BaseHost matchContents={{ vertical: true }} style={styles.fullWidth}><Column modifiers={[fillMaxWidth()]}>
      <PickerBox model={model} kind="group" dialog={dialog} /><Spacer modifiers={[height(12)]} /><Field model={model} name="name" /><Spacer modifiers={[height(12)]} />
      <PickerBox model={model} kind="uom" dialog={dialog} /><Spacer modifiers={[height(12)]} />{dialog.finishedView ? <PickerBox model={model} kind="customer" dialog={dialog} /> : <Field model={model} name="code" />}
      <Spacer modifiers={[height(18)]} /><Button enabled={!dialog.savingView} onClick={model.save} shape={itemCreateRounded(20)} modifiers={[fillMaxWidth(), defaultMinSize({ minHeight: 56 }), testID('admin-item-create-submit')]}><Text style={{ fontSize: 16, fontWeight: '500' }}>{model.a(dialog.savingView ? 'item.creating' : 'item.add_title')}</Text></Button>
    </Column></BaseHost></ScrollView>
    <View style={styles.close}><BaseHost matchContents><IconButton enabled={!dialog.savingView} onClick={() => model.closeDialog()} modifiers={[size(48, 48), semantics({ contentDescription: model.a('item.close') }), testID('admin-item-create-close')]}><ItemCreateIcon name="close" color={colors.onSurfaceVariant} /></IconButton></BaseHost></View>
  </View>;
}
const styles = StyleSheet.create({ card: { width: '100%', maxWidth: 440, borderRadius: 18, overflow: 'hidden', elevation: 6 }, fullWidth: { width: '100%' }, scroll: { flexGrow: 0, flexShrink: 1 }, content: { paddingLeft: 12, paddingTop: 48, paddingRight: 12, paddingBottom: 24 }, close: { position: 'absolute', top: 4, end: 4 } });

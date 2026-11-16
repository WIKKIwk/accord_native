import { Button, HStack, Image, Spacer, Text, TextField, VStack, useNativeState } from '@expo/ui/swift-ui';
import { accessibilityIdentifier, accessibilityLabel, background, buttonStyle, controlSize, cornerRadius, disabled, font, foregroundStyle, frame, lineLimit, padding, textFieldStyle } from '@expo/ui/swift-ui/modifiers';
import { useEffect, useRef } from 'react';
import { ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import { BaseHost } from '../components/BaseHost.ios';
import { useBaseTheme } from '../components/useBaseTheme';
import type { AdminItemCreateDialog } from './adminItemCreateFormController';
import { dartTrim } from './dartJsonString';
import type { AdminItemCreateScreenModel } from './useAdminItemCreate';

function Field({ model, name }: { model: AdminItemCreateScreenModel; name: 'code' | 'name' }) {
  const form = model.state.form, value = useNativeState(form.draft[name]), filled = useRef(form.fillVersion), label = model.a(`item.${name}`);
  useEffect(() => { if (filled.current !== form.fillVersion && model.current()) { filled.current = form.fillVersion; value.set(form.draft[name]); } }, [value, form.fillVersion, form.draft, name, model]);
  return <VStack alignment="leading" spacing={6} modifiers={[frame({ maxWidth: Infinity, alignment: 'leading' })]}><Text modifiers={[font({ textStyle: 'caption' }), foregroundStyle('secondary')]}>{label}</Text>
    <TextField text={value} placeholder={label} onTextChange={name === 'code' ? model.changeCode : model.changeName} modifiers={[textFieldStyle('roundedBorder'), accessibilityIdentifier(`admin-item-create-${name}`)]} />
  </VStack>;
}
function PickerBox({ model, kind, dialog }: { model: AdminItemCreateScreenModel; kind: 'group' | 'uom' | 'customer'; dialog: AdminItemCreateDialog }) {
  const { colors } = useBaseTheme(), form = model.state.form, selected = kind === 'customer' ? dialog.customerView?.name ?? '' : dartTrim(form.draft[kind]);
  const catalogReady = kind === 'customer' || (kind === 'group' ? !form.groups.loading && form.groups.error === null : !form.uoms.loading && form.uoms.error === null && form.uoms.value.length > 0);
  const enabled = !dialog.savingView && catalogReady;
  const missing = kind === 'customer' ? dialog.customerView === null : !selected, placeholder = kind === 'uom' && form.uoms.error !== null ? 'item.uom_load_failed' : `item.${kind}_required${kind === 'customer' ? '_short' : ''}`;
  return <VStack alignment="leading" spacing={6} modifiers={[frame({ maxWidth: Infinity, alignment: 'leading' })]}><Text modifiers={[font({ textStyle: 'caption', weight: 'bold' }), foregroundStyle('secondary')]}>{model.a(`item.${kind}_label`)}</Text>
    <HStack spacing={10} modifiers={[frame({ maxWidth: Infinity, minHeight: 58 }), padding({ horizontal: 16, vertical: 12 }), background(colors.surface), cornerRadius(18)]}>
      <Button onPress={() => model.openPicker(kind)} modifiers={[buttonStyle('plain'), disabled(!enabled), frame({ maxWidth: Infinity, alignment: 'leading' }), accessibilityIdentifier(`admin-item-create-${kind}-picker`)]}>
        <HStack spacing={10}><Text modifiers={[font({ textStyle: 'body', weight: 'bold' }), foregroundStyle(missing ? colors.onSurfaceVariant : colors.onSurface), lineLimit(1), frame({ maxWidth: Infinity, alignment: 'leading' })]}>{missing || kind === 'uom' && form.uoms.error !== null ? model.a(placeholder) : selected}</Text>{kind !== 'customer' || dialog.customerView === null ? <Image systemName="chevron.down" size={16} modifiers={[foregroundStyle('secondary')]} /> : null}</HStack>
      </Button>
      {kind === 'customer' && dialog.customerView !== null ? <Button onPress={model.clearCustomer} modifiers={[buttonStyle('plain'), disabled(dialog.savingView), frame({ width: 44, height: 44 }), accessibilityLabel(model.a('action.clear')), accessibilityIdentifier('admin-item-create-customer-clear')]}><Image systemName="xmark" size={20} /></Button> : null}
    </HStack>
  </VStack>;
}
/** @v2 _ItemCreateDialogCard */
export function AdminItemCreateDialogCard({ model, dialog }: { model: AdminItemCreateScreenModel; dialog: AdminItemCreateDialog }) {
  const { colors, direction } = useBaseTheme(), { height: viewport } = useWindowDimensions();
  return <View testID="admin-item-create-dialog-card" style={[styles.card, { maxHeight: viewport * .72, backgroundColor: colors.surfaceContainerLowest, direction: direction === 'rightToLeft' ? 'rtl' : 'ltr' }]}>
    <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content} style={styles.scroll}><BaseHost matchContents={{ vertical: true }} style={styles.fullWidth}><VStack alignment="leading" spacing={0} modifiers={[frame({ maxWidth: Infinity, alignment: 'leading' })]}>
      <PickerBox model={model} kind="group" dialog={dialog} /><Spacer modifiers={[frame({ height: 12 })]} /><Field model={model} name="name" /><Spacer modifiers={[frame({ height: 12 })]} />
      <PickerBox model={model} kind="uom" dialog={dialog} /><Spacer modifiers={[frame({ height: 12 })]} />{dialog.finishedView ? <PickerBox model={model} kind="customer" dialog={dialog} /> : <Field model={model} name="code" />}
      <Spacer modifiers={[frame({ height: 18 })]} /><Button label={model.a(dialog.savingView ? 'item.creating' : 'item.add_title')} onPress={model.save} modifiers={[buttonStyle('borderedProminent'), controlSize('large'), disabled(dialog.savingView), frame({ maxWidth: Infinity, minHeight: 56 }), accessibilityIdentifier('admin-item-create-submit')]} />
    </VStack></BaseHost></ScrollView>
    <View style={styles.close}><BaseHost matchContents><Button onPress={() => model.closeDialog()} modifiers={[buttonStyle('plain'), disabled(dialog.savingView), frame({ width: 44, height: 44 }), accessibilityLabel(model.a('item.close')), accessibilityIdentifier('admin-item-create-close')]}><Image systemName="xmark" size={20} /></Button></BaseHost></View>
  </View>;
}
const styles = StyleSheet.create({ card: { width: '100%', maxWidth: 440, borderRadius: 18, overflow: 'hidden' }, fullWidth: { width: '100%' }, scroll: { flexGrow: 0, flexShrink: 1 }, content: { paddingLeft: 12, paddingTop: 48, paddingRight: 12, paddingBottom: 24 }, close: { position: 'absolute', top: 4, end: 4 } });

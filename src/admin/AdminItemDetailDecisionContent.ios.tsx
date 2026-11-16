import { Button, HStack, Image, Spacer, Text, TextField, type TextFieldRef, VStack, useNativeState } from '@expo/ui/swift-ui';
import { accessibilityIdentifier, accessibilityHidden, autocorrectionDisabled, background, buttonStyle, controlSize, cornerRadius, disabled, font, foregroundStyle, frame, onSubmit, padding, submitLabel, textFieldStyle, textInputAutocapitalization } from '@expo/ui/swift-ui/modifiers';
import { useRef } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';
import { BaseHost } from '../components/BaseHost.ios';
import { useBaseTheme } from '../components/useBaseTheme';
import { useAdminItemDetailDecisionContent, type AdminItemDetailDecisionContentModel } from './AdminItemDetailDecisionContentOwner';
import type { AdminItemDetailDecisionContentProps } from './AdminItemDetailDecisionContentTypes';

type BodyProps = { model: AdminItemDetailDecisionContentModel; props: AdminItemDetailDecisionContentProps };
function Edit({ model, props }: BodyProps) {
  const code = useNativeState(model.initialDraft!.code), name = useNativeState(model.initialDraft!.name), nameRef = useRef<TextFieldRef | null>(null), { colors } = useBaseTheme();
  const save = () => { if (!model.lifetime.canInteract()) return; try { model.save(code.get(), name.get()); } catch { /* An expired native buffer cannot authorize Save. */ } };
  const next = () => { if (model.lifetime.canInteract()) void nameRef.current?.focus().catch(() => {}); };
  // Installed Expo onSubmit only registers an eventListener; it never invokes next during render.
  // eslint-disable-next-line react-hooks/refs
  const nextSubmit = onSubmit(next);
  return <BaseHost matchContents={{ vertical: true }} style={styles.editDialog}><VStack alignment="leading" spacing={0} modifiers={[frame({ maxWidth: Infinity, alignment: 'leading' }), padding({ horizontal: 24, vertical: 24 }), background(colors.surfaceContainerHigh), cornerRadius(28)]}>
    <Text modifiers={[font({ textStyle: 'title2', weight: 'bold' }), padding({ bottom: 16 })]}>{model.title}</Text>
    <TextField text={code} placeholder={props.a('detail.item_code')} onTextChange={value => model.changeEdit('code', value)} modifiers={[textFieldStyle('roundedBorder'), autocorrectionDisabled(true), textInputAutocapitalization('never'), submitLabel('next'), nextSubmit, disabled(model.closing), accessibilityIdentifier('admin-item-detail-code-field')]} />
    <Spacer modifiers={[frame({ height: 14 })]} /><TextField ref={nameRef} text={name} placeholder={props.a('detail.item_name')} onTextChange={value => model.changeEdit('name', value)} modifiers={[textFieldStyle('roundedBorder'), textInputAutocapitalization('sentences'), submitLabel('done'), onSubmit(save), disabled(model.closing), accessibilityIdentifier('admin-item-detail-name-field')]} />
    {model.validation ? <Text modifiers={[font({ textStyle: 'subheadline' }), foregroundStyle(colors.error), padding({ top: 10 }), accessibilityIdentifier('admin-item-detail-validation')]}>{model.validation}</Text> : null}
    <HStack spacing={8} modifiers={[frame({ maxWidth: Infinity, alignment: 'trailing' }), padding({ top: 24 })]}><Spacer /><Button label={props.a('action.cancel')} onPress={() => model.close(false)} modifiers={[buttonStyle('plain'), disabled(model.closing), frame({ minHeight: 44 })]} /><Button label={props.a('action.save')} onPress={save} modifiers={[buttonStyle('borderedProminent'), controlSize('large'), disabled(model.closing), frame({ minHeight: 56 }), accessibilityIdentifier('admin-item-detail-save')]} /></HStack>
  </VStack></BaseHost>;
}
function Delete({ model, props }: BodyProps) {
  const { colors } = useBaseTheme();
  return <BaseHost matchContents={{ vertical: true }} style={styles.dialog}><VStack spacing={0} modifiers={[frame({ maxWidth: Infinity }), padding({ horizontal: 24, vertical: 24 }), background(colors.surfaceContainerHigh), cornerRadius(28)]}>
    <Image systemName="trash.fill" size={24} modifiers={[foregroundStyle(colors.error), accessibilityHidden(true), padding({ bottom: 16 })]} /><Text modifiers={[font({ textStyle: 'title2', weight: 'bold' }), padding({ bottom: 16 })]}>{model.title}</Text><Text modifiers={[font({ textStyle: 'subheadline' }), frame({ maxWidth: Infinity, alignment: 'leading' })]}>{model.deleteMessage}</Text>
    <HStack spacing={8} modifiers={[frame({ maxWidth: Infinity, alignment: 'trailing' }), padding({ top: 24 })]}><Spacer /><Button label={props.a('action.cancel')} onPress={() => model.close(false)} modifiers={[buttonStyle('plain'), disabled(model.closing), frame({ minHeight: 44 }), accessibilityIdentifier('admin-item-delete-cancel')]} />
      <Button role="destructive" onPress={() => model.close(true)} modifiers={[buttonStyle('borderedProminent'), controlSize('large'), disabled(model.closing), frame({ minHeight: 56 }), accessibilityIdentifier('admin-item-delete-confirm')]}><HStack spacing={8}><Image systemName="trash.fill" size={18} modifiers={[accessibilityHidden(true)]} /><Text>{props.a('action.delete')}</Text></HStack></Button>
    </HStack>
  </VStack></BaseHost>;
}
function Group({ model, props }: BodyProps) {
  const query = useNativeState(model.query), { colors } = useBaseTheme(), viewport = model.viewport!;
  return <View style={[styles.sheet, { height: viewport.height * .74 }]} testID="admin-item-group-content"><BaseHost matchContents={{ vertical: true }} style={styles.full}><VStack alignment="leading" spacing={0} modifiers={[frame({ maxWidth: Infinity, alignment: 'leading' })]}>
    <Text modifiers={[font({ textStyle: 'title2', weight: 'bold' }), padding({ leading: 18, trailing: 18, bottom: 12 })]}>{model.title}</Text><HStack spacing={8} modifiers={[padding({ horizontal: 16 })]}><Image systemName="magnifyingglass" size={24} modifiers={[accessibilityHidden(true)]} /><TextField text={query} placeholder={props.a('detail.item_group_search')} onTextChange={model.changeQuery} modifiers={[textFieldStyle('roundedBorder'), textInputAutocapitalization('never'), submitLabel('done'), disabled(model.closing), accessibilityIdentifier('admin-item-group-search')]} /></HStack><Spacer modifiers={[frame({ height: 10 })]} />
  </VStack></BaseHost>
    {model.groups.length ? <FlatList style={styles.fill} data={model.groups} keyExtractor={row => row.value} keyboardShouldPersistTaps="handled" renderItem={({ item: row }) => <BaseHost matchContents={{ vertical: true }} style={styles.full}><Button onPress={() => model.chooseGroup(row.value, model.query)} modifiers={[buttonStyle('plain'), disabled(model.closing), accessibilityIdentifier(`admin-item-group-option-${row.value}`)]}><HStack spacing={16} modifiers={[frame({ maxWidth: Infinity, minHeight: 56, alignment: 'leading' }), padding({ horizontal: 16, vertical: 8 })]}><Image systemName={row.selected ? 'largecircle.fill.circle' : 'circle'} size={24} modifiers={[foregroundStyle(row.selected ? colors.primary : colors.onSurfaceVariant), frame({ width: 40 }), accessibilityHidden(true)]} /><Text modifiers={[foregroundStyle(row.selected ? colors.primary : colors.onSurface), frame({ maxWidth: Infinity, alignment: 'leading' })]}>{row.value}</Text></HStack></Button></BaseHost>} /> : <View style={styles.center}><BaseHost matchContents><Text>{props.a('detail.item_group_not_found')}</Text></BaseHost></View>}
    <View style={{ paddingLeft: 16, paddingTop: 10, paddingRight: 16, paddingBottom: viewport.paddingBottom + 16 }}><BaseHost matchContents={{ vertical: true }} style={styles.full}><Button label={props.a('detail.item_group_save')} onPress={() => model.close(true)} modifiers={[buttonStyle('borderedProminent'), controlSize('large'), disabled(!model.applyEnabled), frame({ maxWidth: Infinity, minHeight: 56 }), accessibilityIdentifier('admin-item-group-apply')]} /></BaseHost></View>
  </View>;
}
/** @v2 _AdminItemEditDialog / _ItemGroupPickerSheet; native CONTENT, with no modal or synthesized completion. */
export function AdminItemDetailDecisionContent(props: AdminItemDetailDecisionContentProps) {
  const model = useAdminItemDetailDecisionContent(props); if (!model.visible || props.kind === 'group' && !model.viewport) return null;
  return props.kind === 'edit' ? <Edit key={model.lifetime.bufferIdentity} model={model} props={props} /> : props.kind === 'delete' ? <Delete model={model} props={props} /> : <Group key={model.lifetime.bufferIdentity} model={model} props={props} />;
}
const styles = StyleSheet.create({ full: { width: '100%' }, dialog: { width: '100%' }, editDialog: { width: '100%', maxWidth: 468 }, sheet: { width: '100%' }, fill: { flex: 1 }, center: { flex: 1, alignItems: 'center', justifyContent: 'center' } });

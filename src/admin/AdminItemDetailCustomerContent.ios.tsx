import { Button, HStack, Image, List, ProgressView, Spacer, Text, TextField, Toggle, VStack, useNativeState } from '@expo/ui/swift-ui';
import { accessibilityHidden, accessibilityIdentifier, accessibilityLabel, background, buttonStyle, controlSize, cornerRadius, disabled, font, foregroundStyle, frame, listRowInsets, listStyle, onSubmit, padding, submitLabel, textFieldStyle, textInputAutocapitalization } from '@expo/ui/swift-ui/modifiers';
import { StyleSheet, View } from 'react-native';
import { BaseHost } from '../components/BaseHost.ios';
import { useBaseTheme } from '../components/useBaseTheme';
import { useAdminItemDetailCustomerContent, type AdminItemDetailCustomerContentModel } from './AdminItemDetailCustomerContentOwner';
import type { AdminItemDetailCustomerContentProps } from './AdminItemDetailCustomerContentTypes';

type BodyProps = { model: AdminItemDetailCustomerContentModel; props: AdminItemDetailCustomerContentProps };
function Content({ model, props }: BodyProps) {
  const query = useNativeState(''), { colors } = useBaseTheme(), viewport = model.viewport!, state = model.state!;
  const search = (button: boolean) => { if (!model.lifetime.canInteract()) return; try { (button ? model.searchButton : model.searchSubmit)(query.get()); } catch { /* An expired native buffer cannot authorize Search. */ } };
  return <View style={[styles.sheet, { height: viewport.height * .84 }]} testID="admin-item-customer-content"><BaseHost matchContents={{ vertical: true }} style={styles.full}><VStack alignment="leading" spacing={0} modifiers={[frame({ maxWidth: Infinity, alignment: 'leading' })]}>
    <Text modifiers={[font({ textStyle: 'title2', weight: 'bold' }), padding({ leading: 18, trailing: 18, bottom: 12 })]}>{model.title}</Text><HStack spacing={8} modifiers={[padding({ horizontal: 16 })]}><Image systemName="magnifyingglass" size={24} modifiers={[accessibilityHidden(true)]} />
      <TextField text={query} placeholder={props.a('detail.customer_search')} onTextChange={model.changeSearch} modifiers={[textFieldStyle('roundedBorder'), textInputAutocapitalization('never'), submitLabel('search'), onSubmit(() => search(false)), disabled(model.closing), accessibilityIdentifier('admin-item-customer-search')]} />
      <Button onPress={() => search(true)} modifiers={[buttonStyle('plain'), disabled(!model.searchEnabled), frame({ width: 44, height: 44 }), accessibilityLabel(props.a('action.search')), accessibilityIdentifier('admin-item-customer-search-submit')]}><Image systemName="arrow.right" size={24} /></Button>
    </HStack><Spacer modifiers={[frame({ height: 10 })]} />
  </VStack></BaseHost>
    {state.loading ? <View style={styles.center}><BaseHost matchContents><ProgressView /></BaseHost></View>
      : state.error !== null ? <View style={styles.fill}><BaseHost matchContents={{ vertical: true }} style={styles.full}><VStack spacing={16} modifiers={[padding({ horizontal: 24, vertical: 40 }), frame({ maxWidth: Infinity })]}><Text modifiers={[foregroundStyle('secondary')]}>{props.a('detail.customer_load_failed')}</Text><Button label={props.t('retry')} onPress={model.retry} modifiers={[buttonStyle('plain'), accessibilityIdentifier('admin-item-customer-retry')]} /></VStack></BaseHost></View>
        : !model.rows.length ? <View style={styles.center}><BaseHost matchContents><Text>{props.a('detail.customer_not_found')}</Text></BaseHost></View>
          : <BaseHost style={styles.fill}><List modifiers={[listStyle('plain')]}>{model.rows.map(row => <Toggle key={row.customer.ref} isOn={row.selected} onIsOnChange={value => model.toggle(row, value)} modifiers={[disabled(state.pendingRef !== null || model.closing), listRowInsets({ leading: 16, top: 8, trailing: 16, bottom: 8 }), accessibilityIdentifier(row.key)]}>
            <HStack spacing={16} modifiers={[frame({ minHeight: 56 })]}>{row.pending ? <ProgressView modifiers={[frame({ width: 40, height: 40 })]} /> : <Image systemName="building.2.fill" size={24} modifiers={[frame({ width: 40, height: 40 }), foregroundStyle(colors.onPrimaryContainer), background(colors.primaryContainer), cornerRadius(20), accessibilityHidden(true)]} />}
              <VStack alignment="leading" spacing={2} modifiers={[frame({ maxWidth: Infinity, alignment: 'leading' })]}><Text>{row.title}</Text><Text modifiers={[font({ textStyle: 'subheadline' }), foregroundStyle('secondary')]}>{row.subtitle}</Text></VStack>
            </HStack>
          </Toggle>)}</List></BaseHost>}
    <View style={{ paddingLeft: 16, paddingTop: 10, paddingRight: 16, paddingBottom: viewport.paddingBottom + 16 }}><BaseHost matchContents={{ vertical: true }} style={styles.full}><Button label={props.a('detail.done')} onPress={() => model.close(true)} modifiers={[buttonStyle('borderedProminent'), controlSize('large'), disabled(!model.doneEnabled), frame({ maxWidth: Infinity, minHeight: 56 }), accessibilityIdentifier('admin-item-customer-done')]} /></BaseHost></View>
  </View>;
}
/** @v2 _ItemCustomerPickerSheet; no native-sheet availability, activation or dismissal is inferred from React. */
export function AdminItemDetailCustomerContent(props: AdminItemDetailCustomerContentProps) {
  const model = useAdminItemDetailCustomerContent(props); if (!model.visible || !model.viewport) return null;
  return <Content key={model.lifetime.bufferIdentity} model={model} props={props} />;
}
const styles = StyleSheet.create({ full: { width: '100%' }, sheet: { width: '100%' }, fill: { flex: 1 }, center: { flex: 1, alignItems: 'center', justifyContent: 'center' } });

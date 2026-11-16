import { BottomSheet, Button, Group, HStack, Image, ProgressView, RNHostView, Spacer, Text, TextField, VStack, useNativeState } from '@expo/ui/swift-ui';
import { accessibilityIdentifier, accessibilityLabel, background, buttonStyle, controlSize, cornerRadius, disabled, font, foregroundStyle, frame, padding, presentationCornerRadius, presentationDragIndicator, textFieldStyle } from '@expo/ui/swift-ui/modifiers';
import { ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import { BaseHost } from '../components/BaseHost.ios';
import { useBaseTheme } from '../components/useBaseTheme';
import { adminItemCreatePickerRows } from './adminItemCreatePickerPresentation';
import { dartTrim } from './dartJsonString';
import type { AdminItemCreateScreenModel } from './useAdminItemCreate';

/** @v2 M3AsyncPickerSheet */
export function AdminItemCreatePicker({ model }: { model: AdminItemCreateScreenModel }) {
  const picker = model.state.picker!, state = model.state.pickerState!, query = useNativeState(state.searchDraft), { colors } = useBaseTheme(), { height: viewport } = useWindowDimensions();
  const rows = adminItemCreatePickerRows(picker), create = picker.kind === 'customer' && model.owner.needsCustomerCreate, empty = state.loading || state.error !== null || !rows.length;
  const select = (item: typeof rows[number]['item']) => { if (typeof item === 'string') model.selectPickerString(item); else model.selectCustomer(item); };
  return <BottomSheet isPresented={!state.closing} fitToContents onIsPresentedChange={visible => { if (!visible) model.dismissPicker(); }} onDismiss={model.completePicker}>
    <Group modifiers={[presentationDragIndicator('hidden'), presentationCornerRadius(32)]}><RNHostView matchContents={{ vertical: true }}><View style={{ maxHeight: viewport * .66, height: empty ? viewport * .66 : undefined, paddingHorizontal: 12, paddingTop: 12, paddingBottom: 24, backgroundColor: colors.surfaceContainerLow }}>
      <BaseHost matchContents={{ vertical: true }} style={styles.fullWidth}><VStack alignment="leading" spacing={0} modifiers={[frame({ maxWidth: Infinity, alignment: 'leading' })]}>
        <HStack modifiers={[frame({ maxWidth: Infinity, alignment: 'center' })]}><Spacer /><Text modifiers={[frame({ width: 36, height: 4 }), background(colors.outlineVariant), cornerRadius(999)]}>{''}</Text><Spacer /></HStack><Spacer modifiers={[frame({ height: 14 })]} />
        <HStack><Text modifiers={[font({ textStyle: 'title3' }), frame({ maxWidth: Infinity, alignment: 'leading' })]}>{model.a(`item.${picker.kind}_select`)}</Text>
          {create ? <Button onPress={() => model.createCustomer(true)} modifiers={[buttonStyle('plain'), disabled(state.runningEmptyAction), frame({ width: 44, height: 44 }), accessibilityLabel(model.a('user.add_customer')), accessibilityIdentifier('admin-item-create-picker-add')]}><Image systemName="plus" size={20} /></Button> : null}
          <Button onPress={model.dismissPicker} modifiers={[buttonStyle('plain'), frame({ width: 44, height: 44 }), accessibilityLabel(model.a('action.close')), accessibilityIdentifier('admin-item-create-picker-close')]}><Image systemName="xmark" size={20} /></Button>
        </HStack><Spacer modifiers={[frame({ height: 14 })]} />
        <HStack spacing={12} modifiers={[frame({ maxWidth: Infinity, minHeight: 58 }), padding({ horizontal: 18 }), background(colors.surfaceContainerHighest), cornerRadius(999)]}><Image systemName="magnifyingglass" size={26} modifiers={[foregroundStyle('secondary')]} />
          <TextField text={query} placeholder={model.a(`item.${picker.kind}_search`)} onTextChange={model.pickerSearch} modifiers={[textFieldStyle('plain'), font({ textStyle: 'body', weight: 'bold' }), accessibilityIdentifier('admin-item-create-picker-search')]} />
        </HStack><Spacer modifiers={[frame({ height: 14 })]} />
      </VStack></BaseHost>
      <ScrollView keyboardShouldPersistTaps="handled" style={[styles.scroll, { flexGrow: empty ? 1 : 0 }]} contentContainerStyle={empty ? styles.emptyBody : undefined} onScroll={event => { const { contentSize, contentOffset, layoutMeasurement } = event.nativeEvent; model.pickerScroll(contentSize.height - contentOffset.y - layoutMeasurement.height); }} scrollEventThrottle={16}>
        <BaseHost matchContents={{ vertical: true }} style={styles.fullWidth}><VStack spacing={0} modifiers={[frame({ maxWidth: Infinity })]}>
          {state.loading ? <ProgressView /> : state.error !== null ? <VStack spacing={12} modifiers={[padding({ vertical: 24 }), frame({ maxWidth: Infinity })]}><Text modifiers={[font({ textStyle: 'body' }), foregroundStyle('secondary')]}>{model.t('serverDisconnectedRetry')}</Text><Button label={model.t('retry')} onPress={model.pickerReload} modifiers={[buttonStyle('bordered'), controlSize('large'), frame({ maxWidth: Infinity, minHeight: 56 }), accessibilityIdentifier('admin-item-create-picker-retry')]} /></VStack> : !rows.length ? <VStack modifiers={[padding({ vertical: 24 }), frame({ maxWidth: Infinity })]}>
            {create && dartTrim(state.query) ? <Button onPress={() => model.createCustomer(false)} modifiers={[buttonStyle('borderedProminent'), controlSize('large'), disabled(state.runningEmptyAction), frame({ maxWidth: Infinity, minHeight: 56 }), accessibilityIdentifier('admin-item-create-picker-empty-add')]}><HStack spacing={8}>{state.runningEmptyAction ? <ProgressView /> : <Image systemName="plus" size={20} />}<Text>{model.a('user.add_customer')}</Text></HStack></Button> : <Text modifiers={[font({ textStyle: 'body' }), foregroundStyle('secondary')]}>{model.t('noRecordsYet')}</Text>}
          </VStack> : rows.map(row => <Button key={`${row.index}:${row.title}`} onPress={() => select(row.item)} modifiers={[buttonStyle('plain'), frame({ maxWidth: Infinity, alignment: 'leading' }), padding({ top: row.index ? 2 : 0 }), accessibilityIdentifier(`admin-item-create-picker-option-${row.index}`)]}>
            <VStack alignment="leading" spacing={6} modifiers={[frame({ maxWidth: Infinity, alignment: 'leading' }), padding({ horizontal: 18, vertical: 16 }), background(colors.surfaceContainerHighest), cornerRadius(16)]}><Text modifiers={[font({ textStyle: 'title3', weight: 'bold' })]}>{row.title}</Text>{row.subtitle ? <Text modifiers={[font({ textStyle: 'caption' }), foregroundStyle('secondary')]}>{row.subtitle}</Text> : null}</VStack>
          </Button>)}{!state.loading && state.error === null && rows.length && state.loadingMore ? <VStack modifiers={[padding({ vertical: 18 })]}><ProgressView /></VStack> : null}
        </VStack></BaseHost>
      </ScrollView>
    </View></RNHostView></Group>
  </BottomSheet>;
}
const styles = StyleSheet.create({ fullWidth: { width: '100%' }, scroll: { flexGrow: 0, flexShrink: 1 }, emptyBody: { flexGrow: 1, justifyContent: 'center' } });

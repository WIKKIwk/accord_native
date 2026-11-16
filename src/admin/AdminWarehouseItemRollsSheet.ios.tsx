import { BottomSheet, Button, Group, HStack, Image, List, ProgressView, ScrollView, Spacer, Text, VStack } from '@expo/ui/swift-ui';
import { accessibilityIdentifier, background, buttonStyle, cornerRadius, font, foregroundStyle, frame, lineLimit, listRowInsets, listRowSeparator, listStyle, padding, presentationDetents, presentationDragIndicator } from '@expo/ui/swift-ui/modifiers';
import { StyleSheet } from 'react-native';
import { BaseHost } from '../components/BaseHost.ios';
import { useBaseTheme } from '../components/useBaseTheme';
import { adminWarehouseMainDetailValue } from './AdminWarehouseMainRows';
import { dartTrim } from './dartJsonString';
import type { AdminWarehouseItemRollsProviderModel } from './useAdminWarehouseItemRollsProvider';

/** @v2 _WarehouseItemRollsSheet + _WarehouseItemRollRow */
export function AdminWarehouseItemRollsSheet({ model }: { model: AdminWarehouseItemRollsProviderModel }) {
  const { colors } = useBaseTheme(), value = model.presentation, details = value?.details, row = details ? model.rows.find(item => item.roll === details.roll) : null;
  if (!model.active || !value) return null;
  return <BaseHost style={styles.host}><BottomSheet key={value.id} isPresented={!value.closing} onIsPresentedChange={visible => { if (!visible) model.beginDismiss(); }} onDismiss={model.close}>
    <Group modifiers={[presentationDetents([{ fraction: .86 }]), presentationDragIndicator('visible')]}>
      <VStack alignment="leading" spacing={0} modifiers={[frame({ maxWidth: Infinity, maxHeight: Infinity }), padding({ horizontal: 16, top: 12, bottom: 8 })]}>
        <Text modifiers={[font({ textStyle: 'title2', weight: 'bold' })]}>{model.a('warehouse.rolls')}</Text>
        <Text modifiers={[font({ textStyle: 'headline' }), lineLimit(1), padding({ top: 4, bottom: 12 })]}>{dartTrim(value.item.name) ? value.item.name : value.item.code}</Text>
        {value.phase === 'loading' ? <VStack modifiers={[frame({ maxWidth: Infinity, maxHeight: Infinity })]}><Spacer /><ProgressView /><Spacer /></VStack> : value.phase === 'error' || !model.rows.length ? <VStack modifiers={[frame({ maxWidth: Infinity, maxHeight: Infinity })]}><Spacer /><Text>{model.a(value.phase === 'error' ? 'warehouse.rolls_load_failed' : 'warehouse.no_rolls')}</Text><Spacer /></VStack> :
          <List modifiers={[listStyle('plain')]}><List.ForEach data={model.rows} keyExtractor={item => item.key} estimatedItemSize={69}>{({ item }) => <Button onPress={() => model.showDetails(item.roll)}
            modifiers={[buttonStyle('plain'), accessibilityIdentifier(`warehouse-item-roll-${item.key}`), listRowSeparator('hidden'), listRowInsets({ leading: 0, trailing: 0, top: 0, bottom: 8 })]}>
            <HStack spacing={14} modifiers={[frame({ maxWidth: Infinity, minHeight: 61, alignment: 'leading' }), padding({ leading: 14, trailing: 10, vertical: 8 })]}>
              <Image systemName="receipt" size={16} modifiers={[frame({ width: 30, height: 30 }), background(colors.secondaryContainer), cornerRadius(8), foregroundStyle(colors.onSecondaryContainer)]} />
              <VStack alignment="leading" spacing={4} modifiers={[frame({ maxWidth: Infinity, alignment: 'leading' })]}><Text modifiers={[font({ textStyle: 'headline' }), lineLimit(1)]}>{item.title}</Text>
                <Text modifiers={[font({ textStyle: 'caption' }), foregroundStyle('secondary'), lineLimit(1)]}>{item.subtitle}</Text></VStack><Image systemName="chevron.right" size={14} modifiers={[foregroundStyle('secondary')]} />
            </HStack>
          </Button>}</List.ForEach></List>}
      </VStack>
      <BottomSheet key={details?.id ?? 'none'} isPresented={!!details && !details.closing} onIsPresentedChange={visible => { if (!visible && details) model.dismissDetails(details.id, false); }} onDismiss={() => { if (details) model.dismissDetails(details.id, true); }}>
        {row ? <Group modifiers={[presentationDetents([{ fraction: .72 }]), presentationDragIndicator('visible')]}><ScrollView><VStack alignment="leading" spacing={0} modifiers={[frame({ maxWidth: Infinity, alignment: 'leading' }), padding({ horizontal: 20, top: 4, bottom: 24 })]}>
          <Text modifiers={[font({ textStyle: 'title2', weight: 'heavy' }), padding({ bottom: 16 })]}>{row.title}</Text>
          {row.details.map((line, index) => <HStack key={index} alignment="top" spacing={0} modifiers={[padding({ bottom: 6 }), frame({ maxWidth: Infinity, alignment: 'leading' })]}>
            <Text modifiers={[font({ textStyle: 'caption' }), foregroundStyle('secondary'), frame({ width: 72, alignment: 'leading' })]}>{line.label}</Text><Text modifiers={[font({ textStyle: 'body' }), frame({ maxWidth: Infinity, alignment: 'leading' })]}>{adminWarehouseMainDetailValue(line.value)}</Text>
          </HStack>)}
        </VStack></ScrollView></Group> : null}
      </BottomSheet>
    </Group>
  </BottomSheet></BaseHost>;
}
const styles = StyleSheet.create({ host: { position: 'absolute', width: '100%' } });

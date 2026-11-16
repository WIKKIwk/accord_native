import { Button, Divider, HStack, Image, ProgressView, Spacer, Text, VStack } from '@expo/ui/swift-ui';
import { accessibilityIdentifier, background, buttonStyle, controlSize, cornerRadius, disabled, font, foregroundStyle, frame, multilineTextAlignment, padding, progressViewStyle } from '@expo/ui/swift-ui/modifiers';
import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { BaseHost } from '../components/BaseHost.ios';
import { useBaseTheme } from '../components/useBaseTheme';
import { AdminItemDetailHeader } from './AdminItemDetailHeader.ios';
import type { AdminItemDetailReadModel } from './AdminItemDetailReadOwner';
import type { AdminItemDetailInformationRow } from './AdminItemDetailReadPresentation';
import { useAdminItemDetailComboProductName, useAdminItemDetailComboRead, type AdminItemDetailComboReadModel } from './AdminItemDetailComboRead';
import { adminItemDetailComboImageUrl, adminItemDetailComboSize, type AdminItemDetailComboProduct } from './adminItemDetailComboPresentation';
import { adminItemDetailFinishedImageUrl } from './adminItemDetailImagePresentation';

function Section({ title, children }: { title: string; children: ReactNode }) {
  const { colors } = useBaseTheme();
  return <BaseHost matchContents={{ vertical: true }} style={styles.full}><VStack alignment="leading" spacing={0} modifiers={[frame({ maxWidth: Infinity, alignment: 'leading' }), padding({ leading: 16, top: 16, trailing: 16, bottom: 6 }), background(colors.surface), cornerRadius(20)]}><Text modifiers={[font({ textStyle: 'headline', weight: 'bold' })]}>{title}</Text><Spacer modifiers={[frame({ height: 8 })]} />{children}</VStack></BaseHost>;
}
function Row({ row }: { row: AdminItemDetailInformationRow }) {
  return <HStack alignment="top" spacing={14} modifiers={[frame({ maxWidth: Infinity }), padding({ vertical: 10 })]}><Text modifiers={[font({ textStyle: 'subheadline' }), foregroundStyle('secondary'), frame({ maxWidth: Infinity, alignment: 'leading' })]}>{row.label}</Text><Text modifiers={[font({ textStyle: 'body', weight: 'semibold' }), multilineTextAlignment('trailing'), frame({ maxWidth: Infinity, alignment: 'trailing' })]}>{row.value}</Text></HStack>;
}
function Customers({ model }: { model: AdminItemDetailReadModel }) {
  const value = model.presentation!; if (!value.customers.length) return <Row row={{ label: value.customerLabel, value: value.unassigned }} />;
  return <HStack alignment="top" spacing={14} modifiers={[frame({ maxWidth: Infinity }), padding({ vertical: 10 })]}><Text modifiers={[font({ textStyle: 'subheadline' }), foregroundStyle('secondary'), frame({ maxWidth: Infinity, alignment: 'leading' })]}>{value.customerLabel}</Text>
    <VStack alignment="trailing" spacing={6} modifiers={[frame({ maxWidth: Infinity, alignment: 'trailing' })]}>{value.customers.map((customer, index) => <VStack key={index} alignment="trailing" spacing={0}>
      <Text modifiers={[font({ textStyle: 'body', weight: 'semibold' }), multilineTextAlignment('trailing')]}>{customer.name}</Text>{customer.subtitle ? <Text modifiers={[font({ textStyle: 'caption' }), foregroundStyle('secondary'), multilineTextAlignment('trailing')]}>{customer.subtitle}</Text> : null}
    </VStack>)}</VStack>
  </HStack>;
}
function Information({ model, combo = false }: { model: AdminItemDetailReadModel; combo?: boolean }) {
  const value = model.presentation!;
  return <Section title={model.a('detail.main_info')}>{!combo && value.finishedGroup ? <Row row={value.finishedGroup} /> : null}<Row row={value.uom} /><Divider />{value.dates.map((row, index) => <Row key={index} row={row} />)}<Divider /><Customers model={model} /></Section>;
}
function Product({ combo, product, index, model }: { combo: AdminItemDetailComboReadModel; product: AdminItemDetailComboProduct; index: number; model: AdminItemDetailReadModel }) {
  const { colors } = useBaseTheme(), name = useAdminItemDetailComboProductName(combo, product); if (!name || name.phase === 'invalidated') return null;
  return <HStack spacing={12} modifiers={[frame({ maxWidth: Infinity }), padding({ vertical: 10 }), accessibilityIdentifier(`admin-combo-component-${index}`)]}>
    <Text modifiers={[font({ textStyle: 'subheadline', weight: 'bold' }), foregroundStyle(colors.onSecondaryContainer), frame({ width: 34, height: 34 }), background(colors.secondaryContainer), cornerRadius(11)]}>{String(index + 1)}</Text>
    <VStack alignment="leading" spacing={3} modifiers={[frame({ maxWidth: Infinity, alignment: 'leading' })]}><Text modifiers={[font({ textStyle: 'body', weight: 'semibold' })]}>{name.name ?? (name.phase === 'loading' ? model.t('loading') : model.a('calculate.combo_product_unnamed'))}</Text><Text modifiers={[font({ textStyle: 'caption' }), foregroundStyle('secondary')]}>{adminItemDetailComboSize(product)}</Text></VStack>
  </HStack>;
}
function Combo({ model }: { model: AdminItemDetailReadModel }) {
  const combo = useAdminItemDetailComboRead(model.context, model.state.detail!.code), { state } = combo;
  if (state.phase === 'invalidated') return null;
  return <ScrollView style={styles.fill} contentContainerStyle={styles.list}><AdminItemDetailHeader model={model} imageUrl={adminItemDetailComboImageUrl(state.imageEntry)} /><View style={styles.gap} /><Section title={model.a('calculate.combo_components')}>
    {state.phase === 'loading' ? <ProgressView modifiers={[progressViewStyle('linear'), frame({ maxWidth: Infinity }), padding({ vertical: 12 })]} />
      : state.phase === 'unavailable' || state.phase === 'error' ? <Button onPress={combo.retry} modifiers={[buttonStyle('plain'), disabled(state.phase === 'unavailable'), padding({ bottom: 10 })]}><HStack spacing={8}><Image systemName="arrow.clockwise" size={18} /><Text>{model.a('calculate.combo_load_failed')}</Text></HStack></Button>
        : !state.entry?.template.products.length ? <Text modifiers={[padding({ vertical: 10 })]}>{model.a('calculate.combo_products_empty')}</Text>
          : state.entry.template.products.map((product, index) => <VStack key={index} spacing={0} modifiers={[frame({ maxWidth: Infinity })]}>{index ? <Divider /> : null}<Product combo={combo} product={product} index={index} model={model} /></VStack>)}
  </Section><View style={styles.gap} /><Information model={model} combo /></ScrollView>;
}
export function AdminItemDetailBody({ model }: { model: AdminItemDetailReadModel }) {
  const value = model.presentation; if (!value || !model.state.detail) return null;
  if (value.kind === 'combo') return <Combo model={model} />;
  if (value.kind === 'finished') return <ScrollView style={styles.fill} contentContainerStyle={styles.list}><AdminItemDetailHeader model={model} imageUrl={adminItemDetailFinishedImageUrl(model.context.session.baseUrl, model.state.detail)} /><View style={styles.gap} /><Information model={model} /></ScrollView>;
  return <ScrollView style={styles.fill} contentContainerStyle={styles.list}><AdminItemDetailHeader model={model} /><View style={styles.gap} /><Section title={model.a('detail.main_info')}>
    {value.ordinaryRows.map((row, index) => <Row key={index} row={row} />)}<Button onPress={() => model.dispatch('group')} modifiers={[buttonStyle('bordered'), controlSize('large'), disabled(!value.groupEnabled), frame({ maxWidth: Infinity, minHeight: 56 }), padding({ bottom: 10 }), accessibilityIdentifier('admin-item-detail-change-group')]}><HStack spacing={8}>{value.groupBusy ? <ProgressView /> : <Image systemName="point.3.connected.trianglepath.dotted" size={18} />}<Text>{value.groupLabel}</Text></HStack></Button><Row row={value.uom} />
  </Section><View style={styles.gap} /><Section title={model.a('detail.system_info')}>{value.dates.map((row, index) => <Row key={index} row={row} />)}</Section><View style={styles.gap} />
    <Section title={model.a('detail.item_delete_title')}><Text modifiers={[font({ textStyle: 'subheadline' }), foregroundStyle('secondary'), padding({ bottom: 12 })]}>{model.a('detail.delete_description')}</Text><Button role="destructive" onPress={() => model.dispatch('delete')} modifiers={[buttonStyle('bordered'), controlSize('large'), disabled(!value.deleteEnabled), frame({ maxWidth: Infinity, minHeight: 56 }), padding({ bottom: 10 }), accessibilityIdentifier('admin-item-detail-delete')]}><HStack spacing={8}>{value.deleteBusy ? <ProgressView /> : <Image systemName="trash.fill" size={18} />}<Text>{value.deleteLabel}</Text></HStack></Button></Section>
  </ScrollView>;
}
const styles = StyleSheet.create({ fill: { flex: 1 }, full: { width: '100%' }, list: { paddingLeft: 8, paddingTop: 8, paddingRight: 8, paddingBottom: 120 }, gap: { height: 10 } });

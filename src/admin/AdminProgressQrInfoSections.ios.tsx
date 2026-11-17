import { HStack, Image, Text, VStack } from '@expo/ui/swift-ui';
import { accessibilityHidden, accessibilityIdentifier, background, cornerRadius, font, foregroundStyle, frame, padding, textSelection } from '@expo/ui/swift-ui/modifiers';
import { StyleSheet } from 'react-native';
import { BaseHost } from '../components/BaseHost.ios';
import { useBaseTheme } from '../components/useBaseTheme';
import type { AdminProgressQrInfoSection, AdminProgressQrOrderDetailsProps, AdminProgressQrQueueStatesProps } from './AdminProgressQrInfoSectionsTypes';
import { adminProgressQrOrderDetailsModel, adminProgressQrQueueStatesModel } from './adminProgressQrInfoSectionModel';

/** @v2 _InfoSection / _InfoRow */
export function AdminProgressQrInfoSectionCard({ section }: { section: AdminProgressQrInfoSection | null }) {
  const { colors } = useBaseTheme(); if (!section) return null;
  return <BaseHost matchContents={{ vertical: true }} style={styles.card}><VStack alignment="leading" spacing={12}
    modifiers={[frame({ maxWidth: Infinity, alignment: 'leading' }), padding({ all: 16 }), background(colors.surfaceContainerHighest), cornerRadius(12), accessibilityIdentifier(`admin-qr-info-${section.id}`)]}>
    <Text modifiers={[font({ textStyle: 'headline', weight: 'heavy' }), foregroundStyle(colors.onSurface)]}>{section.title}</Text>
    <VStack alignment="leading" spacing={0} modifiers={[frame({ maxWidth: Infinity, alignment: 'leading' })]}>{'rows' in section ? section.rows.map(row => <VStack key={row.id} alignment="leading" spacing={3}
      modifiers={[frame({ maxWidth: Infinity, alignment: 'leading' }), padding({ bottom: 10 }), accessibilityIdentifier(`admin-qr-info-${section.id}-${row.id}`)]}>
      <Text modifiers={[font({ textStyle: 'subheadline', weight: 'bold' }), foregroundStyle('secondary')]}>{row.label}</Text>
      <Text modifiers={[font({ textStyle: 'body', weight: 'bold' }), foregroundStyle(colors.onSurface), textSelection(true)]}>{row.value}</Text>
    </VStack>) : section.lines.map((line, index) => <HStack key={index} alignment="top" spacing={10} modifiers={[frame({ maxWidth: Infinity, alignment: 'leading' }), padding({ bottom: 10 }), accessibilityIdentifier(`admin-qr-info-${section.id}-${index}`)]}>
      <Image systemName="circle.fill" size={7} modifiers={[foregroundStyle(colors.primary), padding({ top: 8 }), accessibilityHidden()]} />
      <Text modifiers={[font({ textStyle: 'body', weight: 'bold' }), foregroundStyle(colors.onSurface), textSelection(true), frame({ maxWidth: Infinity, alignment: 'leading' })]}>{line}</Text>
    </HStack>)}</VStack>
  </VStack></BaseHost>;
}
/** @v2 _OrderDetailsSection */
export function AdminProgressQrOrderDetails(props: AdminProgressQrOrderDetailsProps) { return <AdminProgressQrInfoSectionCard section={adminProgressQrOrderDetailsModel(props)} />; }
/** @v2 _QueueStatesSection */
export function AdminProgressQrQueueStates(props: AdminProgressQrQueueStatesProps) { return <AdminProgressQrInfoSectionCard section={adminProgressQrQueueStatesModel(props)} />; }
const styles = StyleSheet.create({ card: { width: '100%', marginBottom: 12 } });

import { DisclosureGroup, Text, VStack } from '@expo/ui/swift-ui';
import { accessibilityIdentifier, background, cornerRadius, font, foregroundStyle, frame, padding, textSelection } from '@expo/ui/swift-ui/modifiers';
import { StyleSheet } from 'react-native';
import { BaseHost } from '../components/BaseHost.ios';
import { useBaseTheme } from '../components/useBaseTheme';
import type { AdminProgressQrTechnicalMaterialProps } from './AdminProgressQrTechnicalMaterialTypes';
import { useAdminProgressQrTechnicalMaterial } from './useAdminProgressQrTechnicalMaterial';

/** @v2 _TechnicalRawMaterialSection / _InfoRow */
export function AdminProgressQrTechnicalMaterial(props: AdminProgressQrTechnicalMaterialProps) {
  const model = useAdminProgressQrTechnicalMaterial(props), { colors } = useBaseTheme(); if (!model.visible) return null;
  return <BaseHost matchContents={{ vertical: true }} style={styles.card}><VStack alignment="leading" spacing={0} modifiers={[frame({ maxWidth: Infinity, alignment: 'leading' }), padding({ all: 16 }), background(colors.surfaceContainerHighest), cornerRadius(12)]}>
    <DisclosureGroup isExpanded={model.expanded} onIsExpandedChange={model.setExpanded} modifiers={[accessibilityIdentifier('admin-qr-material-technical-toggle')]}><DisclosureGroup.Label><Text modifiers={[font({ textStyle: 'headline', weight: 'heavy' })]}>{model.title}</Text></DisclosureGroup.Label>
      {model.expanded ? <VStack alignment="leading" spacing={0} modifiers={[frame({ maxWidth: Infinity, alignment: 'leading' }), accessibilityIdentifier('admin-qr-material-technical-rows')]}>{model.rows.map(row => <VStack key={row.id} alignment="leading" spacing={3} modifiers={[frame({ maxWidth: Infinity, alignment: 'leading' }), padding({ bottom: 10 }), accessibilityIdentifier(`admin-qr-material-${row.id}`)]}>
        <Text modifiers={[font({ textStyle: 'subheadline', weight: 'bold' }), foregroundStyle('secondary')]}>{row.label}</Text><Text modifiers={[font({ textStyle: 'body', weight: 'bold' }), textSelection(true)]}>{row.value}</Text>
      </VStack>)}</VStack> : null}
    </DisclosureGroup>
  </VStack></BaseHost>;
}
const styles = StyleSheet.create({ card: { width: '100%', marginBottom: 12 } });

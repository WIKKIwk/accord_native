import { Button, HStack, Image, ScrollView, Spacer, Text, VStack } from '@expo/ui/swift-ui';
import { accessibilityHidden, accessibilityIdentifier, buttonStyle, disabled, font, foregroundStyle, frame, padding } from '@expo/ui/swift-ui/modifiers';
import { StyleSheet } from 'react-native';
import { BaseHost } from '../components/BaseHost.ios';
import { useBaseTheme } from '../components/useBaseTheme';
import type { AdminItemDetailActionMenuContentProps } from './AdminItemDetailActionMenuContentTypes';
import { useAdminItemDetailActionMenuContent } from './useAdminItemDetailActionMenuContent';

const icons = { rename: 'pencil', customers: 'person.2', group: 'point.3.connected.trianglepath.dotted', delete: 'trash' } as const;
/** @v2 _ItemDetailActionsSheet; actual SwiftUI controls keep all four locked-combo actions in their original order. */
export function AdminItemDetailActionMenuContent(props: AdminItemDetailActionMenuContentProps) {
  const model = useAdminItemDetailActionMenuContent(props), { colors } = useBaseTheme(); if (!model.visible) return null;
  return <BaseHost matchContents={{ vertical: true }} style={styles.width}><ScrollView><VStack alignment="leading" spacing={0} modifiers={[frame({ maxWidth: Infinity, alignment: 'leading' }), padding({ leading: 20, trailing: 20, bottom: 16 })]}>
    <Text modifiers={[font({ textStyle: 'title2', weight: 'bold' })]}>{model.title}</Text>
    {model.message !== null ? <><Spacer modifiers={[frame({ height: 8 })]} /><Text modifiers={[foregroundStyle(colors.onSurfaceVariant)]}>{model.message}</Text></> : null}
    <Spacer modifiers={[frame({ height: 12 })]} />
    {model.rows.map(row => <Button key={row.key} onPress={() => model.choose(row.action)} modifiers={[buttonStyle('plain'), disabled(!row.enabled || model.closing), accessibilityIdentifier(row.key)]}>
      <HStack spacing={16} modifiers={[frame({ maxWidth: Infinity, minHeight: 56, alignment: 'leading' }), padding({ leading: 16, trailing: 16 })]}>
        <Image systemName={icons[row.action]} size={24} modifiers={[accessibilityHidden(true)]} /><Text modifiers={[font({ textStyle: 'body', weight: 'regular' }), frame({ maxWidth: Infinity, alignment: 'leading' })]}>{row.label}</Text>
      </HStack>
    </Button>)}
  </VStack></ScrollView></BaseHost>;
}
const styles = StyleSheet.create({ width: { width: '100%' } });

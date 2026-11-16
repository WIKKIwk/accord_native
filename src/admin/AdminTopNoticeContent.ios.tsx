import { HStack, Image, Spacer, Text } from '@expo/ui/swift-ui';
import { accessibilityHidden, background, font, foregroundStyle, frame, padding } from '@expo/ui/swift-ui/modifiers';
import { StyleSheet } from 'react-native';
import { BaseHost } from '../components/BaseHost.ios';
import { useBaseTheme } from '../components/useBaseTheme';
import type { AdminTopNoticeContentProps } from './AdminTopNoticeTypes';
import { adminTopNoticeColors } from './adminTopNoticeModel';

/** Native SwiftUI body adapts Source's noninteractive MaterialBanner content. */
export function AdminTopNoticeContent({ banner }: AdminTopNoticeContentProps) {
  const colors = adminTopNoticeColors(banner.tone), theme = useBaseTheme();
  return <BaseHost matchContents={{ vertical: true }} style={styles.fullWidth}><HStack spacing={0} modifiers={[frame({ maxWidth: Infinity }), padding({ leading: 16, top: 12, trailing: 16, bottom: 12 }), background(colors.background)]}>
    {banner.icon ? <><Image systemName={banner.icon.iosSystemName} size={24} modifiers={[foregroundStyle(theme.colors.onSurface), accessibilityHidden(true)]} /><Spacer modifiers={[frame({ width: 16 })]} /></> : null}
    <Text modifiers={[font({ textStyle: 'subheadline', weight: 'regular' }), foregroundStyle(colors.foreground), frame({ maxWidth: Infinity, alignment: 'leading', minHeight: 20 })]}>{banner.message}</Text>
    <Spacer modifiers={[frame({ width: 16 })]} />
  </HStack></BaseHost>;
}
const styles = StyleSheet.create({ fullWidth: { width: '100%' } });

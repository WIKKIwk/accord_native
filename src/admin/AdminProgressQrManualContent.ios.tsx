import { Button, HStack, Spacer, Text, TextField, VStack } from '@expo/ui/swift-ui';
import { accessibilityIdentifier, background, buttonStyle, controlSize, cornerRadius, disabled, font, frame, onSubmit, padding, submitLabel, textFieldStyle, textInputAutocapitalization } from '@expo/ui/swift-ui/modifiers';
import { StyleSheet } from 'react-native';
import { BaseHost } from '../components/BaseHost.ios';
import { useBaseTheme } from '../components/useBaseTheme';
import type { AdminProgressQrManualContentProps } from './AdminProgressQrManualContentTypes';
import { useAdminProgressQrManualContent } from './AdminProgressQrManualContentOwner';

/** @v2 _showManualQrDialog
 * SwiftUI content keeps the page's original native text object through cancellation/reopening. */
export function AdminProgressQrManualContent(props: AdminProgressQrManualContentProps) {
  const model = useAdminProgressQrManualContent(props), { colors } = useBaseTheme(); if (!model.visible) return null;
  return <BaseHost matchContents={{ vertical: true }} style={styles.width}><VStack alignment="leading" spacing={0} modifiers={[frame({ maxWidth: Infinity, alignment: 'leading' }), padding({ horizontal: 24, vertical: 24 }), background(colors.surfaceContainerHigh), cornerRadius(28)]}>
    <Text modifiers={[font({ textStyle: 'title2', weight: 'bold' }), padding({ bottom: 16 })]}>{model.title}</Text><Text modifiers={[font({ textStyle: 'subheadline' }), padding({ bottom: 4 })]}>{model.label}</Text>
    <TextField text={props.buffer} autoFocus placeholder={model.hint} modifiers={[textFieldStyle('roundedBorder'), textInputAutocapitalization('never'), submitLabel('done'), onSubmit(model.lifetime.submitBuffer), disabled(model.closing), accessibilityIdentifier('admin-progress-qr-manual-input')]} />
    <HStack spacing={8} modifiers={[frame({ maxWidth: Infinity, alignment: 'trailing' }), padding({ top: 24 })]}><Spacer /><Button label={model.cancelLabel} onPress={model.lifetime.cancel} modifiers={[buttonStyle('plain'), disabled(model.closing), frame({ minHeight: 44 }), accessibilityIdentifier('admin-progress-qr-manual-cancel')]} /><Button label={model.verifyLabel} onPress={model.lifetime.submitBuffer} modifiers={[buttonStyle('borderedProminent'), controlSize('large'), disabled(model.closing), frame({ minHeight: 56 }), accessibilityIdentifier('admin-progress-qr-manual-verify')]} /></HStack>
  </VStack></BaseHost>;
}
const styles = StyleSheet.create({ width: { width: '100%' } });

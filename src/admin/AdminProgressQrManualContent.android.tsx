import { Button, Column, Row, Spacer, Surface, TextButton } from '@expo/ui/jetpack-compose';
import { defaultMinSize, fillMaxWidth, height, padding, size, testID } from '@expo/ui/jetpack-compose/modifiers';
import { StyleSheet } from 'react-native';
import { BaseHost } from '../components/BaseHost.android';
import { useBaseTheme } from '../components/useBaseTheme';
import { AdminText as Text } from './AdminTypography.android';
import { DecisionField, decisionRounded } from './AdminItemDetailDecisionNative.android';
import type { AdminProgressQrManualContentProps } from './AdminProgressQrManualContentTypes';
import { useAdminProgressQrManualContent } from './AdminProgressQrManualContentOwner';

/** @v2 _showManualQrDialog
 * Native CONTENT only. The real dialog host supplies Source barrier/back/insets and actual close completion. */
export function AdminProgressQrManualContent(props: AdminProgressQrManualContentProps) {
  const model = useAdminProgressQrManualContent(props), { colors } = useBaseTheme(); if (!model.visible) return null;
  return <BaseHost matchContents={{ vertical: true }} style={styles.width}><Surface color={colors.surfaceContainerHigh} shape={decisionRounded(28)}><Column modifiers={[fillMaxWidth(), padding(24, 24, 24, 24)]}>
    <Text style={{ typography: 'headlineSmall', fontSize: 24, fontWeight: '400' }}>{model.title}</Text><Spacer modifiers={[height(16)]} />
    <DecisionField value={props.buffer} autoFocus singleLine enabled={!model.closing} shape={decisionRounded(16)} textStyle={{ fontSize: 16, fontWeight: '400' }}
      keyboardOptions={{ imeAction: 'done', capitalization: 'none' }} keyboardActions={{ onDone: model.lifetime.submitValue }} modifiers={[fillMaxWidth(), testID('admin-progress-qr-manual-input')]}>
      <DecisionField.Label><Text style={{ fontSize: 14 }}>{model.label}</Text></DecisionField.Label><DecisionField.Placeholder><Text color={colors.onSurfaceVariant} style={{ fontSize: 15 }}>{model.hint}</Text></DecisionField.Placeholder>
    </DecisionField><Spacer modifiers={[height(24)]} />
    <Row horizontalArrangement="end" verticalAlignment="center" modifiers={[fillMaxWidth()]}><TextButton enabled={!model.closing} onClick={model.lifetime.cancel} modifiers={[testID('admin-progress-qr-manual-cancel')]}><Text style={{ fontSize: 16, fontWeight: '500' }}>{model.cancelLabel}</Text></TextButton><Spacer modifiers={[size(8, 1)]} />
      <Button enabled={!model.closing} onClick={model.lifetime.submitBuffer} shape={decisionRounded(20)} modifiers={[defaultMinSize({ minHeight: 56 }), testID('admin-progress-qr-manual-verify')]}><Text style={{ fontSize: 16, fontWeight: '500' }}>{model.verifyLabel}</Text></Button>
    </Row>
  </Column></Surface></BaseHost>;
}
const styles = StyleSheet.create({ width: { width: '100%' } });

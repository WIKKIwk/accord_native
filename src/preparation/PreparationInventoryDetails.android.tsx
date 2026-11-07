import { Box, Button, Column, Host, OutlinedButton, Row, Text, TextButton, useMaterialColors } from '@expo/ui/jetpack-compose';
import { background, clip, defaultMinSize, fillMaxWidth, padding, Shapes, testID, weight } from '@expo/ui/jetpack-compose/modifiers';
import { usePreparationText } from './PreparationUI.android';

export function InventorySheetSummary({ title, quantity, status, caption }: {
  title: string; quantity: string; status: string; caption?: string;
}) {
  const colors = useMaterialColors();
  return <Host matchContents={{ vertical: true }} style={{ width: '100%' }}>
    <Column verticalArrangement={{ spacedBy: 8 }} modifiers={[fillMaxWidth()]}>
      {caption ? <Text color={colors.onSurfaceVariant} style={{ typography: 'labelLarge' }}>{caption}</Text> : null}
      <Text color={colors.onSurface} style={{ typography: 'titleLarge' }}>{title}</Text>
      <Row verticalAlignment="center" horizontalArrangement={{ spacedBy: 16 }} modifiers={[fillMaxWidth()]}>
        <Text color={colors.onSurface} style={{ typography: 'headlineSmall' }} modifiers={[weight(1)]}>{quantity}</Text>
        <Box modifiers={[clip(Shapes.RoundedCorner(16)), background(colors.secondaryContainer), padding(10, 4, 10, 4)]}>
          <Text color={colors.onSecondaryContainer} style={{ typography: 'labelLarge' }}>{status}</Text>
        </Box>
      </Row>
    </Column>
  </Host>;
}

export function InventoryDetailRow({ label, value, stacked = false }: { label: string; value: string; stacked?: boolean }) {
  const colors = useMaterialColors(), t = usePreparationText();
  return <Host matchContents={{ vertical: true }} style={{ width: '100%' }}>
    {stacked ? <Column verticalArrangement={{ spacedBy: 4 }} modifiers={[fillMaxWidth()]}>
      <Text color={colors.onSurfaceVariant} style={{ typography: 'labelMedium' }}>{t(label)}</Text>
      <Text color={colors.onSurfaceVariant} style={{ typography: 'bodySmall' }}>{value || '—'}</Text>
    </Column> : <Row verticalAlignment="top" horizontalArrangement={{ spacedBy: 16 }} modifiers={[fillMaxWidth(), padding(0, 6, 0, 6)]}>
      <Text color={colors.onSurfaceVariant} style={{ typography: 'bodyMedium' }} modifiers={[weight(1)]}>{t(label)}</Text>
      <Text color={colors.onSurface} style={{ typography: 'bodyMedium', textAlign: 'end' }} modifiers={[weight(2)]}>{value || '—'}</Text>
    </Row>}
  </Host>;
}

export function InventorySheetButton({ label, onPress, disabled, kind = 'primary', id }: {
  label: string; onPress: () => void; disabled?: boolean; kind?: 'primary' | 'outlined' | 'text'; id?: string;
}) {
  const t = usePreparationText();
  const Component = kind === 'outlined' ? OutlinedButton : kind === 'text' ? TextButton : Button;
  return <Host matchContents={{ vertical: true }} style={{ width: '100%' }}>
    <Component enabled={!disabled} onClick={onPress}
      modifiers={[fillMaxWidth(), defaultMinSize({ minHeight: 48 }), ...(id ? [testID(id)] : [])]}>
      <Text>{t(label)}</Text>
    </Component>
  </Host>;
}
